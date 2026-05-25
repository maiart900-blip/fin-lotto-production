/**
 * Load Test: Monitoring APIs
 * Tests health, metrics, and monitoring endpoints
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { BASE_URL, getOptions, getAdminHeaders } from '../config.js';

// Custom metrics
const healthCheckTime = new Trend('health_check_time');
const metricsLoadTime = new Trend('metrics_load_time');
const logsLoadTime = new Trend('logs_load_time');

const LEVEL = __ENV.LEVEL || 'baseline';

export const options = {
  ...getOptions(LEVEL),
  tags: { category: 'monitoring' },
  thresholds: {
    'health_check_time': ['p(95)<500'],
    'metrics_load_time': ['p(95)<2000'],
    'logs_load_time': ['p(95)<2000'],
  },
};

const headers = getAdminHeaders();

const MONITORING_ENDPOINTS = {
  health: [
    '/api/health',
    '/api/health/redis',
    '/api/gateway/health',
  ],
  metrics: [
    '/api/jobs/stats',
    '/api/financial/worker?action=status',
    '/api/financial/reconciliation?action=stats',
    '/api/entries/stats',
    '/api/hedging/stats',
  ],
  logs: [
    '/api/audit-logs?limit=20',
    '/api/activity-logs?limit=20',
    '/api/auth/security-logs?limit=20',
  ],
};

export default function() {
  group('Health Checks', function() {
    MONITORING_ENDPOINTS.health.forEach(endpoint => {
      const startTime = Date.now();
      const res = http.get(`${BASE_URL}${endpoint}`, {
        headers,
        tags: { name: 'health_' + endpoint.split('/').pop() },
      });
      healthCheckTime.add(Date.now() - startTime);
      
      check(res, {
        [`${endpoint} is healthy`]: (r) => r.status === 200,
        [`${endpoint} responds fast`]: (r) => r.timings.duration < 1000,
      });
      
      sleep(0.1);
    });
  });
  
  group('Metrics Endpoints', function() {
    MONITORING_ENDPOINTS.metrics.forEach(endpoint => {
      const startTime = Date.now();
      const res = http.get(`${BASE_URL}${endpoint}`, {
        headers,
        tags: { name: 'metrics_' + endpoint.split('/').pop().split('?')[0] },
      });
      metricsLoadTime.add(Date.now() - startTime);
      
      check(res, {
        [`${endpoint} returns`]: (r) => r.status === 200 || r.status === 401,
      });
      
      sleep(0.2);
    });
  });
  
  group('Log Endpoints', function() {
    MONITORING_ENDPOINTS.logs.forEach(endpoint => {
      const startTime = Date.now();
      const res = http.get(`${BASE_URL}${endpoint}`, {
        headers,
        tags: { name: 'logs_' + endpoint.split('/').pop().split('?')[0] },
      });
      logsLoadTime.add(Date.now() - startTime);
      
      check(res, {
        [`${endpoint} returns`]: (r) => r.status === 200 || r.status === 401,
      });
      
      sleep(0.2);
    });
  });
  
  sleep(Math.random() + 0.5);
}

export function handleSummary(data) {
  return {
    'load-tests/results/monitoring-apis.json': JSON.stringify(data, null, 2),
    stdout: generateSummary(data),
  };
}

function generateSummary(data) {
  const metrics = data.metrics;
  return `
================================================================================
MONITORING APIS LOAD TEST RESULTS
================================================================================
Test Level: ${LEVEL}
VUs: ${options.vus}

HEALTH CHECKS:
  Avg Time: ${Math.round(metrics.health_check_time?.values?.avg || 0)}ms
  P95 Time: ${Math.round(metrics.health_check_time?.values?.['p(95)'] || 0)}ms
  Max Time: ${Math.round(metrics.health_check_time?.values?.max || 0)}ms

METRICS ENDPOINTS:
  Avg Time: ${Math.round(metrics.metrics_load_time?.values?.avg || 0)}ms
  P95 Time: ${Math.round(metrics.metrics_load_time?.values?.['p(95)'] || 0)}ms

LOGS ENDPOINTS:
  Avg Time: ${Math.round(metrics.logs_load_time?.values?.avg || 0)}ms
  P95 Time: ${Math.round(metrics.logs_load_time?.values?.['p(95)'] || 0)}ms

OVERALL:
  Total Requests: ${metrics.http_reqs?.values?.count || 0}
  Request Rate: ${Math.round(metrics.http_reqs?.values?.rate || 0)}/s
  Failed: ${metrics.http_req_failed?.values?.passes || 0}
================================================================================
`;
}
