# fake-org — Mock AWS Cloud for Blackfyre Integration Tests

A tiny HTTP server that mimics the AWS API surface so Blackfyre's auditors
can run end-to-end against realistic but deliberately misconfigured fake resources.

## Why it exists

Blackfyre's scanners use AWS SDK v3. The SDK reads `AWS_ENDPOINT_URL` from env
to override service endpoints — so pointing it at `http://127.0.0.1:4566` makes
the real auditor code hit the mock server unchanged. No patching, no mocking at
the module level. Real code, real findings.

## Org: "Acme Bank"

Seeded with misconfigs across every audited service:

| Service     | Misconfig                                             |
|-------------|-------------------------------------------------------|
| IAM         | 5 users without MFA, root has access keys, root no MFA, weak password policy, wildcard admin policy |
| S3          | 3 buckets with no public-access block, 3 unencrypted, 4 with no versioning, 5 with no logging |
| EC2         | SSH open to 0.0.0.0/0 (2 SGs), RDP open to 0.0.0.0/0, 2 unencrypted EBS volumes |
| CloudTrail  | No trails (critical finding)                          |
| KMS         | 1 customer key with rotation disabled                 |

## How to run

```bash
# 1. Start mock cloud
bash fake-org/boot.sh

# 2. Run scan (from blackfyre api dir)
cd /c/blackfyre/platform/packages/api
npx tsx src/scan-runner.ts

# 3. Results in fake-org/last-scan.json
# 4. Stop mock cloud
bash fake-org/stop.sh
```

## Full integration test

```bash
bash scenarios/blackfyre-scan-flow.sh
```

Asserts >= 8 findings, >= 1 critical, categories: iam + encryption + network.

## Architecture

```
server.js           # Node stdlib HTTP server on :4566
handlers/
  iam.js            # IAM XML responses (form-encoded protocol)
  sts.js            # STS XML responses
  s3.js             # S3 XML responses (path-style)
  ec2.js            # EC2 XML responses
  cloudtrail.js     # CloudTrail JSON responses (AWS JSON 1.1)
  kms.js            # KMS JSON responses (AWS JSON 1.1)
org-data.json       # Single source of truth for the fake org
scan-runner.ts      # At /c/blackfyre/platform/packages/api/src/
```

Service routing uses the `api/<service>#version` segment in the AWS SDK
User-Agent header, which is present on every SDK v3 request.
