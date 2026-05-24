-- Migration: Add Emergency Lock and Data Retention Systems
-- Date: 2024
-- Description: เพิ่มระบบ Emergency Lock และ Data Retention

-- =====================================================
-- 1. Emergency Lock Logs Table
-- =====================================================
CREATE TABLE IF NOT EXISTS emergency_lock_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_type TEXT NOT NULL, -- SYSTEM, BETTING, WITHDRAWAL, DEPOSIT, AGENT, SETTLEMENT, ALL
  action TEXT NOT NULL, -- lock, unlock
  admin_id UUID REFERENCES auth.users(id),
  reason TEXT,
  affected_systems TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_emergency_lock_logs_created ON emergency_lock_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_lock_logs_type ON emergency_lock_logs(lock_type);
CREATE INDEX IF NOT EXISTS idx_emergency_lock_logs_action ON emergency_lock_logs(action);

-- RLS
ALTER TABLE emergency_lock_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view emergency lock logs"
  ON emergency_lock_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role IN ('super_admin', 'admin', 'owner')
    )
  );

CREATE POLICY "Only super_admin can insert emergency lock logs"
  ON emergency_lock_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role IN ('super_admin', 'owner')
    )
  );

-- =====================================================
-- 2. Data Retention Policies Table
-- =====================================================
CREATE TABLE IF NOT EXISTS data_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_type TEXT UNIQUE NOT NULL,
  table_name TEXT NOT NULL,
  retention_days INTEGER NOT NULL DEFAULT 365,
  archive_before_delete BOOLEAN DEFAULT TRUE,
  archive_location TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  deleted_count INTEGER DEFAULT 0,
  archived_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default policies
INSERT INTO data_retention_policies (data_type, table_name, retention_days, archive_before_delete)
VALUES
  ('transactions', 'transactions', 2555, TRUE), -- 7 years
  ('deposits', 'deposits', 2555, TRUE),
  ('withdrawals', 'withdrawals', 2555, TRUE),
  ('bets', 'bets', 1825, TRUE), -- 5 years
  ('bet_entries', 'bet_entries', 1825, TRUE),
  ('lottery_results', 'lottery_results', 3650, TRUE), -- 10 years
  ('daily_closings', 'daily_closings', 2555, TRUE),
  ('commission_records', 'commission_records', 2555, TRUE),
  ('audit_logs', 'audit_logs', 3650, TRUE), -- 10 years
  ('activity_logs', 'activity_logs', 1095, TRUE), -- 3 years
  ('error_logs', 'error_logs', 365, FALSE), -- 1 year
  ('api_logs', 'api_logs', 90, FALSE), -- 90 days
  ('session_logs', 'session_logs', 180, FALSE), -- 180 days
  ('otp_codes', 'otp_codes', 1, FALSE), -- 1 day
  ('temp_files', 'temp_files', 7, FALSE), -- 7 days
  ('slip_images', 'slip_images', 1095, TRUE) -- 3 years
ON CONFLICT (data_type) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_retention_policies_type ON data_retention_policies(data_type);
CREATE INDEX IF NOT EXISTS idx_retention_policies_active ON data_retention_policies(is_active);

-- RLS
ALTER TABLE data_retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view retention policies"
  ON data_retention_policies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role IN ('super_admin', 'admin', 'owner')
    )
  );

CREATE POLICY "Only super_admin can modify retention policies"
  ON data_retention_policies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role = 'super_admin'
    )
  );

-- =====================================================
-- 3. Archive Tables (for important data)
-- =====================================================

-- Transactions Archive
CREATE TABLE IF NOT EXISTS transactions_archive (
  LIKE transactions INCLUDING ALL,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  archived_by UUID REFERENCES auth.users(id)
);

-- Bets Archive
CREATE TABLE IF NOT EXISTS bets_archive (
  LIKE bets INCLUDING ALL,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  archived_by UUID REFERENCES auth.users(id)
);

-- Audit Logs Archive
CREATE TABLE IF NOT EXISTS audit_logs_archive (
  LIKE audit_logs INCLUDING ALL,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  archived_by UUID REFERENCES auth.users(id)
);

-- Indexes for archive tables
CREATE INDEX IF NOT EXISTS idx_transactions_archive_date ON transactions_archive(archived_at);
CREATE INDEX IF NOT EXISTS idx_bets_archive_date ON bets_archive(archived_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_date ON audit_logs_archive(archived_at);

-- =====================================================
-- 4. Owner Daily Reports Table
-- =====================================================
CREATE TABLE IF NOT EXISTS owner_daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE UNIQUE NOT NULL,
  
  -- Financial Summary
  total_deposits DECIMAL(15,2) DEFAULT 0,
  total_withdrawals DECIMAL(15,2) DEFAULT 0,
  total_bets DECIMAL(15,2) DEFAULT 0,
  total_payouts DECIMAL(15,2) DEFAULT 0,
  total_commission DECIMAL(15,2) DEFAULT 0,
  net_profit DECIMAL(15,2) DEFAULT 0,
  
  -- Customer Summary
  new_customers INTEGER DEFAULT 0,
  active_customers INTEGER DEFAULT 0,
  total_customers INTEGER DEFAULT 0,
  
  -- Agent Summary
  active_agents INTEGER DEFAULT 0,
  top_agent_id UUID,
  top_agent_sales DECIMAL(15,2) DEFAULT 0,
  
  -- Risk Summary
  high_risk_numbers TEXT[],
  suspicious_activities INTEGER DEFAULT 0,
  
  -- Issues
  pending_issues INTEGER DEFAULT 0,
  resolved_issues INTEGER DEFAULT 0,
  
  -- Metadata
  sent_to_line BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_owner_reports_date ON owner_daily_reports(report_date DESC);

-- RLS
ALTER TABLE owner_daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view daily reports"
  ON owner_daily_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role IN ('super_admin', 'owner')
    )
  );
