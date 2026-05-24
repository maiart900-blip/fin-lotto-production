-- =====================================================
-- FIN LOTTO R+ Security & Control Systems Migration
-- Features: 71-80 (Balance Anomaly, Daily Summary, Payout Lock, etc.)
-- =====================================================

-- =====================================================
-- 1. Balance Anomalies Table (ข้อ 71)
-- =====================================================
CREATE TABLE IF NOT EXISTS balance_anomalies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium',
    customer_id UUID REFERENCES customers(id),
    customer_phone VARCHAR(20),
    customer_name VARCHAR(255),
    agent_id UUID REFERENCES agents(id),
    reference_id VARCHAR(255),
    reference_type VARCHAR(50),
    expected_amount DECIMAL(15, 2),
    actual_amount DECIMAL(15, 2),
    difference DECIMAL(15, 2),
    description TEXT NOT NULL,
    details JSONB,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES admin_users(id),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_balance_anomalies_type ON balance_anomalies(type);
CREATE INDEX idx_balance_anomalies_severity ON balance_anomalies(severity);
CREATE INDEX idx_balance_anomalies_customer ON balance_anomalies(customer_id);
CREATE INDEX idx_balance_anomalies_resolved ON balance_anomalies(resolved);
CREATE INDEX idx_balance_anomalies_detected ON balance_anomalies(detected_at);

-- =====================================================
-- 2. Daily Owner Summaries Table (ข้อ 72)
-- =====================================================
CREATE TABLE IF NOT EXISTS daily_owner_summaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    summary_date DATE NOT NULL UNIQUE,
    summary_data JSONB NOT NULL,
    sent_to_owner BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_daily_owner_summaries_date ON daily_owner_summaries(summary_date);

-- =====================================================
-- 3. Payout Rate Snapshots Table (ข้อ 73)
-- =====================================================
CREATE TABLE IF NOT EXISTS payout_rate_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lottery_id UUID NOT NULL,
    lottery_name VARCHAR(255) NOT NULL,
    round_id UUID NOT NULL,
    round_date DATE NOT NULL,
    bet_types JSONB NOT NULL,
    locked_at TIMESTAMPTZ NOT NULL,
    locked_by UUID REFERENCES admin_users(id),
    is_active BOOLEAN DEFAULT TRUE,
    can_modify BOOLEAN DEFAULT FALSE,
    modification_deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(lottery_id, round_id)
);

CREATE INDEX idx_payout_snapshots_lottery ON payout_rate_snapshots(lottery_id);
CREATE INDEX idx_payout_snapshots_round ON payout_rate_snapshots(round_id);
CREATE INDEX idx_payout_snapshots_active ON payout_rate_snapshots(is_active);

-- =====================================================
-- 4. Rate Modification Requests Table (ข้อ 73)
-- =====================================================
CREATE TABLE IF NOT EXISTS rate_modification_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lottery_id UUID NOT NULL,
    round_id UUID NOT NULL,
    bet_type VARCHAR(50) NOT NULL,
    old_rate DECIMAL(10, 2) NOT NULL,
    new_rate DECIMAL(10, 2) NOT NULL,
    requested_by UUID REFERENCES admin_users(id) NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    approved_by UUID REFERENCES admin_users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rate_modification_status ON rate_modification_requests(status);
CREATE INDEX idx_rate_modification_lottery ON rate_modification_requests(lottery_id);
CREATE INDEX idx_rate_modification_requested ON rate_modification_requests(requested_at);

-- =====================================================
-- 5. Used Slips Table (ข้อ 77)
-- =====================================================
CREATE TABLE IF NOT EXISTS used_slips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slip_reference VARCHAR(255) NOT NULL,
    slip_hash VARCHAR(255) NOT NULL,
    customer_id UUID REFERENCES customers(id) NOT NULL,
    topup_request_id UUID REFERENCES topup_requests(id),
    amount DECIMAL(15, 2) NOT NULL,
    transaction_date TIMESTAMPTZ,
    bank_code VARCHAR(10),
    sender_account VARCHAR(50),
    used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_used_slips_reference ON used_slips(slip_reference);
CREATE INDEX idx_used_slips_hash ON used_slips(slip_hash);
CREATE INDEX idx_used_slips_customer ON used_slips(customer_id);
CREATE INDEX idx_used_slips_used_at ON used_slips(used_at);
CREATE UNIQUE INDEX idx_used_slips_unique ON used_slips(slip_hash, used_at);

-- =====================================================
-- 6. Approval Requests Table (ข้อ 78)
-- =====================================================
CREATE TABLE IF NOT EXISTS approval_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    action_data JSONB,
    
    -- Request info
    requested_by UUID REFERENCES admin_users(id) NOT NULL,
    requested_by_name VARCHAR(255),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT NOT NULL,
    amount DECIMAL(15, 2),
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending',
    
    -- First approval
    first_approved_by UUID REFERENCES admin_users(id),
    first_approved_by_name VARCHAR(255),
    first_approved_at TIMESTAMPTZ,
    first_approval_notes TEXT,
    
    -- Final approval
    approved_by UUID REFERENCES admin_users(id),
    approved_by_name VARCHAR(255),
    approved_at TIMESTAMPTZ,
    approval_notes TEXT,
    
    -- Rejection
    rejected_by UUID REFERENCES admin_users(id),
    rejected_by_name VARCHAR(255),
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Expiry
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Metadata
    ip_address VARCHAR(50),
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_approval_requests_type ON approval_requests(type);
CREATE INDEX idx_approval_requests_status ON approval_requests(status);
CREATE INDEX idx_approval_requests_requested_by ON approval_requests(requested_by);
CREATE INDEX idx_approval_requests_requested_at ON approval_requests(requested_at);
CREATE INDEX idx_approval_requests_expires ON approval_requests(expires_at);

-- =====================================================
-- 7. Customer Withdrawal Limits Table (ข้อ 79)
-- =====================================================
CREATE TABLE IF NOT EXISTS customer_withdrawal_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES customers(id) NOT NULL UNIQUE,
    daily_limit DECIMAL(15, 2) NOT NULL,
    max_per_transaction DECIMAL(15, 2) NOT NULL,
    set_by UUID REFERENCES admin_users(id),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customer_withdrawal_limits_customer ON customer_withdrawal_limits(customer_id);

-- =====================================================
-- 8. Add frozen columns to customers (ข้อ 79)
-- =====================================================
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS frozen_reason TEXT,
ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS frozen_by UUID;

CREATE INDEX idx_customers_frozen ON customers(is_frozen);

-- =====================================================
-- 9. Agent Commissions Table (for ข้อ 80)
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_commissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID REFERENCES agents(id) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_sales DECIMAL(15, 2) DEFAULT 0,
    commission_rate DECIMAL(5, 4) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    paid_by UUID REFERENCES admin_users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_commissions_agent ON agent_commissions(agent_id);
CREATE INDEX idx_agent_commissions_status ON agent_commissions(status);
CREATE INDEX idx_agent_commissions_period ON agent_commissions(period_start, period_end);

-- =====================================================
-- 10. Bonus Payouts Table (for ข้อ 80)
-- =====================================================
CREATE TABLE IF NOT EXISTS bonus_payouts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES customers(id) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    bonus_type VARCHAR(50) NOT NULL,
    promotion_id UUID,
    status VARCHAR(20) DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bonus_payouts_customer ON bonus_payouts(customer_id);
CREATE INDEX idx_bonus_payouts_status ON bonus_payouts(status);
CREATE INDEX idx_bonus_payouts_created ON bonus_payouts(created_at);

-- =====================================================
-- 11. Refunds Table (for ข้อ 80)
-- =====================================================
CREATE TABLE IF NOT EXISTS refunds (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES customers(id) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    reason TEXT NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    status VARCHAR(20) DEFAULT 'pending',
    processed_by UUID REFERENCES admin_users(id),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refunds_customer ON refunds(customer_id);
CREATE INDEX idx_refunds_status ON refunds(status);
CREATE INDEX idx_refunds_created ON refunds(created_at);

-- =====================================================
-- 12. Database Function: Check Balance Mismatch (ข้อ 71)
-- =====================================================
CREATE OR REPLACE FUNCTION check_balance_mismatch()
RETURNS TABLE (
    customer_id UUID,
    phone VARCHAR,
    name VARCHAR,
    balance DECIMAL,
    calculated_balance DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as customer_id,
        c.phone,
        c.name,
        c.balance,
        COALESCE(
            (SELECT SUM(
                CASE 
                    WHEN t.type IN ('deposit', 'win', 'bonus', 'refund') THEN t.amount
                    WHEN t.type IN ('withdraw', 'bet') THEN -t.amount
                    ELSE 0
                END
            ) FROM transactions t WHERE t.customer_id = c.id),
            0
        ) as calculated_balance
    FROM customers c
    WHERE ABS(c.balance - COALESCE(
        (SELECT SUM(
            CASE 
                WHEN t.type IN ('deposit', 'win', 'bonus', 'refund') THEN t.amount
                WHEN t.type IN ('withdraw', 'bet') THEN -t.amount
                ELSE 0
            END
        ) FROM transactions t WHERE t.customer_id = c.id),
        0
    )) > 0.01;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 13. Audit Log Enhancement
-- =====================================================
-- Ensure audit_logs table has all needed columns
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50),
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);

-- =====================================================
-- 14. System Settings for Configurations
-- =====================================================
INSERT INTO system_settings (key, value, description) 
VALUES 
    ('withdrawal_default_daily_limit', '100000', 'Default daily withdrawal limit'),
    ('withdrawal_default_min', '100', 'Minimum withdrawal amount'),
    ('withdrawal_default_max', '50000', 'Maximum single withdrawal'),
    ('dual_approval_large_withdrawal', '50000', 'Amount requiring dual approval'),
    ('internal_reserve', '0', 'Internal reserve fund amount')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 15. Indexes for Performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- =====================================================
-- End of Migration
-- =====================================================
