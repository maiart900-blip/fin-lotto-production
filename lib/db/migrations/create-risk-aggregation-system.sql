-- ============================================================
-- RISK AGGREGATION SYSTEM MIGRATION
-- ============================================================
-- Purpose: Central risk aggregation for FIN LOTTO platform
-- 
-- This creates:
-- 1. site_api_keys - Authentication for child auto sites
-- 2. risk_aggregations - Central risk exposure data
-- 3. risk_settings - Per-site configurable risk thresholds
-- ============================================================

-- ============================================================
-- 1. SITE API KEYS TABLE
-- For authenticating child auto site API calls
-- ============================================================
CREATE TABLE IF NOT EXISTS site_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Site identification
  site_id TEXT NOT NULL UNIQUE,
  site_name TEXT NOT NULL,
  site_type TEXT NOT NULL CHECK (site_type IN ('child_auto', 'external_partner')),
  
  -- API key (hashed)
  api_key_hash TEXT NOT NULL,
  api_key_prefix TEXT NOT NULL, -- First 8 chars for identification
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Rate limiting
  rate_limit_per_minute INTEGER DEFAULT 60,
  
  -- Metadata
  contact_email TEXT,
  webhook_url TEXT, -- For sending notifications back to child site
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  
  -- Audit
  created_by UUID,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID,
  revoke_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_site_api_keys_site_id ON site_api_keys(site_id);
CREATE INDEX IF NOT EXISTS idx_site_api_keys_prefix ON site_api_keys(api_key_prefix);
CREATE INDEX IF NOT EXISTS idx_site_api_keys_active ON site_api_keys(is_active) WHERE is_active = true;

-- ============================================================
-- 2. RISK AGGREGATIONS TABLE
-- Central storage for aggregated risk data from all sources
-- ============================================================
CREATE TABLE IF NOT EXISTS risk_aggregations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source identification
  source_type TEXT NOT NULL CHECK (source_type IN ('main_auto', 'child_auto', 'keyin')),
  source_site_id TEXT NOT NULL,
  source_site_name TEXT,
  
  -- Lottery context
  lottery_type TEXT NOT NULL,         -- "หวยรัฐบาล", "หวยลาว", etc.
  lottery_id UUID,                    -- Reference to lotteries table (optional)
  draw_round TEXT,                    -- "01/02/2567" or round identifier
  draw_date DATE NOT NULL,
  
  -- Number exposure
  lottery_number TEXT NOT NULL,       -- "123", "45", "7"
  bet_type TEXT NOT NULL,             -- "3ตัวบน", "2ตัวล่าง", "วิ่งบน", etc.
  
  -- Financial data
  total_bet_amount DECIMAL(15,2) DEFAULT 0,
  payout_liability DECIMAL(15,2) DEFAULT 0,
  payout_rate DECIMAL(10,2),          -- e.g., 900 for 3ตัวบน
  estimated_profit_if_loses DECIMAL(15,2) GENERATED ALWAYS AS (total_bet_amount) STORED,
  estimated_loss_if_wins DECIMAL(15,2) GENERATED ALWAYS AS (payout_liability - total_bet_amount) STORED,
  bet_count INTEGER DEFAULT 0,
  unique_customers INTEGER DEFAULT 0,
  
  -- Risk level (computed based on settings)
  risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  
  -- Timestamps
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  aggregated_at TIMESTAMPTZ DEFAULT NOW(),
  received_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Deduplication
  UNIQUE(source_type, source_site_id, lottery_type, draw_date, lottery_number, bet_type)
);

-- Performance indexes for risk dashboard queries
CREATE INDEX IF NOT EXISTS idx_risk_agg_draw_date ON risk_aggregations(draw_date);
CREATE INDEX IF NOT EXISTS idx_risk_agg_lottery_date ON risk_aggregations(lottery_type, draw_date);
CREATE INDEX IF NOT EXISTS idx_risk_agg_number ON risk_aggregations(lottery_number);
CREATE INDEX IF NOT EXISTS idx_risk_agg_bet_type ON risk_aggregations(bet_type);
CREATE INDEX IF NOT EXISTS idx_risk_agg_source ON risk_aggregations(source_type, source_site_id);
CREATE INDEX IF NOT EXISTS idx_risk_agg_exposure ON risk_aggregations(payout_liability DESC);
CREATE INDEX IF NOT EXISTS idx_risk_agg_risk_level ON risk_aggregations(risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_agg_aggregated ON risk_aggregations(aggregated_at DESC);

-- Composite index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_risk_agg_dashboard 
  ON risk_aggregations(draw_date, lottery_type, lottery_number, bet_type);

-- ============================================================
-- 3. RISK SETTINGS TABLE
-- Per-site configurable risk thresholds
-- ============================================================
CREATE TABLE IF NOT EXISTS risk_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Scope (NULL = global default)
  site_id TEXT,                       -- NULL for global, or specific site_id
  lottery_type TEXT,                  -- NULL for all lotteries, or specific type
  bet_type TEXT,                      -- NULL for all bet types, or specific type
  
  -- Risk thresholds (in THB)
  low_threshold DECIMAL(15,2) DEFAULT 0,
  medium_threshold DECIMAL(15,2) DEFAULT 50000,
  high_threshold DECIMAL(15,2) DEFAULT 200000,
  critical_threshold DECIMAL(15,2) DEFAULT 500000,
  
  -- Alerts
  alert_on_medium BOOLEAN DEFAULT false,
  alert_on_high BOOLEAN DEFAULT true,
  alert_on_critical BOOLEAN DEFAULT true,
  alert_webhook_url TEXT,
  alert_email TEXT,
  
  -- Auto-actions
  auto_pause_on_critical BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint for settings scope
  UNIQUE(COALESCE(site_id, '__global__'), COALESCE(lottery_type, '__all__'), COALESCE(bet_type, '__all__'))
);

CREATE INDEX IF NOT EXISTS idx_risk_settings_site ON risk_settings(site_id);
CREATE INDEX IF NOT EXISTS idx_risk_settings_lottery ON risk_settings(lottery_type);

-- ============================================================
-- 4. RISK AGGREGATION HISTORY TABLE
-- For audit and historical analysis
-- ============================================================
CREATE TABLE IF NOT EXISTS risk_aggregation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Snapshot metadata
  snapshot_date DATE NOT NULL,
  snapshot_time TIMESTAMPTZ DEFAULT NOW(),
  lottery_type TEXT NOT NULL,
  draw_date DATE NOT NULL,
  
  -- Aggregated totals
  total_bet_amount DECIMAL(15,2),
  total_payout_liability DECIMAL(15,2),
  total_bet_count INTEGER,
  total_unique_numbers INTEGER,
  
  -- Risk summary
  critical_count INTEGER DEFAULT 0,
  high_count INTEGER DEFAULT 0,
  medium_count INTEGER DEFAULT 0,
  
  -- Top exposure (JSON for flexibility)
  top_exposures JSONB, -- [{ number, bet_type, liability, sources }]
  
  -- Source breakdown
  source_breakdown JSONB, -- { main_auto: 1000, child_auto: 5000, keyin: 2000 }
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_history_date ON risk_aggregation_history(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_risk_history_lottery ON risk_aggregation_history(lottery_type, draw_date);

-- ============================================================
-- 5. INSERT GLOBAL DEFAULT RISK SETTINGS
-- ============================================================
INSERT INTO risk_settings (
  site_id, lottery_type, bet_type,
  low_threshold, medium_threshold, high_threshold, critical_threshold,
  alert_on_medium, alert_on_high, alert_on_critical
) VALUES (
  NULL, NULL, NULL,
  0, 50000, 200000, 500000,
  false, true, true
) ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. HELPER FUNCTIONS
-- ============================================================

-- Function to calculate risk level based on settings
CREATE OR REPLACE FUNCTION calculate_risk_level(
  p_payout_liability DECIMAL,
  p_site_id TEXT DEFAULT NULL,
  p_lottery_type TEXT DEFAULT NULL,
  p_bet_type TEXT DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
  v_settings RECORD;
BEGIN
  -- Find most specific settings (site > lottery > bet_type > global)
  SELECT * INTO v_settings
  FROM risk_settings
  WHERE (site_id = p_site_id OR site_id IS NULL)
    AND (lottery_type = p_lottery_type OR lottery_type IS NULL)
    AND (bet_type = p_bet_type OR bet_type IS NULL)
  ORDER BY 
    CASE WHEN site_id IS NOT NULL THEN 1 ELSE 2 END,
    CASE WHEN lottery_type IS NOT NULL THEN 1 ELSE 2 END,
    CASE WHEN bet_type IS NOT NULL THEN 1 ELSE 2 END
  LIMIT 1;
  
  IF v_settings IS NULL THEN
    -- Fallback to hardcoded defaults
    IF p_payout_liability >= 500000 THEN RETURN 'critical';
    ELSIF p_payout_liability >= 200000 THEN RETURN 'high';
    ELSIF p_payout_liability >= 50000 THEN RETURN 'medium';
    ELSE RETURN 'low';
    END IF;
  END IF;
  
  IF p_payout_liability >= v_settings.critical_threshold THEN RETURN 'critical';
  ELSIF p_payout_liability >= v_settings.high_threshold THEN RETURN 'high';
  ELSIF p_payout_liability >= v_settings.medium_threshold THEN RETURN 'medium';
  ELSE RETURN 'low';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update risk_level on insert/update
CREATE OR REPLACE FUNCTION update_risk_level_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.risk_level := calculate_risk_level(
    NEW.payout_liability,
    NEW.source_site_id,
    NEW.lottery_type,
    NEW.bet_type
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_risk_aggregations_level ON risk_aggregations;
CREATE TRIGGER trg_risk_aggregations_level
  BEFORE INSERT OR UPDATE OF payout_liability ON risk_aggregations
  FOR EACH ROW
  EXECUTE FUNCTION update_risk_level_trigger();

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
--   AND table_name IN ('site_api_keys', 'risk_aggregations', 'risk_settings', 'risk_aggregation_history');
