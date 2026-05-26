-- Migration: Create backup table for visible_menus cleanup
-- Run this BEFORE running the cleanup script

-- Create backup table if not exists
CREATE TABLE IF NOT EXISTS visible_menus_backup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  original_value JSONB,
  fixed_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_visible_menus_backup_record 
ON visible_menus_backup(table_name, record_id);

-- Create migration reports table if not exists
CREATE TABLE IF NOT EXISTS migration_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_name TEXT NOT NULL,
  report JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grant permissions (adjust as needed)
-- ALTER TABLE visible_menus_backup ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE migration_reports ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE visible_menus_backup IS 'Backup table for visible_menus cleanup migration';
COMMENT ON TABLE migration_reports IS 'Stores migration execution reports';
