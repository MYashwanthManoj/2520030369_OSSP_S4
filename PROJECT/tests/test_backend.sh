#!/bin/bash
#
# test_backend.sh — Test the backend API endpoints
#
# Starts the server, runs tests with curl, then stops it.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PORT=3099  # Use a different port for testing

PASS=0
FAIL=0
SERVER_PID=""

pass() { echo "  ✓ $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }

cleanup() {
    if [ -n "$SERVER_PID" ]; then
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT

echo "════════════════════════════════════════"
echo "  Backend API Tests (port $PORT)"
echo "════════════════════════════════════════"

# Build C engine first
echo ""
echo "[Setup]"
cd "$PROJECT_DIR/c-engine"
if command -v make >/dev/null 2>&1; then
    make -s
else
    gcc -Wall -Wextra -g -O0 -o memory_engine memory_engine.c
    gcc -Wall -Wextra -g -O0 -o valgrind_test valgrind_test.c
fi
pass "C engine built"

# Start server
cd "$PROJECT_DIR/backend"
PORT=$PORT node server.js $PORT &
SERVER_PID=$!
sleep 2

# Check server is running
if kill -0 "$SERVER_PID" 2>/dev/null; then
    pass "Server started (PID $SERVER_PID)"
else
    fail "Server failed to start"
    exit 1
fi

# Wait for server to respond
BASE="http://localhost:$PORT"
for i in $(seq 1 15); do
    if curl -s "http://localhost:$PORT/api/process/status" >/dev/null 2>&1; then
        BASE="http://localhost:$PORT"
        break
    elif curl -s "http://127.0.0.1:$PORT/api/process/status" >/dev/null 2>&1; then
        BASE="http://127.0.0.1:$PORT"
        break
    else
        WIN_IP=$(ip route show default 2>/dev/null | awk '{print $3}')
        if [ -n "$WIN_IP" ] && curl -s "http://$WIN_IP:$PORT/api/process/status" >/dev/null 2>&1; then
            BASE="http://$WIN_IP:$PORT"
            break
        fi
    fi
    sleep 0.5
done

# Test 1: Process status (not running)
echo ""
echo "[Test: Initial Status]"
STATUS=$(curl -s "$BASE/api/process/status")
if echo "$STATUS" | grep -q '"running":false'; then
    pass "Process initially not running"
else
    fail "Process status unexpected: $STATUS"
fi

# Test 2: Start process
echo ""
echo "[Test: Start Process]"
RESULT=$(curl -s -X POST "$BASE/api/process/start")
if echo "$RESULT" | grep -q '"success":true'; then
    pass "Process started"
else
    fail "Process start failed: $RESULT"
fi

sleep 1

# Test 3: Process status (running)
STATUS=$(curl -s "$BASE/api/process/status")
if echo "$STATUS" | grep -q '"running":true'; then
    pass "Process is running"
else
    fail "Process not running: $STATUS"
fi

if echo "$STATUS" | grep -qE '"pid":[0-9]+'; then
    pass "PID is present"
else
    fail "PID missing: $STATUS"
fi

# Test 4: malloc
echo ""
echo "[Test: malloc]"
RESULT=$(curl -s -X POST -H "Content-Type: application/json" -d '{"size":1024}' "$BASE/api/memory/malloc")
if echo "$RESULT" | grep -q '"success":true'; then
    pass "malloc(1024) succeeded"
else
    fail "malloc failed: $RESULT"
fi

sleep 0.5

# Test 5: calloc
echo ""
echo "[Test: calloc]"
RESULT=$(curl -s -X POST -H "Content-Type: application/json" -d '{"count":4,"size":256}' "$BASE/api/memory/calloc")
if echo "$RESULT" | grep -q '"success":true'; then
    pass "calloc(4,256) succeeded"
else
    fail "calloc failed: $RESULT"
fi

sleep 0.5

# Test 6: realloc
echo ""
echo "[Test: realloc]"
RESULT=$(curl -s -X POST -H "Content-Type: application/json" -d '{"id":1,"size":4096}' "$BASE/api/memory/realloc")
if echo "$RESULT" | grep -q '"success":true'; then
    pass "realloc(1,4096) succeeded"
else
    fail "realloc failed: $RESULT"
fi

sleep 0.5

# Test 7: free
echo ""
echo "[Test: free]"
RESULT=$(curl -s -X POST -H "Content-Type: application/json" -d '{"id":1}' "$BASE/api/memory/free")
if echo "$RESULT" | grep -q '"success":true'; then
    pass "free(1) succeeded"
else
    fail "free failed: $RESULT"
fi

# Test 8: Allocations
echo ""
echo "[Test: Allocations]"
ALLOCS=$(curl -s "$BASE/api/allocations")
if echo "$ALLOCS" | grep -q '"allocations"'; then
    pass "Allocations endpoint works"
else
    fail "Allocations endpoint failed: $ALLOCS"
fi

# Test 9: Events
echo ""
echo "[Test: Events]"
EVENTS=$(curl -s "$BASE/api/events")
if echo "$EVENTS" | grep -q '"events"'; then
    pass "Events endpoint works"
else
    fail "Events endpoint failed: $EVENTS"
fi

# Test 10: Demo
echo ""
echo "[Test: Demo]"
RESULT=$(curl -s -X POST -H "Content-Type: application/json" -d '{"type":"leak"}' "$BASE/api/demo/start")
if echo "$RESULT" | grep -q '"success":true'; then
    pass "Leak demo started"
else
    fail "Leak demo failed: $RESULT"
fi

sleep 1

# Test 11: Valgrind
echo ""
echo "[Test: Valgrind]"
RESULT=$(curl -s -X POST "$BASE/api/valgrind/run")
# May or may not succeed depending on valgrind installation
if echo "$RESULT" | grep -qE '"success":(true|false)'; then
    pass "Valgrind endpoint responds"
else
    fail "Valgrind endpoint failed: $RESULT"
fi

# Test 12: Ollama status
echo ""
echo "[Test: Ollama Status]"
RESULT=$(curl -s "$BASE/api/ollama/status")
if echo "$RESULT" | grep -q '"available"'; then
    pass "Ollama status endpoint works"
else
    fail "Ollama status failed: $RESULT"
fi

# Test 13: Chat without Ollama
echo ""
echo "[Test: Chat]"
RESULT=$(curl -s -X POST -H "Content-Type: application/json" -d '{"message":"test"}' "$BASE/api/chat")
if echo "$RESULT" | grep -qE '"success":(true|false)'; then
    pass "Chat endpoint responds"
else
    fail "Chat endpoint failed: $RESULT"
fi

# Test 14: Stop process
echo ""
echo "[Test: Stop Process]"
RESULT=$(curl -s -X POST "$BASE/api/process/stop")
if echo "$RESULT" | grep -q '"success":true'; then
    pass "Process stopped"
else
    fail "Process stop failed: $RESULT"
fi

sleep 1

# Test 15: Frontend accessible
echo ""
echo "[Test: Frontend]"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/")
if [ "$HTTP_CODE" = "200" ]; then
    pass "Frontend accessible (HTTP 200)"
else
    fail "Frontend not accessible (HTTP $HTTP_CODE)"
fi

# Summary
echo ""
echo "════════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed"
echo "════════════════════════════════════════"

exit $FAIL
