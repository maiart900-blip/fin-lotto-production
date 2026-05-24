-- =====================================================
-- LOTTO ENGINE MASTER - SQL SCHEMA
-- Designed for 100M+ rows with Indexing & Partitioning
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- For composite indexes

-- =====================================================
-- 1. SITES (White Label / Multi-Tenant)
-- =====================================================
CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,  -- site-a, site-b
    name VARCHAR(100) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    api_key VARCHAR(64) UNIQUE NOT NULL,
    
    -- Branding
    logo_url TEXT,
    favicon_url TEXT,
    primary_color VARCHAR(7) DEFAULT '#FFD700',
    secondary_color VARCHAR(7) DEFAULT '#1a1a2e',
    
    -- Settings
    use_global_rates BOOLEAN DEFAULT true,
    use_global_limits BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    
    -- Stats cache (updated periodically)
    total_members INTEGER DEFAULT 0,
    total_volume DECIMAL(20,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sites_code ON sites(code);
CREATE INDEX idx_sites_domain ON sites(domain);
CREATE INDEX idx_sites_api_key ON sites(api_key);
CREATE INDEX idx_sites_active ON sites(is_active) WHERE is_active = true;

-- =====================================================
-- 2. USERS (Partitioned by site_id hash)
-- =====================================================
CREATE TABLE users (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id),
    
    username VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    
    -- Role: super_admin, site_admin, master_agent, senior_agent, agent, member
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    
    -- Hierarchy
    parent_id UUID,
    upline_path TEXT[], -- Array of ancestor IDs for fast hierarchy queries
    level INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_suspended BOOLEAN DEFAULT false,
    suspended_reason TEXT,
    
    -- Commission & PT
    commission_rate DECIMAL(5,2) DEFAULT 0,
    pt_rate DECIMAL(5,2) DEFAULT 0, -- Position Taking
    
    -- Credit System (for agents)
    credit_limit DECIMAL(20,2) DEFAULT 0,
    credit_used DECIMAL(20,2) DEFAULT 0,
    outstanding DECIMAL(20,2) DEFAULT 0,
    
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (id, site_id),
    UNIQUE (site_id, username)
) PARTITION BY HASH (site_id);

-- Create 16 partitions for horizontal scaling
CREATE TABLE users_p0 PARTITION OF users FOR VALUES WITH (MODULUS 16, REMAINDER 0);
CREATE TABLE users_p1 PARTITION OF users FOR VALUES WITH (MODULUS 16, REMAINDER 1);
CREATE TABLE users_p2 PARTITION OF users FOR VALUES WITH (MODULUS 16, REMAINDER 2);
CREATE TABLE users_p3 PARTITION OF users FOR VALUES WITH (MODULUS 16, REMAINDER 3);
CREATE TABLE users_p4 PARTITION OF users FOR VALUES WITH (MODULUS 16, REMAINDER 4);
CREATE TABLE users_p5 PARTITION OF users FOR VALUES WITH (MODULUS 16, REMAINDER 5);
CREATE TABLE users_p6 PARTITION OF users FOR VALUES WITH (MODULUS 16, REMAINDER 6);
CREATE TABLE users_p7 PARTITION OF users FOR VALUES WITH (MODULUS 16, REMAINDER 7);
CREATE TABLE users_p8 PARTITION OF users FOR VALUES WITH (MODULUS 16, REMAINDER 8);
CREATE TABLE users_p9 PARTITION OF users FOR VALUES WITH (MODULUS 16, REMAINDER 9);
CREATE TABLE users_p10 PARTITION OF users FOR VALUES WITH (MODULUS 16, REMAINDER 10);
CREATE TABLE users_p11 PARTITION OF users FOR VALUES WITH (MODULUS 16, REMAINDER 11);
CREATE TABLE users_p12 PARTITION OF users FOR VALUES WITH (MODULUS 16, REMAINDER 12);
CREATE TABLE users_p13 PARTITION OF users FOR VALUES WITH (MODULUS 16, REMAINDER 13);
CREATE TABLE users_p14 PARTITION OF users FOR VALUES WITH (MODULUS 16, REMAINDER 14);
CREATE TABLE users_p15 PARTITION OF users FOR VALUES WITH (MODULUS 16, REMAINDER 15);

-- Indexes for users
CREATE INDEX idx_users_site_username ON users(site_id, username);
CREATE INDEX idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_users_role ON users(site_id, role);
CREATE INDEX idx_users_parent ON users(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_users_upline ON users USING GIN(upline_path);
CREATE INDEX idx_users_active ON users(site_id, is_active) WHERE is_active = true;

-- =====================================================
-- 3. CENTRAL WALLET (Single source of truth)
-- =====================================================
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    site_id UUID NOT NULL REFERENCES sites(id),
    
    balance DECIMAL(20,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    frozen_amount DECIMAL(20,2) DEFAULT 0,
    
    -- Optimistic locking
    version INTEGER DEFAULT 1,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (user_id, site_id)
);

CREATE INDEX idx_wallets_user ON wallets(user_id, site_id);
CREATE INDEX idx_wallets_balance ON wallets(balance) WHERE balance > 0;

-- =====================================================
-- 4. WALLET TRANSACTIONS (Partitioned by month)
-- =====================================================
CREATE TABLE wallet_transactions (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL,
    site_id UUID NOT NULL,
    user_id UUID NOT NULL,
    
    -- Type: deposit, withdraw, bet, win, refund, transfer, commission, adjustment
    type VARCHAR(20) NOT NULL,
    amount DECIMAL(20,2) NOT NULL,
    balance_before DECIMAL(20,2) NOT NULL,
    balance_after DECIMAL(20,2) NOT NULL,
    
    -- Reference
    reference_type VARCHAR(50), -- bet, promotion, manual, etc.
    reference_id UUID,
    
    description TEXT,
    performed_by UUID, -- Admin who performed (for adjustments)
    ip_address INET,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions (example for 2024-2025)
CREATE TABLE wallet_transactions_2024_01 PARTITION OF wallet_transactions
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE wallet_transactions_2024_02 PARTITION OF wallet_transactions
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
CREATE TABLE wallet_transactions_2024_03 PARTITION OF wallet_transactions
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
CREATE TABLE wallet_transactions_2024_04 PARTITION OF wallet_transactions
    FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');
CREATE TABLE wallet_transactions_2024_05 PARTITION OF wallet_transactions
    FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');
CREATE TABLE wallet_transactions_2024_06 PARTITION OF wallet_transactions
    FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');
CREATE TABLE wallet_transactions_2024_07 PARTITION OF wallet_transactions
    FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');
CREATE TABLE wallet_transactions_2024_08 PARTITION OF wallet_transactions
    FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');
CREATE TABLE wallet_transactions_2024_09 PARTITION OF wallet_transactions
    FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
CREATE TABLE wallet_transactions_2024_10 PARTITION OF wallet_transactions
    FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE wallet_transactions_2024_11 PARTITION OF wallet_transactions
    FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE wallet_transactions_2024_12 PARTITION OF wallet_transactions
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
-- Add more as needed...
CREATE TABLE wallet_transactions_2025_01 PARTITION OF wallet_transactions
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE wallet_transactions_2025_02 PARTITION OF wallet_transactions
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE wallet_transactions_2025_03 PARTITION OF wallet_transactions
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE wallet_transactions_2025_04 PARTITION OF wallet_transactions
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE wallet_transactions_2025_05 PARTITION OF wallet_transactions
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE wallet_transactions_2025_06 PARTITION OF wallet_transactions
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE wallet_transactions_default PARTITION OF wallet_transactions DEFAULT;

-- Indexes for transactions
CREATE INDEX idx_wtx_wallet ON wallet_transactions(wallet_id, created_at DESC);
CREATE INDEX idx_wtx_site ON wallet_transactions(site_id, created_at DESC);
CREATE INDEX idx_wtx_user ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX idx_wtx_type ON wallet_transactions(type, created_at DESC);
CREATE INDEX idx_wtx_reference ON wallet_transactions(reference_type, reference_id) WHERE reference_id IS NOT NULL;

-- =====================================================
-- 5. LOTTERIES
-- =====================================================
CREATE TABLE lotteries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- laos, hanoi, thai, stock, yeekee
    icon VARCHAR(10),
    
    -- Schedule
    draw_time TIME,
    draw_days INTEGER[], -- 0=Sun, 1=Mon, etc.
    close_before_minutes INTEGER DEFAULT 5,
    
    -- Rates (Global defaults)
    rate_3top DECIMAL(10,2) DEFAULT 900,
    rate_3tod DECIMAL(10,2) DEFAULT 150,
    rate_2top DECIMAL(10,2) DEFAULT 90,
    rate_2bottom DECIMAL(10,2) DEFAULT 90,
    rate_run_top DECIMAL(10,2) DEFAULT 4,
    rate_run_bottom DECIMAL(10,2) DEFAULT 4,
    
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lotteries_category ON lotteries(category);
CREATE INDEX idx_lotteries_active ON lotteries(is_active) WHERE is_active = true;

-- =====================================================
-- 6. LOTTERY ROUNDS
-- =====================================================
CREATE TABLE lottery_rounds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lottery_id UUID NOT NULL REFERENCES lotteries(id),
    
    round_date DATE NOT NULL,
    round_number VARCHAR(20), -- e.g., "01/16/68" for Thai govt lottery
    
    -- Status: upcoming, open, closed, processing, completed
    status VARCHAR(20) NOT NULL DEFAULT 'upcoming',
    
    open_at TIMESTAMPTZ,
    close_at TIMESTAMPTZ,
    draw_at TIMESTAMPTZ,
    
    -- Results
    result_3digits VARCHAR(3),
    result_2digits_top VARCHAR(2),
    result_2digits_bottom VARCHAR(2),
    
    -- Stats
    total_bets INTEGER DEFAULT 0,
    total_amount DECIMAL(20,2) DEFAULT 0,
    total_payout DECIMAL(20,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (lottery_id, round_date)
);

CREATE INDEX idx_rounds_lottery_date ON lottery_rounds(lottery_id, round_date DESC);
CREATE INDEX idx_rounds_status ON lottery_rounds(status);
CREATE INDEX idx_rounds_draw_at ON lottery_rounds(draw_at) WHERE status IN ('upcoming', 'open');

-- =====================================================
-- 7. BETS (Partitioned by created_at month)
-- =====================================================
CREATE TABLE bets (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL,
    user_id UUID NOT NULL,
    round_id UUID NOT NULL,
    lottery_id UUID NOT NULL,
    
    -- Agent hierarchy snapshot
    agent_id UUID,
    agent_path TEXT[],
    
    -- Bet details
    number VARCHAR(6) NOT NULL,
    bet_type VARCHAR(20) NOT NULL, -- 3top, 3tod, 2top, 2bottom, run_top, run_bottom
    amount DECIMAL(20,2) NOT NULL,
    rate DECIMAL(10,2) NOT NULL,
    potential_win DECIMAL(20,2) NOT NULL,
    
    -- Commission
    commission_rate DECIMAL(5,2) DEFAULT 0,
    commission_amount DECIMAL(20,2) DEFAULT 0,
    net_amount DECIMAL(20,2) NOT NULL, -- amount - commission
    
    -- Status: pending, won, lost, cancelled, refunded
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    win_amount DECIMAL(20,2) DEFAULT 0,
    
    -- Limits check
    is_limited BOOLEAN DEFAULT false, -- เลขอั้น
    limit_reason TEXT,
    
    -- Source
    source VARCHAR(20) DEFAULT 'web', -- web, mobile, agent_terminal, api
    ip_address INET,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMPTZ,
    
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE bets_2024_01 PARTITION OF bets FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE bets_2024_02 PARTITION OF bets FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
CREATE TABLE bets_2024_03 PARTITION OF bets FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
CREATE TABLE bets_2024_04 PARTITION OF bets FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');
CREATE TABLE bets_2024_05 PARTITION OF bets FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');
CREATE TABLE bets_2024_06 PARTITION OF bets FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');
CREATE TABLE bets_2024_07 PARTITION OF bets FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');
CREATE TABLE bets_2024_08 PARTITION OF bets FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');
CREATE TABLE bets_2024_09 PARTITION OF bets FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
CREATE TABLE bets_2024_10 PARTITION OF bets FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE bets_2024_11 PARTITION OF bets FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE bets_2024_12 PARTITION OF bets FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE bets_2025_01 PARTITION OF bets FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE bets_2025_02 PARTITION OF bets FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE bets_2025_03 PARTITION OF bets FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE bets_2025_04 PARTITION OF bets FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE bets_2025_05 PARTITION OF bets FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE bets_2025_06 PARTITION OF bets FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE bets_default PARTITION OF bets DEFAULT;

-- Indexes for bets (CRITICAL for performance)
CREATE INDEX idx_bets_site_user ON bets(site_id, user_id, created_at DESC);
CREATE INDEX idx_bets_round ON bets(round_id, status);
CREATE INDEX idx_bets_lottery ON bets(lottery_id, created_at DESC);
CREATE INDEX idx_bets_number ON bets(number, round_id) WHERE status = 'pending';
CREATE INDEX idx_bets_agent ON bets(agent_id, created_at DESC) WHERE agent_id IS NOT NULL;
CREATE INDEX idx_bets_agent_path ON bets USING GIN(agent_path);
CREATE INDEX idx_bets_status ON bets(status, created_at DESC);
CREATE INDEX idx_bets_pending ON bets(round_id) WHERE status = 'pending';

-- =====================================================
-- 8. NUMBER LIMITS (เลขอั้น)
-- =====================================================
CREATE TABLE number_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES sites(id), -- NULL = global
    lottery_id UUID REFERENCES lotteries(id), -- NULL = all lotteries
    
    number VARCHAR(6) NOT NULL,
    bet_type VARCHAR(20), -- NULL = all types
    
    max_amount DECIMAL(20,2) NOT NULL,
    current_amount DECIMAL(20,2) DEFAULT 0,
    
    -- Override rate when limited
    limited_rate DECIMAL(10,2),
    
    is_active BOOLEAN DEFAULT true,
    reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_limits_lookup ON number_limits(number, lottery_id, site_id) WHERE is_active = true;
CREATE INDEX idx_limits_site ON number_limits(site_id) WHERE is_active = true;

-- =====================================================
-- 9. AUDIT LOGS (Critical for fraud prevention)
-- =====================================================
CREATE TABLE audit_logs (
    id UUID NOT NULL DEFAULT uuid_generate_v4(),
    site_id UUID,
    user_id UUID NOT NULL,
    
    -- Action details
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50), -- user, bet, wallet, site, lottery, etc.
    entity_id UUID,
    
    -- Changes
    old_values JSONB,
    new_values JSONB,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(100),
    
    -- Risk scoring
    risk_level VARCHAR(20) DEFAULT 'low', -- low, medium, high, critical
    is_suspicious BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for audit logs
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE audit_logs_2024_02 PARTITION OF audit_logs FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
CREATE TABLE audit_logs_2024_03 PARTITION OF audit_logs FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
CREATE TABLE audit_logs_2024_04 PARTITION OF audit_logs FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');
CREATE TABLE audit_logs_2024_05 PARTITION OF audit_logs FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');
CREATE TABLE audit_logs_2024_06 PARTITION OF audit_logs FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');
CREATE TABLE audit_logs_2024_07 PARTITION OF audit_logs FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');
CREATE TABLE audit_logs_2024_08 PARTITION OF audit_logs FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');
CREATE TABLE audit_logs_2024_09 PARTITION OF audit_logs FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
CREATE TABLE audit_logs_2024_10 PARTITION OF audit_logs FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE audit_logs_2024_11 PARTITION OF audit_logs FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE audit_logs_2024_12 PARTITION OF audit_logs FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE audit_logs_2025_02 PARTITION OF audit_logs FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE audit_logs_2025_03 PARTITION OF audit_logs FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE audit_logs_2025_04 PARTITION OF audit_logs FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE audit_logs_2025_05 PARTITION OF audit_logs FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE audit_logs_2025_06 PARTITION OF audit_logs FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE audit_logs_default PARTITION OF audit_logs DEFAULT;

-- Indexes for audit logs
CREATE INDEX idx_audit_site ON audit_logs(site_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_suspicious ON audit_logs(is_suspicious, created_at DESC) WHERE is_suspicious = true;
CREATE INDEX idx_audit_risk ON audit_logs(risk_level, created_at DESC) WHERE risk_level IN ('high', 'critical');

-- =====================================================
-- 10. SETTLEMENTS (Agent/Site settlements)
-- =====================================================
CREATE TABLE settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES sites(id),
    agent_id UUID,
    
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Totals
    total_bets DECIMAL(20,2) DEFAULT 0,
    total_wins DECIMAL(20,2) DEFAULT 0,
    total_commission DECIMAL(20,2) DEFAULT 0,
    net_amount DECIMAL(20,2) DEFAULT 0, -- What master owes/is owed
    
    -- Status: pending, approved, paid, disputed
    status VARCHAR(20) DEFAULT 'pending',
    
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_settlements_site ON settlements(site_id, period_start DESC);
CREATE INDEX idx_settlements_agent ON settlements(agent_id, period_start DESC);
CREATE INDEX idx_settlements_status ON settlements(status);

-- =====================================================
-- 11. SYSTEM METRICS (For monitoring)
-- =====================================================
CREATE TABLE system_metrics (
    id BIGSERIAL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(20,4) NOT NULL,
    site_id UUID,
    tags JSONB,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- Daily partitions for metrics (high frequency writes)
CREATE TABLE system_metrics_default PARTITION OF system_metrics DEFAULT;

CREATE INDEX idx_metrics_name ON system_metrics(metric_name, recorded_at DESC);
CREATE INDEX idx_metrics_site ON system_metrics(site_id, recorded_at DESC) WHERE site_id IS NOT NULL;

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trigger_sites_updated_at BEFORE UPDATE ON sites FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_lotteries_updated_at BEFORE UPDATE ON lotteries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_rounds_updated_at BEFORE UPDATE ON lottery_rounds FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_limits_updated_at BEFORE UPDATE ON number_limits FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_settlements_updated_at BEFORE UPDATE ON settlements FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to create monthly partitions automatically
CREATE OR REPLACE FUNCTION create_monthly_partitions(
    table_name TEXT,
    start_date DATE,
    end_date DATE
) RETURNS VOID AS $$
DECLARE
    partition_date DATE := start_date;
    partition_name TEXT;
    start_range TEXT;
    end_range TEXT;
BEGIN
    WHILE partition_date < end_date LOOP
        partition_name := table_name || '_' || TO_CHAR(partition_date, 'YYYY_MM');
        start_range := TO_CHAR(partition_date, 'YYYY-MM-DD');
        end_range := TO_CHAR(partition_date + INTERVAL '1 month', 'YYYY-MM-DD');
        
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
            partition_name, table_name, start_range, end_range
        );
        
        partition_date := partition_date + INTERVAL '1 month';
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- MATERIALIZED VIEWS (For fast reporting)
-- =====================================================

-- Daily summary per site
CREATE MATERIALIZED VIEW mv_daily_site_summary AS
SELECT 
    DATE(b.created_at) as date,
    b.site_id,
    s.name as site_name,
    COUNT(*) as bet_count,
    SUM(b.amount) as total_amount,
    SUM(b.net_amount) as net_amount,
    SUM(b.commission_amount) as commission_total,
    SUM(CASE WHEN b.status = 'won' THEN b.win_amount ELSE 0 END) as payout_total,
    SUM(b.net_amount) - SUM(CASE WHEN b.status = 'won' THEN b.win_amount ELSE 0 END) as profit
FROM bets b
JOIN sites s ON b.site_id = s.id
GROUP BY DATE(b.created_at), b.site_id, s.name
WITH DATA;

CREATE UNIQUE INDEX idx_mv_daily_site ON mv_daily_site_summary(date, site_id);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_daily_summaries()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_site_summary;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS (Documentation)
-- =====================================================
COMMENT ON TABLE sites IS 'White Label sites managed by master platform';
COMMENT ON TABLE users IS 'All users partitioned by site for scalability';
COMMENT ON TABLE wallets IS 'Central wallet - single source of truth for balances';
COMMENT ON TABLE wallet_transactions IS 'All money movements, partitioned by month';
COMMENT ON TABLE bets IS 'All bets, partitioned by month for 100M+ row support';
COMMENT ON TABLE audit_logs IS 'Security audit trail, partitioned by month';
COMMENT ON TABLE number_limits IS 'Number betting limits (เลขอั้น)';
COMMENT ON TABLE settlements IS 'Agent and site settlement records';
