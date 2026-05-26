/**
 * K6 Load Testing - Shared Configuration
 */

// Base URL - override with -e BASE_URL=https://your-domain.com
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test user credentials (for authenticated tests)
export const TEST_CUSTOMER = {
  username: __ENV.TEST_CUSTOMER_USERNAME || 'testcustomer',
  password: __ENV.TEST_CUSTOMER_PASSWORD || 'testpassword123',
};

export const TEST_AGENT = {
  username: __ENV.TEST_AGENT_USERNAME || 'testagent',
  password: __ENV.TEST_AGENT_PASSWORD || 'testpassword123',
};

export const TEST_ADMIN = {
  id: __ENV.TEST_ADMIN_ID || '0c24a9f5-e544-4fe4-be09-d145a952713a',
  role: 'super_admin',
};

// Traffic level configurations
export const TRAFFIC_LEVELS = {
  baseline: { vus: 50, duration: '30s' },
  normal: { vus: 100, duration: '1m' },
  peak: { vus: 250, duration: '1m' },
  stress: { vus: 500, duration: '1m' },
  breaking: { vus: 1000, duration: '30s' },
};

// Thresholds for pass/fail
export const DEFAULT_THRESHOLDS = {
  // Response time thresholds
  http_req_duration: ['p(95)<2000', 'p(99)<5000'], // 95% under 2s, 99% under 5s
  // Error rate threshold
  http_req_failed: ['rate<0.05'], // Less than 5% errors
  // Custom metrics
  'http_req_duration{type:api}': ['p(95)<1000'], // APIs under 1s
  'http_req_duration{type:page}': ['p(95)<3000'], // Pages under 3s
};

// Standard k6 options
export function getOptions(level = 'baseline', customThresholds = {}) {
  const config = TRAFFIC_LEVELS[level] || TRAFFIC_LEVELS.baseline;
  
  return {
    vus: config.vus,
    duration: config.duration,
    thresholds: {
      ...DEFAULT_THRESHOLDS,
      ...customThresholds,
    },
    // Tags for filtering
    tags: {
      testLevel: level,
    },
  };
}

// Staged load test (ramp up/down)
export function getStagedOptions(maxVus = 100) {
  return {
    stages: [
      { duration: '30s', target: Math.floor(maxVus * 0.2) }, // Ramp up to 20%
      { duration: '1m', target: Math.floor(maxVus * 0.5) },  // Ramp up to 50%
      { duration: '2m', target: maxVus },                    // Full load
      { duration: '1m', target: Math.floor(maxVus * 0.5) },  // Ramp down
      { duration: '30s', target: 0 },                        // Cool down
    ],
    thresholds: DEFAULT_THRESHOLDS,
  };
}

// Helper to create auth headers
export function getAdminHeaders() {
  return {
    'Cookie': `admin_id=${TEST_ADMIN.id}; admin_role=${TEST_ADMIN.role}`,
    'Content-Type': 'application/json',
  };
}

export function getCustomerHeaders(sessionToken) {
  return {
    'Cookie': `customer_session=${sessionToken}`,
    'Content-Type': 'application/json',
  };
}

export function getAgentHeaders(sessionToken) {
  return {
    'Cookie': `agent_session=${sessionToken}`,
    'Content-Type': 'application/json',
  };
}

// Random data generators
export function randomString(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomBetAmount() {
  const amounts = [10, 20, 50, 100, 200, 500];
  return amounts[Math.floor(Math.random() * amounts.length)];
}

export function randomLotteryNumber(digits = 2) {
  return String(randomNumber(0, Math.pow(10, digits) - 1)).padStart(digits, '0');
}

// Sleep with jitter
export function sleepWithJitter(baseMs, jitterMs = 500) {
  const ms = baseMs + randomNumber(-jitterMs, jitterMs);
  return new Promise(resolve => setTimeout(resolve, Math.max(100, ms)));
}
