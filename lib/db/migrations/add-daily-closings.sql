-- Migration: Add daily_closings table for Daily Closing / สรุปรายวันอัตโนมัติ
-- Date: 2024
-- Description: เก็บ snapshot รายวัน ไม่ลบข้อมูลเก่า พร้อมระบบล็อกและ Audit Log

-- Create daily_closings table
CREATE TABLE IF NOT EXISTS daily_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_date DATE NOT NULL UNIQUE,
  closing_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- ยอดฝาก (Deposits)
  total_deposits DECIMAL(20,2) DEFAULT 0,
  deposit_count INTEGER DEFAULT 0,
  
  -- ยอดถอน (Withdrawals)
  total_withdrawals DECIMAL(20,2) DEFAULT 0,
  withdrawal_count INTEGER DEFAULT 0,
  
  -- ยอดแทงหวย (Bets)
  total_bets DECIMAL(20,2) DEFAULT 0,
  bet_count INTEGER DEFAULT 0,
  
  -- ยอดถูกรางวัล (Winnings)
  total_winnings DECIMAL(20,2) DEFAULT 0,
  winning_count INTEGER DEFAULT 0,
  
  -- ยอดจ่ายรางวัล (Payouts)
  total_payouts DECIMAL(20,2) DEFAULT 0,
  payout_count INTEGER DEFAULT 0,
  
  -- โบนัส (Bonuses)
  total_bonuses DECIMAL(20,2) DEFAULT 0,
  bonus_count INTEGER DEFAULT 0,
  
  -- ยอดขาย (Sales)
  total_sales DECIMAL(20,2) DEFAULT 0,
  
  -- ยอดค้างชำระ (Pending Balance)
  pending_balance DECIMAL(20,2) DEFAULT 0,
  pending_withdrawals DECIMAL(20,2) DEFAULT 0,
  pending_payouts DECIMAL(20,2) DEFAULT 0,
  
  -- กำไร/ขาดทุน (Profit/Loss)
  gross_profit DECIMAL(20,2) DEFAULT 0,
  net_profit DECIMAL(20,2) DEFAULT 0,
  
  -- ค่าคอมมิชชัน Agent
  agent_commission DECIMAL(20,2) DEFAULT 0,
  agent_count INTEGER DEFAULT 0,
  
  -- สมาชิก (Customers)
  total_customers INTEGER DEFAULT 0,
  new_customers INTEGER DEFAULT 0,
  active_customers INTEGER DEFAULT 0,
  
  -- สถานะ
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'finalized', 'locked')),
  closing_type VARCHAR(20) DEFAULT 'auto' CHECK (closing_type IN ('auto', 'manual')),
  closed_by UUID REFERENCES users(id),
  finalized_by UUID REFERENCES users(id),
  finalized_at TIMESTAMPTZ,
  
  -- ล็อกข้อมูล (ห้ามแก้หลังปิดยอด ยกเว้น Super Admin)
  is_locked BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES users(id),
  
  -- รายการผิดปกติ
  has_anomalies BOOLEAN DEFAULT FALSE,
  anomaly_flags JSONB DEFAULT '[]',
  
  -- หมายเหตุ
  notes TEXT,
  
  -- รายละเอียดเพิ่มเติม (JSON for flexibility)
  details JSONB DEFAULT '{}',
  breakdown JSONB DEFAULT '{}',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_daily_closings_date ON daily_closings(closing_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_closings_status ON daily_closings(status);
CREATE INDEX IF NOT EXISTS idx_daily_closings_locked ON daily_closings(is_locked);
CREATE INDEX IF NOT EXISTS idx_daily_closings_anomalies ON daily_closings(has_anomalies);
CREATE INDEX IF NOT EXISTS idx_daily_closings_month ON daily_closings(DATE_TRUNC('month', closing_date));

-- Create monthly_summaries table for quick monthly lookups
CREATE TABLE IF NOT EXISTS monthly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  
  -- Aggregated totals
  total_deposits DECIMAL(20,2) DEFAULT 0,
  total_withdrawals DECIMAL(20,2) DEFAULT 0,
  total_bets DECIMAL(20,2) DEFAULT 0,
  total_winnings DECIMAL(20,2) DEFAULT 0,
  total_payouts DECIMAL(20,2) DEFAULT 0,
  total_bonuses DECIMAL(20,2) DEFAULT 0,
  total_sales DECIMAL(20,2) DEFAULT 0,
  gross_profit DECIMAL(20,2) DEFAULT 0,
  net_profit DECIMAL(20,2) DEFAULT 0,
  agent_commission DECIMAL(20,2) DEFAULT 0,
  new_customers INTEGER DEFAULT 0,
  
  -- Days data
  days_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(year, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_summaries_year_month ON monthly_summaries(year DESC, month DESC);

-- Create yearly_summaries table
CREATE TABLE IF NOT EXISTS yearly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL UNIQUE,
  
  -- Aggregated totals
  total_deposits DECIMAL(20,2) DEFAULT 0,
  total_withdrawals DECIMAL(20,2) DEFAULT 0,
  total_bets DECIMAL(20,2) DEFAULT 0,
  total_winnings DECIMAL(20,2) DEFAULT 0,
  total_payouts DECIMAL(20,2) DEFAULT 0,
  total_bonuses DECIMAL(20,2) DEFAULT 0,
  total_sales DECIMAL(20,2) DEFAULT 0,
  gross_profit DECIMAL(20,2) DEFAULT 0,
  net_profit DECIMAL(20,2) DEFAULT 0,
  agent_commission DECIMAL(20,2) DEFAULT 0,
  new_customers INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create daily_closing_audit_logs table สำหรับ track การแก้ไข
CREATE TABLE IF NOT EXISTS daily_closing_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_closing_id UUID REFERENCES daily_closings(id) ON DELETE CASCADE,
  closing_date DATE NOT NULL,
  action VARCHAR(50) NOT NULL,
  
  -- ค่าก่อน/หลังแก้ไข
  old_values JSONB,
  new_values JSONB,
  
  -- ผู้แก้ไข
  performed_by UUID REFERENCES users(id),
  performer_role VARCHAR(50),
  performer_name TEXT,
  
  -- เหตุผล (required for edits)
  reason TEXT,
  
  -- Context
  ip_address TEXT,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_closing_audit_date ON daily_closing_audit_logs(closing_date DESC);
CREATE INDEX IF NOT EXISTS idx_closing_audit_action ON daily_closing_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_closing_audit_performer ON daily_closing_audit_logs(performed_by);

-- Create anomaly_alerts table สำหรับเก็บรายการผิดปกติ
CREATE TABLE IF NOT EXISTS daily_closing_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_closing_id UUID REFERENCES daily_closings(id) ON DELETE CASCADE,
  closing_date DATE NOT NULL,
  
  -- ประเภทผิดปกติ
  anomaly_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  
  -- รายละเอียด
  title TEXT NOT NULL,
  description TEXT,
  affected_amount DECIMAL(20,2),
  
  -- Related entities
  related_user_id UUID,
  related_agent_id UUID,
  related_transaction_ids UUID[],
  related_bet_ids UUID[],
  
  -- สถานะ
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'ignored')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomalies_date ON daily_closing_anomalies(closing_date DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_type ON daily_closing_anomalies(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON daily_closing_anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_anomalies_status ON daily_closing_anomalies(status);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_daily_closings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for daily_closings
DROP TRIGGER IF EXISTS daily_closings_updated_at ON daily_closings;
CREATE TRIGGER daily_closings_updated_at
  BEFORE UPDATE ON daily_closings
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_closings_timestamp();

-- Trigger for monthly_summaries
DROP TRIGGER IF EXISTS monthly_summaries_updated_at ON monthly_summaries;
CREATE TRIGGER monthly_summaries_updated_at
  BEFORE UPDATE ON monthly_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_closings_timestamp();

-- Trigger for yearly_summaries
DROP TRIGGER IF EXISTS yearly_summaries_updated_at ON yearly_summaries;
CREATE TRIGGER yearly_summaries_updated_at
  BEFORE UPDATE ON yearly_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_closings_timestamp();

-- Function to prevent editing locked daily_closings (except Super Admin)
CREATE OR REPLACE FUNCTION check_daily_closing_lock()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- ตรวจสอบว่าเป็น locked record หรือไม่
  IF OLD.is_locked = TRUE THEN
    -- ดึง role ของ user ที่กำลังแก้ไข (จาก context หรือ session)
    -- หมายเหตุ: ในการใช้งานจริง ต้องใช้ auth.uid() และ join กับ users table
    SELECT role INTO user_role FROM users WHERE id = auth.uid();
    
    -- ถ้าไม่ใช่ super_admin ห้ามแก้ไข
    IF user_role IS NULL OR user_role != 'super_admin' THEN
      RAISE EXCEPTION 'Cannot modify locked daily closing. Only Super Admin can edit locked records.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check lock before update
DROP TRIGGER IF EXISTS check_daily_closing_lock_trigger ON daily_closings;
CREATE TRIGGER check_daily_closing_lock_trigger
  BEFORE UPDATE ON daily_closings
  FOR EACH ROW
  EXECUTE FUNCTION check_daily_closing_lock();

-- Enable RLS
ALTER TABLE daily_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE yearly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_closing_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_closing_anomalies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_closings
CREATE POLICY "Admin can view daily_closings" ON daily_closings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'admin', 'manager')
    )
  );

CREATE POLICY "Admin can insert daily_closings" ON daily_closings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'admin', 'manager')
    )
  );

CREATE POLICY "Super Admin can update daily_closings" ON daily_closings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'super_admin'
    )
  );

-- Admin can update only unlocked records
CREATE POLICY "Admin can update unlocked daily_closings" ON daily_closings
  FOR UPDATE USING (
    is_locked = FALSE AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'manager')
    )
  );

-- RLS for audit_logs (view only for admin, insert for system)
CREATE POLICY "Admin can view audit_logs" ON daily_closing_audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'admin', 'manager')
    )
  );

CREATE POLICY "System can insert audit_logs" ON daily_closing_audit_logs
  FOR INSERT WITH CHECK (TRUE);

-- RLS for anomalies
CREATE POLICY "Admin can view anomalies" ON daily_closing_anomalies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'admin', 'manager')
    )
  );

CREATE POLICY "Admin can manage anomalies" ON daily_closing_anomalies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'admin')
    )
  );

-- Similar policies for monthly and yearly summaries
CREATE POLICY "Admin can view monthly_summaries" ON monthly_summaries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'admin', 'manager')
    )
  );

CREATE POLICY "Admin can manage monthly_summaries" ON monthly_summaries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admin can view yearly_summaries" ON yearly_summaries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'admin', 'manager')
    )
  );

CREATE POLICY "Admin can manage yearly_summaries" ON yearly_summaries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('super_admin', 'admin')
    )
  );

-- Comments
COMMENT ON TABLE daily_closings IS 'เก็บ snapshot สรุปรายวัน - ไม่ลบข้อมูลเก่า ใช้สำหรับดูย้อนหลังได้ ล็อกข้อมูลหลังปิดยอด';
COMMENT ON TABLE monthly_summaries IS 'สรุปรายเดือนสำหรับ quick lookup';
COMMENT ON TABLE yearly_summaries IS 'สรุปรายปีสำหรับ quick lookup';
COMMENT ON TABLE daily_closing_audit_logs IS 'บันทึกทุกการแก้ไข daily closing สำหรับ audit trail';
COMMENT ON TABLE daily_closing_anomalies IS 'เก็บรายการผิดปกติที่ตรวจพบ';
COMMENT ON COLUMN daily_closings.is_locked IS 'ล็อกข้อมูล ห้ามแก้ย้อนหลัง ยกเว้น Super Admin';
