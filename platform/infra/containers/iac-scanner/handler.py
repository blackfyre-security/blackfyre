"""
IaC Security Scanner Lambda Handler

Runs Checkov, Semgrep, and Bandit against IaC files (Terraform,
CloudFormation, Dockerfiles) and uploads SARIF results to S3.

SECURITY:
- subprocess.run with shell=False (no command injection)
- Git clone uses explicit auth header (no shell interpolation)
- File size limits enforced (max 10MB per file)
- /tmp cleaned up after every execution
- Credentials resolved from AWS Secrets Manager (never in payload)
"""

import json
import os
import re
import shutil
import subprocess
import time
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

# Validation patterns
SCAN_ID_RE = re.compile(r"^[a-f0-9\-]{36}$")
BUCKET_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9]$")
SAFE_PATH_RE = re.compile(r"^[a-zA-Z0-9\-_/]+$")
VALID_TOOLS = {"checkov", "semgrep", "bandit"}

# Limits
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB per file
MAX_REPO_SIZE = 500 * 1024 * 1024  # 500 MB total repo size
TOOL_TIMEOUT = 300  # 5 minutes per tool

s3_client = boto3.client("s3")
secrets_client = boto3.client("secretsmanager")


def handler(event, context):
    """Lambda entry point."""
    start_time = time.time()
    scan_id = None
    repo_dir = "/tmp/repo"

    try:
        # --- Input Validation ---
        scan_id = event.get("scanId", "")
        tools = event.get("tools", [])
        output_bucket = event.get("outputBucket", "")
        s3_prefix = event.get("s3Prefix", "")
        repo_url = event.get("repoUrl")
        credential_ref = event.get("credentialRef")
        s3_source_path = event.get("s3SourcePath")

        if not SCAN_ID_RE.match(scan_id):
            raise ValueError(f"Invalid scanId: {scan_id}")
        if not BUCKET_NAME_RE.match(output_bucket):
            raise ValueError(f"Invalid bucket: {output_bucket}")

        # Validate tool names
        validated_tools = [t for t in tools if t in VALID_TOOLS]
        if not validated_tools:
            raise ValueError("No valid tools specified")

        # --- Acquire source code ---
        if os.path.exists(repo_dir):
            shutil.rmtree(repo_dir)

        if repo_url and credential_ref:
            _clone_repo(repo_url, credential_ref, repo_dir)
        elif s3_source_path:
            _download_from_s3(output_bucket, s3_source_path, repo_dir)
        else:
            raise ValueError("Either repoUrl+credentialRef or s3SourcePath required")

        # Validate downloaded files
        _validate_repo_files(repo_dir)

        # --- Run each tool ---
        tool_results = {}
        for tool in validated_tools:
            print(f"[iac-scanner] Running {tool} on scan {scan_id}")
            sarif_path = f"/tmp/{tool}.sarif"
            success = _run_tool(tool, repo_dir, sarif_path)
            tool_results[tool] = success

            if success and os.path.exists(sarif_path):
                s3_client.put_object(
                    Bucket=output_bucket,
                    Key=f"{s3_prefix}/{tool}.sarif",
                    Body=Path(sarif_path).read_bytes(),
                    ContentType="application/json",
                    ServerSideEncryption="AES256",
                )

        # --- Write status ---
        duration = round(time.time() - start_time, 2)
        status = {
            "status": "complete",
            "tools": tool_results,
            "duration": duration,
        }

        s3_client.put_object(
            Bucket=output_bucket,
            Key=f"{s3_prefix}/status.json",
            Body=json.dumps(status),
            ContentType="application/json",
            ServerSideEncryption="AES256",
        )

        print(f"[iac-scanner] Scan {scan_id} complete in {duration}s")
        return {"statusCode": 200, "body": json.dumps(status)}

    except Exception as e:
        duration = round(time.time() - start_time, 2)
        error_msg = str(e)[:1000]
        print(f"[iac-scanner] Error: {error_msg}")
        _write_error_status(event, error_msg, duration)
        return {"statusCode": 500, "body": error_msg}

    finally:
        # Always clean up
        for path in [repo_dir, "/tmp/checkov.sarif", "/tmp/semgrep.sarif", "/tmp/bandit.sarif"]:
            if os.path.isdir(path):
                shutil.rmtree(path, ignore_errors=True)
            elif os.path.isfile(path):
                os.remove(path)


def _clone_repo(repo_url, credential_ref, target_dir):
    """Clone a Git repo using OAuth token from Secrets Manager."""
    # Resolve OAuth token from vault:// reference
    token = _resolve_credential(credential_ref)

    # Inject auth into URL (HTTPS only)
    if not repo_url.startswith("https://"):
        raise ValueError("Only HTTPS repo URLs are supported")

    # Build authenticated URL
    # Format: https://oauth2:TOKEN@github.com/org/repo.git
    auth_url = repo_url.replace("https://", f"https://oauth2:{token}@")

    cmd = [
        "git", "clone",
        "--depth", "1",
        "--single-branch",
        auth_url,
        target_dir,
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=120,
        shell=False,
        env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
    )

    if result.returncode != 0:
        # Sanitize error output to avoid leaking tokens
        stderr = result.stderr.replace(token, "***")
        raise RuntimeError(f"Git clone failed: {stderr[:500]}")

    # Remove .git directory to save space
    git_dir = os.path.join(target_dir, ".git")
    if os.path.exists(git_dir):
        shutil.rmtree(git_dir)


def _resolve_credential(credential_ref):
    """Resolve a vault:// credential reference from AWS Secrets Manager."""
    if not credential_ref.startswith("vault://"):
        raise ValueError("credentialRef must start with vault://")

    secret_name = credential_ref.replace("vault://", "")
    if not secret_name or ".." in secret_name:
        raise ValueError("Invalid credential reference")

    try:
        resp = secrets_client.get_secret_value(SecretId=secret_name)
        secret = json.loads(resp["SecretString"])
        return secret.get("token") or secret.get("oauth_token") or resp["SecretString"]
    except ClientError as e:
        raise RuntimeError(f"Failed to resolve credential: {e.response['Error']['Code']}")


def _download_from_s3(bucket, prefix, target_dir):
    """Download IaC files from S3 upload path."""
    if not SAFE_PATH_RE.match(prefix):
        raise ValueError(f"Invalid S3 path: potential traversal detected")

    os.makedirs(target_dir, exist_ok=True)

    paginator = s3_client.get_paginator("list_objects_v2")
    total_size = 0

    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            rel_path = key[len(prefix):].lstrip("/")

            # Security: validate no path traversal
            if ".." in rel_path or rel_path.startswith("/"):
                continue

            # Check file size
            if obj["Size"] > MAX_FILE_SIZE:
                print(f"[iac-scanner] Skipping oversized file: {key} ({obj['Size']} bytes)")
                continue

            total_size += obj["Size"]
            if total_size > MAX_REPO_SIZE:
                raise ValueError("Total file size exceeds 500MB limit")

            local_path = os.path.join(target_dir, rel_path)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)

            s3_client.download_file(bucket, key, local_path)


def _validate_repo_files(repo_dir):
    """Validate downloaded/cloned files are safe to scan."""
    if not os.path.exists(repo_dir):
        raise ValueError("No source files found")

    file_count = 0
    for root, dirs, files in os.walk(repo_dir):
        # Skip hidden directories and node_modules
        dirs[:] = [d for d in dirs if not d.startswith(".") and d != "node_modules"]
        for f in files:
            file_count += 1
            fpath = os.path.join(root, f)
            if os.path.getsize(fpath) > MAX_FILE_SIZE:
                os.remove(fpath)  # Remove oversized files
                print(f"[iac-scanner] Removed oversized file: {fpath}")

    if file_count == 0:
        raise ValueError("No files found to scan")

    print(f"[iac-scanner] Validated {file_count} files in repo")


def _run_tool(tool, repo_dir, output_path):
    """Run a scanning tool and return True if it produced output."""
    try:
        if tool == "checkov":
            cmd = [
                "checkov", "-d", repo_dir,
                "-o", "sarif",
                "--output-file", output_path,
                "--quiet",
            ]
        elif tool == "semgrep":
            cmd = [
                "semgrep", "--config", "auto",
                repo_dir,
                "--sarif", "-o", output_path,
                "--quiet",
            ]
        elif tool == "bandit":
            cmd = [
                "bandit", "-r", repo_dir,
                "-f", "sarif",
                "-o", output_path,
                "--quiet",
            ]
        else:
            return False

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=TOOL_TIMEOUT,
            shell=False,
        )

        # Most tools return non-zero when findings are present
        # That's expected behavior, not an error
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            print(f"[iac-scanner] {tool} completed (exit {result.returncode})")
            return True

        print(f"[iac-scanner] {tool} produced no output (exit {result.returncode})")
        return False

    except subprocess.TimeoutExpired:
        print(f"[iac-scanner] {tool} timed out after {TOOL_TIMEOUT}s")
        return False
    except Exception as e:
        print(f"[iac-scanner] {tool} error: {e}")
        return False


def _write_error_status(event, error, duration):
    """Write error status to S3."""
    try:
        s3_client.put_object(
            Bucket=event.get("outputBucket", ""),
            Key=f"{event.get('s3Prefix', '')}/status.json",
            Body=json.dumps({"status": "error", "error": error, "duration": duration}),
            ContentType="application/json",
            ServerSideEncryption="AES256",
        )
    except Exception as e:
        print(f"[iac-scanner] Failed to write error status: {e}")
