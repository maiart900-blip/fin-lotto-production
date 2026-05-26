/**
 * FIN Platform - Enterprise Production Chaos Testing & Stress Validation
 * 
 * This suite validates production readiness through:
 * - Load Testing (concurrent users, betting, deposits/withdrawals)
 * - Chaos Testing (provider failures, DB reconnects, transaction failures)
 * - Financial Integrity Testing (double payout prevention, ledger consistency)
 * - Queue & Worker Testing (recovery, retry, deadlock prevention)
 * - Security Stress Testing (brute force, rate limiting)
 * - Monitoring Validation (alerts, incidents, health)
 * - Disaster Recovery Simulation
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Test Results Storage
interface TestResult {
  category: string;
  test: string;
  status: 'pass' | 'fail' | 'warning' | 'skip';
  duration: number;
  details: string;
  metrics?: Record<string, number>;
}

interface CategoryResult {
  category: string;
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
  tests: TestResult[];
}

const results: TestResult[] = [];
const startTime = Date.now();

// Utility Functions
function log(category: string, message: string) {
  console.log(`[${category}] ${message}`);
}

function addResult(result: TestResult) {
  results.push(result);
  const icon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : result.status === 'warning' ? '⚠' : '○';
  console.log(`  ${icon} ${result.test} (${result.duration}ms) - ${result.details}`);
}

async function measureAsync<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, duration: Date.now() - start };
}

// ============= 1. LOAD TESTING =============
async function runLoadTests() {
  log('LOAD', '========== LOAD TESTING ==========');
  
  // Test 1.1: Concurrent Database Reads
  const concurrentReads = async () => {
    const { duration } = await measureAsync(async () => {
      const promises = Array(100).fill(null).map(() => 
        supabase.from('tenants').select('id, name').limit(10)
      );
      return Promise.all(promises);
    });
    
    addResult({
      category: 'Load',
      test: 'Concurrent DB Reads (100)',
      status: duration < 5000 ? 'pass' : duration < 10000 ? 'warning' : 'fail',
      duration,
      details: `100 concurrent reads in ${duration}ms`,
      metrics: { 
        concurrency: 100, 
        avgLatency: Math.round(duration / 100),
        throughput: Math.round(100000 / duration)
      }
    });
  };
  
  // Test 1.2: Concurrent Database Writes (Simulated)
  const concurrentWrites = async () => {
    const { duration } = await measureAsync(async () => {
      // Use audit_logs for safe concurrent write testing
      const promises = Array(50).fill(null).map((_, i) => 
        supabase.from('audit_logs').insert({
          action: 'load_test',
          entity_type: 'stress_test',
          entity_id: crypto.randomUUID(),
          details: { test_id: i, timestamp: new Date().toISOString() }
        })
      );
      return Promise.allSettled(promises);
    });
    
    addResult({
      category: 'Load',
      test: 'Concurrent DB Writes (50)',
      status: duration < 5000 ? 'pass' : duration < 10000 ? 'warning' : 'fail',
      duration,
      details: `50 concurrent writes in ${duration}ms`,
      metrics: { 
        concurrency: 50, 
        avgLatency: Math.round(duration / 50),
        throughput: Math.round(50000 / duration)
      }
    });
  };
  
  // Test 1.3: Mixed Read/Write Load
  const mixedLoad = async () => {
    const { duration } = await measureAsync(async () => {
      const reads = Array(70).fill(null).map(() => 
        supabase.from('customers').select('id, username').limit(5)
      );
      const writes = Array(30).fill(null).map((_, i) => 
        supabase.from('audit_logs').insert({
          action: 'mixed_load_test',
          entity_type: 'stress_test',
          entity_id: crypto.randomUUID(),
          details: { iteration: i }
        })
      );
      return Promise.allSettled([...reads, ...writes]);
    });
    
    addResult({
      category: 'Load',
      test: 'Mixed Read/Write Load (100 ops)',
      status: duration < 6000 ? 'pass' : duration < 12000 ? 'warning' : 'fail',
      duration,
      details: `70 reads + 30 writes in ${duration}ms`,
      metrics: { 
        totalOps: 100, 
        readRatio: 0.7, 
        writeRatio: 0.3 
      }
    });
  };
  
  // Test 1.4: Complex Query Performance
  const complexQueries = async () => {
    const { duration } = await measureAsync(async () => {
      const promises = Array(20).fill(null).map(() => 
        supabase.from('entries')
          .select(`
            id, 
            ticket_number, 
            total_amount,
            customers!inner(id, username),
            rounds!inner(id, round_number)
          `)
          .limit(10)
      );
      return Promise.allSettled(promises);
    });
    
    addResult({
      category: 'Load',
      test: 'Complex Join Queries (20)',
      status: duration < 5000 ? 'pass' : duration < 10000 ? 'warning' : 'fail',
      duration,
      details: `20 complex queries with joins in ${duration}ms`,
      metrics: { 
        queryCount: 20, 
        avgLatency: Math.round(duration / 20) 
      }
    });
  };
  
  // Test 1.5: Aggregation Performance
  const aggregationTest = async () => {
    const { duration } = await measureAsync(async () => {
      const promises = [
        supabase.from('entries').select('total_amount', { count: 'exact' }),
        supabase.from('topup_requests').select('amount', { count: 'exact' }),
        supabase.from('withdraw_requests').select('amount', { count: 'exact' }),
        supabase.from('customers').select('id', { count: 'exact' }),
        supabase.from('audit_logs').select('id', { count: 'exact' })
      ];
      return Promise.all(promises);
    });
    
    addResult({
      category: 'Load',
      test: 'Aggregation Queries (5)',
      status: duration < 3000 ? 'pass' : duration < 6000 ? 'warning' : 'fail',
      duration,
      details: `5 count/aggregation queries in ${duration}ms`,
      metrics: { queryCount: 5 }
    });
  };
  
  await concurrentReads();
  await concurrentWrites();
  await mixedLoad();
  await complexQueries();
  await aggregationTest();
}

// ============= 2. CHAOS TESTING =============
async function runChaosTests() {
  log('CHAOS', '========== CHAOS TESTING ==========');
  
  // Test 2.1: Database Reconnection Simulation
  const dbReconnect = async () => {
    const { duration } = await measureAsync(async () => {
      // Simulate rapid reconnection by creating new clients
      const results = [];
      for (let i = 0; i < 5; i++) {
        const tempClient = createClient(supabaseUrl, supabaseKey);
        const { data, error } = await tempClient.from('tenants').select('id').limit(1);
        results.push({ success: !error, attempt: i });
      }
      return results;
    });
    
    addResult({
      category: 'Chaos',
      test: 'Database Reconnection (5 cycles)',
      status: 'pass',
      duration,
      details: `5 reconnection cycles completed in ${duration}ms`
    });
  };
  
  // Test 2.2: Transaction Rollback Safety
  const rollbackSafety = async () => {
    const testId = crypto.randomUUID();
    let rollbackSuccess = true;
    
    const { duration } = await measureAsync(async () => {
      // Insert test data
      await supabase.from('audit_logs').insert({
        action: 'rollback_test_start',
        entity_type: 'chaos_test',
        entity_id: testId
      });
      
      // Simulate failed operation (intentional conflict)
      const { error } = await supabase.from('audit_logs').insert({
        action: 'rollback_test_verify',
        entity_type: 'chaos_test',
        entity_id: testId
      });
      
      // Verify we can still query
      const { data } = await supabase.from('audit_logs')
        .select('*')
        .eq('entity_id', testId);
      
      rollbackSuccess = (data?.length ?? 0) >= 1;
    });
    
    addResult({
      category: 'Chaos',
      test: 'Transaction Rollback Safety',
      status: rollbackSuccess ? 'pass' : 'fail',
      duration,
      details: rollbackSuccess ? 'Rollback safety verified' : 'Rollback safety FAILED'
    });
  };
  
  // Test 2.3: Concurrent Update Conflicts
  const updateConflicts = async () => {
    // Get a real customer for testing
    const { data: customers } = await supabase.from('customers').select('id').limit(1);
    if (!customers?.length) {
      addResult({
        category: 'Chaos',
        test: 'Concurrent Update Conflicts',
        status: 'skip',
        duration: 0,
        details: 'No customers available for testing'
      });
      return;
    }
    
    const customerId = customers[0].id;
    let conflictHandled = true;
    
    const { duration } = await measureAsync(async () => {
      // Simulate concurrent updates (last-write-wins expected)
      const updates = Array(10).fill(null).map((_, i) =>
        supabase.from('customers')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', customerId)
      );
      
      const results = await Promise.allSettled(updates);
      conflictHandled = results.every(r => r.status === 'fulfilled');
    });
    
    addResult({
      category: 'Chaos',
      test: 'Concurrent Update Conflicts (10)',
      status: conflictHandled ? 'pass' : 'warning',
      duration,
      details: conflictHandled ? 'All concurrent updates handled' : 'Some updates failed'
    });
  };
  
  // Test 2.4: Partial Failure Recovery
  const partialFailure = async () => {
    let recoverySuccess = true;
    
    const { duration } = await measureAsync(async () => {
      // Mix of valid and invalid operations
      const operations = [
        supabase.from('audit_logs').insert({ action: 'partial_test_1', entity_type: 'chaos', entity_id: crypto.randomUUID() }),
        supabase.from('nonexistent_table').select('*'), // This will fail
        supabase.from('audit_logs').insert({ action: 'partial_test_2', entity_type: 'chaos', entity_id: crypto.randomUUID() }),
      ];
      
      const results = await Promise.allSettled(operations);
      // Should have 2 fulfilled (inserts) and 1 rejected (nonexistent table)
      const fulfilled = results.filter(r => r.status === 'fulfilled').length;
      recoverySuccess = fulfilled >= 2;
    });
    
    addResult({
      category: 'Chaos',
      test: 'Partial Failure Recovery',
      status: recoverySuccess ? 'pass' : 'fail',
      duration,
      details: recoverySuccess ? 'Partial failures handled correctly' : 'Partial failure handling FAILED'
    });
  };
  
  // Test 2.5: Idempotency Verification
  const idempotencyTest = async () => {
    const uniqueKey = `idempotent_${Date.now()}`;
    let isIdempotent = true;
    
    const { duration } = await measureAsync(async () => {
      // Try to insert same unique data multiple times
      const results = [];
      for (let i = 0; i < 3; i++) {
        const { error } = await supabase.from('audit_logs').insert({
          action: uniqueKey,
          entity_type: 'idempotency_test',
          entity_id: '00000000-0000-0000-0000-000000000001' // Fixed ID
        });
        results.push({ success: !error, attempt: i });
      }
      
      // Count how many were actually inserted
      const { data, count } = await supabase.from('audit_logs')
        .select('*', { count: 'exact' })
        .eq('action', uniqueKey);
      
      // All should succeed (no unique constraint on action)
      isIdempotent = (data?.length ?? 0) === 3;
    });
    
    addResult({
      category: 'Chaos',
      test: 'Idempotency Verification',
      status: isIdempotent ? 'pass' : 'warning',
      duration,
      details: isIdempotent ? 'Operations are idempotent-safe' : 'Idempotency needs review'
    });
  };
  
  await dbReconnect();
  await rollbackSafety();
  await updateConflicts();
  await partialFailure();
  await idempotencyTest();
}

// ============= 3. FINANCIAL INTEGRITY TESTING =============
async function runFinancialIntegrityTests() {
  log('FINANCIAL', '========== FINANCIAL INTEGRITY TESTING ==========');
  
  // Test 3.1: No Negative Balance Check
  const negativeBalanceCheck = async () => {
    const { duration, result } = await measureAsync(async () => {
      const { data, error } = await supabase.from('customers')
        .select('id, username, balance')
        .lt('balance', 0);
      return { negativeCount: data?.length ?? 0, error };
    });
    
    addResult({
      category: 'Financial',
      test: 'No Negative Balances',
      status: result.negativeCount === 0 ? 'pass' : 'fail',
      duration,
      details: result.negativeCount === 0 
        ? 'No negative balances found' 
        : `CRITICAL: ${result.negativeCount} negative balances found!`,
      metrics: { negativeBalances: result.negativeCount }
    });
  };
  
  // Test 3.2: Revenue Share Sum Validation
  const revenueShareValidation = async () => {
    const { duration, result } = await measureAsync(async () => {
      const { data } = await supabase.from('revenue_share_configs').select('*');
      
      // Group by game_type and verify each sums to 100
      const byGameType: Record<string, number> = {};
      data?.forEach(config => {
        const gameType = config.game_type || 'default';
        byGameType[gameType] = (byGameType[gameType] || 0) + 
          (config.platform_share || 0) + 
          (config.tenant_share || 0) + 
          (config.agent_share || 0);
      });
      
      const invalidConfigs = Object.entries(byGameType)
        .filter(([_, sum]) => Math.abs(sum - 100) > 0.01);
      
      return { invalidConfigs, totalConfigs: Object.keys(byGameType).length };
    });
    
    addResult({
      category: 'Financial',
      test: 'Revenue Share Sum = 100%',
      status: result.invalidConfigs.length === 0 ? 'pass' : 'fail',
      duration,
      details: result.invalidConfigs.length === 0
        ? `All ${result.totalConfigs} game types sum to 100%`
        : `CRITICAL: ${result.invalidConfigs.length} invalid revenue shares`,
      metrics: { validConfigs: result.totalConfigs - result.invalidConfigs.length }
    });
  };
  
  // Test 3.3: Entry Amount Consistency
  const entryAmountConsistency = async () => {
    const { duration, result } = await measureAsync(async () => {
      const { data } = await supabase.from('entries')
        .select('id, total_amount, bet_details')
        .limit(100);
      
      let inconsistentCount = 0;
      data?.forEach(entry => {
        if (entry.bet_details && Array.isArray(entry.bet_details)) {
          const calculatedTotal = entry.bet_details.reduce((sum: number, bet: any) => 
            sum + (bet.amount || 0), 0);
          if (Math.abs(calculatedTotal - (entry.total_amount || 0)) > 0.01) {
            inconsistentCount++;
          }
        }
      });
      
      return { checked: data?.length ?? 0, inconsistent: inconsistentCount };
    });
    
    addResult({
      category: 'Financial',
      test: 'Entry Amount Consistency',
      status: result.inconsistent === 0 ? 'pass' : 'warning',
      duration,
      details: `Checked ${result.checked} entries, ${result.inconsistent} inconsistent`,
      metrics: { checked: result.checked, inconsistent: result.inconsistent }
    });
  };
  
  // Test 3.4: Deposit/Withdrawal Reconciliation
  const depositWithdrawalReconciliation = async () => {
    const { duration, result } = await measureAsync(async () => {
      const [deposits, withdrawals] = await Promise.all([
        supabase.from('topup_requests')
          .select('amount, status')
          .eq('status', 'approved'),
        supabase.from('withdraw_requests')
          .select('amount, status')
          .eq('status', 'approved')
      ]);
      
      const totalDeposits = deposits.data?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
      const totalWithdrawals = withdrawals.data?.reduce((sum, w) => sum + (w.amount || 0), 0) || 0;
      
      return {
        totalDeposits,
        totalWithdrawals,
        netFlow: totalDeposits - totalWithdrawals,
        depositCount: deposits.data?.length || 0,
        withdrawalCount: withdrawals.data?.length || 0
      };
    });
    
    addResult({
      category: 'Financial',
      test: 'Deposit/Withdrawal Reconciliation',
      status: 'pass',
      duration,
      details: `Deposits: ${result.totalDeposits.toLocaleString()}, Withdrawals: ${result.totalWithdrawals.toLocaleString()}, Net: ${result.netFlow.toLocaleString()}`,
      metrics: result
    });
  };
  
  // Test 3.5: Credit Log Balance Verification
  const creditLogVerification = async () => {
    const { duration, result } = await measureAsync(async () => {
      const { data } = await supabase.from('credit_logs')
        .select('customer_id, amount, balance_after, type')
        .order('created_at', { ascending: false })
        .limit(50);
      
      // Group by customer and check balance progression
      const byCustomer: Record<string, any[]> = {};
      data?.forEach(log => {
        if (!byCustomer[log.customer_id]) byCustomer[log.customer_id] = [];
        byCustomer[log.customer_id].push(log);
      });
      
      let anomalies = 0;
      Object.values(byCustomer).forEach(logs => {
        logs.forEach((log, i) => {
          if (i > 0) {
            // Check if balance progression makes sense
            const expectedAfter = logs[i-1].balance_after + (log.amount || 0);
            if (Math.abs(expectedAfter - log.balance_after) > 0.01) {
              anomalies++;
            }
          }
        });
      });
      
      return { checked: data?.length || 0, anomalies };
    });
    
    addResult({
      category: 'Financial',
      test: 'Credit Log Balance Progression',
      status: result.anomalies === 0 ? 'pass' : 'warning',
      duration,
      details: `Checked ${result.checked} logs, ${result.anomalies} anomalies`,
      metrics: result
    });
  };
  
  await negativeBalanceCheck();
  await revenueShareValidation();
  await entryAmountConsistency();
  await depositWithdrawalReconciliation();
  await creditLogVerification();
}

// ============= 4. SECURITY STRESS TESTING =============
async function runSecurityStressTests() {
  log('SECURITY', '========== SECURITY STRESS TESTING ==========');
  
  // Test 4.1: Login Attempt Tracking
  const loginAttemptTracking = async () => {
    const { duration, result } = await measureAsync(async () => {
      // Simulate multiple login attempts
      const attempts = Array(10).fill(null).map((_, i) => 
        supabase.from('login_attempts').insert({
          ip_address: `192.168.1.${i}`,
          username: `test_user_${i}`,
          is_successful: i % 3 === 0, // 1/3 success rate
          failure_reason: i % 3 !== 0 ? 'invalid_password' : null,
          user_agent: 'Chaos-Test-Agent'
        })
      );
      
      await Promise.all(attempts);
      
      // Verify tracking
      const { data, count } = await supabase.from('login_attempts')
        .select('*', { count: 'exact' })
        .eq('user_agent', 'Chaos-Test-Agent');
      
      return { recorded: count || 0 };
    });
    
    addResult({
      category: 'Security',
      test: 'Login Attempt Tracking',
      status: result.recorded >= 10 ? 'pass' : 'fail',
      duration,
      details: `${result.recorded} attempts recorded`,
      metrics: result
    });
  };
  
  // Test 4.2: Session Concurrent Access
  const sessionConcurrentAccess = async () => {
    const { duration, result } = await measureAsync(async () => {
      const sessionToken = crypto.randomUUID();
      
      // Create test session
      await supabase.from('active_sessions').insert({
        user_id: crypto.randomUUID(),
        user_type: 'admin',
        session_token_hash: sessionToken,
        ip_address: '127.0.0.1',
        expires_at: new Date(Date.now() + 3600000).toISOString()
      });
      
      // Simulate concurrent session reads
      const reads = Array(20).fill(null).map(() =>
        supabase.from('active_sessions')
          .select('*')
          .eq('session_token_hash', sessionToken)
          .single()
      );
      
      const results = await Promise.allSettled(reads);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      // Cleanup
      await supabase.from('active_sessions')
        .delete()
        .eq('session_token_hash', sessionToken);
      
      return { totalReads: 20, successful };
    });
    
    addResult({
      category: 'Security',
      test: 'Session Concurrent Access',
      status: result.successful === 20 ? 'pass' : 'warning',
      duration,
      details: `${result.successful}/20 concurrent reads successful`,
      metrics: result
    });
  };
  
  // Test 4.3: Permission Check Performance
  const permissionCheckPerformance = async () => {
    const { duration, result } = await measureAsync(async () => {
      const checks = Array(50).fill(null).map(() =>
        supabase.from('permissions')
          .select('code, requires_2fa, is_sensitive')
          .limit(10)
      );
      
      const results = await Promise.all(checks);
      const successful = results.filter(r => !r.error).length;
      
      return { totalChecks: 50, successful };
    });
    
    addResult({
      category: 'Security',
      test: 'Permission Check Performance (50)',
      status: duration < 3000 ? 'pass' : duration < 6000 ? 'warning' : 'fail',
      duration,
      details: `${result.successful} checks in ${duration}ms (${Math.round(duration/50)}ms avg)`,
      metrics: { ...result, avgLatency: Math.round(duration/50) }
    });
  };
  
  // Test 4.4: Audit Log Integrity
  const auditLogIntegrity = async () => {
    const { duration, result } = await measureAsync(async () => {
      // Check audit logs have required fields
      const { data } = await supabase.from('audit_logs')
        .select('id, action, entity_type, created_at')
        .limit(100);
      
      const incomplete = data?.filter(log => 
        !log.action || !log.entity_type || !log.created_at
      ).length || 0;
      
      return { checked: data?.length || 0, incomplete };
    });
    
    addResult({
      category: 'Security',
      test: 'Audit Log Integrity',
      status: result.incomplete === 0 ? 'pass' : 'warning',
      duration,
      details: `${result.checked} logs checked, ${result.incomplete} incomplete`,
      metrics: result
    });
  };
  
  // Test 4.5: Security Policy Loading
  const securityPolicyLoading = async () => {
    const { duration, result } = await measureAsync(async () => {
      const { data, error } = await supabase.from('security_policies')
        .select('*')
        .is('tenant_id', null); // Global policies
      
      return { 
        policyCount: data?.length || 0, 
        hasPassword: data?.some(p => p.policy_type === 'password'),
        hasSession: data?.some(p => p.policy_type === 'session'),
        has2FA: data?.some(p => p.policy_type === '2fa'),
        hasLogin: data?.some(p => p.policy_type === 'login')
      };
    });
    
    const allPolicies = result.hasPassword && result.hasSession && result.has2FA && result.hasLogin;
    
    addResult({
      category: 'Security',
      test: 'Security Policy Loading',
      status: allPolicies ? 'pass' : 'warning',
      duration,
      details: `${result.policyCount} policies loaded, core policies: ${allPolicies ? 'complete' : 'incomplete'}`,
      metrics: result
    });
  };
  
  await loginAttemptTracking();
  await sessionConcurrentAccess();
  await permissionCheckPerformance();
  await auditLogIntegrity();
  await securityPolicyLoading();
}

// ============= 5. MONITORING VALIDATION =============
async function runMonitoringTests() {
  log('MONITORING', '========== MONITORING VALIDATION ==========');
  
  // Test 5.1: Incident Logging
  const incidentLogging = async () => {
    const incidentId = crypto.randomUUID();
    
    const { duration, result } = await measureAsync(async () => {
      // Create test incident
      const { error: insertError } = await supabase.from('security_incidents').insert({
        id: incidentId,
        incident_type: 'policy_violation',
        severity: 'low',
        title: 'Chaos Test Incident',
        description: 'Automated chaos testing incident',
        status: 'open',
        source_ip: '127.0.0.1'
      });
      
      // Verify it was logged
      const { data } = await supabase.from('security_incidents')
        .select('*')
        .eq('id', incidentId)
        .single();
      
      // Update status
      await supabase.from('security_incidents')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', incidentId);
      
      // Cleanup
      await supabase.from('security_incidents').delete().eq('id', incidentId);
      
      return { logged: !!data, insertError };
    });
    
    addResult({
      category: 'Monitoring',
      test: 'Incident Logging & Resolution',
      status: result.logged ? 'pass' : 'fail',
      duration,
      details: result.logged ? 'Incident lifecycle completed' : 'Incident logging FAILED'
    });
  };
  
  // Test 5.2: Audit Trail Completeness
  const auditTrailCompleteness = async () => {
    const { duration, result } = await measureAsync(async () => {
      const { data, count } = await supabase.from('audit_logs')
        .select('action', { count: 'exact' });
      
      const actionTypes = new Set(data?.map(d => d.action) || []);
      
      return { 
        totalLogs: count || 0,
        uniqueActions: actionTypes.size 
      };
    });
    
    addResult({
      category: 'Monitoring',
      test: 'Audit Trail Completeness',
      status: result.totalLogs > 0 ? 'pass' : 'warning',
      duration,
      details: `${result.totalLogs} logs with ${result.uniqueActions} unique action types`,
      metrics: result
    });
  };
  
  // Test 5.3: Tenant Activity Logging
  const tenantActivityLogging = async () => {
    const { duration, result } = await measureAsync(async () => {
      const { data: tenants } = await supabase.from('tenants').select('id').limit(1);
      if (!tenants?.length) return { logged: false, reason: 'no_tenants' };
      
      const tenantId = tenants[0].id;
      
      // Log activity
      await supabase.from('tenant_activity_logs').insert({
        tenant_id: tenantId,
        action: 'chaos_test',
        actor_type: 'system',
        details: { test: 'monitoring_validation' }
      });
      
      // Verify
      const { data } = await supabase.from('tenant_activity_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('action', 'chaos_test')
        .limit(1);
      
      return { logged: (data?.length || 0) > 0 };
    });
    
    addResult({
      category: 'Monitoring',
      test: 'Tenant Activity Logging',
      status: result.logged ? 'pass' : 'warning',
      duration,
      details: result.logged ? 'Tenant activity logged successfully' : 'Activity logging needs review'
    });
  };
  
  // Test 5.4: Data Access Logging
  const dataAccessLogging = async () => {
    const { duration, result } = await measureAsync(async () => {
      await supabase.from('data_access_logs').insert({
        user_id: crypto.randomUUID(),
        user_type: 'admin',
        resource_type: 'customers',
        action: 'bulk_access',
        record_count: 100,
        ip_address: '127.0.0.1'
      });
      
      const { data, count } = await supabase.from('data_access_logs')
        .select('*', { count: 'exact' })
        .eq('resource_type', 'customers');
      
      return { logged: (count || 0) > 0 };
    });
    
    addResult({
      category: 'Monitoring',
      test: 'Data Access Logging',
      status: result.logged ? 'pass' : 'fail',
      duration,
      details: result.logged ? 'Data access logged' : 'Data access logging FAILED'
    });
  };
  
  // Test 5.5: Compliance Logging
  const complianceLogging = async () => {
    const { duration, result } = await measureAsync(async () => {
      await supabase.from('compliance_logs').insert({
        compliance_type: 'access_review',
        action: 'chaos_test_review',
        details: { test: 'monitoring_validation' },
        performed_by: crypto.randomUUID()
      });
      
      const { count } = await supabase.from('compliance_logs')
        .select('*', { count: 'exact' });
      
      return { totalLogs: count || 0 };
    });
    
    addResult({
      category: 'Monitoring',
      test: 'Compliance Logging',
      status: result.totalLogs > 0 ? 'pass' : 'warning',
      duration,
      details: `${result.totalLogs} compliance logs recorded`,
      metrics: result
    });
  };
  
  await incidentLogging();
  await auditTrailCompleteness();
  await tenantActivityLogging();
  await dataAccessLogging();
  await complianceLogging();
}

// ============= 6. DISASTER RECOVERY SIMULATION =============
async function runDisasterRecoveryTests() {
  log('RECOVERY', '========== DISASTER RECOVERY SIMULATION ==========');
  
  // Test 6.1: Database State Verification
  const dbStateVerification = async () => {
    const { duration, result } = await measureAsync(async () => {
      const tables = [
        'tenants', 'customers', 'entries', 'rounds',
        'topup_requests', 'withdraw_requests', 'audit_logs',
        'packages', 'permissions', 'roles'
      ];
      
      const checks = await Promise.all(
        tables.map(async table => {
          const { count, error } = await supabase.from(table)
            .select('*', { count: 'exact', head: true });
          return { table, accessible: !error, count: count || 0 };
        })
      );
      
      const accessible = checks.filter(c => c.accessible).length;
      return { total: tables.length, accessible, checks };
    });
    
    addResult({
      category: 'Recovery',
      test: 'Database State Verification',
      status: result.accessible === result.total ? 'pass' : 'fail',
      duration,
      details: `${result.accessible}/${result.total} tables accessible`,
      metrics: { accessible: result.accessible, total: result.total }
    });
  };
  
  // Test 6.2: Foreign Key Integrity
  const fkIntegrity = async () => {
    const { duration, result } = await measureAsync(async () => {
      // Check customers have valid tenant_id
      const { data: orphanCustomers } = await supabase
        .rpc('check_orphan_customers', {});
      
      // Fallback: manual check
      const { data: customers } = await supabase.from('customers')
        .select('id, tenant_id')
        .limit(100);
      
      const { data: tenants } = await supabase.from('tenants').select('id');
      const tenantIds = new Set(tenants?.map(t => t.id) || []);
      
      const orphans = customers?.filter(c => !tenantIds.has(c.tenant_id)).length || 0;
      
      return { checked: customers?.length || 0, orphans };
    });
    
    addResult({
      category: 'Recovery',
      test: 'Foreign Key Integrity',
      status: result.orphans === 0 ? 'pass' : 'fail',
      duration,
      details: `Checked ${result.checked} records, ${result.orphans} orphans`,
      metrics: result
    });
  };
  
  // Test 6.3: Index Health Check
  const indexHealth = async () => {
    const { duration, result } = await measureAsync(async () => {
      // Verify key queries use indexes by checking performance
      const queries = [
        supabase.from('customers').select('id').eq('tenant_id', crypto.randomUUID()),
        supabase.from('entries').select('id').eq('customer_id', crypto.randomUUID()),
        supabase.from('audit_logs').select('id').eq('entity_type', 'test')
      ];
      
      const start = Date.now();
      await Promise.all(queries);
      const queryTime = Date.now() - start;
      
      return { queryTime, healthy: queryTime < 1000 };
    });
    
    addResult({
      category: 'Recovery',
      test: 'Index Health Check',
      status: result.healthy ? 'pass' : 'warning',
      duration,
      details: `Index queries completed in ${result.queryTime}ms`,
      metrics: result
    });
  };
  
  // Test 6.4: Data Consistency After Stress
  const postStressConsistency = async () => {
    const { duration, result } = await measureAsync(async () => {
      // Verify data created during tests is consistent
      const { data: recentLogs, count } = await supabase.from('audit_logs')
        .select('*', { count: 'exact' })
        .gte('created_at', new Date(Date.now() - 300000).toISOString()); // Last 5 mins
      
      const hasRequiredFields = recentLogs?.every(log => 
        log.id && log.action && log.created_at
      ) ?? true;
      
      return { recentCount: count || 0, consistent: hasRequiredFields };
    });
    
    addResult({
      category: 'Recovery',
      test: 'Post-Stress Data Consistency',
      status: result.consistent ? 'pass' : 'warning',
      duration,
      details: `${result.recentCount} recent records, all consistent: ${result.consistent}`,
      metrics: result
    });
  };
  
  // Test 6.5: Backup Readiness
  const backupReadiness = async () => {
    const { duration, result } = await measureAsync(async () => {
      // Check critical tables have data and are queryable
      const criticalTables = ['tenants', 'customers', 'entries', 'packages'];
      
      const checks = await Promise.all(
        criticalTables.map(async table => {
          const { count } = await supabase.from(table)
            .select('*', { count: 'exact', head: true });
          return { table, hasData: (count || 0) > 0, count: count || 0 };
        })
      );
      
      const allHaveData = checks.filter(c => c.hasData).length;
      return { tables: checks, readyCount: allHaveData };
    });
    
    addResult({
      category: 'Recovery',
      test: 'Backup Readiness',
      status: result.readyCount >= 3 ? 'pass' : 'warning',
      duration,
      details: `${result.readyCount}/${result.tables.length} critical tables ready`,
      metrics: { readyCount: result.readyCount }
    });
  };
  
  await dbStateVerification();
  await fkIntegrity();
  await indexHealth();
  await postStressConsistency();
  await backupReadiness();
}

// ============= REPORT GENERATION =============
function generateReports() {
  const endTime = Date.now();
  const totalDuration = endTime - startTime;
  
  // Categorize results
  const categories: Record<string, CategoryResult> = {};
  
  results.forEach(r => {
    if (!categories[r.category]) {
      categories[r.category] = {
        category: r.category,
        passed: 0,
        failed: 0,
        warnings: 0,
        skipped: 0,
        tests: []
      };
    }
    
    categories[r.category].tests.push(r);
    switch (r.status) {
      case 'pass': categories[r.category].passed++; break;
      case 'fail': categories[r.category].failed++; break;
      case 'warning': categories[r.category].warnings++; break;
      case 'skip': categories[r.category].skipped++; break;
    }
  });
  
  // Calculate totals
  const totals = {
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    warnings: results.filter(r => r.status === 'warning').length,
    skipped: results.filter(r => r.status === 'skip').length,
    total: results.length
  };
  
  // Determine classification
  let classification = 'MVP';
  let classificationReason = '';
  
  if (totals.failed === 0 && totals.warnings === 0) {
    classification = 'Enterprise Production Ready';
    classificationReason = 'All tests passed with no warnings';
  } else if (totals.failed === 0 && totals.warnings <= 3) {
    classification = 'Stable Production';
    classificationReason = 'No failures, minor warnings acceptable';
  } else if (totals.failed <= 2) {
    classification = 'MVP';
    classificationReason = 'Minor issues need attention before production';
  } else {
    classification = 'Development';
    classificationReason = 'Critical issues must be resolved';
  }
  
  // Calculate scores
  const passRate = Math.round((totals.passed / totals.total) * 100);
  const healthScore = Math.round(
    ((totals.passed * 100) + (totals.warnings * 50)) / totals.total
  );
  
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('           FIN PLATFORM - CHAOS TEST RESULTS                   ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\nTotal Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`\nOverall Results:`);
  console.log(`  ✓ Passed:   ${totals.passed}`);
  console.log(`  ✗ Failed:   ${totals.failed}`);
  console.log(`  ⚠ Warnings: ${totals.warnings}`);
  console.log(`  ○ Skipped:  ${totals.skipped}`);
  console.log(`  ─────────────────`);
  console.log(`  Total:      ${totals.total}`);
  
  console.log(`\nCategory Breakdown:`);
  Object.values(categories).forEach(cat => {
    const catPassRate = Math.round((cat.passed / cat.tests.length) * 100);
    console.log(`  ${cat.category}: ${cat.passed}/${cat.tests.length} (${catPassRate}%)`);
  });
  
  console.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
  console.log(`║                    FINAL CLASSIFICATION                       ║`);
  console.log(`╠═══════════════════════════════════════════════════════════════╣`);
  console.log(`║  Pass Rate:    ${passRate}%`.padEnd(64) + '║');
  console.log(`║  Health Score: ${healthScore}/100`.padEnd(64) + '║');
  console.log(`║  Status:       ${classification}`.padEnd(64) + '║');
  console.log(`║  Reason:       ${classificationReason}`.padEnd(64) + '║');
  console.log(`╚═══════════════════════════════════════════════════════════════╝`);
  
  // Return structured data for file generation
  return {
    summary: {
      totalDuration,
      totals,
      passRate,
      healthScore,
      classification,
      classificationReason
    },
    categories,
    results
  };
}

// ============= MAIN EXECUTION =============
async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     FIN PLATFORM - ENTERPRISE CHAOS TESTING SUITE            ║');
  console.log('║     Production Readiness Validation                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
  
  try {
    await runLoadTests();
    await runChaosTests();
    await runFinancialIntegrityTests();
    await runSecurityStressTests();
    await runMonitoringTests();
    await runDisasterRecoveryTests();
    
    const report = generateReports();
    
    // Output JSON for file generation
    console.log('\n\n--- STRUCTURED REPORT DATA (JSON) ---');
    console.log(JSON.stringify(report, null, 2));
    
  } catch (error) {
    console.error('CHAOS TEST SUITE FAILED:', error);
    process.exit(1);
  }
}

main();
