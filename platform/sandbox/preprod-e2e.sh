#!/usr/bin/env bash
# End-to-end test of the preprod-foundation slice against the fake-org
# mock cloud + a local postgres. Asserts:
#   1. fake-org is up (STS reachable, returns 123456789012)
#   2. migration 015_preprod_foundation applied
#   3. POST /api/onboarding/step-1 issues a BF-YYYY-NNNNNN clientNumber
#   4. POST /api/cloud-accounts/aws/init issues bfyr-<externalId> + trust policy
#   5. POST /api/cloud-accounts/aws/verify hits fake STS, transitions account
#      to verified (records verifiedCallerArn)
#   6. POST /api/auth/login is BLOCKED with MFA_ENROLLMENT_REQUIRED when the
#      tenant has mfa_required=true and user has no MFA enrolled
set -euo pipefail

WORKTREE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAKE_ORG_DIR="${WORKTREE_ROOT}/sandbox/fake-org"
API_DIR="${WORKTREE_ROOT}/packages/api"

API_URL="${API_URL:-http://127.0.0.1:4000}"
PG_URL="${DATABASE_URL:-postgres://blackfyre:blackfyre_dev@localhost:5432/blackfyre}"
FAKE_AWS="${AWS_ENDPOINT_URL:-http://127.0.0.1:4566}"

c_green() { printf "\033[32m%s\033[0m\n" "$*"; }
c_red()   { printf "\033[31m%s\033[0m\n" "$*"; }
c_blue()  { printf "\033[34m%s\033[0m\n" "$*"; }

step() { c_blue "── $* ──"; }
pass() { c_green "  ✓ $*"; }
fail() { c_red   "  ✗ $*"; exit 1; }

step "1. Verify fake-org mock cloud is up"
if curl -fsS -X POST "$FAKE_AWS/" \
     -d "Action=GetCallerIdentity&Version=2011-06-15" \
     -H "User-Agent: aws-sdk-js/3.x api/sts#3.x" \
     --max-time 3 | grep -q "123456789012"; then
  pass "fake STS responds with account 123456789012"
else
  fail "fake-org not reachable at $FAKE_AWS — run platform/sandbox/fake-org/boot.sh"
fi

step "2. Verify postgres is up + migration 015 applied"
if ! command -v psql >/dev/null 2>&1; then
  # Fall back to running through a node one-liner using the 'postgres' package
  node -e "
    import('postgres').then(async ({default: postgres}) => {
      const sql = postgres('$PG_URL');
      const rows = await sql\`SELECT name FROM _migrations WHERE name = '015_preprod_foundation.sql'\`;
      if (rows.length === 0) { console.error('migration 015 not applied'); process.exit(1); }
      await sql.end(); console.log('OK');
    }).catch(e => { console.error(e.message); process.exit(1); });
  " || fail "postgres unreachable or migration 015 missing — run 'npm run migrate:sql' first"
else
  PGPASSWORD="$(echo "$PG_URL" | sed -nE 's#.*://[^:]+:([^@]+)@.*#\1#p')" \
  psql "$PG_URL" -c "SELECT name FROM _migrations WHERE name = '015_preprod_foundation.sql'" \
    2>/dev/null | grep -q 015 || fail "migration 015 not applied"
fi
pass "migration 015_preprod_foundation present"

step "3. Provision test tenant + admin user via direct insert"
SETUP_OUT=$(cd "$API_DIR" && node --input-type=module -e "
  import postgres from 'postgres';
  import argon2 from 'argon2';
  const sql = postgres('$PG_URL');
  try {
    const stale = await sql\`SELECT id FROM tenants WHERE slug LIKE 'e2e-%'\`;
    for (const row of stale) {
      await sql\`DELETE FROM audit_logs WHERE tenant_id = \${row.id}\`;
      await sql\`DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE tenant_id = \${row.id})\`;
      await sql\`DELETE FROM cloud_accounts WHERE tenant_id = \${row.id}\`;
      await sql\`DELETE FROM tenant_contacts WHERE tenant_id = \${row.id}\`;
      await sql\`DELETE FROM tenants WHERE id = \${row.id}\`;
    }
    const slug = 'e2e-' + Date.now();
    const [t] = await sql\`INSERT INTO tenants (name, slug, plan, industry_profile)
                          VALUES ('E2E Corp', \${slug}, 'retainer', 'saas') RETURNING id\`;
    const pwd = await argon2.hash('TestPass123!');
    const email = 'e2e+'+Date.now()+'@blackfyre.test';
    const [u] = await sql\`INSERT INTO users (tenant_id, email, name, password_hash, role)
                          VALUES (\${t.id}, \${email}, 'E2E Admin', \${pwd}, 'admin') RETURNING id\`;
    console.log(JSON.stringify({tenantId: t.id, userId: u.id, email}));
  } finally { await sql.end(); }
")
TENANT_ID=$(echo "$SETUP_OUT" | node -e "let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).tenantId))")
USER_ID=$(echo "$SETUP_OUT" | node -e "let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).userId))")
USER_EMAIL=$(echo "$SETUP_OUT" | node -e "let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).email))")
pass "tenant=$TENANT_ID  user=$USER_EMAIL"

step "4. Mint a JWT for the admin user (direct, skips MFA path)"
TOKEN=$(cd "$API_DIR" && node -e "
  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_SECRET || 'dev-only-secret-replace-in-production!!';
  console.log(jwt.sign({sub: '$USER_ID', tenantId: '$TENANT_ID', role: 'admin', type: 'access'}, secret, {expiresIn: '15m'}));
" 2>/dev/null)
[ -n "$TOKEN" ] || fail "could not mint JWT (is jsonwebtoken installed in $API_DIR?)"
pass "token minted (len=${#TOKEN})"

step "5. POST /api/onboarding/step-1 — issues clientNumber"
STEP1=$(curl -sS -X POST "$API_URL/api/onboarding/step-1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "legalName": "E2E Corp Pvt. Ltd.",
    "displayName": "E2E",
    "websiteUrl": "https://e2e.test",
    "region": "us-east-1",
    "primarySpoc": {"name":"Test Spoc","email":"spoc@e2e.test","phone":"+1 555 0100","timezone":"Asia/Kolkata"},
    "billingContact": {"name":"Bill","email":"billing@e2e.test"},
    "tosAccepted": true,
    "tosVersion": "2026-05-v1",
    "dpaSigned": true,
    "dpaSignerName": "E2E Legal",
    "dpaSignerEmail": "legal@e2e.test"
  }')
CLIENT_NUMBER=$(echo "$STEP1" | node -e "let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).tenant.clientNumber||'')}catch(_){console.log('')}})")
echo "$CLIENT_NUMBER" | grep -qE "^BF-[0-9]{4}-[0-9]{6}$" \
  || fail "step-1 did not return BF-YYYY-NNNNNN clientNumber. raw: $STEP1"
pass "clientNumber=$CLIENT_NUMBER"

step "6. POST /api/cloud-accounts/aws/init — issues externalId + trust policy"
INIT=$(curl -sS -X POST "$API_URL/api/cloud-accounts/aws/init" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"accountId":"123456789012","accountAlias":"E2E Mumbai","regions":["us-east-1","ap-south-1"]}')
EXTERNAL_ID=$(echo "$INIT" | node -e "let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).cloudAccount.externalId||'')}catch(_){console.log('')}})")
CA_ID=$(echo "$INIT" | node -e "let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).cloudAccount.id||'')}catch(_){console.log('')}})")
echo "$EXTERNAL_ID" | grep -qE "^bfyr-" || fail "init did not return bfyr- externalId. raw: $INIT"
pass "externalId=$EXTERNAL_ID  cloudAccountId=$CA_ID"

step "7. POST /api/cloud-accounts/aws/verify — calls fake STS"
VERIFY=$(curl -sS -X POST "$API_URL/api/cloud-accounts/aws/verify" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"cloudAccountId\":\"$CA_ID\",\"roleArn\":\"arn:aws:iam::123456789012:role/BlackfyreReadOnlyRole\"}")
VERIFIED_ARN=$(echo "$VERIFY" | node -e "let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>{try{const r=JSON.parse(s);console.log(r.cloudAccount&&r.cloudAccount.verifiedCallerArn||'')}catch(_){console.log('')}})")
[ -n "$VERIFIED_ARN" ] || fail "verify did not return verifiedCallerArn. raw: $VERIFY"
pass "cloud account verified via fake STS · callerArn=$VERIFIED_ARN"

step "8. MFA gate — flip mfa_required, expect login to be blocked"
(cd "$API_DIR" && node --input-type=module -e "
  import postgres from 'postgres';
  const sql = postgres('$PG_URL');
  await sql\`UPDATE tenants SET mfa_required = true WHERE id = '$TENANT_ID'\`;
  await sql.end();
")
LOGIN=$(curl -sS -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER_EMAIL\",\"password\":\"TestPass123!\"}")
echo "$LOGIN" | grep -q MFA_ENROLLMENT_REQUIRED \
  || fail "login was NOT blocked despite mfa_required=true. raw: $LOGIN"
pass "MFA enrollment required correctly enforced"

step "9. Teardown"
(cd "$API_DIR" && node --input-type=module -e "
  import postgres from 'postgres';
  const sql = postgres('$PG_URL');
  try {
    await sql\`DELETE FROM audit_logs WHERE tenant_id = '$TENANT_ID'\`;
    await sql\`DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE tenant_id = '$TENANT_ID')\`;
    await sql\`DELETE FROM cloud_accounts WHERE tenant_id = '$TENANT_ID'\`;
    await sql\`DELETE FROM tenant_contacts WHERE tenant_id = '$TENANT_ID'\`;
    await sql\`DELETE FROM tenants WHERE id = '$TENANT_ID'\`;
  } finally { await sql.end(); }
")
pass "tenant $TENANT_ID cleaned up"

c_green "ALL E2E ASSERTIONS PASSED ✓"
