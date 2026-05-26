#!/bin/bash

# Load Test Runner Script
# Runs all load tests sequentially at different traffic levels

set -e

BASE_URL=${BASE_URL:-"http://localhost:3000"}
LEVEL=${LEVEL:-"baseline"}

echo "=============================================="
echo "LOAD TEST SUITE"
echo "=============================================="
echo "Base URL: $BASE_URL"
echo "Level: $LEVEL"
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
mkdir -p load-tests/results

# Run tests
echo "Running Public Pages Test..."
k6 run -e LEVEL=$LEVEL -e BASE_URL=$BASE_URL load-tests/scripts/public-pages.js

echo ""
echo "Running Authentication Flow Test..."
k6 run -e LEVEL=$LEVEL -e BASE_URL=$BASE_URL load-tests/scripts/auth-flow.js

echo ""
echo "Running Customer Dashboard Test..."
k6 run -e LEVEL=$LEVEL -e BASE_URL=$BASE_URL load-tests/scripts/customer-dashboard.js

echo ""
echo "Running Betting Flow Test..."
k6 run -e LEVEL=$LEVEL -e BASE_URL=$BASE_URL load-tests/scripts/betting-flow.js

echo ""
echo "Running Credit/Transaction APIs Test..."
k6 run -e LEVEL=$LEVEL -e BASE_URL=$BASE_URL load-tests/scripts/credit-transactions.js

echo ""
echo "Running Admin Dashboard Test..."
k6 run -e LEVEL=$LEVEL -e BASE_URL=$BASE_URL load-tests/scripts/admin-dashboard.js

echo ""
echo "Running Agent Dashboard Test..."
k6 run -e LEVEL=$LEVEL -e BASE_URL=$BASE_URL load-tests/scripts/agent-dashboard.js

echo ""
echo "Running Monitoring APIs Test..."
k6 run -e LEVEL=$LEVEL -e BASE_URL=$BASE_URL load-tests/scripts/monitoring-apis.js

echo ""
echo "=============================================="
echo "ALL TESTS COMPLETED"
echo "=============================================="
echo ""
echo "Generating report..."
node load-tests/generate-report.js

echo ""
echo "Results saved to load-tests/results/"
echo "Report saved to load-tests/results/CAPACITY_REPORT.md"
