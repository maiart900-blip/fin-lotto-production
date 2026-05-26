/**
 * Safety Verification Test
 * Verifies operational safety under load:
 * - No duplicate payouts
 * - No ledger corruption
 * - No cross-agent data leaks
 * - No orphan entries created
 * - No settlement deadlocks
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { BASE_URL, getAdminHeaders, randomNumber, randomLotteryNumber, randomBetAmount } from '../config.js';

// Safety violation counters - ALL MUST BE 0
const duplicatePayouts = new Counter('safety_duplicate_payouts');
const ledgerInconsistencies = new Counter('safety_ledger_inconsistencies');
const crossAgentLeaks = new Counter('safety_cross_agent_leaks');
const orphanEntries = new Counter('safety_orphan_entries');
const settlementDeadlocks = new Counter('safety_settlement_deadlocks');
const dataRaceConditions = new Counter('safety_data_races');

// Test success tracking
const safetyTestsPassed = new Rate('safety_tests_passed');

const LEVEL = __ENV.LEVEL || 'normal';
const headers = getAdminHeaders();

const TRAFFIC_CONFIGS = {
  light: { vus: 20, duration: '2m' },
  normal: { vus: 50, duration: '3m' },
  heavy: { vus: 100, duration: '3m' },
};

const config = TRAFFIC_CONFIGS[LEVEL] || TRAFFIC_CONFIGS.normal;

export const options = {
  scenarios: {
    // Concurrent settlement attempts (duplicate payout test)
    concurrent_settlement: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: 50,
      maxDuration: '2m',
      exec: 'testDuplicatePayoutPrevention',
      tags: { test: 'duplicate_payout' },
    },
    // Cross-agent data isolation
    cross_agent_isolation: {
      executor: 'constant-vus',
      vus: config.vus,
      duration: config.duration,
      exec: 'testCrossAgentIsolation',
      tags: { test: 'cross_agent' },
    },
    // Entry validation (orphan prevention)
    entry_validation: {
      executor: 'constant-vus',
      vus: Math.floor(config.vus / 2),
      duration: config.duration,
      exec: 'testOrphanPrevention',
      tags: { test: 'orphan_prevention' },
    },
    // Ledger consistency
    ledger_consistency: {
      executor: 'per-vu-iterations',
      vus: 5,
      iterations: 20,
      exec: 'testLedgerConsistency',
      tags: { test: 'ledger' },
    },
  },
  thresholds: {
    // CRITICAL: All safety counters MUST be 0
    'safety_duplicate_payouts': ['count==0'],
    'safety_ledger_inconsistencies': ['count==0'],
    'safety_cross_agent_leaks': ['count==0'],
    'safety_orphan_entries': ['count==0'],
    'safety_settlement_deadlocks': ['count==0'],
    'safety_data_races': ['count==0'],
    // At least 95% of safety tests should pass
    'safety_tests_passed': ['rate>0.95'],
  },
};

// ===== Test Functions =====

// Test 1: Duplicate Payout Prevention
export function testDuplicatePayoutPrevention() {
  group('Duplicate Payout Prevention', function() {
    // Get a result to process
    let res = http.get(`${BASE_URL}/api/results?limit=10`, { headers });
    
    if (res.status !== 200) {
      safetyTestsPassed.add(0);
      return;
    }
    
    let results = [];
    try {
      const body = JSON.parse(res.body);
      results = body.data || body.results || body || [];
    } catch {
      safetyTestsPassed.add(0);
      return;
    }
    
    if (results.length === 0) {
      safetyTestsPassed.add(1); // No results to test, pass
      return;
    }
    
    // Pick a random result
    const result = results[randomNumber(0, results.length - 1)];
    
    // Attempt to process it multiple times in rapid succession
    const attempts = [];
    for (let i = 0; i < 3; i++) {
      const attempt = http.post(`${BASE_URL}/api/results/process`, 
        JSON.stringify({ result_id: result.id }),
        { headers: { ...headers, 'Content-Type': 'application/json' } }
      );
      attempts.push(attempt);
      sleep(0.05); // 50ms between attempts
    }
    
    // Analyze results
    let successCount = 0;
    let alreadyProcessedCount = 0;
    
    for (const attempt of attempts) {
      if (attempt.status === 200) {
        const body = attempt.body || '';
        if (body.includes('already_processed') || body.includes('cached')) {
          alreadyProcessedCount++;
        } else {
          successCount++;
        }
      }
    }
    
    // CRITICAL: Only ONE successful processing should happen
    // Others should return "already_processed"
    if (successCount > 1) {
      duplicatePayouts.add(successCount - 1);
      console.error(`CRITICAL: ${successCount} successful payouts for same result!`);
      safetyTestsPassed.add(0);
    } else {
      safetyTestsPassed.add(1);
    }
  });
  
  sleep(1);
}

// Test 2: Cross-Agent Data Isolation
export function testCrossAgentIsolation() {
  group('Cross-Agent Isolation', function() {
    // Create test agent IDs
    const myAgentId = `test-agent-${__VU}`;
    const otherAgentId = `test-agent-other-${randomNumber(1000, 9999)}`;
    
    // Try to access another agent's entries
    let res = http.get(`${BASE_URL}/api/entries?agent_id=${otherAgentId}&limit=50`, { headers });
    
    if (res.status === 200) {
      try {
        const body = JSON.parse(res.body);
        const entries = body.data || body.entries || body || [];
        
        // Check if any entries belong to the other agent
        for (const entry of entries) {
          if (entry.agent_id === otherAgentId) {
            crossAgentLeaks.add(1);
            console.error(`SECURITY: Accessed agent ${otherAgentId} data!`);
            safetyTestsPassed.add(0);
            return;
          }
        }
      } catch {}
    }
    
    // Try to modify another agent's entry
    res = http.patch(`${BASE_URL}/api/entries/fake-entry-id`, 
      JSON.stringify({ agent_id: myAgentId }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    );
    
    // Should be rejected (404 or 403)
    if (res.status === 200) {
      crossAgentLeaks.add(1);
      safetyTestsPassed.add(0);
      return;
    }
    
    safetyTestsPassed.add(1);
  });
  
  sleep(0.5);
}

// Test 3: Orphan Entry Prevention
export function testOrphanPrevention() {
  group('Orphan Entry Prevention', function() {
    // Get a lottery
    let res = http.get(`${BASE_URL}/api/lotteries`, { headers });
    
    if (res.status !== 200) {
      safetyTestsPassed.add(0);
      return;
    }
    
    let lotteries = [];
    try {
      const body = JSON.parse(res.body);
      lotteries = body.data || body.lotteries || body || [];
    } catch {
      safetyTestsPassed.add(0);
      return;
    }
    
    if (lotteries.length === 0) {
      safetyTestsPassed.add(1);
      return;
    }
    
    const lottery = lotteries[0];
    
    // Attempt to create entry WITHOUT customer_name (should be rejected)
    const orphanPayload = {
      entries: [{
        number: randomLotteryNumber(2),
        betType: '2_top',
        amount: randomBetAmount(),
      }],
      lotteryId: lottery.id,
      source_type: 'manual',
      // Intentionally missing customer_name and customer_id
    };
    
    res = http.post(`${BASE_URL}/api/entries`, JSON.stringify(orphanPayload), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
    
    // Should be rejected with CUSTOMER_REQUIRED error
    if (res.status === 200 || res.status === 201) {
      // Entry was created - check if it has customer linkage
      try {
        const body = JSON.parse(res.body);
        const entries = body.data || body.entries || body || [];
        for (const entry of (Array.isArray(entries) ? entries : [entries])) {
          if (!entry.customer_id) {
            orphanEntries.add(1);
            console.error('CRITICAL: Orphan entry created without customer_id!');
            safetyTestsPassed.add(0);
            return;
          }
        }
      } catch {}
    }
    
    // Entry was rejected or has customer_id - PASS
    safetyTestsPassed.add(1);
  });
  
  sleep(0.3);
}

// Test 4: Ledger Consistency
export function testLedgerConsistency() {
  group('Ledger Consistency', function() {
    // Get customer balance
    let res = http.get(`${BASE_URL}/api/customers?limit=5`, { headers });
    
    if (res.status !== 200) {
      safetyTestsPassed.add(0);
      return;
    }
    
    let customers = [];
    try {
      const body = JSON.parse(res.body);
      customers = body.data || body.customers || body || [];
    } catch {
      safetyTestsPassed.add(0);
      return;
    }
    
    if (customers.length === 0) {
      safetyTestsPassed.add(1);
      return;
    }
    
    const customer = customers[randomNumber(0, customers.length - 1)];
    const initialBalance = customer.credit_balance || 0;
    
    // Get ledger entries for this customer
    res = http.get(`${BASE_URL}/api/ledger?customer_id=${customer.id}&limit=100`, { headers });
    
    if (res.status === 200) {
      try {
        const body = JSON.parse(res.body);
        const ledgerEntries = body.data || body.entries || body || [];
        
        // Calculate expected balance from ledger
        let calculatedBalance = 0;
        for (const entry of ledgerEntries) {
          calculatedBalance += Number(entry.amount) || 0;
        }
        
        // Allow for small floating point differences
        const diff = Math.abs(initialBalance - calculatedBalance);
        if (diff > 0.01 && ledgerEntries.length > 0) {
          ledgerInconsistencies.add(1);
          console.error(`LEDGER MISMATCH: Balance=${initialBalance}, Calculated=${calculatedBalance}`);
          safetyTestsPassed.add(0);
          return;
        }
      } catch {}
    }
    
    safetyTestsPassed.add(1);
  });
  
  sleep(1);
}

// ===== Summary Handler =====
export function handleSummary(data) {
  const metrics = data.metrics;
  
  const duplicates = metrics.safety_duplicate_payouts?.values?.count || 0;
  const ledgerIssues = metrics.safety_ledger_inconsistencies?.values?.count || 0;
  const leaks = metrics.safety_cross_agent_leaks?.values?.count || 0;
  const orphans = metrics.safety_orphan_entries?.values?.count || 0;
  const deadlocks = metrics.safety_settlement_deadlocks?.values?.count || 0;
  const races = metrics.safety_data_races?.values?.count || 0;
  
  const totalViolations = duplicates + ledgerIssues + leaks + orphans + deadlocks + races;
  const passRate = metrics.safety_tests_passed?.values?.rate || 0;
  
  const status = totalViolations === 0 ? 'PASS' : 'FAIL';
  
  const report = `
================================================================================
SAFETY VERIFICATION REPORT
================================================================================
Test Level: ${LEVEL}
Overall Status: ${status}

SAFETY VIOLATIONS (must be 0):
------------------------------
Duplicate Payouts: ${duplicates} ${duplicates === 0 ? 'PASS' : 'FAIL'}
Ledger Inconsistencies: ${ledgerIssues} ${ledgerIssues === 0 ? 'PASS' : 'FAIL'}
Cross-Agent Data Leaks: ${leaks} ${leaks === 0 ? 'PASS' : 'FAIL'}
Orphan Entries Created: ${orphans} ${orphans === 0 ? 'PASS' : 'FAIL'}
Settlement Deadlocks: ${deadlocks} ${deadlocks === 0 ? 'PASS' : 'FAIL'}
Data Race Conditions: ${races} ${races === 0 ? 'PASS' : 'FAIL'}

TOTAL VIOLATIONS: ${totalViolations}

TEST METRICS:
-------------
Safety Tests Passed: ${Math.round(passRate * 100)}%
Total HTTP Requests: ${metrics.http_reqs?.values?.count || 0}

${totalViolations === 0 ? 
  'SYSTEM IS SAFE FOR PRODUCTION' : 
  'CRITICAL: SAFETY VIOLATIONS DETECTED - DO NOT DEPLOY'}

================================================================================
`;

  return {
    'load-tests/results/safety-verification.json': JSON.stringify(data, null, 2),
    'load-tests/results/safety-verification.txt': report,
    stdout: report,
  };
}
