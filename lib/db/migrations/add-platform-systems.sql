-- =====================================================
-- Platform Level Systems Migration
-- ระบบ 41-70: Sharding, Queue, Geo, Session, Chat, etc.
-- Production Ready - FIN LOTTO R+
-- =====================================================

-- =====================================================
-- 42. Transaction Queue System
-- =====================================================
CREATE TABLE IF NOT EXISTS transaction_queue (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdraw', 'bet', 'payout', 'commission', 'bonus', 'transfer', 'refund', 'adjustment')),
  user_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_transaction_queue_user_status ON transaction_queue(user_id, status);
CREATE INDEX idx_transaction_queue_status_priority ON transaction_queue(status, priority, created_at);

-- Archive table for old transactions
CREATE TABLE IF NOT EXISTS transaction_queue_archive (
  LIKE transaction_queue INCLUDING ALL
);

-- =====================================================
-- 54. Geo Tracking System
-- =====================================================
CREATE TABLE IF NOT EXISTS geo_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('country', 'region', 'city', 'ip_range', 'isp')),
  value TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('block', 'allow', 'flag', 'require_verification')),
  reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_geo_rules_active ON geo_rules(is_active, type);

CREATE TABLE IF NOT EXISTS geo_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES customers(id),
  ip_address TEXT NOT NULL,
  country TEXT,
  country_code TEXT,
  region TEXT,
  city TEXT,
  latitude DECIMAL(10,6),
  longitude DECIMAL(10,6),
  isp TEXT,
  is_proxy BOOLEAN DEFAULT false,
  is_vpn BOOLEAN DEFAULT false,
  risk_score INTEGER DEFAULT 0,
  action TEXT NOT NULL,
  blocked BOOLEAN NOT NULL DEFAULT false,
  block_reason TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_geo_access_logs_user ON geo_access_logs(user_id, created_at DESC);
CREATE INDEX idx_geo_access_logs_ip ON geo_access_logs(ip_address, created_at DESC);
CREATE INDEX idx_geo_access_logs_blocked ON geo_access_logs(blocked, created_at DESC) WHERE blocked = true;

-- =====================================================
-- 56. Session Manager System
-- =====================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown')),
  browser TEXT,
  os TEXT,
  ip_address TEXT,
  country TEXT,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_trusted BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id, is_active);
CREATE INDEX idx_user_sessions_device ON user_sessions(device_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS session_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_activity_logs_session ON session_activity_logs(session_id, created_at DESC);

-- =====================================================
-- 61. AI Chat Support System
-- =====================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'handed_off')),
  intent TEXT,
  assigned_to UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_sessions_customer ON chat_sessions(customer_id, created_at DESC);
CREATE INDEX idx_chat_sessions_status ON chat_sessions(status, updated_at DESC);
CREATE INDEX idx_chat_sessions_assigned ON chat_sessions(assigned_to, status);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  intent TEXT,
  confidence INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at ASC);

-- =====================================================
-- 62. Ticket Support System
-- =====================================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  ticket_number TEXT UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  category TEXT NOT NULL CHECK (category IN ('deposit', 'withdraw', 'bet', 'result', 'account', 'promotion', 'technical', 'complaint', 'suggestion', 'other')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'pending_customer', 'resolved', 'closed')),
  assigned_to UUID REFERENCES admin_users(id),
  assigned_to_name TEXT,
  attachments TEXT[],
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT
);

CREATE INDEX idx_support_tickets_customer ON support_tickets(customer_id, created_at DESC);
CREATE INDEX idx_support_tickets_status ON support_tickets(status, priority, created_at DESC);
CREATE INDEX idx_support_tickets_assigned ON support_tickets(assigned_to, status);
CREATE INDEX idx_support_tickets_number ON support_tickets(ticket_number);

CREATE TABLE IF NOT EXISTS ticket_replies (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL CHECK (user_role IN ('customer', 'admin', 'system')),
  content TEXT NOT NULL,
  attachments TEXT[],
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ticket_replies_ticket ON ticket_replies(ticket_id, created_at ASC);

-- =====================================================
-- 69-70. Error Tracking & Centralized Logging
-- =====================================================
CREATE TABLE IF NOT EXISTS system_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
  service TEXT NOT NULL,
  action TEXT NOT NULL,
  message TEXT NOT NULL,
  user_id UUID,
  session_id TEXT,
  request_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  error_name TEXT,
  error_message TEXT,
  error_stack TEXT,
  duration_ms INTEGER,
  tags TEXT[]
);

-- Partitioning by time for better performance
CREATE INDEX idx_system_logs_timestamp ON system_logs(timestamp DESC);
CREATE INDEX idx_system_logs_level ON system_logs(level, timestamp DESC);
CREATE INDEX idx_system_logs_service ON system_logs(service, timestamp DESC);
CREATE INDEX idx_system_logs_user ON system_logs(user_id, timestamp DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_system_logs_request ON system_logs(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX idx_system_logs_error ON system_logs(level, service, action) WHERE level IN ('error', 'fatal');

CREATE TABLE IF NOT EXISTS error_reports (
  id TEXT PRIMARY KEY,
  error_hash TEXT UNIQUE NOT NULL,
  first_seen TIMESTAMPTZ NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  level TEXT NOT NULL,
  service TEXT NOT NULL,
  action TEXT NOT NULL,
  message TEXT NOT NULL,
  error_name TEXT NOT NULL,
  error_stack TEXT,
  affected_users TEXT[],
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'resolved', 'ignored')),
  assigned_to UUID REFERENCES admin_users(id),
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_error_reports_hash ON error_reports(error_hash);
CREATE INDEX idx_error_reports_status ON error_reports(status, last_seen DESC);
CREATE INDEX idx_error_reports_service ON error_reports(service, status);

-- =====================================================
-- Row Level Security Policies
-- =====================================================

-- Transaction Queue RLS
ALTER TABLE transaction_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON transaction_queue
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can manage all transactions" ON transaction_queue
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'system')
    )
  );

-- Geo Rules RLS
ALTER TABLE geo_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage geo rules" ON geo_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- User Sessions RLS
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON user_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can revoke own sessions" ON user_sessions
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all sessions" ON user_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- Chat Sessions RLS
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chats" ON chat_sessions
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Users can create chats" ON chat_sessions
  FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Admins can manage all chats" ON chat_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
  );

-- Support Tickets RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets" ON support_tickets
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Users can create tickets" ON support_tickets
  FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Users can update own tickets" ON support_tickets
  FOR UPDATE USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Admins can manage all tickets" ON support_tickets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid()
    )
  );

-- System Logs RLS (Admin only)
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view logs" ON system_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- Error Reports RLS (Admin only)
ALTER TABLE error_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage error reports" ON error_reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

-- =====================================================
-- Functions for Auto Cleanup
-- =====================================================

-- Function to clean old logs (run via cron)
CREATE OR REPLACE FUNCTION clean_old_system_logs(keep_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM system_logs
  WHERE timestamp < NOW() - (keep_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired sessions
CREATE OR REPLACE FUNCTION clean_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  UPDATE user_sessions
  SET is_active = false, revoked_reason = 'expired'
  WHERE is_active = true AND expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_support_tickets_dashboard 
  ON support_tickets(status, priority, created_at DESC)
  WHERE status IN ('open', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_chat_sessions_active 
  ON chat_sessions(status, updated_at DESC)
  WHERE status IN ('active', 'handed_off');

CREATE INDEX IF NOT EXISTS idx_error_reports_active 
  ON error_reports(status, count DESC, last_seen DESC)
  WHERE status IN ('new', 'acknowledged');

-- Full text search indexes (optional, requires pg_trgm extension)
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX idx_system_logs_message_trgm ON system_logs USING gin(message gin_trgm_ops);
-- CREATE INDEX idx_support_tickets_subject_trgm ON support_tickets USING gin(subject gin_trgm_ops);
