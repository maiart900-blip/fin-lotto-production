/**
 * Load Test: Full System Test
 * Comprehensive test simulating realistic user behavior across all systems
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { BASE_URL, getStagedOptions, getAdminHeaders, randomBetAmount, randomLotteryNumber, randomNumber } from '../config.js';

// Custom metrics
const overallResponseTime = new Trend('overall_response_time');
const errorRate = new Rate('error_rate');
const errorCounter = new Counter('errors_by_status');

// Get max VUs from environment or default
const MAX_VUS = parseInt(__ENV.MAX_VUS || '100');

export const options = {
  ...getStagedOptions(MAX_VUS),
  tags: { category: 'full_system' },
  thresholds: {
    'overall_response_time': ['p(95)<3000', 'p(99)<5000'],
    'error_rate': ['rate<0.05'],
    'http_req_failed': ['rate<0.05'],
  },
};

const headers = getAdminHeaders();

// User behavior scenarios with weights
const SCENARIOS = [
  { name: 'browse_public', weight: 30, fn: browsePublic },
  { name: 'customer_dashboard', weight: 25, fn: customerDashboard },
  { name: 'betting_flow', weight: 20, fn: bettingFlow },
  { name: 'agent_dashboard', weight: 15, fn: agentDashboard },
  { name: 'admin_dashboard', weight: 10, fn: adminDashboard },
];

// Calculate total weight for random selection
const totalWeight = SCENARIOS.reduce((sum, s) => sum + s.weight, 0);

function selectScenario() {
  const rand = Math.random() * totalWeight;
  let cumulative = 0;
  for (const scenario of SCENARIOS) {
    cumulative += scenario.weight;
    if (rand < cumulative) {
      return scenario;
    }
  }
  return SCENARIOS[0];
}

export default function() {
  const scenario = selectScenario();
  
  group(scenario.name, function() {
    scenario.fn();
  });
  
  // Think time between actions
  sleep(randomNumber(1, 3));
}

function browsePublic() {
  const endpoints = [
    '/api/health',
    '/api/lotteries',
    '/api/announcements',
    '/c/lotteries',
    '/c/results',
    '/c/promotions',
  ];
  
  endpoints.forEach(endpoint => {
    const startTime = Date.now();
    const res = http.get(`${BASE_URL}${endpoint}`, {
      tags: { scenario: 'browse_public', endpoint },
    });
    overallResponseTime.add(Date.now() - startTime);
    
    const ok = check(res, {
      'status ok': (r) => r.status < 400,
    });
    
    errorRate.add(ok ? 0 : 1);
    if (!ok) {
      errorCounter.add(1, { status: res.status.toString() });
    }
    
    sleep(randomNumber(200, 500) / 1000);
  });
}

function customerDashboard() {
  const endpoints = [
    '/api/customer/me',
    '/api/credits?type=customer',
    '/api/customer/notifications',
    '/api/lotteries',
    '/api/bets?limit=10',
  ];
  
  endpoints.forEach(endpoint => {
    const startTime = Date.now();
    const res = http.get(`${BASE_URL}${endpoint}`, {
      headers,
      tags: { scenario: 'customer_dashboard', endpoint },
    });
    overallResponseTime.add(Date.now() - startTime);
    
    const ok = check(res, {
      'status ok': (r) => r.status < 500,
    });
    
    errorRate.add(ok ? 0 : 1);
    if (!ok) {
      errorCounter.add(1, { status: res.status.toString() });
    }
    
    sleep(randomNumber(300, 700) / 1000);
  });
}

function bettingFlow() {
  // 1. Get lotteries
  let startTime = Date.now();
  let res = http.get(`${BASE_URL}/api/lotteries`, {
    headers,
    tags: { scenario: 'betting_flow', endpoint: '/api/lotteries' },
  });
  overallResponseTime.add(Date.now() - startTime);
  
  let lotteries = [];
  try {
    const body = JSON.parse(res.body);
    lotteries = body.data || body.lotteries || [];
  } catch {
    return;
  }
  
  if (lotteries.length === 0) return;
  
  const lottery = lotteries[Math.floor(Math.random() * lotteries.length)];
  
  sleep(0.5);
  
  // 2. Get lottery detail
  startTime = Date.now();
  res = http.get(`${BASE_URL}/api/lotteries/${lottery.id}`, {
    headers,
    tags: { scenario: 'betting_flow', endpoint: '/api/lotteries/[id]' },
  });
  overallResponseTime.add(Date.now() - startTime);
  
  sleep(0.3);
  
  // 3. Get rates
  startTime = Date.now();
  res = http.get(`${BASE_URL}/api/payout-rates?lottery_id=${lottery.id}`, {
    headers,
    tags: { scenario: 'betting_flow', endpoint: '/api/payout-rates' },
  });
  overallResponseTime.add(Date.now() - startTime);
  
  sleep(0.5);
  
  // 4. Place bet
  const betPayload = {
    lottery_id: lottery.id,
    entries: [
      {
        bet_type: '2_top',
        number: randomLotteryNumber(2),
        amount: randomBetAmount(),
      },
    ],
  };
  
  startTime = Date.now();
  res = http.post(`${BASE_URL}/api/bets`, JSON.stringify(betPayload), {
    headers,
    tags: { scenario: 'betting_flow', endpoint: '/api/bets' },
  });
  overallResponseTime.add(Date.now() - startTime);
  
  const ok = check(res, {
    'bet not server error': (r) => r.status < 500,
  });
  
  errorRate.add(ok ? 0 : 1);
  if (!ok) {
    errorCounter.add(1, { status: res.status.toString() });
  }
}

function agentDashboard() {
  const endpoints = [
    '/api/agent/profit',
    '/api/agent/commission/stats',
    '/api/agent/downline?limit=10',
    '/api/agent/entries?limit=20',
    '/api/agents/downline-stats',
  ];
  
  endpoints.forEach(endpoint => {
    const startTime = Date.now();
    const res = http.get(`${BASE_URL}${endpoint}`, {
      headers,
      tags: { scenario: 'agent_dashboard', endpoint },
    });
    overallResponseTime.add(Date.now() - startTime);
    
    const ok = check(res, {
      'status ok': (r) => r.status < 500,
    });
    
    errorRate.add(ok ? 0 : 1);
    if (!ok) {
      errorCounter.add(1, { status: res.status.toString() });
    }
    
    sleep(randomNumber(200, 500) / 1000);
  });
}

function adminDashboard() {
  const endpoints = [
    '/api/dashboard/stats',
    '/api/admin/pending-counts',
    '/api/agents?limit=10',
    '/api/customers?limit=10',
    '/api/entries?limit=20',
    '/api/jobs/stats',
  ];
  
  endpoints.forEach(endpoint => {
    const startTime = Date.now();
    const res = http.get(`${BASE_URL}${endpoint}`, {
      headers,
      tags: { scenario: 'admin_dashboard', endpoint },
    });
    overallResponseTime.add(Date.now() - startTime);
    
    const ok = check(res, {
      'status ok': (r) => r.status < 500,
    });
    
    errorRate.add(ok ? 0 : 1);
    if (!ok) {
      errorCounter.add(1, { status: res.status.toString() });
    }
    
    sleep(randomNumber(200, 400) / 1000);
  });
}

export function handleSummary(data) {
  return {
    'load-tests/results/full-system.json': JSON.stringify(data, null, 2),
    stdout: generateSummary(data),
  };
}

function generateSummary(data) {
  const metrics = data.metrics;
  return `
================================================================================
FULL SYSTEM LOAD TEST RESULTS
================================================================================
Max VUs: ${MAX_VUS}
Stages: Ramp up -> Peak -> Ramp down

OVERALL PERFORMANCE:
  Response Time (avg): ${Math.round(metrics.overall_response_time?.values?.avg || 0)}ms
  Response Time (p95): ${Math.round(metrics.overall_response_time?.values?.['p(95)'] || 0)}ms
  Response Time (p99): ${Math.round(metrics.overall_response_time?.values?.['p(99)'] || 0)}ms
  Response Time (max): ${Math.round(metrics.overall_response_time?.values?.max || 0)}ms

ERROR METRICS:
  Error Rate: ${((metrics.error_rate?.values?.rate || 0) * 100).toFixed(2)}%
  Total Errors: ${metrics.errors_by_status?.values?.count || 0}

REQUEST METRICS:
  Total Requests: ${metrics.http_reqs?.values?.count || 0}
  Request Rate: ${Math.round(metrics.http_reqs?.values?.rate || 0)}/s
  Failed Requests: ${metrics.http_req_failed?.values?.passes || 0}
  Failed Rate: ${((metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%

HTTP RESPONSE TIMES:
  Connect: ${Math.round(metrics.http_req_connecting?.values?.avg || 0)}ms
  TLS: ${Math.round(metrics.http_req_tls_handshaking?.values?.avg || 0)}ms
  Sending: ${Math.round(metrics.http_req_sending?.values?.avg || 0)}ms
  Waiting: ${Math.round(metrics.http_req_waiting?.values?.avg || 0)}ms
  Receiving: ${Math.round(metrics.http_req_receiving?.values?.avg || 0)}ms

THRESHOLDS:
${Object.entries(data.thresholds || {}).map(([k, v]) => `  ${k}: ${v.ok ? 'PASS' : 'FAIL'}`).join('\n')}
================================================================================
`;
}
