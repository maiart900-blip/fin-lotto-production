/**
 * Load Test: Public Pages
 * Tests unauthenticated endpoints and landing pages
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL, getOptions } from '../config.js';

// Custom metrics
const errorCounter = new Counter('custom_errors');
const pageLoadTime = new Trend('page_load_time');

// Test level from environment or default
const LEVEL = __ENV.LEVEL || 'baseline';

export const options = {
  ...getOptions(LEVEL),
  tags: { category: 'public' },
};

// Public endpoints to test
const PUBLIC_ENDPOINTS = [
  // Health checks
  { path: '/api/health', name: 'health_check', type: 'api' },
  { path: '/api/health/redis', name: 'redis_health', type: 'api' },
  
  // Public pages
  { path: '/c', name: 'customer_home', type: 'page' },
  { path: '/c/login', name: 'customer_login', type: 'page' },
  { path: '/c/register', name: 'customer_register', type: 'page' },
  { path: '/c/lotteries', name: 'lotteries_list', type: 'page' },
  { path: '/c/results', name: 'results_page', type: 'page' },
  { path: '/c/how-to', name: 'how_to_page', type: 'page' },
  { path: '/c/rules', name: 'rules_page', type: 'page' },
  { path: '/c/promotions', name: 'promotions_page', type: 'page' },
  
  // Public APIs
  { path: '/api/lotteries', name: 'lotteries_api', type: 'api' },
  { path: '/api/announcements', name: 'announcements_api', type: 'api' },
  { path: '/api/payout-rates', name: 'payout_rates_api', type: 'api' },
];

export default function() {
  // Pick a random endpoint
  const endpoint = PUBLIC_ENDPOINTS[Math.floor(Math.random() * PUBLIC_ENDPOINTS.length)];
  const url = `${BASE_URL}${endpoint.path}`;
  
  const startTime = Date.now();
  const response = http.get(url, {
    tags: { 
      name: endpoint.name, 
      type: endpoint.type,
      endpoint: endpoint.path,
    },
  });
  const duration = Date.now() - startTime;
  
  // Record custom metrics
  pageLoadTime.add(duration, { endpoint: endpoint.name });
  
  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 2000ms': (r) => r.timings.duration < 2000,
    'no server error': (r) => r.status < 500,
  });
  
  if (!success) {
    errorCounter.add(1, { endpoint: endpoint.name, status: response.status });
  }
  
  // Short sleep between requests
  sleep(Math.random() * 2 + 0.5);
}

export function handleSummary(data) {
  return {
    'load-tests/results/public-pages.json': JSON.stringify(data, null, 2),
    stdout: generateSummary(data),
  };
}

function generateSummary(data) {
  const metrics = data.metrics;
  return `
================================================================================
PUBLIC PAGES LOAD TEST RESULTS
================================================================================
Test Level: ${LEVEL}
Duration: ${options.duration}
VUs: ${options.vus}

RESPONSE TIMES:
  Average: ${Math.round(metrics.http_req_duration?.values?.avg || 0)}ms
  P95: ${Math.round(metrics.http_req_duration?.values?.['p(95)'] || 0)}ms
  P99: ${Math.round(metrics.http_req_duration?.values?.['p(99)'] || 0)}ms
  Max: ${Math.round(metrics.http_req_duration?.values?.max || 0)}ms

REQUESTS:
  Total: ${metrics.http_reqs?.values?.count || 0}
  Rate: ${Math.round(metrics.http_reqs?.values?.rate || 0)}/s
  Failed: ${metrics.http_req_failed?.values?.passes || 0}

ERROR BREAKDOWN:
  Custom Errors: ${metrics.custom_errors?.values?.count || 0}

THRESHOLDS:
  ${Object.entries(data.thresholds || {}).map(([k, v]) => `  ${k}: ${v.ok ? 'PASS' : 'FAIL'}`).join('\n')}
================================================================================
`;
}
