#!/bin/bash
#
# test_engine.sh — Test the C memory engine directly
#
# Sends commands via stdin, validates structured events on stdout.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENGINE="$PROJECT_DIR/c-engine/memory_engine"

PASS=0
FAIL=0

pass() { echo "  ✓ $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }

echo "════════════════════════════════════════"
echo "  C Engine Tests"
echo "════════════════════════════════════════"

# Build
echo ""
echo "[Build]"
cd "$PROJECT_DIR/c-engine"
if command -v make >/dev/null 2>&1; then
    make -s
else
    gcc -Wall -Wextra -g -O0 -o memory_engine memory_engine.c
    gcc -Wall -Wextra -g -O0 -o valgrind_test valgrind_test.c
fi
pass "Compilation successful"

# Test 1: Process start event
echo ""
echo "[Test: Process Start]"
OUTPUT=$(echo "QUIT" | "$ENGINE" 2>/dev/null)
if echo "$OUTPUT" | grep -q "EVENT|PROCESS_START|"; then
    pass "PROCESS_START event emitted"
else
    fail "PROCESS_START event missing"
fi

if echo "$OUTPUT" | grep -q "EVENT|PROCESS_EXIT|"; then
    pass "PROCESS_EXIT event emitted"
else
    fail "PROCESS_EXIT event missing"
fi

# Check PID is a real number
PID_LINE=$(echo "$OUTPUT" | grep "EVENT|PROCESS_START|" | head -1)
PID_VAL=$(echo "$PID_LINE" | cut -d'|' -f3)
if [ "$PID_VAL" -gt 0 ] 2>/dev/null; then
    pass "PID is a valid number: $PID_VAL"
else
    fail "PID is not a valid number: $PID_VAL"
fi

# Test 2: malloc
echo ""
echo "[Test: malloc]"
OUTPUT=$(printf "MALLOC 1024\nSTATUS\nQUIT\n" | "$ENGINE" 2>/dev/null)
if echo "$OUTPUT" | grep -q "EVENT|MALLOC|"; then
    pass "MALLOC event emitted"
else
    fail "MALLOC event missing"
fi

# Check pointer is a real hex address
MALLOC_LINE=$(echo "$OUTPUT" | grep "EVENT|MALLOC|" | head -1)
PTR=$(echo "$MALLOC_LINE" | cut -d'|' -f5)
if echo "$PTR" | grep -qE "^0x[0-9a-fA-F]+$"; then
    pass "Pointer is a real address: $PTR"
else
    fail "Pointer doesn't look real: $PTR"
fi

# Test 3: calloc
echo ""
echo "[Test: calloc]"
OUTPUT=$(printf "CALLOC 4 256\nQUIT\n" | "$ENGINE" 2>/dev/null)
if echo "$OUTPUT" | grep -q "EVENT|CALLOC|"; then
    pass "CALLOC event emitted"
else
    fail "CALLOC event missing"
fi

# Test 4: realloc
echo ""
echo "[Test: realloc]"
OUTPUT=$(printf "MALLOC 512\nREALLOC 1 2048\nQUIT\n" | "$ENGINE" 2>/dev/null)
if echo "$OUTPUT" | grep -q "EVENT|REALLOC|"; then
    pass "REALLOC event emitted"
else
    fail "REALLOC event missing"
fi

# Test 5: free
echo ""
echo "[Test: free]"
OUTPUT=$(printf "MALLOC 256\nFREE 1\nQUIT\n" | "$ENGINE" 2>/dev/null)
if echo "$OUTPUT" | grep -q "EVENT|FREE|"; then
    pass "FREE event emitted"
else
    fail "FREE event missing"
fi

# Test 6: STATUS
echo ""
echo "[Test: STATUS]"
OUTPUT=$(printf "MALLOC 100\nMALLOC 200\nFREE 1\nSTATUS\nQUIT\n" | "$ENGINE" 2>/dev/null)
if echo "$OUTPUT" | grep -q "EVENT|STATUS|"; then
    pass "STATUS event emitted"
else
    fail "STATUS event missing"
fi

# Test 7: PROC_INFO
echo ""
echo "[Test: PROC_INFO]"
OUTPUT=$(printf "PROC_INFO\nQUIT\n" | "$ENGINE" 2>/dev/null)
if echo "$OUTPUT" | grep -q "EVENT|PROC_INFO|"; then
    pass "PROC_INFO event emitted"
else
    fail "PROC_INFO event missing"
fi

# Test 8: Error demos
echo ""
echo "[Test: Error Demos]"
for DEMO in leak use_after_free double_free buffer_overflow dangling_pointer; do
    OUTPUT=$(printf "DEMO $DEMO\nQUIT\n" | "$ENGINE" 2>/dev/null)
    if echo "$OUTPUT" | grep -q "EVENT|DEMO_RESULT|$DEMO|"; then
        pass "Demo $DEMO works"
    else
        fail "Demo $DEMO failed"
    fi
done

# Test 9: Guided steps
echo ""
echo "[Test: Guided Steps]"
OUTPUT=$(printf "GUIDED 1\nGUIDED 2\nGUIDED 3\nQUIT\n" | "$ENGINE" 2>/dev/null)
if echo "$OUTPUT" | grep -q "EVENT|GUIDED|1|"; then
    pass "Guided step 1 works"
else
    fail "Guided step 1 failed"
fi

# Test 10: Error handling
echo ""
echo "[Test: Error Handling]"
OUTPUT=$(printf "FREE 999\nQUIT\n" | "$ENGINE" 2>/dev/null)
if echo "$OUTPUT" | grep -q "EVENT|ERROR|ALLOC_NOT_FOUND"; then
    pass "Invalid FREE handled correctly"
else
    fail "Invalid FREE not handled"
fi

OUTPUT=$(printf "BOGUS_COMMAND\nQUIT\n" | "$ENGINE" 2>/dev/null)
if echo "$OUTPUT" | grep -q "EVENT|ERROR|UNKNOWN_CMD"; then
    pass "Unknown command handled correctly"
else
    fail "Unknown command not handled"
fi

# Summary
echo ""
echo "════════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed"
echo "════════════════════════════════════════"

exit $FAIL
