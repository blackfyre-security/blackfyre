#!/usr/bin/env bash
# run-all.sh — Build the scan-bundle.json from all findings
# Usage: bash fake-org/cross-cutting/run-all.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAKE_ORG_DIR="$(dirname "$SCRIPT_DIR")"
TSX="C:/blackfyre/platform/node_modules/.bin/tsx"

echo "==================================================="
echo "  Blackfyre Fake-Org Bundle Generator"
echo "==================================================="
echo ""
echo "Working dir: $FAKE_ORG_DIR"
echo ""

# Check tsx is available
if [ ! -f "$TSX" ]; then
  echo "ERROR: tsx not found at $TSX"
  echo "  Try: npm install -g tsx"
  exit 1
fi

# Check required input
if [ ! -f "$FAKE_ORG_DIR/last-scan.json" ]; then
  echo "ERROR: last-scan.json not found at $FAKE_ORG_DIR/last-scan.json"
  exit 1
fi

# Warn about optional inputs
if [ ! -f "$FAKE_ORG_DIR/azure/findings.json" ]; then
  echo "WARN: azure/findings.json not found — bundle will contain 0 Azure findings"
fi
if [ ! -f "$FAKE_ORG_DIR/gcp/findings.json" ]; then
  echo "WARN: gcp/findings.json not found — bundle will contain 0 GCP findings"
fi

echo ""
echo "Running bundle assembler..."
echo ""

"$TSX" --tsconfig "$SCRIPT_DIR/tsconfig.json" "$SCRIPT_DIR/bundle-assembler.ts"

BUNDLE="$FAKE_ORG_DIR/scan-bundle.json"

if [ ! -f "$BUNDLE" ]; then
  echo "ERROR: scan-bundle.json was not created"
  exit 1
fi

BUNDLE_SIZE=$(wc -c < "$BUNDLE")
BUNDLE_KB=$((BUNDLE_SIZE / 1024))

echo ""
echo "==================================================="
echo "  Verification"
echo "==================================================="

# Write a temporary verification script to avoid MSYS2 path interpolation issues
VERIFY_SCRIPT=$(mktemp --suffix=.js)
cat > "$VERIFY_SCRIPT" << 'JSEOF'
const fs = require('fs');
const bundlePath = process.argv[2];
let b;
try {
  b = JSON.parse(fs.readFileSync(bundlePath, 'utf-8'));
  console.log('  JSON.parse: OK');
} catch(e) {
  console.error('  JSON.parse: FAIL -', e.message);
  process.exit(1);
}
const required = ['metadata','scans','findings','evidence','drift','threatIntel',
  'remediations','policies','reports','compliance','learning','team','integrations','subscription','alerts'];
required.forEach(k => {
  const v = b[k];
  const display = Array.isArray(v) ? v.length : typeof v;
  console.log('  ' + k + ': ' + display);
});
console.log('');
console.log('  Total findings: ' + b.findings.length);
if (b.findings.length < 39) console.warn('  WARN: findings.length < 39');
if (b.evidence.length !== b.findings.length) console.warn('  WARN: evidence.length != findings.length');
JSEOF

node "$VERIFY_SCRIPT" "$BUNDLE"
rm -f "$VERIFY_SCRIPT"

echo "  Bundle size:    ${BUNDLE_KB} KB"
echo ""
echo "Done. Bundle at: $BUNDLE"
