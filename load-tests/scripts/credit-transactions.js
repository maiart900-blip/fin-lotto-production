/**
 * Load Test: Credit/Transaction APIs
 * Tests financial operations
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { BASE_URL, getOptions, getAdminHeaders, randomNumber } from '../config.js';

// Custom metrics
const creditCheckTime = new Trend('credit_check_time');
const transactionListTime = new Trend('transaction_list_time');
const ledgerQueryTime = new Trend('ledger_query_time');
const transferTime = new Trend('transfer_time');
const transferSuccessRate = new Rate('transfer_success_rate');

const LEVEL = __ENV.LEVEL || 'baseline';

export const options = {
  ...getOptions(LEVEL),
  tags: { category: 'financial' },
  thresholds: {
    'credit_check_time': ['p(95)<1000'],
    'transaction_list_time': ['p(95)<2000'],
    'ledger_query_time': ['p(95)<2000'],
    'transfer_time': ['p(95)<3000'],
  },
};

const headers = getAdminHeaders();

export default function() {
  group('Credit Check Operations', function() {
    // 1. Check credits
    let startTime = Date.now();
    let res = http.get(`${BASE_URL}/api/credits`, {
      headers,
      tags: { name: 'credits_check' },
    });
    creditCheckTime.add(Date.now() - startTime);
    
    check(res, {
      'credits check returns': (r) => r.status === 200 || r.status === 401,
    });
    
    sleep(0.3);
    
    // 2. Get credit transactions
    startTime = Date.now();
    res = http.get(`${BASE_URL}/api/credit-transactions?limit=50`, {
      headers,
      tags: { name: 'credit_transactions' },
    });
    transactionListTime.add(Date.now() - startTime);
    
    check(res, {
      'transactions load': (r) => r.status === 200 || r.status === 401,
    });
  });
  
  group('Ledger Operations', function() {
    // 1. Query ledger
    let startTime = Date.now();
    let res = http.get(`${BASE_URL}/api/financial/ledger?limit=50`, {
      headers,
      tags: { name: 'ledger_query' },
    });
    ledgerQueryTime.add(Date.now() - startTime);
    
    check(res, {
      'ledger query returns': (r) => r.status === 200 || r.status === 401,
    });
    
    sleep(0.3);
    
    // 2. Get financial summary
    res = http.get(`${BASE_URL}/api/financial/summary`, {
      headers,
      tags: { name: 'financial_summary' },
    });
    
    check(res, {
      'financial summary returns': (r) => r.status === 200 || r.status === 401,
    });
    
    sleep(0.3);
    
    // 3. Get autopilot status
    res = http.get(`${BASE_URL}/api/financial/autopilot?action=status`, {
      headers,
      tags: { name: 'autopilot_status' },
    });
    
    check(res, {
      'autopilot status returns': (r) => r.status === 200 || r.status === 401,
    });
  });
  
  group('Transfer Operations (Read-Only)', function() {
    // Only test read operations - no actual transfers
    
    // 1. Check agent credit
    let res = http.get(`${BASE_URL}/api/agents?limit=10`, {
      headers,
      tags: { name: 'agents_list' },
    });
    
    check(res, {
      'agents list returns': (r) => r.status === 200 || r.status === 401,
    });
    
    sleep(0.3);
    
    // 2. Check downline stats
    res = http.get(`${BASE_URL}/api/agents/downline-stats`, {
      headers,
      tags: { name: 'downline_stats' },
    });
    
    check(res, {
      'downline stats returns': (r) => r.status === 200 || r.status === 401,
    });
    
    sleep(0.3);
    
    // 3. Check commission stats
    res = http.get(`${BASE_URL}/api/agent/commission/stats`, {
      headers,
      tags: { name: 'commission_stats' },
    });
    
    check(res, {
      'commission stats returns': (r) => r.status === 200 || r.status === 401,
    });
  });
  
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  return {
    'load-tests/results/credit-transactions.json': JSON.stringify(data, null, 2),
    stdout: generateSummary(data),
  };
}

function generateSummary(data) {
  const metrics = data.metrics;
  return `
================================================================================
CREDIT/TRANSACTION APIS LOAD TEST RESULTS
================================================================================
Test Level: ${LEVEL}
VUs: ${options.vus}

CREDIT CHECKS:
  Avg Time: ${Math.round(metrics.credit_check_time?.values?.avg || 0)}ms
  P95 Time: ${Math.round(metrics.credit_check_time?.values?.['p(95)'] || 0)}ms

TRANSACTION LISTS:
  Avg Time: ${Math.round(metrics.transaction_list_time?.values?.avg || 0)}ms
  P95 Time: ${Math.round(metrics.transaction_list_time?.values?.['p(95)'] || 0)}ms

LEDGER QUERIES:
  Avg Time: ${Math.round(metrics.ledger_query_time?.values?.avg || 0)}ms
  P95 Time: ${Math.round(metrics.ledger_query_time?.values?.['p(95)'] || 0)}ms

OVERALL:
  Total Requests: ${metrics.http_reqs?.values?.count || 0}
  Request Rate: ${Math.round(metrics.http_reqs?.values?.rate || 0)}/s
  Failed: ${metrics.http_req_failed?.values?.passes || 0}
================================================================================
`;
}
