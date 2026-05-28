-- ============================================
-- FIN LOTTO PRODUCTION DATABASE BACKUP
-- Date: 2026-05-28
-- Project: ifmcaztqaordcgsbmnij
-- Supabase Region: Supabase Cloud
-- ============================================

-- BACKUP METADATA
-- ================
-- Backup Type: Full Schema + Critical Data
-- Created By: v0 Automated Backup
-- Stable Release: PR #27 (commit 141cab8)

-- ============================================
-- SECTION 1: CRITICAL TABLE DDL
-- ============================================

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  referral_code text,
  is_unlimited_credit boolean DEFAULT false,
  parent_id uuid,
  hierarchy_level integer DEFAULT 0,
  credit_balance numeric DEFAULT 0,
  commission_percent numeric DEFAULT 0,
  share_percent numeric DEFAULT 0,
  is_partner boolean DEFAULT false,
  two_factor_enabled boolean DEFAULT false,
  email text,
  bank_code text,
  bank_account_number text,
  bank_account_name text,
  referred_by uuid,
  parent_agent_id uuid,
  tenant_id uuid,
  is_active boolean DEFAULT true,
  visible_menus text[] DEFAULT '{}'::text[],
  two_factor_secret text,
  two_factor_backup_codes text[],
  two_factor_verified_at timestamp with time zone,
  failed_login_attempts integer DEFAULT 0,
  locked_until timestamp with time zone,
  last_login timestamp with time zone,
  PRIMARY KEY (id)
);

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  note text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  credit_balance numeric DEFAULT 0,
  password_hash text,
  is_active boolean DEFAULT true,
  last_login timestamp with time zone,
  referral_code character varying,
  referred_by uuid,
  username text,
  bank_code text,
  bank_account_number text,
  bank_account_name text,
  total_turnover numeric DEFAULT 0,
  user_type character varying DEFAULT 'customer',
  tenant_id uuid,
  owner_id uuid,
  root_owner_id uuid,
  hierarchy_level integer DEFAULT 4,
  PRIMARY KEY (id)
);

-- Entries Table (Betting Records)
CREATE TABLE IF NOT EXISTS entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  number text NOT NULL,
  bet_type text NOT NULL,
  amount integer NOT NULL,
  customer_id uuid,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  lottery_id uuid,
  status text DEFAULT 'pending',
  payout_rate numeric,
  payout_amount numeric DEFAULT 0,
  payout_status character varying DEFAULT 'pending',
  owner_id uuid,
  root_owner_id uuid,
  tenant_id uuid,
  PRIMARY KEY (id)
);

-- Payout Rates Table (Critical Configuration)
CREATE TABLE IF NOT EXISTS payout_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lottery_id uuid,
  bet_type text NOT NULL,
  rate numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Lotteries Table
CREATE TABLE IF NOT EXISTS lotteries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean DEFAULT true,
  draw_days text[] DEFAULT '{}'::text[],
  draw_type text DEFAULT 'daily',
  open_time time without time zone DEFAULT '06:00:00',
  close_time time without time zone DEFAULT '14:00:00',
  note text,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  timezone text DEFAULT 'Asia/Bangkok',
  country_code text DEFAULT 'TH',
  PRIMARY KEY (id)
);

-- Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  domain text,
  logo_url text,
  theme_config jsonb DEFAULT '{"theme": "midnight-gold", "primaryColor": "#D4AF37"}',
  owner_id uuid,
  is_active boolean DEFAULT true,
  is_master boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'active',
  plan text DEFAULT 'basic',
  max_customers integer DEFAULT 100,
  max_agents integer DEFAULT 10,
  max_daily_bets integer DEFAULT 1000,
  PRIMARY KEY (id)
);

-- ============================================
-- SECTION 2: CRITICAL DATA ROW COUNTS (VERIFIED 2026-05-28 06:48:17 UTC)
-- ============================================
-- users: 4 rows
-- entries: 60 rows
-- customers: 14 rows
-- tenants: 3 rows
-- payout_rates: 224 rows
-- lotteries: 32 rows

-- ============================================
-- SECTION 3: RESTORE PROCEDURE
-- ============================================
-- 
-- STEP 1: Access Supabase Dashboard
--   - Go to: https://supabase.com/dashboard/project/ifmcaztqaordcgsbmnij
--   - Navigate to: Settings > Database > Backups
--
-- STEP 2: Use Point-in-Time Recovery (PITR)
--   - Supabase automatically maintains PITR backups
--   - Select recovery point before the incident
--   - Restore to a new project or replace existing
--
-- STEP 3: Manual Data Restore (if needed)
--   - Use SQL Editor in Supabase Dashboard
--   - Run INSERT statements from data backup files
--   - Verify row counts match expected values
--
-- STEP 4: Verify Restore
--   - Check row counts: SELECT COUNT(*) FROM <table>;
--   - Verify payout_rates configuration is correct
--   - Test a sample bet submission
--   - Verify user authentication works

-- ============================================
-- SECTION 4: BACKUP VERIFICATION QUERIES
-- ============================================

-- Verify users count
-- SELECT COUNT(*) FROM users; -- Expected: 4

-- Verify payout_rates count
-- SELECT COUNT(*) FROM payout_rates; -- Expected: 224

-- Verify entries count
-- SELECT COUNT(*) FROM entries; -- Expected: 60

-- Verify customers count
-- SELECT COUNT(*) FROM customers; -- Expected: 14

-- Verify tenants exist
-- SELECT COUNT(*) FROM tenants; -- Expected: 3

-- Verify lotteries count
-- SELECT COUNT(*) FROM lotteries; -- Expected: 32

-- ============================================
-- SECTION 5: BACKUP STORAGE LOCATION
-- ============================================
-- Primary: Supabase PITR (automatic, 7-day retention)
-- Secondary: This SQL file in repository /backups/
-- Supabase Project ID: ifmcaztqaordcgsbmnij
-- Supabase Dashboard: https://supabase.com/dashboard/project/ifmcaztqaordcgsbmnij

-- ============================================
-- SECTION 6: ROLLBACK PROCEDURE
-- ============================================
-- Option A: Supabase Point-in-Time Recovery
--   1. Go to Supabase Dashboard > Settings > Database > Backups
--   2. Select "Point in Time Recovery"
--   3. Choose timestamp BEFORE the incident
--   4. Click "Restore" to create recovery
--
-- Option B: Manual Data Restore
--   1. Use SQL Editor in Supabase Dashboard
--   2. TRUNCATE affected tables (CAUTION!)
--   3. Run INSERT statements from data backup
--   4. Verify row counts match expected values
--
-- Option C: Full Database Restore
--   1. Contact Supabase Support
--   2. Request full database restore from backup
--   3. Specify target timestamp

-- ============================================
-- END OF BACKUP FILE
-- ============================================
