/**
 * Production Traffic Simulation
 * Simulates realistic production traffic patterns including:
 * - Customer betting spikes
 * - Manual key entries
 * - Multiple agents active
 * - Concurrent settlement processing
 * - Payout bursts after results
 * - Rapid betting bursts
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { BASE_URL, getAdminHeaders, randomBetAmount, randomLotteryNumber, randomNumber } from '../config.js';

// ===== Custom Metrics =====
// Betting metrics
const betPlacementTime = new Trend('bet_placement_time', true);
const betSuccessRate = new Rate('bet_success_rate');
const rapidBetCounter = new Counter('rapid_bet_count');

// Manual key metrics
const manualKeyTime = new Trend('manual_key_time', true);
const manualKeySuccessRate = new Rate('manual_key_success_rate');

// Settlement metrics
const settlementTime = new Trend('settlement_time', true);
const settlementSuccessRate = new Rate('settlement_success_rate');

// Payout metrics
const payoutTime = new Trend('payout_time', true);
const payoutSuccessRate = new Rate('payout_success_rate');

// Safety metrics
const duplicatePayoutAttempts = new Counter('duplicate_payout_attempts');
const orphanEntryAttempts = new Counter('orphan_entry_attempts');
const crossAgentLeakAttempts = new Counter('cross_agent_leak_attempts');

// DB/API metrics
const dbLatency = new Trend('db_latency', true);
const apiLatency = new Trend('api_latency', true);

// ===== Test Configuration =====
const LEVEL = __ENV.LEVEL || 'baseline';
const SCENARIO = __ENV.SCENARIO || 'mixed';

// Traffic level configurations
const TRAFFIC_CONFIGS = {
  light: { vus: 50, duration: '2m' },
  normal: { vus: 100, duration: '3m' },
  peak: { vus: 250, duration: '3m' },
  stress: { vus: 500, duration: '2m' },
  breaking: { vus: 1000, duration: '1m' },
};

const config = TRAFFIC_CONFIGS[LEVEL] || TRAFFIC_CONFIGS.light;

export const options = {
  scenarios: {
    // Scenario 1: Customer betting (60% of traffic)
    customer_betting: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Math.floor(config.vus * 0.3) },
        { duration: '1m', target: Math.floor(config.vus * 0.6) },
        { duration: '1m', target: Math.floor(config.vus * 0.6) },
        { duration: '30s', target: 0 },
      ],
      exec: 'customerBetting',
      tags: { scenario: 'customer_betting' },
    },
    // Scenario 2: Manual key entries (20% of traffic)
    manual_key: {
      executor: 'constant-vus',
      vus: Math.floor(config.vus * 0.2),
      duration: config.duration,
      exec: 'manualKeyEntry',
      tags: { scenario: 'manual_key' },
    },
    // Scenario 3: Agent operations (15% of traffic)
    agent_operations: {
      executor: 'constant-vus',
      vus: Math.floor(config.vus * 0.15),
      duration: config.duration,
      exec: 'agentOperations',
      tags: { scenario: 'agent_operations' },
    },
    // Scenario 4: Settlement processing (5% of traffic - admin only)
    settlement: {
      executor: 'per-vu-iterations',
      vus: Math.max(1, Math.floor(config.vus * 0.05)),
      iterations: 3,
      exec: 'settlementProcessing',
      tags: { scenario: 'settlement' },
    },
  },
  thresholds: {
    // Performance thresholds
    'bet_placement_time': ['p(95)<3000', 'p(99)<5000'],
    'manual_key_time': ['p(95)<2000'],
    'settlement_time': ['p(95)<10000'],
    'api_latency': ['p(95)<1000'],
    
    // Safety thresholds - CRITICAL
    'duplicate_payout_attempts': ['count<1'],
    'orphan_entry_attempts': ['count<1'],
    'cross_agent_leak_attempts': ['count<1'],
    
    // Success rate thresholds
    'bet_success_rate': ['rate>0.8'],
    'manual_key_success_rate': ['rate>0.9'],
    'settlement_success_rate': ['rate>0.95'],
  },
};

const headers = getAdminHeaders();

// ===== Scenario Functions =====

// Customer betting flow with spike simulation
export function customerBetting() {
  group('Customer Betting Flow', function() {
    const startTime = Date.now();
    
    // 1. Get available lotteries
    let res = http.get(`${BASE_URL}/api/lotteries`, { headers });
    apiLatency.add(Date.now() - startTime);
    
    if (!check(res, { 'lotteries loaded': (r) => r.status === 200 })) {
      betSuccessRate.add(0);
      return;
    }
    
    let lotteries = [];
    try {
      const body = JSON.parse(res.body);
      lotteries = body.data || body.lotteries || body || [];
    } catch { return; }
    
    if (lotteries.length === 0) return;
    
    const lottery = lotteries[randomNumber(0, lotteries.length - 1)];
    sleep(0.2);
    
    // 2. Check exposure/rates
    res = http.get(`${BASE_URL}/api/payout-rates?lottery_id=${lottery.id}`, { headers });
    check(res, { 'rates loaded': (r) => r.status === 200 });
    sleep(0.1);
    
    // 3. Place bet with customer_name (required)
    const betStart = Date.now();
    const betPayload = {
      entries: generateBetEntries(randomNumber(1, 5)),
      lotteryId: lottery.id,
      customer_name: `LoadTestCustomer_${__VU}_${__ITER}`,
      source_type: 'manual',
    };
    
    res = http.post(`${BASE_URL}/api/entries`, JSON.stringify(betPayload), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
    betPlacementTime.add(Date.now() - betStart);
    
    const success = res.status === 200 || res.status === 201;
    betSuccessRate.add(success ? 1 : 0);
    
    // Check for orphan entry attempt (no customer linkage)
    if (res.body && res.body.includes('CUSTOMER_REQUIRED')) {
      orphanEntryAttempts.add(1);
    }
    
    // Rapid betting simulation (burst)
    if (randomNumber(1, 10) === 1) {
      // 10% chance of rapid burst
      for (let i = 0; i < 5; i++) {
        const burstPayload = {
          entries: generateBetEntries(1),
          lotteryId: lottery.id,
          customer_name: `RapidBet_${__VU}_${__ITER}_${i}`,
          source_type: 'manual',
        };
        http.post(`${BASE_URL}/api/entries`, JSON.stringify(burstPayload), {
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
        rapidBetCounter.add(1);
        sleep(0.05); // 50ms between rapid bets
      }
    }
  });
  
  sleep(randomNumber(1, 3));
}

// Manual key entry flow
export function manualKeyEntry() {
  group('Manual Key Entry', function() {
    const startTime = Date.now();
    
    // 1. Get lotteries
    let res = http.get(`${BASE_URL}/api/lotteries`, { headers });
    if (res.status !== 200) {
      manualKeySuccessRate.add(0);
      return;
    }
    
    let lotteries = [];
    try {
      const body = JSON.parse(res.body);
      lotteries = body.data || body.lotteries || body || [];
    } catch { return; }
    
    if (lotteries.length === 0) return;
    
    const lottery = lotteries[randomNumber(0, lotteries.length - 1)];
    sleep(0.3);
    
    // 2. Submit manual key entries (with customer_name - required)
    const entries = generateBetEntries(randomNumber(3, 10));
    const payload = {
      entries,
      lotteryId: lottery.id,
      customer_name: `ManualKeyCustomer_${__VU}_${Date.now()}`,
      source_type: 'manual',
    };
    
    res = http.post(`${BASE_URL}/api/entries`, JSON.stringify(payload), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
    manualKeyTime.add(Date.now() - startTime);
    
    const success = res.status === 200 || res.status === 201;
    manualKeySuccessRate.add(success ? 1 : 0);
    
    if (!success) {
      console.log(`Manual key failed: ${res.status} - ${res.body}`);
    }
  });
  
  sleep(randomNumber(2, 5));
}

// Agent operations flow
export function agentOperations() {
  group('Agent Operations', function() {
    // 1. Agent dashboard
    let res = http.get(`${BASE_URL}/api/agent/dashboard`, { headers });
    check(res, { 'agent dashboard': (r) => r.status === 200 || r.status === 401 });
    sleep(0.5);
    
    // 2. Agent entries
    res = http.get(`${BASE_URL}/api/agent/entries?limit=20`, { headers });
    check(res, { 'agent entries': (r) => r.status === 200 || r.status === 401 });
    sleep(0.3);
    
    // 3. Agent customers
    res = http.get(`${BASE_URL}/api/customers?limit=20`, { headers });
    check(res, { 'agent customers': (r) => r.status === 200 });
    
    // 4. Cross-agent data leak test
    // Try to access another agent's data (should fail or return empty)
    const otherAgentId = 'fake-agent-id-12345';
    res = http.get(`${BASE_URL}/api/agent/entries?agent_id=${otherAgentId}`, { headers });
    
    // If we got data for another agent, that's a security issue
    if (res.status === 200) {
      try {
        const body = JSON.parse(res.body);
        const entries = body.data || body.entries || body || [];
        if (entries.length > 0 && entries[0].agent_id === otherAgentId) {
          crossAgentLeakAttempts.add(1);
        }
      } catch {}
    }
  });
  
  sleep(randomNumber(1, 3));
}

// Settlement processing flow
export function settlementProcessing() {
  group('Settlement Processing', function() {
    const startTime = Date.now();
    
    // 1. Get lottery results
    let res = http.get(`${BASE_URL}/api/results?limit=5`, { headers });
    if (res.status !== 200) {
      settlementSuccessRate.add(0);
      return;
    }
    
    let results = [];
    try {
      const body = JSON.parse(res.body);
      results = body.data || body.results || body || [];
    } catch { return; }
    
    if (results.length === 0) {
      settlementSuccessRate.add(1); // No results to process is OK
      return;
    }
    
    // 2. Process first unprocessed result
    const unprocessed = results.filter(r => !r.is_processed);
    if (unprocessed.length === 0) {
      settlementSuccessRate.add(1); // All processed is OK
      return;
    }
    
    const result = unprocessed[0];
    
    // 3. Attempt settlement
    res = http.post(`${BASE_URL}/api/results/process`, JSON.stringify({
      result_id: result.id,
    }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
    settlementTime.add(Date.now() - startTime);
    
    // Check for duplicate payout attempt
    if (res.body && res.body.includes('already_processed')) {
      duplicatePayoutAttempts.add(1);
    }
    
    const success = res.status === 200 || (res.body && res.body.includes('already_processed'));
    settlementSuccessRate.add(success ? 1 : 0);
    
    // 4. Verify no duplicate in quick succession
    sleep(0.1);
    res = http.post(`${BASE_URL}/api/results/process`, JSON.stringify({
      result_id: result.id,
    }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
    
    // Second attempt should return already_processed
    if (res.status === 200 && res.body && !res.body.includes('already_processed')) {
      duplicatePayoutAttempts.add(1);
      console.error('CRITICAL: Duplicate payout possible!');
    }
  });
  
  sleep(randomNumber(5, 10));
}

// ===== Helper Functions =====

function generateBetEntries(count) {
  const betTypes = ['2_top', '2_bottom', '3_top', 'run_top', 'run_bottom'];
  const entries = [];
  
  for (let i = 0; i < count; i++) {
    const betType = betTypes[randomNumber(0, betTypes.length - 1)];
    const digits = betType.startsWith('3') ? 3 : betType.startsWith('run') ? 1 : 2;
    
    entries.push({
      number: randomLotteryNumber(digits),
      betType: betType,
      bet_type: betType,
      amount: randomBetAmount(),
    });
  }
  
  return entries;
}

// ===== Summary Handler =====
export function handleSummary(data) {
  const metrics = data.metrics;
  
  const report = `
================================================================================
PRODUCTION TRAFFIC SIMULATION RESULTS
================================================================================
Test Level: ${LEVEL}
Total VUs: ${config.vus}
Duration: ${config.duration}

PERFORMANCE METRICS:
--------------------
Bet Placement:
  Avg: ${Math.round(metrics.bet_placement_time?.values?.avg || 0)}ms
  P95: ${Math.round(metrics.bet_placement_time?.values?.['p(95)'] || 0)}ms
  P99: ${Math.round(metrics.bet_placement_time?.values?.['p(99)'] || 0)}ms

Manual Key Entry:
  Avg: ${Math.round(metrics.manual_key_time?.values?.avg || 0)}ms
  P95: ${Math.round(metrics.manual_key_time?.values?.['p(95)'] || 0)}ms

Settlement Processing:
  Avg: ${Math.round(metrics.settlement_time?.values?.avg || 0)}ms
  P95: ${Math.round(metrics.settlement_time?.values?.['p(95)'] || 0)}ms

API Latency:
  Avg: ${Math.round(metrics.api_latency?.values?.avg || 0)}ms
  P95: ${Math.round(metrics.api_latency?.values?.['p(95)'] || 0)}ms

SUCCESS RATES:
--------------
Bet Success Rate: ${Math.round((metrics.bet_success_rate?.values?.rate || 0) * 100)}%
Manual Key Success: ${Math.round((metrics.manual_key_success_rate?.values?.rate || 0) * 100)}%
Settlement Success: ${Math.round((metrics.settlement_success_rate?.values?.rate || 0) * 100)}%

SAFETY METRICS (should be 0):
-----------------------------
Duplicate Payout Attempts: ${metrics.duplicate_payout_attempts?.values?.count || 0}
Orphan Entry Attempts: ${metrics.orphan_entry_attempts?.values?.count || 0}
Cross-Agent Data Leaks: ${metrics.cross_agent_leak_attempts?.values?.count || 0}

TRAFFIC STATS:
--------------
Total HTTP Requests: ${metrics.http_reqs?.values?.count || 0}
Request Rate: ${Math.round(metrics.http_reqs?.values?.rate || 0)}/s
Failed Requests: ${metrics.http_req_failed?.values?.passes || 0}
Rapid Bet Bursts: ${metrics.rapid_bet_count?.values?.count || 0}

================================================================================
`;

  return {
    'load-tests/results/production-simulation.json': JSON.stringify(data, null, 2),
    'load-tests/results/production-simulation.txt': report,
    stdout: report,
  };
}
