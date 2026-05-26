# Load Testing Suite

This directory contains load testing scripts to measure system capacity.

## Prerequisites

Install k6 locally:
```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker
docker run --rm -i grafana/k6 run - <script.js
```

## Running Tests

```bash
# Run all tests sequentially
npm run load-test

# Run specific test
k6 run load-tests/scripts/public-pages.js

# Run with specific VUs (virtual users)
k6 run --vus 50 --duration 30s load-tests/scripts/public-pages.js

# Run with environment variables
k6 run -e BASE_URL=https://your-domain.com load-tests/scripts/public-pages.js
```

## Test Categories

1. **Public Pages** - Landing, login, register pages
2. **Customer Dashboard** - Authenticated customer operations
3. **Agent Dashboard** - Agent-specific operations
4. **Betting Flow** - Lottery browsing and bet placement
5. **Credit/Transactions** - Financial operations
6. **Admin Dashboard** - Admin operations
7. **Monitoring APIs** - Health and monitoring endpoints

## Traffic Levels

Tests are configured to run at these concurrency levels:
- 50 concurrent users (baseline)
- 100 concurrent users (normal)
- 250 concurrent users (peak)
- 500 concurrent users (stress)
- 1000 concurrent users (breaking point)

## Metrics Collected

- Response time (avg, p95, p99)
- Error rate
- HTTP status codes (401, 403, 429, 500)
- Requests per second
- Data transferred

## Output

Results are saved to `load-tests/results/` in JSON format.
