-- ============================================================
-- PRODUCTION SCOPE INDEXES MIGRATION
-- ============================================================
-- Purpose: Add indexes to optimize tenant_id and agent_id queries
-- 
-- IMPORTANT: 
-- 1. Run add-scope-columns.sql FIRST to add missing columns
-- 2. Uses CONCURRENTLY to avoid table locks in production
-- 3. Verify columns exist before running
-- ============================================================

-- ============================================================
-- 1. CUSTOMERS TABLE INDEXES (columns exist)
-- ============================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_tenant_id 
  ON customers(tenant_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_agent_id 
  ON customers(agent_id) WHERE agent_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_tenant_agent 
  ON customers(tenant_id, agent_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_parent_agent_id 
  ON customers(parent_agent_id) WHERE parent_agent_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_tenant_name 
  ON customers(tenant_id, name) WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_tenant_phone 
  ON customers(tenant_id, phone) WHERE tenant_id IS NOT NULL AND phone IS NOT NULL;

-- ============================================================
-- 2. ENTRIES TABLE INDEXES (columns exist)
-- ============================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_entries_tenant_id 
  ON entries(tenant_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_entries_agent_id 
  ON entries(agent_id) WHERE agent_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_entries_tenant_agent 
  ON entries(tenant_id, agent_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_entries_customer_id 
  ON entries(customer_id) WHERE customer_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_entries_tenant_created 
  ON entries(tenant_id, created_at DESC) WHERE tenant_id IS NOT NULL;

-- ============================================================
-- 3. AGENTS TABLE INDEXES (columns exist)
-- ============================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_parent_agent_id 
  ON agents(parent_agent_id) WHERE parent_agent_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_tenant_id 
  ON agents(tenant_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_owner_id 
  ON agents(owner_id) WHERE owner_id IS NOT NULL;

-- ============================================================
-- 4. CREDIT_TRANSACTIONS TABLE INDEXES
-- NOTE: Requires add-scope-columns.sql first!
-- ============================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_transactions_tenant_id 
  ON credit_transactions(tenant_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_transactions_agent_id 
  ON credit_transactions(agent_id) WHERE agent_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_transactions_customer_id 
  ON credit_transactions(customer_id) WHERE customer_id IS NOT NULL;

-- ============================================================
-- 5. SLIP_UPLOADS TABLE INDEXES
-- NOTE: Requires add-scope-columns.sql first!
-- ============================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_slip_uploads_tenant_id 
  ON slip_uploads(tenant_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_slip_uploads_agent_id 
  ON slip_uploads(agent_id) WHERE agent_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_slip_uploads_user_id 
  ON slip_uploads(user_id) WHERE user_id IS NOT NULL;

-- ============================================================
-- 6. TOPUP_REQUESTS TABLE INDEXES
-- NOTE: Requires add-scope-columns.sql first!
-- ============================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_topup_requests_tenant_id 
  ON topup_requests(tenant_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_topup_requests_agent_id 
  ON topup_requests(agent_id) WHERE agent_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_topup_requests_customer_id 
  ON topup_requests(customer_id) WHERE customer_id IS NOT NULL;

-- ============================================================
-- 7. WITHDRAW_REQUESTS TABLE INDEXES
-- NOTE: Requires add-scope-columns.sql first!
-- ============================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdraw_requests_tenant_id 
  ON withdraw_requests(tenant_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdraw_requests_agent_id 
  ON withdraw_requests(agent_id) WHERE agent_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_withdraw_requests_customer_id 
  ON withdraw_requests(customer_id) WHERE customer_id IS NOT NULL;

-- ============================================================
-- VERIFICATION QUERY
-- ============================================================
-- SELECT indexname, tablename FROM pg_indexes 
-- WHERE indexname LIKE 'idx_%tenant%' OR indexname LIKE 'idx_%agent%';
