#!/bin/bash

# Production Traffic Simulation and Scaling Verification
# Runs all production readiness tests

set -e

BASE_URL=${BASE_URL:-"http://localhost:3000"}
RESULTS_DIR="load-tests/results"

echo "=============================================="
echo "PRODUCTION SCALING VERIFICATION SUITE"
echo "=============================================="
echo "Base URL: $BASE_URL"
echo "Results: $RESULTS_DIR"
echo "=============================================="
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo "k6 is not installed. Please install it first:"
    echo "  brew install k6  # macOS"
    echo "  https://k6.io/docs/getting-started/installation/"
    exit 1
fi

# Create results directory
mkdir -p $RESULTS_DIR

# ===== Phase 1: Safety Verification =====
echo ""
echo "===== PHASE 1: SAFETY VERIFICATION ====="
echo "Testing operational safety under normal load..."
k6 run -e LEVEL=normal -e BASE_URL=$BASE_URL load-tests/scripts/safety-verification.js

# ===== Phase 2: Scaling Verification =====
echo ""
echo "===== PHASE 2: SCALING VERIFICATION ====="
echo "Testing system at increasing load levels (50 -> 1000 VUs)..."
k6 run -e BASE_URL=$BASE_URL load-tests/scripts/scaling-verification.js

# ===== Phase 3: Production Traffic Simulation =====
echo ""
echo "===== PHASE 3: PRODUCTION TRAFFIC SIMULATION ====="

echo ""
echo "--- Level 1: Light (50 concurrent users) ---"
k6 run -e LEVEL=light -e BASE_URL=$BASE_URL load-tests/scripts/production-simulation.js

echo ""
echo "--- Level 2: Normal (100 concurrent users) ---"
k6 run -e LEVEL=normal -e BASE_URL=$BASE_URL load-tests/scripts/production-simulation.js

echo ""
echo "--- Level 3: Peak (250 concurrent users) ---"
k6 run -e LEVEL=peak -e BASE_URL=$BASE_URL load-tests/scripts/production-simulation.js

echo ""
echo "--- Level 4: Stress (500 concurrent users) ---"
k6 run -e LEVEL=stress -e BASE_URL=$BASE_URL load-tests/scripts/production-simulation.js

echo ""
echo "--- Level 5: Breaking Point (1000 concurrent users) ---"
k6 run -e LEVEL=breaking -e BASE_URL=$BASE_URL load-tests/scripts/production-simulation.js

# ===== Generate Final Reports =====
echo ""
echo "===== GENERATING REPORTS ====="
node load-tests/scripts/generate-scaling-reports.js

echo ""
echo "=============================================="
echo "ALL TESTS COMPLETED"
echo "=============================================="
echo ""
echo "Reports generated:"
echo "  - $RESULTS_DIR/LOAD_TEST_REPORT.md"
echo "  - $RESULTS_DIR/SCALING_READINESS.md"
echo "  - $RESULTS_DIR/BOTTLENECK_ANALYSIS.md"
echo "  - $RESULTS_DIR/SAFE_CONCURRENT_USER_LIMIT.md"
