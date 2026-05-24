-- =====================================================
-- MULTI-WALLET SYSTEM MIGRATION
-- Supports: Main Balance, Bonus, Cashback, Promo Credits
-- =====================================================

-- 1. WALLET TYPES TABLE
CREATE TABLE IF NOT EXISTS wallet_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    name_th VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Rules
    can_withdraw BOOLEAN DEFAULT false,
    can_bet BOOLEAN DEFAULT true,
    can_transfer BOOLEAN DEFAULT false,
    expires_days INTEGER, -- NULL = never expires
    min_turnover_multiplier DECIMAL(5,2) DEFAULT 1, -- ต้องเล่นกี่เท่าถึงถอนได้
    
    -- Priority (which wallet to use first when betting)
    priority INTEGER DEFAULT 0,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default wallet types
INSERT INTO wallet_types (code, name, name_th, can_withdraw, can_bet, can_transfer, expires_days, min_turnover_multiplier, priority) VALUES
('main', 'Main Balance', 'ยอดเงินหลัก', true, true, true, NULL, 0, 1),
('bonus', 'Bonus Credit', 'เครดิตโบนัส', false, true, false, 30, 5, 2),
('cashback', 'Cashback', 'เครดิตคืน', true, true, false, 7, 1, 3),
('promo', 'Promotion Credit', 'เครดิตโปรโมชั่น', false, true, false, 14, 3, 4),
('referral', 'Referral Bonus', 'โบนัสแนะนำเพื่อน', true, true, false, NULL, 2, 5)
ON CONFLICT (code) DO NOTHING;

-- 2. USER WALLETS TABLE (Multi-wallet per user)
CREATE TABLE IF NOT EXISTS user_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    site_id UUID NOT NULL REFERENCES sites(id),
    wallet_type_id UUID NOT NULL REFERENCES wallet_types(id),
    
    balance DECIMAL(20,2) DEFAULT 0 CHECK (balance >= 0),
    frozen_amount DECIMAL(20,2) DEFAULT 0 CHECK (frozen_amount >= 0),
    available_balance DECIMAL(20,2) GENERATED ALWAYS AS (balance - frozen_amount) STORED,
    
    -- Turnover tracking for bonus
    turnover_required DECIMAL(20,2) DEFAULT 0,
    turnover_completed DECIMAL(20,2) DEFAULT 0,
    turnover_remaining DECIMAL(20,2) GENERATED ALWAYS AS (GREATEST(0, turnover_required - turnover_completed)) STORED,
    
    -- Expiry
    expires_at TIMESTAMPTZ,
    is_expired BOOLEAN DEFAULT false,
    
    -- Freeze status
    is_frozen BOOLEAN DEFAULT false,
    frozen_at TIMESTAMPTZ,
    frozen_by UUID,
    frozen_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (user_id, site_id, wallet_type_id)
);

CREATE INDEX idx_user_wallets_user ON user_wallets(user_id, site_id);
CREATE INDEX idx_user_wallets_type ON user_wallets(wallet_type_id);
CREATE INDEX idx_user_wallets_expires ON user_wallets(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_user_wallets_frozen ON user_wallets(is_frozen) WHERE is_frozen = true;

-- 3. WALLET TRANSACTIONS TABLE (Detailed ledger)
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    site_id UUID NOT NULL REFERENCES sites(id),
    wallet_id UUID NOT NULL REFERENCES user_wallets(id),
    wallet_type_id UUID NOT NULL REFERENCES wallet_types(id),
    
    -- Transaction details
    transaction_type VARCHAR(30) NOT NULL, -- deposit, withdraw, bet, win, bonus_credit, cashback, promo_credit, transfer_in, transfer_out, freeze, unfreeze, expire, adjustment
    amount DECIMAL(20,2) NOT NULL,
    balance_before DECIMAL(20,2) NOT NULL,
    balance_after DECIMAL(20,2) NOT NULL,
    
    -- For turnover tracking
    turnover_contribution DECIMAL(20,2) DEFAULT 0,
    
    -- Reference
    reference_type VARCHAR(30), -- bet, promotion, manual, system
    reference_id UUID,
    
    description TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Audit
    created_by UUID,
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
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

CREATE INDEX idx_wallet_tx_user ON wallet_transactions(user_id, site_id);
CREATE INDEX idx_wallet_tx_wallet ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_tx_type ON wallet_transactions(transaction_type);
CREATE INDEX idx_wallet_tx_created ON wallet_transactions(created_at DESC);

-- 4. FREEZE BALANCE REQUESTS TABLE
CREATE TABLE IF NOT EXISTS freeze_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    site_id UUID NOT NULL REFERENCES sites(id),
    wallet_id UUID REFERENCES user_wallets(id), -- NULL = freeze all wallets
    
    amount DECIMAL(20,2), -- NULL = freeze entire balance
    reason TEXT NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- active, released, expired
    
    -- Freeze details
    frozen_at TIMESTAMPTZ DEFAULT NOW(),
    frozen_by UUID NOT NULL,
    frozen_by_name VARCHAR(100),
    frozen_by_role VARCHAR(50),
    
    -- Release details
    released_at TIMESTAMPTZ,
    released_by UUID,
    released_by_name VARCHAR(100),
    release_reason TEXT,
    
    -- Auto-release
    auto_release_at TIMESTAMPTZ,
    
    -- Audit
    ip_address INET,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_freeze_user ON freeze_requests(user_id, site_id);
CREATE INDEX idx_freeze_status ON freeze_requests(status) WHERE status = 'active';
CREATE INDEX idx_freeze_auto ON freeze_requests(auto_release_at) WHERE auto_release_at IS NOT NULL AND status = 'active';

-- 5. EVENT SCHEDULER TABLE
CREATE TABLE IF NOT EXISTS scheduled_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Event type
    event_type VARCHAR(30) NOT NULL, -- promotion_start, promotion_end, lottery_open, lottery_close, maintenance_start, maintenance_end, system_task
    
    -- Target
    target_type VARCHAR(30), -- site, lottery, promotion, user, system
    target_id UUID,
    
    -- Schedule
    scheduled_at TIMESTAMPTZ NOT NULL,
    timezone VARCHAR(50) DEFAULT 'Asia/Bangkok',
    
    -- Recurrence
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern VARCHAR(50), -- daily, weekly, monthly, custom
    recurrence_cron VARCHAR(100), -- cron expression for complex schedules
    next_run_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ,
    
    -- Action
    action_type VARCHAR(30) NOT NULL, -- api_call, update_status, send_notification, run_script
    action_payload JSONB DEFAULT '{}',
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed, cancelled
    run_count INTEGER DEFAULT 0,
    last_result JSONB,
    last_error TEXT,
    
    -- Control
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    retry_count INTEGER DEFAULT 0,
    
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_scheduled ON scheduled_events(scheduled_at) WHERE status = 'pending' AND is_active = true;
CREATE INDEX idx_events_type ON scheduled_events(event_type);
CREATE INDEX idx_events_next_run ON scheduled_events(next_run_at) WHERE is_recurring = true AND is_active = true;

-- 6. SMS LOGS TABLE
CREATE TABLE IF NOT EXISTS sms_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Recipient
    phone_number VARCHAR(20) NOT NULL,
    user_id UUID,
    site_id UUID REFERENCES sites(id),
    
    -- Message
    message_type VARCHAR(30) NOT NULL, -- otp, withdrawal_alert, login_alert, promotion, custom
    message_content TEXT NOT NULL,
    
    -- Provider
    provider VARCHAR(30) NOT NULL, -- thaibulksms, thsms, custom
    provider_message_id VARCHAR(100),
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- pending, sent, delivered, failed
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    
    -- Error handling
    error_code VARCHAR(20),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Cost tracking
    credit_used DECIMAL(10,4) DEFAULT 0,
    
    -- Audit
    triggered_by VARCHAR(30), -- system, admin, user
    triggered_by_id UUID,
    ip_address INET,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_phone ON sms_logs(phone_number);
CREATE INDEX idx_sms_user ON sms_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_sms_status ON sms_logs(status);
CREATE INDEX idx_sms_created ON sms_logs(created_at DESC);

-- 7. LANGUAGE TRANSLATIONS TABLE
CREATE TABLE IF NOT EXISTS translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    key VARCHAR(200) NOT NULL,
    locale VARCHAR(10) NOT NULL, -- th, en, lo (Lao), vi (Vietnamese)
    value TEXT NOT NULL,
    
    -- Context
    namespace VARCHAR(50) DEFAULT 'common', -- common, betting, wallet, admin, error
    
    -- Metadata
    is_verified BOOLEAN DEFAULT false,
    verified_by UUID,
    verified_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE (key, locale, namespace)
);

CREATE INDEX idx_translations_locale ON translations(locale);
CREATE INDEX idx_translations_namespace ON translations(namespace, locale);
CREATE INDEX idx_translations_key ON translations(key);

-- Insert default Thai translations (base)
INSERT INTO translations (key, locale, namespace, value) VALUES
-- Common
('app.name', 'th', 'common', 'FIN LOTTO P+'),
('app.tagline', 'th', 'common', 'เว็บหวยอันดับ 1 จ่ายจริง โอนไว 100%'),
('nav.home', 'th', 'common', 'หน้าแรก'),
('nav.bet', 'th', 'common', 'แทงหวย'),
('nav.results', 'th', 'common', 'ผลรางวัล'),
('nav.history', 'th', 'common', 'ประวัติ'),
('nav.wallet', 'th', 'common', 'กระเป๋าเงิน'),
('nav.profile', 'th', 'common', 'โปรไฟล์'),

-- Wallet
('wallet.main', 'th', 'wallet', 'ยอดเงินหลัก'),
('wallet.bonus', 'th', 'wallet', 'เครดิตโบนัส'),
('wallet.cashback', 'th', 'wallet', 'เครดิตคืน'),
('wallet.promo', 'th', 'wallet', 'เครดิตโปรโมชั่น'),
('wallet.deposit', 'th', 'wallet', 'เติมเงิน'),
('wallet.withdraw', 'th', 'wallet', 'ถอนเงิน'),
('wallet.transfer', 'th', 'wallet', 'โอนเงิน'),
('wallet.frozen', 'th', 'wallet', 'ยอดถูกระงับ'),

-- Betting
('bet.place', 'th', 'betting', 'แทงหวย'),
('bet.confirm', 'th', 'betting', 'ยืนยันการแทง'),
('bet.cancel', 'th', 'betting', 'ยกเลิกโพย'),
('bet.success', 'th', 'betting', 'แทงสำเร็จ'),
('bet.failed', 'th', 'betting', 'แทงไม่สำเร็จ'),

-- Admin
('admin.dashboard', 'th', 'admin', 'แดชบอร์ด'),
('admin.members', 'th', 'admin', 'สมาชิก'),
('admin.agents', 'th', 'admin', 'ตัวแทน'),
('admin.reports', 'th', 'admin', 'รายงาน'),
('admin.settings', 'th', 'admin', 'ตั้งค่า')
ON CONFLICT (key, locale, namespace) DO NOTHING;

-- Insert English translations
INSERT INTO translations (key, locale, namespace, value) VALUES
('app.name', 'en', 'common', 'FIN LOTTO P+'),
('app.tagline', 'en', 'common', 'No.1 Lottery - 100% Real Payouts'),
('nav.home', 'en', 'common', 'Home'),
('nav.bet', 'en', 'common', 'Bet'),
('nav.results', 'en', 'common', 'Results'),
('nav.history', 'en', 'common', 'History'),
('nav.wallet', 'en', 'common', 'Wallet'),
('nav.profile', 'en', 'common', 'Profile'),
('wallet.main', 'en', 'wallet', 'Main Balance'),
('wallet.bonus', 'en', 'wallet', 'Bonus Credit'),
('wallet.cashback', 'en', 'wallet', 'Cashback'),
('wallet.promo', 'en', 'wallet', 'Promo Credit'),
('wallet.deposit', 'en', 'wallet', 'Deposit'),
('wallet.withdraw', 'en', 'wallet', 'Withdraw'),
('wallet.transfer', 'en', 'wallet', 'Transfer'),
('wallet.frozen', 'en', 'wallet', 'Frozen Balance'),
('bet.place', 'en', 'betting', 'Place Bet'),
('bet.confirm', 'en', 'betting', 'Confirm Bet'),
('bet.cancel', 'en', 'betting', 'Cancel Bet'),
('bet.success', 'en', 'betting', 'Bet Placed Successfully'),
('bet.failed', 'en', 'betting', 'Bet Failed'),
('admin.dashboard', 'en', 'admin', 'Dashboard'),
('admin.members', 'en', 'admin', 'Members'),
('admin.agents', 'en', 'admin', 'Agents'),
('admin.reports', 'en', 'admin', 'Reports'),
('admin.settings', 'en', 'admin', 'Settings')
ON CONFLICT (key, locale, namespace) DO NOTHING;

-- 8. RLS POLICIES
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE freeze_requests ENABLE ROW LEVEL SECURITY;

-- Super Admin can access all
CREATE POLICY "Super admin full access wallets" ON user_wallets
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('super_admin', 'owner')
        )
    );

CREATE POLICY "Super admin full access wallet_tx" ON wallet_transactions
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('super_admin', 'owner')
        )
    );

CREATE POLICY "Super admin full access freeze" ON freeze_requests
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('super_admin', 'owner')
        )
    );

-- Users can view their own wallets
CREATE POLICY "Users view own wallets" ON user_wallets
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users view own wallet_tx" ON wallet_transactions
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- 9. FUNCTIONS

-- Function to get user's total available balance across all wallets
CREATE OR REPLACE FUNCTION get_total_available_balance(p_user_id UUID, p_site_id UUID)
RETURNS DECIMAL(20,2) AS $$
DECLARE
    v_total DECIMAL(20,2);
BEGIN
    SELECT COALESCE(SUM(available_balance), 0) INTO v_total
    FROM user_wallets uw
    JOIN wallet_types wt ON uw.wallet_type_id = wt.id
    WHERE uw.user_id = p_user_id 
    AND uw.site_id = p_site_id
    AND uw.is_frozen = false
    AND (uw.expires_at IS NULL OR uw.expires_at > NOW())
    AND wt.can_bet = true
    AND wt.is_active = true;
    
    RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- Function to freeze user balance
CREATE OR REPLACE FUNCTION freeze_user_balance(
    p_user_id UUID,
    p_site_id UUID,
    p_amount DECIMAL(20,2),
    p_reason TEXT,
    p_frozen_by UUID,
    p_auto_release_hours INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_freeze_id UUID;
    v_main_wallet_id UUID;
BEGIN
    -- Get main wallet
    SELECT uw.id INTO v_main_wallet_id
    FROM user_wallets uw
    JOIN wallet_types wt ON uw.wallet_type_id = wt.id
    WHERE uw.user_id = p_user_id 
    AND uw.site_id = p_site_id
    AND wt.code = 'main';
    
    IF v_main_wallet_id IS NULL THEN
        RAISE EXCEPTION 'User wallet not found';
    END IF;
    
    -- Update wallet
    UPDATE user_wallets
    SET frozen_amount = frozen_amount + p_amount,
        is_frozen = true,
        frozen_at = NOW(),
        frozen_by = p_frozen_by,
        frozen_reason = p_reason,
        updated_at = NOW()
    WHERE id = v_main_wallet_id;
    
    -- Create freeze request
    INSERT INTO freeze_requests (
        user_id, site_id, wallet_id, amount, reason,
        frozen_by, auto_release_at
    ) VALUES (
        p_user_id, p_site_id, v_main_wallet_id, p_amount, p_reason,
        p_frozen_by, 
        CASE WHEN p_auto_release_hours IS NOT NULL THEN NOW() + (p_auto_release_hours || ' hours')::INTERVAL ELSE NULL END
    )
    RETURNING id INTO v_freeze_id;
    
    RETURN v_freeze_id;
END;
$$ LANGUAGE plpgsql;

-- Function to release frozen balance
CREATE OR REPLACE FUNCTION release_frozen_balance(
    p_freeze_id UUID,
    p_released_by UUID,
    p_release_reason TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_freeze freeze_requests%ROWTYPE;
BEGIN
    -- Get freeze request
    SELECT * INTO v_freeze
    FROM freeze_requests
    WHERE id = p_freeze_id AND status = 'active';
    
    IF v_freeze IS NULL THEN
        RETURN false;
    END IF;
    
    -- Update wallet
    UPDATE user_wallets
    SET frozen_amount = GREATEST(0, frozen_amount - COALESCE(v_freeze.amount, balance)),
        is_frozen = (frozen_amount - COALESCE(v_freeze.amount, balance)) > 0,
        updated_at = NOW()
    WHERE id = v_freeze.wallet_id;
    
    -- Update freeze request
    UPDATE freeze_requests
    SET status = 'released',
        released_at = NOW(),
        released_by = p_released_by,
        release_reason = p_release_reason,
        updated_at = NOW()
    WHERE id = p_freeze_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 10. TRIGGERS

-- Auto-expire wallets
CREATE OR REPLACE FUNCTION check_wallet_expiry()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expires_at IS NOT NULL AND NEW.expires_at < NOW() AND NOT NEW.is_expired THEN
        NEW.is_expired := true;
        NEW.balance := 0;
        NEW.frozen_amount := 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_wallet_expiry
    BEFORE UPDATE ON user_wallets
    FOR EACH ROW
    EXECUTE FUNCTION check_wallet_expiry();

-- Auto-release frozen balances
CREATE OR REPLACE FUNCTION auto_release_frozen()
RETURNS void AS $$
BEGIN
    UPDATE freeze_requests
    SET status = 'released',
        released_at = NOW(),
        release_reason = 'Auto-released by system',
        updated_at = NOW()
    WHERE status = 'active'
    AND auto_release_at IS NOT NULL
    AND auto_release_at <= NOW();
END;
$$ LANGUAGE plpgsql;
