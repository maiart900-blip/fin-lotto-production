/**
 * Menu Audit Script
 * Compares menu definitions against actual page implementations
 * 
 * Run with: npx tsx scripts/audit-menus.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// === MENU DEFINITIONS FROM menu-config.ts ===
const ALL_MENU_ITEMS = [
  // Standalone
  { id: 'dashboard', href: '/', title: 'Dashboard' },
  { id: 'attendance', href: '/attendance', title: 'ลงเวลางาน' },
  
  // ศูนย์ปฏิบัติการ
  { id: 'topup-requests', href: '/topup-requests', title: 'คำขอเติมเงิน' },
  { id: 'withdraw-requests', href: '/withdraw-requests', title: 'คำขอถอนเงิน' },
  { id: 'prize-payout', href: '/prize-payout', title: 'จ่ายรางวัลลูกค้าคีย์' },
  { id: 'credits', href: '/credits', title: 'ปรับยอดเครดิต' },
  { id: 'deposit-issues', href: '/deposit-issues', title: 'แจ้งปัญหาฝากเงิน' },
  { id: 'pending-review', href: '/pending-review', title: 'รายการรอตรวจสอบ' },
  
  // ศูนย์แอดมิน
  { id: 'member-summary', href: '/member/summary', title: 'สรุปยอด' },
  { id: 'member-finance', href: '/member/finance', title: 'การเงิน' },
  { id: 'member-slip-upload', href: '/member/slip-upload', title: 'อัปโหลดสลิป / ถอนเงิน' },
  
  // สมาชิก
  { id: 'customers', href: '/customers', title: 'รายชื่อสมาชิก' },
  { id: 'customer-history', href: '/customer-history', title: 'ประวัติสมาชิก' },
  { id: 'customer-banks', href: '/customer-banks', title: 'ธนาคารลูกค้า' },
  { id: 'member-summary-page', href: '/member-summary', title: 'สรุปแมมเบอร์' },
  
  // บัญชีและการเงิน
  { id: 'payment-gateway', href: '/payment-gateway', title: 'จัดการ Payment Gateway' },
  { id: 'wallet-manager', href: '/wallet-manager', title: 'จัดการกระเป๋าเงิน' },
  { id: 'bank-settings', href: '/bank-settings', title: 'ตั้งค่าธนาคาร' },
  { id: 'payment-accounts', href: '/payment-accounts', title: 'บัญชีรับเงิน' },
  { id: 'withdraw-accounts', href: '/withdraw-accounts', title: 'บัญชีถอนเงิน' },
  { id: 'scb-maemanee', href: '/scb-maemanee', title: 'SCB แม่มณี' },
  { id: 'transactions', href: '/transactions', title: 'ประวัติธุรกรรม' },
  { id: 'finance-reports', href: '/finance-reports', title: 'รายงานการเงิน' },
  
  // หวย
  { id: 'admin-key', href: '/admin/key', title: 'คีย์หวย' },
  { id: 'entries', href: '/entries', title: 'รายการทั้งหมด' },
  { id: 'lotteries', href: '/lotteries', title: 'จัดการหวย' },
  { id: 'results', href: '/results', title: 'ผลหวย' },
  
  // ระบบออโต้
  { id: 'auto-system', href: '/auto-system', title: 'ภาพรวมออโต้' },
  { id: 'auto-entries', href: '/auto-system/entries', title: 'รายการออโต้' },
  { id: 'auto-customers', href: '/auto-system/customers', title: 'ลูกค้าออโต้' },
  { id: 'auto-settings', href: '/auto-system/settings', title: 'ตั้งค่าออโต้' },
  
  // ระบบคีย์หวย
  { id: 'manual-key', href: '/manual-key', title: 'ภาพรวมคีย์หวย' },
  { id: 'manual-key-entry', href: '/admin/key', title: 'คีย์โพย' },
  { id: 'manual-key-entries', href: '/manual-key/entries', title: 'รายการคีย์หวย' },
  { id: 'manual-key-customers', href: '/manual-key/customers', title: 'ลูกค้าคีย์หวย' },
  { id: 'manual-key-rates', href: '/manual-key/rates', title: 'ตั้งค่าเรท' },
  
  // สายงานเอเย่นต์
  { id: 'agent-system', href: '/agent-system', title: 'จัดการเอเย่นต์' },
  { id: 'agent-system-members', href: '/agent-system/members', title: 'จัดการแมมเบอร์' },
  { id: 'agent-system-commission', href: '/agent-system/commission', title: 'คอมมิชชั่น' },
  { id: 'agent-system-bank', href: '/agent-system/bank-settings', title: 'ตั้งค่าธนาคาร' },
  { id: 'agent-system-site', href: '/agent-system/site-settings', title: 'ตั้งค่าเว็บลูก' },
  { id: 'agent-system-settlement', href: '/agent-system/settlement', title: 'ส่งยอดเข้าเว็บกลาง' },
  { id: 'agent-system-report', href: '/agent-system/report', title: 'รายงาน' },
  
  // โปรโมชั่น
  { id: 'promotions', href: '/promotions', title: 'จัดการโปรโมชั่น' },
  { id: 'referrals', href: '/referrals', title: 'แนะนำลูกค้า' },
  { id: 'affiliate', href: '/affiliate', title: 'ลิงก์แนะนำเพื่อน' },
  { id: 'promo-agent-system', href: '/agent-system', title: 'สายงานเอเย่นต์' },
  
  // ศูนย์การตลาด
  { id: 'lead-users', href: '/lead-users', title: 'ยูสนำแทง' },
  { id: 'marketing-links', href: '/marketing-center', title: 'ลิงก์ทั้งหมด' },
  { id: 'marketing-agent', href: '/marketing-center/agent', title: 'แดชบอร์ดเอเย่นต์' },
  { id: 'marketing-member', href: '/marketing-center/member', title: 'หน้าหลักสมาชิก' },
  { id: 'marketing-partner', href: '/marketing-center/partner', title: 'หน้าข้อมูลพาร์ทเนอร์' },
  { id: 'qr-generator', href: '/marketing-center/qr-generator', title: 'สร้าง QR Code' },
  { id: 'member-links', href: '/member-links', title: 'ลิงก์สมาชิก' },
  
  // รายงาน
  { id: 'omni-channel', href: '/reports/omni-channel', title: 'Omni-Channel' },
  { id: 'analysis', href: '/analysis', title: 'วิเคราะห์ยอดเลข' },
  { id: 'profit-loss', href: '/profit-loss', title: 'กำไร/ขาดทุน' },
  { id: 'reports', href: '/reports', title: 'รายงาน' },
  
  // จัดการพนักงาน
  { id: 'admin-attendance-report', href: '/admin-attendance-report', title: 'รายงานเข้างานแอดมิน' },
  { id: 'admin-performance', href: '/admin-performance', title: 'ตรวจสอบการทำงาน' },
  { id: 'payroll', href: '/payroll', title: 'สรุปเงินเดือน' },
  { id: 'payroll-settings', href: '/payroll/settings', title: 'ตั้งค่า Payroll' },
  { id: 'ot-report', href: '/payroll/ot-report', title: 'รายงานโอที' },
  { id: 'admin-sales-report', href: '/admin-sales-report', title: 'รายงานยอดแอดมิน' },
  
  // ตั้งค่าเว็บ
  { id: 'web-theme', href: '/web-theme', title: 'ตั้งค่าธีม' },
  { id: 'manage-images', href: '/manage-images', title: 'จัดการรูปภาพ' },
  { id: 'desktop-settings', href: '/desktop-settings', title: 'ตั้งค่าหน้าเว็บ' },
  { id: 'settings', href: '/settings', title: 'ตั้งค่าทั่วไป' },
  
  // ไลฟ์สด
  { id: 'live-draw', href: '/live-draw', title: 'ถ่ายทอดสด' },
  { id: 'live-stream', href: '/live-stream', title: 'Global Live Stream' },
  { id: 'result-announcement', href: '/result-announcement', title: 'บอทประกาศผล' },
  
  // Multi-Tenant (Master Only)
  { id: 'mt-dashboard', href: '/multi-tenant/dashboard', title: 'Dashboard ยอดรวม' },
  { id: 'mt-settlements', href: '/multi-tenant/settlements', title: 'รายการส่งยอด' },
  { id: 'enterprise-summary', href: '/enterprise-summary', title: 'Enterprise Summary' },
  { id: 'sub-sites', href: '/sub-sites', title: 'จัดการเว็บลูก' },
  { id: 'vip-dashboard', href: '/vip-dashboard', title: 'VIP Dashboard' },
  { id: 'billion-dashboard', href: '/billion-dashboard', title: 'Billion Dashboard' },
  { id: 'tenant-manager', href: '/tenant-manager', title: 'Tenant Manager' },
  { id: 'site-manager', href: '/site-manager', title: 'Site Manager' },
  { id: 'site-branding', href: '/site-manager/branding', title: 'Branding/Theme' },
  { id: 'master-rates', href: '/master-rates', title: 'เรท/อั้นกลาง' },
  { id: 'financial-hub', href: '/financial-hub', title: 'Financial Hub' },
  { id: 'risk-control', href: '/risk-control', title: 'Risk Control' },
  { id: 'api-docs', href: '/api-docs', title: 'API Docs' },
  
  // Super Admin (Restricted)
  { id: 'super-downline', href: '/super-admin/downline', title: 'จัดการสายงาน' },
  { id: 'agent-visibility', href: '/agent-visibility', title: 'ตั้งค่าการมองเห็นเอเย่น' },
  { id: 'member-visibility', href: '/member-visibility', title: 'ตั้งค่าการมองเห็นแมมเบอร์' },
  { id: 'risk-management', href: '/risk-management', title: 'ควบคุมความเสี่ยง' },
  { id: 'master-control', href: '/master-control', title: 'Master Control' },
  { id: 'system-settings', href: '/settings/system', title: 'ตั้งค่าระบบ' },
  
  // ความปลอดภัย (Restricted)
  { id: 'users', href: '/users', title: 'จัดการผู้ใช้' },
  { id: 'roles-permissions', href: '/roles-permissions', title: 'สิทธิ์การใช้งาน' },
  { id: 'security-attendance', href: '/admin-attendance-report', title: 'รายงานเข้างานแอดมิน' },
  { id: 'security-payroll', href: '/payroll', title: 'สรุปเงินเดือน' },
  { id: 'security-dashboard', href: '/security-dashboard', title: 'Security Dashboard' },
  { id: '2fa', href: '/security/2fa', title: 'ยืนยันตัวตน 2 ชั้น (2FA)' },
  { id: 'audit-logs', href: '/audit-logs', title: 'ประวัติการใช้งาน' },
  { id: 'backup', href: '/backup', title: 'สำรองข้อมูล' },
  { id: 'health-check', href: '/health-check', title: 'Health Check' },
  
  // Agent Menus
  { id: 'agent-dashboard', href: '/agent-dashboard', title: 'Dashboard เอเย่นต์' },
  { id: 'agent-slip-upload', href: '/member/slip-upload', title: 'ศูนย์การเงิน' },
  { id: 'agent-summary', href: '/member/summary', title: 'สรุปรายได้' },
  { id: 'agent-finance', href: '/member/finance', title: 'ประวัติธุรกรรม' },
  { id: 'agent-members', href: '/agent-members', title: 'ลูกค้าใต้สาย' },
  { id: 'agent-commission', href: '/agent/commission', title: 'คอมมิชชั่น' },
  { id: 'agent-profit-loss', href: '/agent-profit-loss', title: 'รายงานแพ้ชนะ' },
  { id: 'agent-withdraw-history', href: '/agent-withdraw-history', title: 'ถอนคอมมิชชั่น' },
  { id: 'agent-betting', href: '/agent-terminal/betting', title: 'คีย์โพย' },
  { id: 'agent-entries', href: '/entries', title: 'รายการโพย' },
  { id: 'agent-results', href: '/results', title: 'ผลหวย' },
];

// === EXISTING PAGES (from glob) ===
function getExistingPages(): Set<string> {
  const appDir = path.join(process.cwd(), 'app/(main)');
  const pages = new Set<string>();
  
  function walkDir(dir: string, prefix: string = '') {
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (item.startsWith('[')) {
            // Dynamic route - mark as exists
            walkDir(fullPath, prefix + '/' + item);
          } else if (!item.startsWith('_')) {
            walkDir(fullPath, prefix + '/' + item);
          }
        } else if (item === 'page.tsx') {
          // Found a page
          pages.add(prefix || '/');
        }
      }
    } catch (e) {
      // Directory doesn't exist
    }
  }
  
  walkDir(appDir);
  return pages;
}

// === MAIN AUDIT ===
interface AuditResult {
  id: string;
  title: string;
  href: string;
  pageExists: boolean;
  sidebarMapped: boolean;
  agentCompatible: boolean;
  status: 'WORKING' | 'ROUTE_MISSING' | 'SIDEBAR_MISSING' | 'NEEDS_REVIEW';
}

function runAudit(): AuditResult[] {
  const existingPages = getExistingPages();
  const results: AuditResult[] = [];
  
  // Agent-compatible menu IDs
  const agentMenus = new Set([
    'dashboard', 'agent-dashboard',
    'agent-slip-upload', 'agent-summary', 'agent-finance',
    'agent-members', 'agent-commission', 'agent-profit-loss', 'agent-withdraw-history',
    'agent-betting', 'agent-entries', 'agent-results',
    'manual-key', 'manual-key-entry', 'manual-key-entries', 'manual-key-customers', 'manual-key-rates',
    'results', 'entries', 'customers',
  ]);
  
  for (const menu of ALL_MENU_ITEMS) {
    const href = menu.href;
    const pageExists = existingPages.has(href) || existingPages.has(href.replace(/^\//, ''));
    const agentCompatible = agentMenus.has(menu.id);
    
    let status: AuditResult['status'] = 'WORKING';
    
    if (!pageExists) {
      status = 'ROUTE_MISSING';
    }
    
    results.push({
      id: menu.id,
      title: menu.title,
      href: menu.href,
      pageExists,
      sidebarMapped: true, // All items in ALL_MENU_ITEMS are sidebar-mapped
      agentCompatible,
      status,
    });
  }
  
  return results;
}

// === OUTPUT ===
function printReport(results: AuditResult[]) {
  console.log('\n=== MENU AUDIT REPORT ===\n');
  
  const working = results.filter(r => r.status === 'WORKING');
  const routeMissing = results.filter(r => r.status === 'ROUTE_MISSING');
  const agentCompatible = results.filter(r => r.agentCompatible);
  
  console.log(`Total Menus: ${results.length}`);
  console.log(`Working: ${working.length}`);
  console.log(`Route Missing: ${routeMissing.length}`);
  console.log(`Agent Compatible: ${agentCompatible.length}`);
  
  console.log('\n--- WORKING MENUS ---');
  for (const r of working.slice(0, 20)) {
    console.log(`✓ ${r.id.padEnd(30)} ${r.href.padEnd(40)} ${r.agentCompatible ? '[AGENT]' : ''}`);
  }
  if (working.length > 20) console.log(`  ... and ${working.length - 20} more`);
  
  console.log('\n--- ROUTE MISSING (Page not implemented) ---');
  for (const r of routeMissing) {
    console.log(`✗ ${r.id.padEnd(30)} ${r.href.padEnd(40)} ${r.title}`);
  }
  
  console.log('\n--- AGENT COMPATIBLE MENUS ---');
  for (const r of agentCompatible) {
    const status = r.pageExists ? '✓' : '✗';
    console.log(`${status} ${r.id.padEnd(30)} ${r.href.padEnd(40)}`);
  }
}

// Run
const results = runAudit();
printReport(results);

// Export for use
export { ALL_MENU_ITEMS, runAudit };
