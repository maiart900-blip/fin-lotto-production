-- ============================================================
-- PRODUCTION SCOPE INDEXES MIGRATION (Simplified)
-- ============================================================
-- Purpose: Add indexes to optimize key-in agent queries
-- 
-- IMPORTANT: 
-- - Uses CONCURRENTLY to avoid table locks in production
-- - Only includes indexes for EXISTING columns
-- - For key-in agent data isolation within FIN LOTTO DB
-- ============================================================

-- ============================================================
-- 1. CUSTOMERS TABLE INDEXES
-- ============================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_tenant_id 
  ON customers(tenant_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_agent_id 
  ON customers(agent_id) WHERE agent_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_tenant_agent 
  ON customers(tenant_id, agent_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_parent_agent_id 
  ON customers(parent_agent_id) WHERE parent_agent_id IS NOT NULL;

-- ============================================================
-- 2. ENTRIES TABLE INDEXES
-- ============================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_entries_tenant_id 
  ON entries(tenant_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_entries_agent_id 
  ON entries(agent_id) WHERE agent_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_entries_tenant_agent 
  ON entries(tenant_id, agent_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_entries_customer_id 
  ON entries(customer_id) WHERE customer_id IS NOT NULL;

-- ============================================================
-- 3. AGENTS TABLE INDEXES
-- ============================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_parent_agent_id 
  ON agents(parent_agent_id) WHERE parent_agent_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_tenant_id 
  ON agents(tenant_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_owner_id 
  ON agents(owner_id) WHERE owner_id IS NOT NULL;

-- ============================================================
-- 4. CREDIT_TRANSACTIONS - Index on customer_id only
-- ============================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_transactions_customer_id 
  ON credit_transactions(customer_id) WHERE customer_id IS NOT NULL;

-- ============================================================
-- VERIFICATION QUERY
-- ============================================================
-- SELECT indexname, tablename FROM pg_indexes 
-- WHERE indexname LIKE 'idx_customers%' 
--    OR indexname LIKE 'idx_entries%' 
--    OR indexname LIKE 'idx_agents%';
