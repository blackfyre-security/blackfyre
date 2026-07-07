#!/usr/bin/env bash
# Generate Azure synthetic findings to findings.json
# Must be run from: C:/blackfyre/platform/packages/api
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT="$SCRIPT_DIR/findings.json"

echo "Generating Azure synthetic findings..."
npx tsx "$SCRIPT_DIR/generate.ts" > "$OUTPUT"

COUNT=$(node -e "const f = require('fs'); const d = JSON.parse(f.readFileSync('$OUTPUT','utf8')); console.log(d.length);")
echo "Done. $COUNT findings written to $OUTPUT"
