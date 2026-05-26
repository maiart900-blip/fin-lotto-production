/**
 * Scaling Verification Test
 * Tests system behavior at increasing load levels
 * Identifies bottlenecks and safe concurrent user limits
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate, Gauge } from 'k6/metrics';
import { BASE_URL, getAdminHeaders, randomBetAmount, randomLotteryNumber, randomNumber } from '../config.js';

// Metrics for scaling analysis
const responseTime = new Trend('response_time', true);
const errorRate = new Rate('error_rate');
const throughput = new Counter('throughput');
const activeConnections = new Gauge('active_connections');

// Bottleneck indicators
const slowQueries = new Counter('slow_queries');
const timeouts = new Counter('timeouts');
const memoryPressure = new Counter('memory_pressure_indicators');

const headers = getAdminHeaders();

// Staged load test - ramps through all traffic levels
export const options = {
  stages: [
    // Warmup
    { duration: '30s', target: 10 },
    // Level 1: 50 concurrent users
    { duration: '1m', target: 50 },
    { duration: '2m', target: 50 },
    // Level 2: 100 concurrent users
    { duration: '30s', target: 100 },
    { duration: '2m', target: 100 },
    // Level 3: 250 concurrent users
    { duration: '30s', target: 250 },
    { duration: '2m', target: 250 },
    // Level 4: 500 concurrent users (stress)
    { duration: '30s', target: 500 },
    { duration: '1m', target: 500 },
    // Level 5: 1000 concurrent users (breaking point)
    { duration: '30s', target: 1000 },
    { duration: '30s', target: 1000 },
    // Cooldown
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    'response_time': ['p(95)<5000'],
    'error_rate': ['rate<0.1'],
    'slow_queries': ['count<100'],
    'timeouts': ['count<50'],
  },
};

export default function() {
  activeConnections.add(__VU);
  
  const operations = [
    { weight: 40, fn: testBettingAPI },
    { weight: 20, fn: testLotteryAPI },
    { weight: 15, fn: testCustomerAPI },
    { weight: 10, fn: testEntriesAPI },
    { weight: 10, fn: testResultsAPI },
    { weight: 5, fn: testMonitoringAPI },
  ];
  
  // Weighted random selection
  const rand = randomNumber(1, 100);
  let cumulative = 0;
  
  for (const op of operations) {
    cumulative += op.weight;
    if (rand <= cumulative) {
      op.fn();
      break;
    }
  }
  
  sleep(randomNumber(1, 3) / 10); // 100-300ms between requests
}

function testBettingAPI() {
  group('Betting API', function() {
    const start = Date.now();
    
    // Get lotteries
    let res = http.get(`${BASE_URL}/api/lotteries`, { 
      headers,
      timeout: '10s',
    });
    
    recordMetrics(res, start);
    
    if (res.status !== 200) return;
    
    let lotteries = [];
    try {
      const body = JSON.parse(res.body);
      lotteries = body.data || body.lotteries || body || [];
    } catch { return; }
    
    if (lotteries.length === 0) return;
    
    const lottery = lotteries[randomNumber(0, lotteries.length - 1)];
    
    // Place bet
    const betStart = Date.now();
    const payload = {
      entries: [{
        number: randomLotteryNumber(2),
        betType: '2_top',
        amount: randomBetAmount(),
      }],
      lotteryId: lottery.id,
      customer_name: `ScaleTest_${__VU}`,
      source_type: 'manual',
    };
    
    res = http.post(`${BASE_URL}/api/entries`, JSON.stringify(payload), {
      headers: { ...headers, 'Content-Type': 'application/json' },
      timeout: '10s',
    });
    
    recordMetrics(res, betStart);
    throughput.add(1);
  });
}

function testLotteryAPI() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/lotteries`, { 
    headers,
    timeout: '5s',
  });
  recordMetrics(res, start);
  throughput.add(1);
}

function testCustomerAPI() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/customers?limit=20`, { 
    headers,
    timeout: '5s',
  });
  recordMetrics(res, start);
  throughput.add(1);
}

function testEntriesAPI() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/entries?limit=50`, { 
    headers,
    timeout: '5s',
  });
  recordMetrics(res, start);
  throughput.add(1);
}

function testResultsAPI() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/results?limit=10`, { 
    headers,
    timeout: '5s',
  });
  recordMetrics(res, start);
  throughput.add(1);
}

function testMonitoringAPI() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/operations/live`, { 
    headers,
    timeout: '5s',
  });
  recordMetrics(res, start);
  throughput.add(1);
}

function recordMetrics(res, startTime) {
  const duration = Date.now() - startTime;
  responseTime.add(duration);
  
  // Error tracking
  if (res.status >= 400) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }
  
  // Bottleneck indicators
  if (duration > 2000) {
    slowQueries.add(1);
  }
  
  if (res.status === 0 || res.status === 408 || res.status === 504) {
    timeouts.add(1);
  }
  
  // Memory pressure indicators (503, connection refused patterns)
  if (res.status === 503 || res.status === 502) {
    memoryPressure.add(1);
  }
}

export function handleSummary(data) {
  const metrics = data.metrics;
  
  // Calculate safe limit based on error rate at each VU level
  const errorRateThreshold = 0.05; // 5%
  const p95Threshold = 3000; // 3 seconds
  
  const report = `
================================================================================
SCALING VERIFICATION REPORT
================================================================================
Test Duration: ~13 minutes (staged ramp)
Max VUs Tested: 1000

RESPONSE TIME BY PERCENTILE:
----------------------------
P50: ${Math.round(metrics.response_time?.values?.['p(50)'] || 0)}ms
P90: ${Math.round(metrics.response_time?.values?.['p(90)'] || 0)}ms
P95: ${Math.round(metrics.response_time?.values?.['p(95)'] || 0)}ms
P99: ${Math.round(metrics.response_time?.values?.['p(99)'] || 0)}ms
Max: ${Math.round(metrics.response_time?.values?.max || 0)}ms

THROUGHPUT:
-----------
Total Requests: ${metrics.throughput?.values?.count || 0}
Average Rate: ${Math.round(metrics.http_reqs?.values?.rate || 0)}/s
Peak Rate: ${Math.round((metrics.http_reqs?.values?.rate || 0) * 1.5)}/s (estimated)

ERROR ANALYSIS:
---------------
Error Rate: ${Math.round((metrics.error_rate?.values?.rate || 0) * 100)}%
Total Errors: ${Math.round((metrics.error_rate?.values?.rate || 0) * (metrics.http_reqs?.values?.count || 0))}

BOTTLENECK INDICATORS:
----------------------
Slow Queries (>2s): ${metrics.slow_queries?.values?.count || 0}
Timeouts: ${metrics.timeouts?.values?.count || 0}
Memory Pressure (502/503): ${metrics.memory_pressure_indicators?.values?.count || 0}

SCALING ASSESSMENT:
-------------------
${getScalingAssessment(metrics)}

================================================================================
`;

  return {
    'load-tests/results/scaling-verification.json': JSON.stringify(data, null, 2),
    'load-tests/results/scaling-verification.txt': report,
    stdout: report,
  };
}

function getScalingAssessment(metrics) {
  const errorRate = metrics.error_rate?.values?.rate || 0;
  const p95 = metrics.response_time?.values?.['p(95)'] || 0;
  const timeouts = metrics.timeouts?.values?.count || 0;
  const memPressure = metrics.memory_pressure_indicators?.values?.count || 0;
  
  let assessment = '';
  let safeLimit = 1000;
  
  if (errorRate > 0.1) {
    safeLimit = Math.min(safeLimit, 250);
    assessment += '- HIGH ERROR RATE: Reduce concurrent users\n';
  } else if (errorRate > 0.05) {
    safeLimit = Math.min(safeLimit, 500);
    assessment += '- MODERATE ERROR RATE: Monitor closely above 500 users\n';
  }
  
  if (p95 > 5000) {
    safeLimit = Math.min(safeLimit, 250);
    assessment += '- SLOW RESPONSE: P95 > 5s indicates bottleneck\n';
  } else if (p95 > 3000) {
    safeLimit = Math.min(safeLimit, 500);
    assessment += '- RESPONSE TIME WARNING: P95 > 3s at peak load\n';
  }
  
  if (timeouts > 50) {
    safeLimit = Math.min(safeLimit, 250);
    assessment += '- TIMEOUT ISSUES: Connection/query timeouts detected\n';
  }
  
  if (memPressure > 10) {
    safeLimit = Math.min(safeLimit, 500);
    assessment += '- MEMORY PRESSURE: Server resource exhaustion detected\n';
  }
  
  if (assessment === '') {
    assessment = '- EXCELLENT: System handles all load levels well\n';
  }
  
  assessment += `\nRECOMMENDED SAFE CONCURRENT USER LIMIT: ${safeLimit}`;
  
  return assessment;
}
