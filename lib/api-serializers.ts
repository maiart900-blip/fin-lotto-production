/**
 * API Response Serializers
 * 
 * Centralized serializers to ensure consistent, secure API responses.
 * Uses allow-list approach - only explicitly listed fields are exposed.
 * 
 * SECURITY PRINCIPLES:
 * 1. Never return raw database entities directly
 * 2. Use allow-list (whitelist) field selection only
 * 3. Different serializers for different access levels (public, agent, admin)
 * 4. Sensitive fields are explicitly excluded and documented
 * 
 * USAGE:
 * import { serializePublicLottery, serializeAdminCustomer } from '@/lib/api-serializers';
 * return NextResponse.json(serializePublicLottery(lottery));
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/** Public lottery response - safe for unauthenticated users */
export interface PublicLotteryResponse {
  id: string;
  name: string;
  category: string | null;
  is_active: boolean;
  draw_type: string | null;
  draw_days: string[] | null;
  open_time: string | null;
  close_time: string | null;
  result_time: string | null;
  sort_order: number | null;
  flag_emoji: string | null;
  flag_url: string | null;
  icon_url: string | null;
  bg_color: string | null;
  text_color: string | null;
  timezone: string | null;
  country_code: string | null;
}

/** Public payout rate response */
export interface PublicPayoutRateResponse {
  id: string;
  lottery_id: string;
  bet_type: string;
  pay_rate: number;
  max_bet: number | null;
  min_bet: number | null;
}

/** Public customer response - safe for public display */
export interface PublicCustomerResponse {
  id: string;
  username: string;
  name: string | null;
  avatar_url: string | null;
}

/** Agent-level customer response - includes balance info */
export interface AgentCustomerResponse extends PublicCustomerResponse {
  phone: string | null;
  credit_balance: number;
  credit_limit: number;
  is_active: boolean;
  agent_id: string | null;
  created_at: string;
}

/** Admin-level customer response - full access */
export interface AdminCustomerResponse extends AgentCustomerResponse {
  line_user_id: string | null;
  outstanding_balance: number;
  last_login_at: string | null;
  last_login_ip: string | null;
  login_count: number;
  notes: string | null;
  risk_level: string | null;
  tenant_id: string | null;
  updated_at: string;
}

/** Public bet response - safe for customer view */
export interface PublicBetResponse {
  id: string;
  lottery_id: string;
  total_amount: number;
  status: string;
  created_at: string;
  cancel_deadline: string | null;
  total_win_amount: number;
  is_checked: boolean;
}

/** Agent-level bet response */
export interface AgentBetResponse extends PublicBetResponse {
  customer_id: string;
  customer_name: string | null;
  source_type: string | null;
  agent_id: string | null;
}

/** Admin-level bet response - full access */
export interface AdminBetResponse extends AgentBetResponse {
  keyed_by: string | null;
  tenant_id: string | null;
  idempotency_key: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  checked_at: string | null;
  refunded_at: string | null;
  refunded_by: string | null;
  refund_reason: string | null;
  updated_at: string;
}

/** Public user response - safe for display */
export interface PublicUserResponse {
  id: string;
  name: string | null;
  role: string;
  avatar_url: string | null;
}

/** Admin user response - excludes password hash */
export interface AdminUserResponse extends PublicUserResponse {
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  permissions: string[] | null;
}

// =============================================================================
// FIELD DEFINITIONS (Allow-lists)
// =============================================================================

/**
 * PUBLIC FIELDS - Safe for unauthenticated/public access
 * These fields contain no sensitive business logic or PII
 */
const PUBLIC_LOTTERY_FIELDS = [
  'id', 'name', 'category', 'is_active', 'draw_type', 'draw_days',
  'open_time', 'close_time', 'result_time', 'sort_order',
  'flag_emoji', 'flag_url', 'icon_url', 'bg_color', 'text_color',
  'timezone', 'country_code',
  // Display/UI fields
  'background_image', 'card_color', 'badge_color', 'badge_text',
  'gradient_start', 'gradient_end',
] as const;

const PUBLIC_PAYOUT_RATE_FIELDS = [
  'id', 'lottery_id', 'bet_type', 'pay_rate', 'max_bet', 'min_bet',
] as const;

const PUBLIC_CUSTOMER_FIELDS = [
  'id', 'username', 'name', 'avatar_url',
] as const;

const PUBLIC_BET_FIELDS = [
  'id', 'lottery_id', 'total_amount', 'status', 'created_at',
  'cancel_deadline', 'total_win_amount', 'is_checked',
] as const;

const PUBLIC_USER_FIELDS = [
  'id', 'name', 'role', 'avatar_url',
] as const;

/**
 * AGENT FIELDS - Additional fields for agent-level access
 * Includes customer management data
 */
const AGENT_CUSTOMER_FIELDS = [
  ...PUBLIC_CUSTOMER_FIELDS,
  'phone', 'credit_balance', 'credit_limit', 'is_active',
  'agent_id', 'created_at',
] as const;

const AGENT_BET_FIELDS = [
  ...PUBLIC_BET_FIELDS,
  'customer_id', 'customer_name', 'source_type', 'agent_id',
] as const;

/**
 * ADMIN FIELDS - Full access (still excludes password hashes)
 * 
 * EXCLUDED EVEN FROM ADMIN:
 * - password_hash: Never expose password hashes
 * - Internal system fields that serve no purpose in API response
 */
const ADMIN_CUSTOMER_FIELDS = [
  ...AGENT_CUSTOMER_FIELDS,
  'line_user_id', 'outstanding_balance', 'last_login_at', 'last_login_ip',
  'login_count', 'notes', 'risk_level', 'tenant_id', 'updated_at',
] as const;

const ADMIN_BET_FIELDS = [
  ...AGENT_BET_FIELDS,
  'keyed_by', 'tenant_id', 'idempotency_key',
  'cancelled_at', 'cancelled_by', 'checked_at',
  'refunded_at', 'refunded_by', 'refund_reason', 'updated_at',
] as const;

const ADMIN_USER_FIELDS = [
  ...PUBLIC_USER_FIELDS,
  'email', 'phone', 'is_active', 'created_at', 'last_login_at', 'permissions',
  // EXCLUDED: password_hash, 2fa_secret, recovery_codes
] as const;

// =============================================================================
// GENERIC SERIALIZER
// =============================================================================

/**
 * Generic field picker - extracts only allowed fields from an object
 * @param data Raw database entity
 * @param allowedFields Array of field names to include
 * @returns Filtered object with only allowed fields
 */
function pickFields<T extends Record<string, unknown>>(
  data: T,
  allowedFields: readonly string[]
): Partial<T> {
  const result: Partial<T> = {};
  for (const field of allowedFields) {
    if (field in data) {
      (result as Record<string, unknown>)[field] = data[field];
    }
  }
  return result;
}

/**
 * Serialize array of entities
 */
function serializeArray<T extends Record<string, unknown>, R>(
  data: T[],
  serializer: (item: T) => R
): R[] {
  return data.map(serializer);
}

// =============================================================================
// LOTTERY SERIALIZERS
// =============================================================================

/** Serialize lottery for public access */
export function serializePublicLottery(
  lottery: Record<string, unknown>
): PublicLotteryResponse {
  return pickFields(lottery, PUBLIC_LOTTERY_FIELDS) as PublicLotteryResponse;
}

/** Serialize multiple lotteries for public access */
export function serializePublicLotteries(
  lotteries: Record<string, unknown>[]
): PublicLotteryResponse[] {
  return serializeArray(lotteries, serializePublicLottery);
}

/** Serialize payout rate for public access */
export function serializePublicPayoutRate(
  rate: Record<string, unknown>
): PublicPayoutRateResponse {
  return pickFields(rate, PUBLIC_PAYOUT_RATE_FIELDS) as PublicPayoutRateResponse;
}

/** Serialize multiple payout rates for public access */
export function serializePublicPayoutRates(
  rates: Record<string, unknown>[]
): PublicPayoutRateResponse[] {
  return serializeArray(rates, serializePublicPayoutRate);
}

// =============================================================================
// CUSTOMER SERIALIZERS
// =============================================================================

/** Serialize customer for public access (minimal info) */
export function serializePublicCustomer(
  customer: Record<string, unknown>
): PublicCustomerResponse {
  return pickFields(customer, PUBLIC_CUSTOMER_FIELDS) as PublicCustomerResponse;
}

/** Serialize customer for agent access */
export function serializeAgentCustomer(
  customer: Record<string, unknown>
): AgentCustomerResponse {
  return pickFields(customer, AGENT_CUSTOMER_FIELDS) as AgentCustomerResponse;
}

/** Serialize multiple customers for agent access */
export function serializeAgentCustomers(
  customers: Record<string, unknown>[]
): AgentCustomerResponse[] {
  return serializeArray(customers, serializeAgentCustomer);
}

/** Serialize customer for admin access (full data, no password) */
export function serializeAdminCustomer(
  customer: Record<string, unknown>
): AdminCustomerResponse {
  return pickFields(customer, ADMIN_CUSTOMER_FIELDS) as AdminCustomerResponse;
}

/** Serialize multiple customers for admin access */
export function serializeAdminCustomers(
  customers: Record<string, unknown>[]
): AdminCustomerResponse[] {
  return serializeArray(customers, serializeAdminCustomer);
}

// =============================================================================
// BET SERIALIZERS
// =============================================================================

/** Serialize bet for public/customer access */
export function serializePublicBet(
  bet: Record<string, unknown>
): PublicBetResponse {
  return pickFields(bet, PUBLIC_BET_FIELDS) as PublicBetResponse;
}

/** Serialize multiple bets for public access */
export function serializePublicBets(
  bets: Record<string, unknown>[]
): PublicBetResponse[] {
  return serializeArray(bets, serializePublicBet);
}

/** Serialize bet for agent access */
export function serializeAgentBet(
  bet: Record<string, unknown>
): AgentBetResponse {
  return pickFields(bet, AGENT_BET_FIELDS) as AgentBetResponse;
}

/** Serialize multiple bets for agent access */
export function serializeAgentBets(
  bets: Record<string, unknown>[]
): AgentBetResponse[] {
  return serializeArray(bets, serializeAgentBet);
}

/** Serialize bet for admin access (full data) */
export function serializeAdminBet(
  bet: Record<string, unknown>
): AdminBetResponse {
  return pickFields(bet, ADMIN_BET_FIELDS) as AdminBetResponse;
}

/** Serialize multiple bets for admin access */
export function serializeAdminBets(
  bets: Record<string, unknown>[]
): AdminBetResponse[] {
  return serializeArray(bets, serializeAdminBet);
}

// =============================================================================
// USER SERIALIZERS
// =============================================================================

/** Serialize user for public access (minimal info) */
export function serializePublicUser(
  user: Record<string, unknown>
): PublicUserResponse {
  return pickFields(user, PUBLIC_USER_FIELDS) as PublicUserResponse;
}

/** Serialize user for admin access (no password hash) */
export function serializeAdminUser(
  user: Record<string, unknown>
): AdminUserResponse {
  return pickFields(user, ADMIN_USER_FIELDS) as AdminUserResponse;
}

/** Serialize multiple users for admin access */
export function serializeAdminUsers(
  users: Record<string, unknown>[]
): AdminUserResponse[] {
  return serializeArray(users, serializeAdminUser);
}

// =============================================================================
// TRANSACTION SERIALIZERS
// =============================================================================

const PUBLIC_TRANSACTION_FIELDS = [
  'id', 'amount', 'type', 'description', 'created_at', 'balance_after',
] as const;

const ADMIN_TRANSACTION_FIELDS = [
  ...PUBLIC_TRANSACTION_FIELDS,
  'customer_id', 'reference_id', 'reference_type', 'created_by',
  'ip_address', 'tenant_id',
] as const;

export interface PublicTransactionResponse {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
  balance_after: number | null;
}

export interface AdminTransactionResponse extends PublicTransactionResponse {
  customer_id: string;
  reference_id: string | null;
  reference_type: string | null;
  created_by: string | null;
  ip_address: string | null;
  tenant_id: string | null;
}

/** Serialize transaction for public/customer access */
export function serializePublicTransaction(
  transaction: Record<string, unknown>
): PublicTransactionResponse {
  return pickFields(transaction, PUBLIC_TRANSACTION_FIELDS) as PublicTransactionResponse;
}

/** Serialize transaction for admin access */
export function serializeAdminTransaction(
  transaction: Record<string, unknown>
): AdminTransactionResponse {
  return pickFields(transaction, ADMIN_TRANSACTION_FIELDS) as AdminTransactionResponse;
}

// =============================================================================
// AGENT SERIALIZERS
// =============================================================================

const PUBLIC_AGENT_FIELDS = [
  'id', 'username', 'name', 'agent_level',
] as const;

const ADMIN_AGENT_FIELDS = [
  ...PUBLIC_AGENT_FIELDS,
  'phone', 'credit_balance', 'credit_limit', 'outstanding_balance',
  'commission_rate', 'is_active', 'parent_agent_id', 'tenant_id',
  'created_at', 'updated_at', 'last_login_at',
  // EXCLUDED: password_hash
] as const;

export interface PublicAgentResponse {
  id: string;
  username: string;
  name: string | null;
  agent_level: string | null;
}

export interface AdminAgentResponse extends PublicAgentResponse {
  phone: string | null;
  credit_balance: number;
  credit_limit: number;
  outstanding_balance: number;
  commission_rate: number | null;
  is_active: boolean;
  parent_agent_id: string | null;
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

/** Serialize agent for public access */
export function serializePublicAgent(
  agent: Record<string, unknown>
): PublicAgentResponse {
  return pickFields(agent, PUBLIC_AGENT_FIELDS) as PublicAgentResponse;
}

/** Serialize agent for admin access */
export function serializeAdminAgent(
  agent: Record<string, unknown>
): AdminAgentResponse {
  return pickFields(agent, ADMIN_AGENT_FIELDS) as AdminAgentResponse;
}

/** Serialize multiple agents for admin access */
export function serializeAdminAgents(
  agents: Record<string, unknown>[]
): AdminAgentResponse[] {
  return serializeArray(agents, serializeAdminAgent);
}

// =============================================================================
// RESULT SERIALIZERS
// =============================================================================

const PUBLIC_RESULT_FIELDS = [
  'id', 'lottery_id', 'draw_date', 'draw_time',
  'first_prize', 'last_two', 'front_three', 'back_three',
  'is_official', 'announced_at',
] as const;

export interface PublicResultResponse {
  id: string;
  lottery_id: string;
  draw_date: string;
  draw_time: string | null;
  first_prize: string | null;
  last_two: string | null;
  front_three: string[] | null;
  back_three: string[] | null;
  is_official: boolean;
  announced_at: string | null;
}

/** Serialize lottery result for public access */
export function serializePublicResult(
  result: Record<string, unknown>
): PublicResultResponse {
  return pickFields(result, PUBLIC_RESULT_FIELDS) as PublicResultResponse;
}

/** Serialize multiple results for public access */
export function serializePublicResults(
  results: Record<string, unknown>[]
): PublicResultResponse[] {
  return serializeArray(results, serializePublicResult);
}

// =============================================================================
// SENSITIVE FIELDS DOCUMENTATION
// =============================================================================

/**
 * SENSITIVE FIELDS - NEVER EXPOSED IN ANY API RESPONSE
 * 
 * These fields are explicitly excluded from all serializers:
 * 
 * Authentication:
 * - password_hash: Hashed passwords must never be exposed
 * - password: Plain text passwords (if any)
 * - 2fa_secret: Two-factor authentication secrets
 * - recovery_codes: Account recovery codes
 * - api_key: Service API keys
 * - access_token: OAuth/JWT tokens
 * - refresh_token: Token refresh credentials
 * 
 * Security/Audit:
 * - session_id: Active session identifiers
 * - csrf_token: CSRF protection tokens
 * - verification_code: Email/phone verification codes
 * 
 * Internal System:
 * - internal_notes: Staff-only notes
 * - admin_flags: Internal admin flags
 * - debug_info: Debugging information
 * 
 * PII (conditionally excluded based on access level):
 * - full_address: Only for admin/self
 * - national_id: Only for admin/self
 * - bank_account: Only for admin/self
 * - date_of_birth: Only for admin/self
 */
export const NEVER_EXPOSE_FIELDS = [
  'password_hash',
  'password',
  '2fa_secret',
  'recovery_codes',
  'api_key',
  'access_token',
  'refresh_token',
  'session_id',
  'csrf_token',
  'verification_code',
] as const;
