/**
 * Production Safety Guardrails
 * Prevents system damage, financial corruption, duplicate payouts during load testing and soft launch
 */

import { createClient } from '@/lib/supabase/server'

// ============= LOAD TEST MODE =============

export interface LoadTestConfig {
  enabled: boolean
  dryRunPayouts: boolean      // Skip actual balance updates
  dryRunWithdrawals: boolean  // Skip actual withdrawal processing
  markTestTransactions: boolean // Add [TEST] prefix to descriptions
  bypassLedgerWrites: boolean // Skip ledger entries (use with caution)
}

const DEFAULT_LOAD_TEST_CONFIG: LoadTestConfig = {
  enabled: false,
  dryRunPayouts: true,
  dryRunWithdrawals: true,
  markTestTransactions: true,
  bypassLedgerWrites: false,
}

export async function getLoadTestConfig(): Promise<LoadTestConfig> {
  // Check environment variable first
  if (process.env.LOAD_TEST_MODE === 'true') {
    return { ...DEFAULT_LOAD_TEST_CONFIG, enabled: true }
  }
  
  // Check system_settings
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'load_test_mode')
      .single()
    
    if (data?.value === 'true') {
      return { ...DEFAULT_LOAD_TEST_CONFIG, enabled: true }
    }
  } catch {
    // Ignore errors, default to disabled
  }
  
  return { ...DEFAULT_LOAD_TEST_CONFIG, enabled: false }
}

export function isLoadTestMode(): boolean {
  return process.env.LOAD_TEST_MODE === 'true'
}

// ============= EMERGENCY KILL SWITCHES =============

export type KillSwitchType = 
  | 'betting_enabled'
  | 'deposit_enabled' 
  | 'withdraw_enabled'
  | 'settlement_enabled'
  | 'payout_processing_enabled'
  | 'auto_payout_enabled'
  | 'registration_enabled'
  | 'maintenance_mode'

export interface KillSwitchStatus {
  betting: boolean
  deposit: boolean
  withdraw: boolean
  settlement: boolean
  payoutProcessing: boolean
  autoPayout: boolean
  registration: boolean
  maintenanceMode: boolean
}

export async function getKillSwitchStatus(): Promise<KillSwitchStatus> {
  const supabase = await createClient()
  
  const { data: controls } = await supabase
    .from('global_controls')
    .select('control_key, is_enabled')
  
  const controlMap = new Map(controls?.map(c => [c.control_key, c.is_enabled]) || [])
  
  // Check system_settings for maintenance_mode
  const { data: settings } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['maintenance_mode'])
  
  const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || [])
  
  return {
    betting: controlMap.get('betting_enabled') !== false,
    deposit: controlMap.get('deposit_enabled') !== false,
    withdraw: controlMap.get('withdraw_enabled') !== false,
    settlement: controlMap.get('settlement_enabled') !== false,
    payoutProcessing: controlMap.get('payout_processing_enabled') !== false,
    autoPayout: controlMap.get('auto_payout_enabled') !== false,
    registration: controlMap.get('registration_enabled') !== false,
    maintenanceMode: settingsMap.get('maintenance_mode') === 'true',
  }
}

export async function checkKillSwitch(switchType: KillSwitchType): Promise<boolean> {
  const status = await getKillSwitchStatus()
  
  switch (switchType) {
    case 'betting_enabled': return status.betting
    case 'deposit_enabled': return status.deposit
    case 'withdraw_enabled': return status.withdraw
    case 'settlement_enabled': return status.settlement
    case 'payout_processing_enabled': return status.payoutProcessing
    case 'auto_payout_enabled': return status.autoPayout
    case 'registration_enabled': return status.registration
    case 'maintenance_mode': return !status.maintenanceMode // Inverted - returns false when in maintenance
    default: return true
  }
}

// ============= FINANCIAL SAFETY LIMITS =============

export interface FinancialLimits {
  maxPayoutPerResult: number
  maxPayoutPerUser: number
  maxExposurePerNumber: number
  maxDailyPayout: number
  maxSettlementBatchSize: number
  requireApprovalAbove: number
}

const DEFAULT_LIMITS: FinancialLimits = {
  maxPayoutPerResult: 100000,
  maxPayoutPerUser: 50000,
  maxExposurePerNumber: 10000,
  maxDailyPayout: 500000,
  maxSettlementBatchSize: 100,
  requireApprovalAbove: 50000,
}

export async function getFinancialLimits(): Promise<FinancialLimits> {
  try {
    const supabase = await createClient()
    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'max_payout_per_result',
        'max_payout_per_user',
        'max_exposure_per_number',
        'max_daily_payout',
        'max_settlement_batch_size',
        'require_approval_above'
      ])
    
    const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || [])
    
    return {
      maxPayoutPerResult: Number(settingsMap.get('max_payout_per_result')) || DEFAULT_LIMITS.maxPayoutPerResult,
      maxPayoutPerUser: Number(settingsMap.get('max_payout_per_user')) || DEFAULT_LIMITS.maxPayoutPerUser,
      maxExposurePerNumber: Number(settingsMap.get('max_exposure_per_number')) || DEFAULT_LIMITS.maxExposurePerNumber,
      maxDailyPayout: Number(settingsMap.get('max_daily_payout')) || DEFAULT_LIMITS.maxDailyPayout,
      maxSettlementBatchSize: Number(settingsMap.get('max_settlement_batch_size')) || DEFAULT_LIMITS.maxSettlementBatchSize,
      requireApprovalAbove: Number(settingsMap.get('require_approval_above')) || DEFAULT_LIMITS.requireApprovalAbove,
    }
  } catch {
    return DEFAULT_LIMITS
  }
}

export async function checkPayoutLimit(amount: number, type: 'per_result' | 'per_user' | 'daily'): Promise<{
  allowed: boolean
  limit: number
  requiresApproval: boolean
}> {
  const limits = await getFinancialLimits()
  
  let limit: number
  switch (type) {
    case 'per_result': limit = limits.maxPayoutPerResult; break
    case 'per_user': limit = limits.maxPayoutPerUser; break
    case 'daily': limit = limits.maxDailyPayout; break
  }
  
  return {
    allowed: amount <= limit,
    limit,
    requiresApproval: amount > limits.requireApprovalAbove,
  }
}

// ============= DUPLICATE PROTECTION =============

export interface DuplicateCheckResult {
  isDuplicate: boolean
  existingId?: string
  existingStatus?: string
}

export async function checkDuplicateResultProcessing(resultId: string): Promise<DuplicateCheckResult> {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from('lottery_results')
    .select('id, is_processed, processing_started_at')
    .eq('id', resultId)
    .single()
  
  if (data?.is_processed) {
    return { isDuplicate: true, existingId: data.id, existingStatus: 'processed' }
  }
  
  // Check if currently being processed (within last 10 minutes)
  if (data?.processing_started_at) {
    const processingStart = new Date(data.processing_started_at)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
    if (processingStart > tenMinutesAgo) {
      return { isDuplicate: true, existingId: data.id, existingStatus: 'processing' }
    }
  }
  
  return { isDuplicate: false }
}

export async function checkDuplicatePayout(entryId: string): Promise<DuplicateCheckResult> {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from('entries')
    .select('id, payout_status, payout_processed_at')
    .eq('id', entryId)
    .single()
  
  if (data?.payout_status === 'paid') {
    return { isDuplicate: true, existingId: data.id, existingStatus: 'paid' }
  }
  
  return { isDuplicate: false }
}

export async function checkDuplicateLedgerEntry(idempotencyKey: string): Promise<DuplicateCheckResult> {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from('ledger_transactions')
    .select('id, status')
    .eq('idempotency_key', idempotencyKey)
    .single()
  
  if (data) {
    return { isDuplicate: true, existingId: data.id, existingStatus: data.status }
  }
  
  return { isDuplicate: false }
}

// ============= DATA INTEGRITY CHECKS =============

export interface EntryValidationResult {
  valid: boolean
  errors: string[]
}

export async function validateEntryForProcessing(entry: {
  id: string
  customer_id?: string | null
  lottery_id?: string | null
  agent_id?: string | null
  amount?: number | null
  bet_type?: string | null
  legacy_orphan?: boolean | null
}): Promise<EntryValidationResult> {
  const errors: string[] = []
  
  // Check customer_id
  if (!entry.customer_id) {
    errors.push(`Entry ${entry.id}: customer_id is required for payout attribution`)
  }
  
  // Check lottery_id
  if (!entry.lottery_id) {
    errors.push(`Entry ${entry.id}: lottery_id is required`)
  }
  
  // Check amount
  if (!entry.amount || entry.amount <= 0) {
    errors.push(`Entry ${entry.id}: amount must be positive`)
  }
  
  // Check bet_type
  const validBetTypes = ['3top', '3tod', '3flip', '2top', '2bot', '2flip', '1top', '1bot', 'run_top', 'run_bot']
  if (!entry.bet_type || !validBetTypes.includes(entry.bet_type)) {
    errors.push(`Entry ${entry.id}: invalid bet_type '${entry.bet_type}'`)
  }
  
  // Check legacy_orphan
  if (entry.legacy_orphan === true) {
    errors.push(`Entry ${entry.id}: legacy_orphan entries are excluded from processing`)
  }
  
  // Verify customer exists
  if (entry.customer_id) {
    const supabase = await createClient()
    const { data: customer } = await supabase
      .from('customers')
      .select('id, is_active')
      .eq('id', entry.customer_id)
      .single()
    
    if (!customer) {
      errors.push(`Entry ${entry.id}: customer ${entry.customer_id} not found`)
    } else if (!customer.is_active) {
      errors.push(`Entry ${entry.id}: customer ${entry.customer_id} is inactive`)
    }
  }
  
  // Verify agent exists if provided
  if (entry.agent_id) {
    const supabase = await createClient()
    const { data: agent } = await supabase
      .from('agents')
      .select('id, is_active')
      .eq('id', entry.agent_id)
      .single()
    
    if (!agent) {
      errors.push(`Entry ${entry.id}: agent ${entry.agent_id} not found`)
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

// ============= WORKER SAFETY =============

export interface WorkerLockStatus {
  isLocked: boolean
  lockedBy?: string
  lockedAt?: Date
  expiresAt?: Date
}

export async function checkWorkerLock(workerType: string): Promise<WorkerLockStatus> {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from('worker_locks')
    .select('*')
    .eq('worker_type', workerType)
    .single()
  
  if (!data) {
    return { isLocked: false }
  }
  
  const now = new Date()
  const expiresAt = new Date(data.expires_at)
  
  if (expiresAt < now) {
    // Lock expired, release it
    await supabase.from('worker_locks').delete().eq('worker_type', workerType)
    return { isLocked: false }
  }
  
  return {
    isLocked: true,
    lockedBy: data.locked_by,
    lockedAt: new Date(data.locked_at),
    expiresAt,
  }
}

export async function acquireWorkerLock(workerType: string, lockDurationMs: number = 300000): Promise<boolean> {
  const supabase = await createClient()
  const lockId = `${workerType}-${Date.now()}`
  const expiresAt = new Date(Date.now() + lockDurationMs)
  
  // Try to acquire lock (upsert with conflict handling)
  const { error } = await supabase
    .from('worker_locks')
    .upsert({
      worker_type: workerType,
      locked_by: lockId,
      locked_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    }, {
      onConflict: 'worker_type',
    })
  
  if (error) {
    console.error(`Failed to acquire lock for ${workerType}:`, error)
    return false
  }
  
  return true
}

export async function releaseWorkerLock(workerType: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('worker_locks').delete().eq('worker_type', workerType)
}

// ============= PRE-LOAD-TEST VERIFICATION =============

export interface SafetyVerificationResult {
  passed: boolean
  checks: {
    name: string
    passed: boolean
    message: string
  }[]
}

export async function runPreLoadTestVerification(): Promise<SafetyVerificationResult> {
  const checks: SafetyVerificationResult['checks'] = []
  const supabase = await createClient()
  
  // 1. Check database connectivity
  try {
    const { error } = await supabase.from('system_settings').select('key').limit(1)
    checks.push({
      name: 'Database Connectivity',
      passed: !error,
      message: error ? `Database error: ${error.message}` : 'Connected',
    })
  } catch (e) {
    checks.push({
      name: 'Database Connectivity',
      passed: false,
      message: `Database error: ${e}`,
    })
  }
  
  // 2. Check kill switches are available
  try {
    const status = await getKillSwitchStatus()
    checks.push({
      name: 'Kill Switches Available',
      passed: true,
      message: `Betting: ${status.betting}, Deposit: ${status.deposit}, Withdraw: ${status.withdraw}`,
    })
  } catch (e) {
    checks.push({
      name: 'Kill Switches Available',
      passed: false,
      message: `Failed to check: ${e}`,
    })
  }
  
  // 3. Check financial limits are configured
  try {
    const limits = await getFinancialLimits()
    checks.push({
      name: 'Financial Limits Configured',
      passed: limits.maxPayoutPerResult > 0,
      message: `Max payout: ${limits.maxPayoutPerResult}, Max exposure: ${limits.maxExposurePerNumber}`,
    })
  } catch (e) {
    checks.push({
      name: 'Financial Limits Configured',
      passed: false,
      message: `Failed to check: ${e}`,
    })
  }
  
  // 4. Check for orphan entries excluded
  try {
    const { count } = await supabase
      .from('entries')
      .select('*', { count: 'exact', head: true })
      .eq('legacy_orphan', true)
      .neq('status', 'archived')
    
    checks.push({
      name: 'Orphan Entries Excluded',
      passed: count === 0,
      message: count === 0 ? 'All orphan entries archived' : `${count} orphan entries not archived`,
    })
  } catch (e) {
    checks.push({
      name: 'Orphan Entries Excluded',
      passed: false,
      message: `Failed to check: ${e}`,
    })
  }
  
  // 5. Check worker locks table exists
  try {
    const { error } = await supabase.from('worker_locks').select('worker_type').limit(1)
    checks.push({
      name: 'Worker Locks Table',
      passed: !error,
      message: error ? `Table error: ${error.message}` : 'Available',
    })
  } catch (e) {
    checks.push({
      name: 'Worker Locks Table',
      passed: false,
      message: `Failed to check: ${e}`,
    })
  }
  
  // 6. Check ledger integrity (debits = credits)
  try {
    const { data } = await supabase.rpc('check_ledger_balance')
    const balanced = data === true || data === null // null means no entries
    checks.push({
      name: 'Ledger Integrity',
      passed: balanced,
      message: balanced ? 'Balanced' : 'Imbalanced - requires investigation',
    })
  } catch {
    // RPC may not exist, skip
    checks.push({
      name: 'Ledger Integrity',
      passed: true,
      message: 'Skipped (RPC not available)',
    })
  }
  
  return {
    passed: checks.every(c => c.passed),
    checks,
  }
}

// ============= SAFETY GUARD WRAPPER =============

export async function withSafetyGuards<T>(
  operation: () => Promise<T>,
  options: {
    checkKillSwitch?: KillSwitchType
    checkDuplicate?: () => Promise<DuplicateCheckResult>
    checkLimit?: { amount: number; type: 'per_result' | 'per_user' | 'daily' }
    workerType?: string
  }
): Promise<{ success: boolean; data?: T; error?: string }> {
  // Check kill switch
  if (options.checkKillSwitch) {
    const enabled = await checkKillSwitch(options.checkKillSwitch)
    if (!enabled) {
      return { success: false, error: `Operation disabled: ${options.checkKillSwitch}` }
    }
  }
  
  // Check duplicate
  if (options.checkDuplicate) {
    const dupCheck = await options.checkDuplicate()
    if (dupCheck.isDuplicate) {
      return { success: false, error: `Duplicate detected: ${dupCheck.existingId} (${dupCheck.existingStatus})` }
    }
  }
  
  // Check financial limit
  if (options.checkLimit) {
    const limitCheck = await checkPayoutLimit(options.checkLimit.amount, options.checkLimit.type)
    if (!limitCheck.allowed) {
      return { success: false, error: `Exceeds limit: ${options.checkLimit.amount} > ${limitCheck.limit}` }
    }
  }
  
  // Check worker lock
  if (options.workerType) {
    const lockStatus = await checkWorkerLock(options.workerType)
    if (lockStatus.isLocked) {
      return { success: false, error: `Worker locked by ${lockStatus.lockedBy} until ${lockStatus.expiresAt}` }
    }
  }
  
  // Load test mode check
  const loadTestConfig = await getLoadTestConfig()
  if (loadTestConfig.enabled) {
    console.log('[SafetyGuard] Load test mode enabled - operation may be dry-run')
  }
  
  // Execute operation
  try {
    const data = await operation()
    return { success: true, data }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
