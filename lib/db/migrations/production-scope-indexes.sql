-- =====================================================
-- PRODUCTION INDEX RECOMMENDATIONS
-- Indexes for tenant_id and agent_id scope enforcement
-- Run this migration on production before rollout
-- =====================================================

-- =====================================================
-- 1. CUSTOMERS TABLE - Critical for customer scope
-- =====================================================

-- Primary scope indexes
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id 
  ON customers(tenant_id) 
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_agent_id 
  ON customers(agent_id) 
  WHERE agent_id IS NOT NULL;

-- Composite index for agent-tenant scope queries
CREATE INDEX IF NOT EXISTS idx_customers_tenant_agent 
  ON customers(tenant_id, agent_id);

-- Performance index for downline queries
CREATE INDEX IF NOT EXISTS idx_customers_parent_agent_id 
  ON customers(parent_agent_id) 
  WHERE parent_agent_id IS NOT NULL;

-- Search optimization with scope
CREATE INDEX IF NOT EXISTS idx_customers_tenant_name 
  ON customers(tenant_id, name) 
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_tenant_phone 
  ON customers(tenant_id, phone) 
  WHERE tenant_id IS NOT NULL;

-- =====================================================
-- 2. ENTRIES TABLE - Critical for betting data scope
-- =====================================================

-- Primary scope indexes
CREATE INDEX IF NOT EXISTS idx_entries_tenant_id 
  ON entries(tenant_id) 
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entries_agent_id 
  ON entries(agent_id) 
  WHERE agent_id IS NOT NULL;

-- Composite index for agent-tenant scope
CREATE INDEX IF NOT EXISTS idx_entries_tenant_agent 
  ON entries(tenant_id, agent_id);

-- Customer lookup with scope
CREATE INDEX IF NOT EXISTS idx_entries_customer_id 
  ON entries(customer_id);

-- Date range queries with scope
CREATE INDEX IF NOT EXISTS idx_entries_tenant_created 
  ON entries(tenant_id, created_at DESC) 
  WHERE tenant_id IS NOT NULL;

-- =====================================================
-- 3. TRANSACTIONS TABLE - Critical for finance scope
-- =====================================================

-- Primary scope indexes
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_id 
  ON transactions(tenant_id) 
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_agent_id 
  ON transactions(agent_id) 
  WHERE agent_id IS NOT NULL;

-- Composite index for agent-tenant scope
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_agent 
  ON transactions(tenant_id, agent_id);

-- Customer transaction lookup
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id 
  ON transactions(customer_id);

-- Date range queries with scope
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_created 
  ON transactions(tenant_id, created_at DESC) 
  WHERE tenant_id IS NOT NULL;

-- =====================================================
-- 4. CREDIT_TRANSACTIONS TABLE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_credit_transactions_tenant_id 
  ON credit_transactions(tenant_id) 
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_transactions_agent_id 
  ON credit_transactions(agent_id) 
  WHERE agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_transactions_customer_id 
  ON credit_transactions(customer_id);

-- =====================================================
-- 5. AGENTS TABLE - For downline resolution
-- =====================================================

-- Parent agent lookup for downline calculation
CREATE INDEX IF NOT EXISTS idx_agents_parent_agent_id 
  ON agents(parent_agent_id) 
  WHERE parent_agent_id IS NOT NULL;

-- Tenant scope for agents
CREATE INDEX IF NOT EXISTS idx_agents_tenant_id 
  ON agents(tenant_id) 
  WHERE tenant_id IS NOT NULL;

-- Owner lookup
CREATE INDEX IF NOT EXISTS idx_agents_owner_id 
  ON agents(owner_id) 
  WHERE owner_id IS NOT NULL;

-- =====================================================
-- 6. SLIP_UPLOADS TABLE - For finance queries
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_slip_uploads_tenant_id 
  ON slip_uploads(tenant_id) 
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_slip_uploads_agent_id 
  ON slip_uploads(agent_id) 
  WHERE agent_id IS NOT NULL;

-- =====================================================
-- 7. TOPUP_REQUESTS TABLE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_topup_requests_tenant_id 
  ON topup_requests(tenant_id) 
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_topup_requests_agent_id 
  ON topup_requests(agent_id) 
  WHERE agent_id IS NOT NULL;

-- =====================================================
-- 8. WITHDRAW_REQUESTS TABLE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_withdraw_requests_tenant_id 
  ON withdraw_requests(tenant_id) 
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_withdraw_requests_agent_id 
  ON withdraw_requests(agent_id) 
  WHERE agent_id IS NOT NULL;

-- =====================================================
-- VERIFY INDEXES (Run after creation)
-- =====================================================

-- Check index existence:
-- SELECT indexname, tablename FROM pg_indexes 
-- WHERE indexname LIKE 'idx_%_tenant%' OR indexname LIKE 'idx_%_agent%';

-- Monitor index usage:
-- SELECT schemaname, relname, indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE indexrelname LIKE 'idx_%_tenant%' OR indexrelname LIKE 'idx_%_agent%'
-- ORDER BY idx_scan DESC;
