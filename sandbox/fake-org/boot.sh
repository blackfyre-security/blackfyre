#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Kill any existing instance
if [ -f "$DIR/server.pid" ]; then
  OLD_PID=$(cat "$DIR/server.pid")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "[fake-org] Stopping existing instance (pid $OLD_PID)"
    kill "$OLD_PID" 2>/dev/null || true
    sleep 0.5
  fi
  rm -f "$DIR/server.pid"
fi

# Start server in background
node "$DIR/server.js" > "$DIR/server.log" 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > "$DIR/server.pid"

# Wait for server to be ready
for i in 1 2 3 4 5; do
  if curl -s -X POST http://127.0.0.1:4566/ \
       -d "Action=GetCallerIdentity&Version=2011-06-15" \
       -H "Content-Type: application/x-www-form-urlencoded" \
       -H "User-Agent: aws-sdk-js/3.x api/sts#3.x" \
       --max-time 2 | grep -q "123456789012"; then
    echo "[fake-org] Mock AWS cloud up on :4566 (pid $SERVER_PID)"
    exit 0
  fi
  sleep 0.5
done

echo "[fake-org] ERROR: server did not become ready. Check $DIR/server.log"
exit 1
