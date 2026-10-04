#!/bin/bash
#
# start.sh — Build the C engine and start the backend server
#
# Run inside WSL Ubuntu:
#   bash scripts/start.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "════════════════════════════════════════"
echo "  Memory Monitor — Starting"
echo "════════════════════════════════════════"

# Build C engine
echo "[1/2] Building C engine..."
if command -v make >/dev/null 2>&1; then
    make -s
else
    gcc -Wall -Wextra -g -O0 -o memory_engine memory_engine.c
    gcc -Wall -Wextra -g -O0 -o valgrind_test valgrind_test.c
fi

# Start backend
echo "[2/2] Starting backend server..."
cd "$PROJECT_DIR/backend"

# Copy .env.example to .env if .env doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo "  Created .env from .env.example"
fi

echo ""
echo "  Open http://localhost:3000 in your browser"
echo "  Press Ctrl+C to stop"
echo ""

node server.js
