#!/bin/bash
#
# setup.sh — Install dependencies and build the Memory Monitor
#
# Run this inside WSL Ubuntu:
#   bash scripts/setup.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "════════════════════════════════════════"
echo "  Memory Monitor — Setup"
echo "════════════════════════════════════════"
echo ""

# 1. Install system packages
echo "[1/4] Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq build-essential valgrind

# 2. Install Node.js if not available
if ! command -v node &> /dev/null; then
    echo "[2/4] Installing Node.js..."
    # Install via NodeSource
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y -qq nodejs
else
    echo "[2/4] Node.js already installed: $(node --version)"
fi

# 3. Build C engine
echo "[3/4] Building C engine..."
cd "$PROJECT_DIR/c-engine"
make clean
make
echo "  Built: memory_engine"
echo "  Built: valgrind_test"

# 4. Install Node.js dependencies
echo "[4/4] Installing backend dependencies..."
cd "$PROJECT_DIR/backend"
npm install --silent

echo ""
echo "════════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  To start: bash scripts/start.sh"
echo "  Or:       cd backend && node server.js"
echo "  Then:     open http://localhost:3000"
echo "════════════════════════════════════════"
