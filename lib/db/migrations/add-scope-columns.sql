-- ============================================================
-- ADD SCOPE COLUMNS MIGRATION
-- ============================================================
-- Purpose: Add tenant_id and agent_id columns to tables that need 
-- direct scoping instead of JOIN-based scoping
-- 
-- Run this BEFORE production-scope-indexes.sql
-- ============================================================

-- ============================================================
-- 1. ADD COLUMNS TO credit_transactions
-- ============================================================
ALTER TABLE credit_transactions 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id),
ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id);

-- Backfill from customers table
UPDATE credit_transactions ct
SET 
  tenant_id = c.tenant_id,
  agent_id = c.agent_id
FROM customers c
WHERE ct.customer_id = c.id
  AND (ct.tenant_id IS NULL OR ct.agent_id IS NULL);

-- ============================================================
-- 2. ADD COLUMNS TO slip_uploads
-- ============================================================
-- Note: slip_uploads uses user_id which may reference customers
ALTER TABLE slip_uploads
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id),
ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id),
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);

-- Backfill tenant_id and agent_id from customers via user_id
UPDATE slip_uploads su
SET 
  tenant_id = c.tenant_id,
  agent_id = c.agent_id,
  customer_id = c.id
FROM customers c
WHERE su.user_id = c.id
  AND (su.tenant_id IS NULL OR su.agent_id IS NULL);

-- ============================================================
-- 3. ADD COLUMNS TO topup_requests
-- ============================================================
ALTER TABLE topup_requests
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id),
ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id);

-- Backfill from customers table
UPDATE topup_requests tr
SET 
  tenant_id = c.tenant_id,
  agent_id = c.agent_id
FROM customers c
WHERE tr.customer_id = c.id
  AND (tr.tenant_id IS NULL OR tr.agent_id IS NULL);

-- ============================================================
-- 4. ADD COLUMNS TO withdraw_requests
-- ============================================================
ALTER TABLE withdraw_requests
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id),
ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id);

-- Backfill from customers table
UPDATE withdraw_requests wr
SET 
  tenant_id = c.tenant_id,
  agent_id = c.agent_id
FROM customers c
WHERE wr.customer_id = c.id
  AND (wr.tenant_id IS NULL OR wr.agent_id IS NULL);

-- ============================================================
-- 5. CREATE TRIGGERS TO AUTO-POPULATE SCOPE COLUMNS
-- ============================================================

-- Function to auto-populate tenant_id and agent_id from customer
CREATE OR REPLACE FUNCTION populate_scope_from_customer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL AND (NEW.tenant_id IS NULL OR NEW.agent_id IS NULL) THEN
    SELECT tenant_id, agent_id INTO NEW.tenant_id, NEW.agent_id
    FROM customers WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for credit_transactions
DROP TRIGGER IF EXISTS trg_credit_transactions_scope ON credit_transactions;
CREATE TRIGGER trg_credit_transactions_scope
  BEFORE INSERT OR UPDATE ON credit_transactions
  FOR EACH ROW EXECUTE FUNCTION populate_scope_from_customer();

-- Trigger for topup_requests
DROP TRIGGER IF EXISTS trg_topup_requests_scope ON topup_requests;
CREATE TRIGGER trg_topup_requests_scope
  BEFORE INSERT OR UPDATE ON topup_requests
  FOR EACH ROW EXECUTE FUNCTION populate_scope_from_customer();

-- Trigger for withdraw_requests
DROP TRIGGER IF EXISTS trg_withdraw_requests_scope ON withdraw_requests;
CREATE TRIGGER trg_withdraw_requests_scope
  BEFORE INSERT OR UPDATE ON withdraw_requests
  FOR EACH ROW EXECUTE FUNCTION populate_scope_from_customer();

-- Special trigger for slip_uploads (uses user_id as customer_id)
CREATE OR REPLACE FUNCTION populate_scope_from_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND (NEW.tenant_id IS NULL OR NEW.agent_id IS NULL) THEN
    SELECT tenant_id, agent_id, id INTO NEW.tenant_id, NEW.agent_id, NEW.customer_id
    FROM customers WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_slip_uploads_scope ON slip_uploads;
CREATE TRIGGER trg_slip_uploads_scope
  BEFORE INSERT OR UPDATE ON slip_uploads
  FOR EACH ROW EXECUTE FUNCTION populate_scope_from_user();

-- ============================================================
-- VERIFICATION QUERY (run after migration)
-- ============================================================
-- SELECT 
--   'credit_transactions' as table_name,
--   COUNT(*) as total,
--   COUNT(tenant_id) as with_tenant,
--   COUNT(agent_id) as with_agent
-- FROM credit_transactions
-- UNION ALL
-- SELECT 'topup_requests', COUNT(*), COUNT(tenant_id), COUNT(agent_id) FROM topup_requests
-- UNION ALL
-- SELECT 'withdraw_requests', COUNT(*), COUNT(tenant_id), COUNT(agent_id) FROM withdraw_requests
-- UNION ALL
-- SELECT 'slip_uploads', COUNT(*), COUNT(tenant_id), COUNT(agent_id) FROM slip_uploads;
