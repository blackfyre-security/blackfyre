"""
Prowler Scanner Lambda Handler

Executes Prowler CLI against a customer AWS account and uploads
OCSF JSON results to S3. This handler is a dumb executor —
all business logic lives in the Node.js API layer.

SECURITY:
- subprocess.run with shell=False (no command injection)
- Input validation on all fields
- Credentials resolved via STS AssumeRole (never passed directly)
- S3 uploads use SSE-S3 encryption
- /tmp cleaned up after every execution
"""

import json
import os
import re
import shutil
import subprocess
import time
import uuid
from datetime import datetime
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

# Validation patterns
SCAN_ID_RE = re.compile(r"^[a-f0-9\-]{36}$")
ROLE_ARN_RE = re.compile(r"^arn:aws:iam::\d{12}:role/blackfyre-.+$")
BUCKET_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9]$")
SAFE_SERVICE_RE = re.compile(r"^[a-z0-9_]+$")

# Subprocess timeout: 14 minutes (Lambda has 15 min, leave 1 min buffer)
PROWLER_TIMEOUT = 840

s3_client = boto3.client("s3")


def handler(event, context):
    """Lambda entry point."""
    start_time = time.time()
    scan_id = None
    output_dir = None

    try:
        # --- Input Validation ---
        scan_id = event.get("scanId", "")
        role_arn = event.get("roleArn", "")
        frameworks = event.get("frameworks", [])
        output_bucket = event.get("outputBucket", "")
        s3_prefix = event.get("s3Prefix", "")
        services = event.get("services", [])

        if not SCAN_ID_RE.match(scan_id):
            raise ValueError(f"Invalid scanId format: {scan_id}")
        if not ROLE_ARN_RE.match(role_arn):
            raise ValueError(f"Invalid roleArn format — must match blackfyre-* pattern")
        if not BUCKET_NAME_RE.match(output_bucket):
            raise ValueError(f"Invalid bucket name: {output_bucket}")

        # Validate services list
        if services:
            for svc in services:
                if not isinstance(svc, str) or not SAFE_SERVICE_RE.match(svc):
                    raise ValueError(f"Invalid service name: {svc}")

        # --- Build Prowler CLI args ---
        output_dir = f"/tmp/prowler-{scan_id}"
        os.makedirs(output_dir, exist_ok=True)

        cmd = [
            "prowler", "aws",
            "--role", role_arn,
            "--output-formats", "json-ocsf",
            "--output-path", output_dir,
        ]

        # Add services filter if specified
        if services:
            cmd.extend(["--services"] + services)

        # Add compliance framework filter if specified
        if frameworks:
            for fw in frameworks:
                if isinstance(fw, str) and SAFE_SERVICE_RE.match(fw):
                    cmd.extend(["--compliance", fw])

        print(f"[prowler-scanner] Starting scan {scan_id} with role {role_arn}")
        print(f"[prowler-scanner] Command: {' '.join(cmd)}")

        # --- Execute Prowler (shell=False for security) ---
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=PROWLER_TIMEOUT,
            shell=False,
        )

        duration = round(time.time() - start_time, 2)
        print(f"[prowler-scanner] Prowler exited with code {result.returncode} in {duration}s")

        if result.returncode != 0:
            print(f"[prowler-scanner] stderr: {result.stderr[:2000]}")

        # --- Find and upload results ---
        results_files = list(Path(output_dir).glob("*.ocsf.json"))
        finding_count = 0

        if results_files:
            # Merge all OCSF files into one
            all_findings = []
            for f in results_files:
                try:
                    data = json.loads(f.read_text())
                    if isinstance(data, list):
                        all_findings.extend(data)
                    elif isinstance(data, dict):
                        all_findings.append(data)
                except (json.JSONDecodeError, IOError) as e:
                    print(f"[prowler-scanner] Error reading {f}: {e}")

            finding_count = len(all_findings)

            # Upload merged results with encryption
            s3_client.put_object(
                Bucket=output_bucket,
                Key=f"{s3_prefix}/results.json",
                Body=json.dumps(all_findings),
                ContentType="application/json",
                ServerSideEncryption="AES256",
            )

        # --- Write status file ---
        status = {
            "status": "complete",
            "findingCount": finding_count,
            "duration": duration,
            "returnCode": result.returncode,
        }

        s3_client.put_object(
            Bucket=output_bucket,
            Key=f"{s3_prefix}/status.json",
            Body=json.dumps(status),
            ContentType="application/json",
            ServerSideEncryption="AES256",
        )

        print(f"[prowler-scanner] Scan {scan_id} complete: {finding_count} findings in {duration}s")
        return {"statusCode": 200, "body": json.dumps(status)}

    except subprocess.TimeoutExpired:
        duration = round(time.time() - start_time, 2)
        _write_error_status(event, scan_id, "Prowler timed out", duration)
        return {"statusCode": 504, "body": "Prowler scan timed out"}

    except Exception as e:
        duration = round(time.time() - start_time, 2)
        error_msg = str(e)[:1000]
        print(f"[prowler-scanner] Error: {error_msg}")
        _write_error_status(event, scan_id, error_msg, duration)
        return {"statusCode": 500, "body": error_msg}

    finally:
        # --- Always clean up /tmp ---
        if output_dir and os.path.exists(output_dir):
            shutil.rmtree(output_dir, ignore_errors=True)


def _write_error_status(event, scan_id, error, duration):
    """Write error status to S3 so the polling agent knows the scan failed."""
    try:
        output_bucket = event.get("outputBucket", "")
        s3_prefix = event.get("s3Prefix", "")
        if output_bucket and s3_prefix:
            s3_client.put_object(
                Bucket=output_bucket,
                Key=f"{s3_prefix}/status.json",
                Body=json.dumps({
                    "status": "error",
                    "error": error,
                    "duration": duration,
                }),
                ContentType="application/json",
                ServerSideEncryption="AES256",
            )
    except Exception as e:
        print(f"[prowler-scanner] Failed to write error status: {e}")
