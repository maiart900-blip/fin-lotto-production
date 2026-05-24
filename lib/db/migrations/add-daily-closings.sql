-- Migration: Add daily_closings table for Daily Closing / สรุปรายวันอัตโนมัติ
-- Date: 2024
-- Description: เก็บ snapshot รายวัน ไม่ลบข้อมูลเก่า

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
  
  -- ยอดจ่ายรางวัล (Payouts)
  total_payouts DECIMAL(20,2) DEFAULT 0,
  payout_count INTEGER DEFAULT 0,
  
  -- ยอดขาย (Sales)
  total_sales DECIMAL(20,2) DEFAULT 0,
  
  -- ยอดค้างชำระ (Pending Balance)
  pending_balance DECIMAL(20,2) DEFAULT 0,
  
  -- กำไร/ขาดทุน (Profit/Loss)
  gross_profit DECIMAL(20,2) DEFAULT 0,
  net_profit DECIMAL(20,2) DEFAULT 0,
  
  -- ค่าคอมมิชชัน Agent
  agent_commission DECIMAL(20,2) DEFAULT 0,
  
  -- สมาชิก (Customers)
  total_customers INTEGER DEFAULT 0,
  new_customers INTEGER DEFAULT 0,
  active_customers INTEGER DEFAULT 0,
  
  -- สถานะ
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'finalized')),
  closed_by UUID REFERENCES users(id),
  notes TEXT,
  
  -- รายละเอียดเพิ่มเติม (JSON for flexibility)
  details JSONB DEFAULT '{}',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_daily_closings_date ON daily_closings(closing_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_closings_status ON daily_closings(status);
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
  total_payouts DECIMAL(20,2) DEFAULT 0,
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
  total_payouts DECIMAL(20,2) DEFAULT 0,
  total_sales DECIMAL(20,2) DEFAULT 0,
  gross_profit DECIMAL(20,2) DEFAULT 0,
  net_profit DECIMAL(20,2) DEFAULT 0,
  agent_commission DECIMAL(20,2) DEFAULT 0,
  new_customers INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- Enable RLS
ALTER TABLE daily_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE yearly_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Admin only)
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

CREATE POLICY "Admin can update daily_closings" ON daily_closings
  FOR UPDATE USING (
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

-- Comment
COMMENT ON TABLE daily_closings IS 'เก็บ snapshot สรุปรายวัน - ไม่ลบข้อมูลเก่า ใช้สำหรับดูย้อนหลังได้';
COMMENT ON TABLE monthly_summaries IS 'สรุปรายเดือนสำหรับ quick lookup';
COMMENT ON TABLE yearly_summaries IS 'สรุปรายปีสำหรับ quick lookup';
