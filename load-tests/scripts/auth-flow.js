/**
 * Load Test: Authentication Flow
 * Tests login, session, and logout endpoints
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { BASE_URL, getOptions, TEST_CUSTOMER, randomString } from '../config.js';

// Custom metrics
const loginSuccess = new Rate('login_success_rate');
const loginDuration = new Trend('login_duration');
const sessionCheckDuration = new Trend('session_check_duration');

const LEVEL = __ENV.LEVEL || 'baseline';

export const options = {
  ...getOptions(LEVEL),
  tags: { category: 'auth' },
  thresholds: {
    'login_success_rate': ['rate>0.8'], // 80% login success
    'login_duration': ['p(95)<3000'], // Login under 3s
    'session_check_duration': ['p(95)<500'], // Session check under 500ms
  },
};

export default function() {
  group('Customer Authentication Flow', function() {
    // 1. Check session (unauthenticated)
    let startTime = Date.now();
    let res = http.get(`${BASE_URL}/api/customer/auth/session`, {
      tags: { name: 'session_check_unauth' },
    });
    sessionCheckDuration.add(Date.now() - startTime);
    
    check(res, {
      'session check returns 200': (r) => r.status === 200,
    });
    
    sleep(0.5);
    
    // 2. Attempt login
    startTime = Date.now();
    res = http.post(`${BASE_URL}/api/customer/auth/login`, JSON.stringify({
      username: TEST_CUSTOMER.username,
      password: TEST_CUSTOMER.password,
    }), {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'customer_login' },
    });
    loginDuration.add(Date.now() - startTime);
    
    const loginOk = check(res, {
      'login returns 200': (r) => r.status === 200,
      'login has success': (r) => {
        try {
          return JSON.parse(r.body).success === true;
        } catch {
          return false;
        }
      },
    });
    
    loginSuccess.add(loginOk ? 1 : 0);
    
    sleep(1);
    
    // 3. Check session (authenticated) - only if login succeeded
    if (loginOk && res.cookies && res.cookies.customer_session) {
      const sessionCookie = res.cookies.customer_session[0].value;
      
      startTime = Date.now();
      res = http.get(`${BASE_URL}/api/customer/auth/session`, {
        headers: { 'Cookie': `customer_session=${sessionCookie}` },
        tags: { name: 'session_check_auth' },
      });
      sessionCheckDuration.add(Date.now() - startTime);
      
      check(res, {
        'authenticated session returns 200': (r) => r.status === 200,
        'session has user data': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.authenticated === true;
          } catch {
            return false;
          }
        },
      });
      
      sleep(0.5);
      
      // 4. Logout
      res = http.post(`${BASE_URL}/api/customer/auth/logout`, null, {
        headers: { 'Cookie': `customer_session=${sessionCookie}` },
        tags: { name: 'customer_logout' },
      });
      
      check(res, {
        'logout returns 200': (r) => r.status === 200,
      });
    }
  });
  
  group('Admin Authentication Flow', function() {
    // Admin login (via admin_id cookie - simulating session)
    const adminId = '0c24a9f5-e544-4fe4-be09-d145a952713a';
    
    const res = http.get(`${BASE_URL}/api/auth/session`, {
      headers: { 'Cookie': `admin_id=${adminId}; admin_role=super_admin` },
      tags: { name: 'admin_session_check' },
    });
    
    check(res, {
      'admin session returns 200': (r) => r.status === 200,
    });
  });
  
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  return {
    'load-tests/results/auth-flow.json': JSON.stringify(data, null, 2),
    stdout: generateSummary(data),
  };
}

function generateSummary(data) {
  const metrics = data.metrics;
  return `
================================================================================
AUTHENTICATION FLOW LOAD TEST RESULTS
================================================================================
Test Level: ${LEVEL}
VUs: ${options.vus}

LOGIN METRICS:
  Success Rate: ${Math.round((metrics.login_success_rate?.values?.rate || 0) * 100)}%
  Average Duration: ${Math.round(metrics.login_duration?.values?.avg || 0)}ms
  P95 Duration: ${Math.round(metrics.login_duration?.values?.['p(95)'] || 0)}ms

SESSION CHECK:
  Average Duration: ${Math.round(metrics.session_check_duration?.values?.avg || 0)}ms
  P95 Duration: ${Math.round(metrics.session_check_duration?.values?.['p(95)'] || 0)}ms

OVERALL:
  Total Requests: ${metrics.http_reqs?.values?.count || 0}
  Failed Requests: ${metrics.http_req_failed?.values?.passes || 0}
  Avg Response Time: ${Math.round(metrics.http_req_duration?.values?.avg || 0)}ms
================================================================================
`;
}
