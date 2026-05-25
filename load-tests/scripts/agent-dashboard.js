/**
 * Load Test: Agent Dashboard
 * Tests agent-specific operations
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { BASE_URL, getOptions, getAdminHeaders } from '../config.js';

// Custom metrics
const agentDashboardTime = new Trend('agent_dashboard_time');
const networkLoadTime = new Trend('agent_network_time');
const commissionTime = new Trend('agent_commission_time');
const memberLoadTime = new Trend('agent_member_time');

const LEVEL = __ENV.LEVEL || 'baseline';

export const options = {
  ...getOptions(LEVEL),
  tags: { category: 'agent' },
  thresholds: {
    'agent_dashboard_time': ['p(95)<2000'],
    'agent_network_time': ['p(95)<2500'],
    'agent_commission_time': ['p(95)<2000'],
    'agent_member_time': ['p(95)<2000'],
  },
};

const headers = getAdminHeaders();

export default function() {
  group('Agent Dashboard', function() {
    // 1. Agent profile/stats
    let startTime = Date.now();
    let res = http.get(`${BASE_URL}/api/agent/profit`, {
      headers,
      tags: { name: 'agent_profit' },
    });
    agentDashboardTime.add(Date.now() - startTime);
    
    check(res, {
      'agent profit loads': (r) => r.status === 200 || r.status === 401,
    });
    
    sleep(0.3);
    
    // 2. Turnover chart
    startTime = Date.now();
    res = http.get(`${BASE_URL}/api/agent/turnover-chart`, {
      headers,
      tags: { name: 'turnover_chart' },
    });
    agentDashboardTime.add(Date.now() - startTime);
    
    check(res, {
      'turnover chart loads': (r) => r.status === 200 || r.status === 401,
    });
  });
  
  group('Agent Network', function() {
    // 1. Agent tree
    let startTime = Date.now();
    let res = http.get(`${BASE_URL}/api/agent-tree`, {
      headers,
      tags: { name: 'agent_tree' },
    });
    networkLoadTime.add(Date.now() - startTime);
    
    check(res, {
      'agent tree loads': (r) => r.status === 200 || r.status === 401,
    });
    
    sleep(0.3);
    
    // 2. Downline list
    startTime = Date.now();
    res = http.get(`${BASE_URL}/api/agent/downline?limit=20`, {
      headers,
      tags: { name: 'agent_downline' },
    });
    networkLoadTime.add(Date.now() - startTime);
    
    check(res, {
      'downline loads': (r) => r.status === 200 || r.status === 401,
    });
    
    sleep(0.3);
    
    // 3. Team stats
    startTime = Date.now();
    res = http.get(`${BASE_URL}/api/agent/team`, {
      headers,
      tags: { name: 'agent_team' },
    });
    networkLoadTime.add(Date.now() - startTime);
    
    check(res, {
      'team stats loads': (r) => r.status === 200 || r.status === 401,
    });
  });
  
  group('Agent Commission', function() {
    // 1. Commission stats
    let startTime = Date.now();
    let res = http.get(`${BASE_URL}/api/agent/commission/stats`, {
      headers,
      tags: { name: 'commission_stats' },
    });
    commissionTime.add(Date.now() - startTime);
    
    check(res, {
      'commission stats loads': (r) => r.status === 200 || r.status === 401,
    });
    
    sleep(0.3);
    
    // 2. Commission logs
    startTime = Date.now();
    res = http.get(`${BASE_URL}/api/agent/commission/logs?limit=20`, {
      headers,
      tags: { name: 'commission_logs' },
    });
    commissionTime.add(Date.now() - startTime);
    
    check(res, {
      'commission logs loads': (r) => r.status === 200 || r.status === 401,
    });
    
    sleep(0.3);
    
    // 3. Settlement
    startTime = Date.now();
    res = http.get(`${BASE_URL}/api/agent/settlement`, {
      headers,
      tags: { name: 'agent_settlement' },
    });
    commissionTime.add(Date.now() - startTime);
    
    check(res, {
      'settlement loads': (r) => r.status === 200 || r.status === 401,
    });
  });
  
  group('Agent Members', function() {
    // 1. Member list
    let startTime = Date.now();
    let res = http.get(`${BASE_URL}/api/customers?limit=20`, {
      headers,
      tags: { name: 'agent_members' },
    });
    memberLoadTime.add(Date.now() - startTime);
    
    check(res, {
      'members load': (r) => r.status === 200 || r.status === 401,
    });
    
    sleep(0.3);
    
    // 2. Entries
    startTime = Date.now();
    res = http.get(`${BASE_URL}/api/agent/entries?limit=50`, {
      headers,
      tags: { name: 'agent_entries' },
    });
    memberLoadTime.add(Date.now() - startTime);
    
    check(res, {
      'entries load': (r) => r.status === 200 || r.status === 401,
    });
  });
  
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  return {
    'load-tests/results/agent-dashboard.json': JSON.stringify(data, null, 2),
    stdout: generateSummary(data),
  };
}

function generateSummary(data) {
  const metrics = data.metrics;
  return `
================================================================================
AGENT DASHBOARD LOAD TEST RESULTS
================================================================================
Test Level: ${LEVEL}
VUs: ${options.vus}

DASHBOARD:
  Avg Time: ${Math.round(metrics.agent_dashboard_time?.values?.avg || 0)}ms
  P95 Time: ${Math.round(metrics.agent_dashboard_time?.values?.['p(95)'] || 0)}ms

NETWORK:
  Avg Time: ${Math.round(metrics.agent_network_time?.values?.avg || 0)}ms
  P95 Time: ${Math.round(metrics.agent_network_time?.values?.['p(95)'] || 0)}ms

COMMISSION:
  Avg Time: ${Math.round(metrics.agent_commission_time?.values?.avg || 0)}ms
  P95 Time: ${Math.round(metrics.agent_commission_time?.values?.['p(95)'] || 0)}ms

MEMBERS:
  Avg Time: ${Math.round(metrics.agent_member_time?.values?.avg || 0)}ms
  P95 Time: ${Math.round(metrics.agent_member_time?.values?.['p(95)'] || 0)}ms

OVERALL:
  Total Requests: ${metrics.http_reqs?.values?.count || 0}
  Request Rate: ${Math.round(metrics.http_reqs?.values?.rate || 0)}/s
  Failed: ${metrics.http_req_failed?.values?.passes || 0}
================================================================================
`;
}
