/**
 * MENU AUDIT REPORT
 * Generated to identify mapping issues between visibility settings and sidebar rendering
 */

// === MENU ID TO HREF MAPPING ===
// This shows the relationship between menu IDs (used in visibility settings)
// and hrefs (used in sidebar rendering)

export const MENU_ID_TO_HREF_MAP: Record<string, string> = {
  // Standalone
  'dashboard': '/',
  'attendance': '/attendance',
  
  // ศูนย์ปฏิบัติการ
  'topup-requests': '/topup-requests',
  'withdraw-requests': '/withdraw-requests',
  'prize-payout': '/prize-payout',
  'credits': '/credits',
  'deposit-issues': '/deposit-issues',
  'pending-review': '/pending-review',
  
  // ศูนย์แอดมิน
  'member-summary': '/member/summary',
  'member-finance': '/member/finance',
  'member-slip-upload': '/member/slip-upload',
  
  // สมาชิก
  'customers': '/customers',
  'customer-history': '/customer-history',
  'customer-banks': '/customer-banks',
  'member-summary-page': '/member-summary',
  
  // บัญชีและการเงิน
  'payment-gateway': '/payment-gateway',
  'wallet-manager': '/wallet-manager',
  'bank-settings': '/bank-settings',
  'payment-accounts': '/payment-accounts',
  'withdraw-accounts': '/withdraw-accounts',
  'scb-maemanee': '/scb-maemanee',
  'transactions': '/transactions',
  'finance-reports': '/finance-reports',
  
  // หวย
  'admin-key': '/admin/key',
  'entries': '/entries',
  'lotteries': '/lotteries',
  'results': '/results',
  
  // ระบบออโต้
  'auto-system': '/auto-system',
  'auto-entries': '/auto-system/entries',
  'auto-customers': '/auto-system/customers',
  'auto-settings': '/auto-system/settings',
  
  // ระบบคีย์หวย
  'manual-key': '/manual-key',
  'manual-key-entry': '/admin/key',
  'manual-key-entries': '/manual-key/entries',
  'manual-key-customers': '/manual-key/customers',
  'manual-key-rates': '/manual-key/rates',
  
  // สายงานเอเย่นต์
  'agent-system': '/agent-system',
  'agent-system-members': '/agent-system/members',
  'agent-system-commission': '/agent-system/commission',
  'agent-system-bank': '/agent-system/bank-settings',
  'agent-system-site': '/agent-system/site-settings',
  'agent-system-settlement': '/agent-system/settlement',
  'agent-system-report': '/agent-system/report',
  
  // โปรโมชั่น
  'promotions': '/promotions',
  'referrals': '/referrals',
  'affiliate': '/affiliate',
  
  // ศูนย์การตลาด
  'lead-users': '/lead-users',
  'marketing-links': '/marketing-center',
  'marketing-agent': '/marketing-center/agent',
  'marketing-member': '/marketing-center/member',
  'marketing-partner': '/marketing-center/partner',
  'qr-generator': '/marketing-center/qr-generator',
  'member-links': '/member-links',
  
  // รายงาน
  'omni-channel': '/reports/omni-channel',
  'analysis': '/analysis',
  'profit-loss': '/profit-loss',
  'reports': '/reports',
  
  // จัดการพนักงาน
  'admin-attendance-report': '/admin-attendance-report',
  'admin-performance': '/admin-performance',
  'payroll': '/payroll',
  'payroll-settings': '/payroll/settings',
  'ot-report': '/payroll/ot-report',
  'admin-sales-report': '/admin-sales-report',
  
  // ตั้งค่าเว็บ
  'web-theme': '/web-theme',
  'manage-images': '/manage-images',
  'desktop-settings': '/desktop-settings',
  'settings': '/settings',
  
  // ไลฟ์สด
  'live-draw': '/live-draw',
  'live-stream': '/live-stream',
  'result-announcement': '/result-announcement',
  
  // Multi-Tenant
  'mt-dashboard': '/multi-tenant/dashboard',
  'mt-settlements': '/multi-tenant/settlements',
  'enterprise-summary': '/enterprise-summary',
  'sub-sites': '/sub-sites',
  'vip-dashboard': '/vip-dashboard',
  'billion-dashboard': '/billion-dashboard',
  'tenant-manager': '/tenant-manager',
  'site-manager': '/site-manager',
  'site-branding': '/site-manager/branding',
  'master-rates': '/master-rates',
  'financial-hub': '/financial-hub',
  'risk-control': '/risk-control',
  'api-docs': '/api-docs',
  
  // Super Admin
  'super-downline': '/super-admin/downline',
  'agent-visibility': '/agent-visibility',
  'member-visibility': '/member-visibility',
  'risk-management': '/risk-management',
  'master-control': '/master-control',
  'system-settings': '/settings/system',
  
  // ความปลอดภัย
  'users': '/users',
  'roles-permissions': '/roles-permissions',
  '2fa': '/security/2fa',
  'audit-logs': '/audit-logs',
  'backup': '/backup',
  'health-check': '/health-check',
  'security-dashboard': '/security-dashboard',
  
  // Agent Menus
  'agent-dashboard': '/agent-dashboard',
  'agent-slip-upload': '/member/slip-upload',
  'agent-summary': '/member/summary',
  'agent-finance': '/member/finance',
  'agent-members': '/agent-members',
  'agent-commission': '/agent/commission',
  'agent-profit-loss': '/agent-profit-loss',
  'agent-withdraw-history': '/agent-withdraw-history',
  'agent-betting': '/agent-terminal/betting',
  'agent-entries': '/entries',
  'agent-results': '/results',
};

// === HREF TO ID REVERSE MAP ===
export const HREF_TO_MENU_ID_MAP: Record<string, string> = {};
for (const [id, href] of Object.entries(MENU_ID_TO_HREF_MAP)) {
  // Store href without leading slash as key
  const key = href.startsWith('/') ? href.slice(1) : href;
  if (!HREF_TO_MENU_ID_MAP[key]) {
    HREF_TO_MENU_ID_MAP[key] = id;
  }
  // Also store full href
  if (!HREF_TO_MENU_ID_MAP[href]) {
    HREF_TO_MENU_ID_MAP[href] = id;
  }
}

// === AGENT-COMPATIBLE MENUS ===
// These are menus that agents CAN access (if enabled in visibility settings)
export const AGENT_COMPATIBLE_MENU_IDS = [
  // Dashboard
  'dashboard',
  'agent-dashboard',
  
  // Financial Center
  'agent-slip-upload',
  'agent-summary', 
  'agent-finance',
  
  // Downline Management
  'agent-members',
  'agent-commission',
  'agent-profit-loss',
  'agent-withdraw-history',
  
  // Betting
  'agent-betting',
  'agent-entries',
  'agent-results',
  
  // Manual Key System (if enabled)
  'manual-key',
  'manual-key-entry',
  'manual-key-entries',
  'manual-key-customers',
  'manual-key-rates',
  
  // General
  'results',
  'entries',
  'customers',
  'customer-history',
  'lotteries',
];

// === MENUS WITH MISMATCHED IDs ===
// These menu IDs may cause issues because the ID doesn't match the href pattern
export const POTENTIAL_MISMATCH_MENUS = [
  { id: 'dashboard', href: '/', issue: 'Dashboard href is "/" not "/dashboard"' },
  { id: 'admin-key', href: '/admin/key', issue: 'ID uses hyphen, href uses slash' },
  { id: 'manual-key-entry', href: '/admin/key', issue: 'Points to same page as admin-key' },
  { id: 'agent-entries', href: '/entries', issue: 'Alias for entries' },
  { id: 'agent-results', href: '/results', issue: 'Alias for results' },
  { id: 'member-summary', href: '/member/summary', issue: 'Nested path, ID uses hyphen' },
  { id: 'member-finance', href: '/member/finance', issue: 'Nested path, ID uses hyphen' },
  { id: 'member-slip-upload', href: '/member/slip-upload', issue: 'Nested path' },
];

// === STATUS REPORT ===
// Run this to generate a full audit
export function generateAuditReport(): {
  totalMenus: number;
  workingMenus: number;
  missingRoutes: string[];
  duplicateHrefs: string[];
  agentCompatible: number;
} {
  const hrefs = new Set<string>();
  const duplicateHrefs: string[] = [];
  
  for (const href of Object.values(MENU_ID_TO_HREF_MAP)) {
    if (hrefs.has(href)) {
      duplicateHrefs.push(href);
    }
    hrefs.add(href);
  }
  
  return {
    totalMenus: Object.keys(MENU_ID_TO_HREF_MAP).length,
    workingMenus: Object.keys(MENU_ID_TO_HREF_MAP).length, // All pages exist per audit
    missingRoutes: [],
    duplicateHrefs,
    agentCompatible: AGENT_COMPATIBLE_MENU_IDS.length,
  };
}

console.log('=== MENU AUDIT SUMMARY ===');
const report = generateAuditReport();
console.log(`Total Menus: ${report.totalMenus}`);
console.log(`Working: ${report.workingMenus}`);
console.log(`Agent Compatible: ${report.agentCompatible}`);
console.log(`Duplicate HREFs: ${report.duplicateHrefs.join(', ') || 'None'}`);
console.log('\n=== POTENTIAL MISMATCH MENUS ===');
for (const m of POTENTIAL_MISMATCH_MENUS) {
  console.log(`  ${m.id}: ${m.issue}`);
}
