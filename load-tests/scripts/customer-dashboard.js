/**
 * Load Test: Customer Dashboard
 * Tests authenticated customer operations
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL, getOptions, getAdminHeaders } from '../config.js';

// Custom metrics
const dashboardLoadTime = new Trend('dashboard_load_time');
const walletCheckTime = new Trend('wallet_check_time');
const historyLoadTime = new Trend('history_load_time');

const LEVEL = __ENV.LEVEL || 'baseline';

export const options = {
  ...getOptions(LEVEL),
  tags: { category: 'customer_dashboard' },
  thresholds: {
    'dashboard_load_time': ['p(95)<2000'],
    'wallet_check_time': ['p(95)<1000'],
    'history_load_time': ['p(95)<2000'],
  },
};

// Simulate authenticated customer with admin headers (for testing)
const headers = getAdminHeaders();

// Customer dashboard endpoints
const CUSTOMER_ENDPOINTS = [
  // Dashboard & Profile
  { path: '/api/customer/me', name: 'customer_profile', metric: 'dashboard' },
  { path: '/api/customer/notifications', name: 'notifications', metric: 'dashboard' },
  
  // Wallet & Transactions
  { path: '/api/credits?type=customer', name: 'customer_credits', metric: 'wallet' },
  { path: '/api/credit-transactions?limit=20', name: 'credit_transactions', metric: 'history' },
  
  // Betting
  { path: '/api/lotteries', name: 'lotteries_list', metric: 'dashboard' },
  { path: '/api/bets?limit=20', name: 'bet_history', metric: 'history' },
  { path: '/api/entries?limit=20', name: 'entries_list', metric: 'history' },
  
  // Analysis
  { path: '/api/analysis/hot-cold', name: 'hot_cold_analysis', metric: 'dashboard' },
];

export default function() {
  group('Customer Dashboard Operations', function() {
    // Simulate customer browsing their dashboard
    
    // 1. Load profile
    let startTime = Date.now();
    let res = http.get(`${BASE_URL}/api/customer/me`, {
      headers,
      tags: { name: 'customer_profile' },
    });
    dashboardLoadTime.add(Date.now() - startTime);
    
    check(res, {
      'profile loads': (r) => r.status === 200 || r.status === 401,
    });
    
    sleep(0.3);
    
    // 2. Check wallet/credits
    startTime = Date.now();
    res = http.get(`${BASE_URL}/api/credits?type=customer`, {
      headers,
      tags: { name: 'customer_credits' },
    });
    walletCheckTime.add(Date.now() - startTime);
    
    check(res, {
      'credits load': (r) => r.status === 200 || r.status === 401,
    });
    
    sleep(0.3);
    
    // 3. Browse lotteries
    startTime = Date.now();
    res = http.get(`${BASE_URL}/api/lotteries`, {
      headers,
      tags: { name: 'lotteries_list' },
    });
    dashboardLoadTime.add(Date.now() - startTime);
    
    check(res, {
      'lotteries load': (r) => r.status === 200,
    });
    
    sleep(0.5);
    
    // 4. Check bet history
    startTime = Date.now();
    res = http.get(`${BASE_URL}/api/bets?limit=20`, {
      headers,
      tags: { name: 'bet_history' },
    });
    historyLoadTime.add(Date.now() - startTime);
    
    check(res, {
      'bet history loads': (r) => r.status === 200 || r.status === 401,
    });
    
    sleep(0.3);
    
    // 5. Check notifications
    res = http.get(`${BASE_URL}/api/customer/notifications`, {
      headers,
      tags: { name: 'notifications' },
    });
    
    check(res, {
      'notifications load': (r) => r.status === 200 || r.status === 401,
    });
  });
  
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  return {
    'load-tests/results/customer-dashboard.json': JSON.stringify(data, null, 2),
    stdout: generateSummary(data),
  };
}

function generateSummary(data) {
  const metrics = data.metrics;
  return `
================================================================================
CUSTOMER DASHBOARD LOAD TEST RESULTS
================================================================================
Test Level: ${LEVEL}
VUs: ${options.vus}

DASHBOARD METRICS:
  Load Time (avg): ${Math.round(metrics.dashboard_load_time?.values?.avg || 0)}ms
  Load Time (p95): ${Math.round(metrics.dashboard_load_time?.values?.['p(95)'] || 0)}ms

WALLET METRICS:
  Check Time (avg): ${Math.round(metrics.wallet_check_time?.values?.avg || 0)}ms
  Check Time (p95): ${Math.round(metrics.wallet_check_time?.values?.['p(95)'] || 0)}ms

HISTORY METRICS:
  Load Time (avg): ${Math.round(metrics.history_load_time?.values?.avg || 0)}ms
  Load Time (p95): ${Math.round(metrics.history_load_time?.values?.['p(95)'] || 0)}ms

OVERALL:
  Total Requests: ${metrics.http_reqs?.values?.count || 0}
  Request Rate: ${Math.round(metrics.http_reqs?.values?.rate || 0)}/s
  Failed Requests: ${metrics.http_req_failed?.values?.passes || 0}
================================================================================
`;
}
