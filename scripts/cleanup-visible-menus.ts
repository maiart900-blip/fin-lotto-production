/**
 * Database Cleanup Migration: Fix corrupted visible_menus data
 * 
 * This script:
 * 1. Scans all agents with invalid visible_menus
 * 2. Converts character arrays like ["d","a","s","h"] into valid menu arrays
 * 3. Converts JSON string values into arrays
 * 4. Removes duplicate and invalid menu IDs
 * 5. Backs up original values before migration
 * 
 * Run with: npx tsx scripts/cleanup-visible-menus.ts
 * Or: node --env-file-if-exists=/vercel/share/.env.project scripts/cleanup-visible-menus.ts
 */

import { createClient } from '@supabase/supabase-js';

// Valid menu IDs from menu-config.ts
const VALID_MENU_IDS = new Set([
  // Standalone
  'dashboard', 'attendance',
  
  // Operation section
  'operation', 'topup-requests', 'withdraw-requests', 'prize-payout', 'credits', 'deposit-issues', 'pending-review',
  
  // Member Admin
  'member-admin', 'member-summary', 'member-finance', 'member-slip-upload',
  
  // Members
  'members', 'customers', 'customer-history', 'customer-banks', 'member-summary-page',
  
  // Finance
  'finance', 'payment-gateway', 'wallet-manager', 'bank-settings', 'payment-accounts', 
  'withdraw-accounts', 'scb-maemanee', 'transactions', 'finance-reports',
  
  // Lottery
  'lottery', 'admin-key', 'entries', 'lotteries', 'results',
  
  // Auto System
  'auto-system', 'auto-entries', 'auto-customers', 'auto-settings',
  
  // Manual Key
  'manual-key', 'manual-key-entry', 'manual-key-entries', 'manual-key-customers', 'manual-key-rates',
  
  // Agent System
  'agent-system', 'agent-system-members', 'agent-system-commission', 'agent-system-bank', 
  'agent-system-site', 'agent-system-settlement', 'agent-system-report',
  
  // Promotions
  'promotions', 'referrals', 'affiliate', 'promo-agent-system',
  
  // Marketing Center
  'marketing-center', 'lead-users', 'marketing-links', 'marketing-agent', 'marketing-member', 
  'marketing-partner', 'qr-generator', 'member-links',
  
  // Reports
  'reports', 'omni-channel', 'analysis', 'profit-loss',
  
  // Staff Management
  'staff-management', 'admin-attendance-report', 'admin-performance', 'payroll', 
  'payroll-settings', 'ot-report', 'admin-sales-report',
  
  // Web Settings
  'web-settings', 'web-theme', 'manage-images', 'desktop-settings', 'settings',
  
  // Live Stream
  'live-stream', 'live-draw', 'result-announcement',
  
  // Multi-Tenant
  'multi-tenant', 'mt-dashboard', 'mt-settlements', 'enterprise-summary', 'sub-sites',
  'vip-dashboard', 'billion-dashboard', 'tenant-manager', 'site-manager', 'site-branding',
  'master-rates', 'financial-hub', 'risk-control', 'api-docs',
  
  // Super Admin
  'super-admin', 'super-downline', 'agent-visibility', 'member-visibility', 
  'risk-management', 'master-control', 'system-settings',
  
  // Security
  'security', 'users', 'roles-permissions', 'security-attendance', 'security-payroll',
  'security-dashboard', '2fa', 'audit-logs', 'backup', 'health-check',
  
  // Agent Menus
  'agent-finance', 'agent-slip-upload', 'agent-summary',
  'agent-downline', 'agent-members', 'agent-commission', 'agent-profit-loss', 'agent-withdraw-history',
  'agent-betting', 'agent-entries', 'agent-results',
]);

interface CleanupRecord {
  id: string;
  code: string;
  original_value: unknown;
  fixed_value: string[];
  status: 'fixed' | 'skipped' | 'already_valid';
  reason?: string;
}

interface CleanupReport {
  timestamp: string;
  records_scanned: number;
  records_fixed: number;
  records_skipped: number;
  records_already_valid: number;
  details: CleanupRecord[];
}

/**
 * Parse and fix visible_menus data
 */
function parseAndFixVisibleMenus(menus: unknown): { fixed: string[]; wasCorrupted: boolean } {
  if (!menus) {
    return { fixed: [], wasCorrupted: false };
  }
  
  // Case 1: JSON string
  if (typeof menus === 'string') {
    try {
      const parsed = JSON.parse(menus);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter(m => typeof m === 'string' && VALID_MENU_IDS.has(m));
        const unique = [...new Set(filtered)];
        return { fixed: unique, wasCorrupted: true };
      }
    } catch {
      // Invalid JSON string
      return { fixed: [], wasCorrupted: true };
    }
  }
  
  // Case 2: Array
  if (Array.isArray(menus)) {
    // Check for single-character corruption (JSON fragments)
    const hasSingleChars = menus.some(m => typeof m === 'string' && m.length === 1);
    
    if (hasSingleChars) {
      // Filter out single chars and validate remaining
      const filtered = menus.filter(m => typeof m === 'string' && m.length > 1 && VALID_MENU_IDS.has(m));
      const unique = [...new Set(filtered)];
      return { fixed: unique, wasCorrupted: true };
    }
    
    // Normal array - validate and dedupe
    const filtered = menus.filter(m => typeof m === 'string' && VALID_MENU_IDS.has(m));
    const unique = [...new Set(filtered)];
    const wasChanged = unique.length !== menus.length || menus.some(m => !VALID_MENU_IDS.has(m));
    
    return { fixed: unique, wasCorrupted: wasChanged };
  }
  
  return { fixed: [], wasCorrupted: true };
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const report: CleanupReport = {
    timestamp: new Date().toISOString(),
    records_scanned: 0,
    records_fixed: 0,
    records_skipped: 0,
    records_already_valid: 0,
    details: [],
  };
  
  console.log('='.repeat(60));
  console.log('Visible Menus Cleanup Migration');
  console.log('='.repeat(60));
  console.log(`Started at: ${report.timestamp}`);
  console.log('');
  
  // =====================================================
  // Step 1: Scan and fix agents table
  // =====================================================
  console.log('Scanning agents table...');
  
  const { data: agents, error: agentError } = await supabase
    .from('agents')
    .select('id, code, name, visible_menus');
  
  if (agentError) {
    console.error('Error fetching agents:', agentError.message);
    process.exit(1);
  }
  
  report.records_scanned += agents?.length || 0;
  console.log(`Found ${agents?.length || 0} agents`);
  
  for (const agent of agents || []) {
    const { fixed, wasCorrupted } = parseAndFixVisibleMenus(agent.visible_menus);
    
    const record: CleanupRecord = {
      id: agent.id,
      code: agent.code || agent.name || 'unknown',
      original_value: agent.visible_menus,
      fixed_value: fixed,
      status: 'already_valid',
    };
    
    if (!wasCorrupted) {
      record.status = 'already_valid';
      report.records_already_valid++;
    } else {
      // Backup and update
      try {
        // Create backup record
        await supabase.from('visible_menus_backup').insert({
          table_name: 'agents',
          record_id: agent.id,
          original_value: JSON.stringify(agent.visible_menus),
          fixed_value: JSON.stringify(fixed),
          created_at: new Date().toISOString(),
        }).throwOnError();
        
        // Update the record
        const { error: updateError } = await supabase
          .from('agents')
          .update({ visible_menus: fixed })
          .eq('id', agent.id);
        
        if (updateError) {
          record.status = 'skipped';
          record.reason = updateError.message;
          report.records_skipped++;
        } else {
          record.status = 'fixed';
          report.records_fixed++;
          console.log(`  Fixed agent: ${record.code}`);
        }
      } catch (err) {
        record.status = 'skipped';
        record.reason = err instanceof Error ? err.message : 'Unknown error';
        report.records_skipped++;
      }
    }
    
    report.details.push(record);
  }
  
  // =====================================================
  // Step 2: Scan and fix users table
  // =====================================================
  console.log('');
  console.log('Scanning users table...');
  
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, username, display_name, visible_menus');
  
  if (userError) {
    console.error('Error fetching users:', userError.message);
  } else {
    report.records_scanned += users?.length || 0;
    console.log(`Found ${users?.length || 0} users`);
    
    for (const user of users || []) {
      const { fixed, wasCorrupted } = parseAndFixVisibleMenus(user.visible_menus);
      
      const record: CleanupRecord = {
        id: user.id,
        code: user.username || user.display_name || 'unknown',
        original_value: user.visible_menus,
        fixed_value: fixed,
        status: 'already_valid',
      };
      
      if (!wasCorrupted) {
        record.status = 'already_valid';
        report.records_already_valid++;
      } else {
        try {
          // Backup
          await supabase.from('visible_menus_backup').insert({
            table_name: 'users',
            record_id: user.id,
            original_value: JSON.stringify(user.visible_menus),
            fixed_value: JSON.stringify(fixed),
            created_at: new Date().toISOString(),
          }).throwOnError();
          
          // Update
          const { error: updateError } = await supabase
            .from('users')
            .update({ visible_menus: fixed })
            .eq('id', user.id);
          
          if (updateError) {
            record.status = 'skipped';
            record.reason = updateError.message;
            report.records_skipped++;
          } else {
            record.status = 'fixed';
            report.records_fixed++;
            console.log(`  Fixed user: ${record.code}`);
          }
        } catch (err) {
          record.status = 'skipped';
          record.reason = err instanceof Error ? err.message : 'Unknown error';
          report.records_skipped++;
        }
      }
      
      report.details.push(record);
    }
  }
  
  // =====================================================
  // Generate Report
  // =====================================================
  console.log('');
  console.log('='.repeat(60));
  console.log('CLEANUP REPORT');
  console.log('='.repeat(60));
  console.log(`Records scanned:       ${report.records_scanned}`);
  console.log(`Records fixed:         ${report.records_fixed}`);
  console.log(`Records skipped:       ${report.records_skipped}`);
  console.log(`Records already valid: ${report.records_already_valid}`);
  console.log('');
  
  if (report.records_fixed > 0) {
    console.log('Fixed records:');
    report.details
      .filter(d => d.status === 'fixed')
      .forEach(d => {
        console.log(`  - ${d.code}: ${JSON.stringify(d.original_value).slice(0, 50)}... -> ${JSON.stringify(d.fixed_value).slice(0, 50)}...`);
      });
    console.log('');
  }
  
  if (report.records_skipped > 0) {
    console.log('Skipped records:');
    report.details
      .filter(d => d.status === 'skipped')
      .forEach(d => {
        console.log(`  - ${d.code}: ${d.reason}`);
      });
    console.log('');
  }
  
  // Save report to database
  try {
    await supabase.from('migration_reports').insert({
      migration_name: 'cleanup-visible-menus',
      report: report,
      created_at: new Date().toISOString(),
    });
    console.log('Report saved to migration_reports table');
  } catch {
    console.log('Could not save report to database (table may not exist)');
  }
  
  console.log('');
  console.log('Migration complete!');
}

main().catch(console.error);
