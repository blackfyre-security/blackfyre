#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$DIR/server.pid" ]; then
  PID=$(cat "$DIR/server.pid")
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    echo "[fake-org] Stopped server (pid $PID)"
  else
    echo "[fake-org] Server (pid $PID) was not running"
  fi
  rm -f "$DIR/server.pid"
else
  echo "[fake-org] No server.pid found — nothing to stop"
fi
