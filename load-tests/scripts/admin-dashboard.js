/**
 * Load Test: Admin Dashboard
 * Tests admin-specific operations
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { BASE_URL, getOptions, getAdminHeaders } from '../config.js';

// Custom metrics
const dashboardLoadTime = new Trend('admin_dashboard_time');
const reportsLoadTime = new Trend('admin_reports_time');
const operationsTime = new Trend('admin_operations_time');

const LEVEL = __ENV.LEVEL || 'baseline';

export const options = {
  ...getOptions(LEVEL),
  tags: { category: 'admin' },
  thresholds: {
    'admin_dashboard_time': ['p(95)<2000'],
    'admin_reports_time': ['p(95)<3000'],
    'admin_operations_time': ['p(95)<2000'],
  },
};

const headers = getAdminHeaders();

// Admin endpoints to test
const ADMIN_ENDPOINTS = {
  dashboard: [
    '/api/dashboard/stats',
    '/api/admin/pending-counts',
    '/api/admin/operations',
  ],
  reports: [
    '/api/admin/daily-closing?date=' + new Date().toISOString().split('T')[0],
    '/api/admin-sales-report',
    '/api/finance-reports?type=daily',
    '/api/admin/analytics/risk-analysis',
  ],
  operations: [
    '/api/agents?limit=20',
    '/api/customers?limit=20',
    '/api/entries?limit=50',
    '/api/bets?limit=50',
    '/api/deposit-requests?limit=20',
    '/api/admin-withdraw?limit=20',
  ],
  monitoring: [
    '/api/jobs/stats',
    '/api/financial/reconciliation?action=stats',
    '/api/financial/worker?action=status',
    '/api/audit-logs?limit=20',
    '/api/activity-logs?limit=20',
  ],
};

export default function() {
  group('Admin Dashboard Load', function() {
    ADMIN_ENDPOINTS.dashboard.forEach(endpoint => {
      const startTime = Date.now();
      const res = http.get(`${BASE_URL}${endpoint}`, {
        headers,
        tags: { name: endpoint.split('/').pop() },
      });
      dashboardLoadTime.add(Date.now() - startTime);
      
      check(res, {
        [`${endpoint} returns`]: (r) => r.status === 200 || r.status === 401,
      });
      
      sleep(0.2);
    });
  });
  
  group('Admin Reports Load', function() {
    ADMIN_ENDPOINTS.reports.forEach(endpoint => {
      const startTime = Date.now();
      const res = http.get(`${BASE_URL}${endpoint}`, {
        headers,
        tags: { name: 'report_' + endpoint.split('/').pop().split('?')[0] },
      });
      reportsLoadTime.add(Date.now() - startTime);
      
      check(res, {
        [`${endpoint} returns`]: (r) => r.status === 200 || r.status === 401,
      });
      
      sleep(0.3);
    });
  });
  
  group('Admin Operations', function() {
    // Randomly pick 3 operation endpoints to test
    const shuffled = ADMIN_ENDPOINTS.operations.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);
    
    selected.forEach(endpoint => {
      const startTime = Date.now();
      const res = http.get(`${BASE_URL}${endpoint}`, {
        headers,
        tags: { name: 'ops_' + endpoint.split('/').pop().split('?')[0] },
      });
      operationsTime.add(Date.now() - startTime);
      
      check(res, {
        [`${endpoint} returns`]: (r) => r.status === 200 || r.status === 401,
      });
      
      sleep(0.2);
    });
  });
  
  group('Admin Monitoring', function() {
    ADMIN_ENDPOINTS.monitoring.forEach(endpoint => {
      const res = http.get(`${BASE_URL}${endpoint}`, {
        headers,
        tags: { name: 'monitor_' + endpoint.split('/').pop().split('?')[0] },
      });
      
      check(res, {
        [`${endpoint} returns`]: (r) => r.status === 200 || r.status === 401,
      });
      
      sleep(0.2);
    });
  });
  
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  return {
    'load-tests/results/admin-dashboard.json': JSON.stringify(data, null, 2),
    stdout: generateSummary(data),
  };
}

function generateSummary(data) {
  const metrics = data.metrics;
  return `
================================================================================
ADMIN DASHBOARD LOAD TEST RESULTS
================================================================================
Test Level: ${LEVEL}
VUs: ${options.vus}

DASHBOARD LOAD:
  Avg Time: ${Math.round(metrics.admin_dashboard_time?.values?.avg || 0)}ms
  P95 Time: ${Math.round(metrics.admin_dashboard_time?.values?.['p(95)'] || 0)}ms

REPORTS LOAD:
  Avg Time: ${Math.round(metrics.admin_reports_time?.values?.avg || 0)}ms
  P95 Time: ${Math.round(metrics.admin_reports_time?.values?.['p(95)'] || 0)}ms

OPERATIONS:
  Avg Time: ${Math.round(metrics.admin_operations_time?.values?.avg || 0)}ms
  P95 Time: ${Math.round(metrics.admin_operations_time?.values?.['p(95)'] || 0)}ms

OVERALL:
  Total Requests: ${metrics.http_reqs?.values?.count || 0}
  Request Rate: ${Math.round(metrics.http_reqs?.values?.rate || 0)}/s
  Failed: ${metrics.http_req_failed?.values?.passes || 0}
================================================================================
`;
}
