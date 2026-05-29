-- LINE Multi-Tenant Configuration Migration
-- Adds LINE notification columns to tenants table for Sub-Web configuration

-- Add LINE configuration columns to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS line_channel_token TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS line_group_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS line_notification_enabled BOOLEAN DEFAULT true;

-- Add comments for documentation
COMMENT ON COLUMN tenants.line_channel_token IS 'Tenant-specific LINE Channel Access Token for notifications';
COMMENT ON COLUMN tenants.line_group_id IS 'Tenant-specific LINE Group ID for receiving notifications';
COMMENT ON COLUMN tenants.line_notification_enabled IS 'Toggle to enable/disable LINE notifications for this tenant';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tenants_line_enabled ON tenants(line_notification_enabled) WHERE line_notification_enabled = true;

-- Create notification_logs table if not exists (for audit trail)
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  notification_type VARCHAR(50) NOT NULL,
  channel VARCHAR(20) DEFAULT 'line',
  recipient JSONB,
  payload JSONB,
  results JSONB,
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying notification logs
CREATE INDEX IF NOT EXISTS idx_notification_logs_tenant ON notification_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(notification_type, created_at DESC);

-- Create mother_web_alerts table for audit trail
CREATE TABLE IF NOT EXISTS mother_web_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  affected_tenants TEXT[],
  sent_to_line BOOLEAN DEFAULT false,
  line_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID
);

-- Index for querying mother web alerts
CREATE INDEX IF NOT EXISTS idx_mother_web_alerts_type ON mother_web_alerts(alert_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mother_web_alerts_severity ON mother_web_alerts(severity, created_at DESC);
