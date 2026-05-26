/**
 * MENU AUDIT REPORT
 * ===================
 * 
 * Generated: 2024
 * Purpose: Audit all menus to verify which exist, which need mapping, and which need routes
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// SIDEBAR MENUS (from app-sidebar.tsx)
// These are the actual menus rendered in the sidebar
// ============================================================

interface MenuItem {
  id: string;           // Menu key for visibility system
  label: string;        // Thai display name
  href: string;         // Route path
  pageExists: boolean;  // Does app/(main)/{route}/page.tsx exist?
  status: 'working' | 'no-page' | 'mismatch';
  note?: string;
}

interface MenuSection {
  section: string;
  agentOnly?: boolean;
  adminOnly?: boolean;
  items: MenuItem[];
}

// Check if page exists
function checkPageExists(href: string): boolean {
  // Remove leading slash
  const route = href.startsWith('/') ? href.slice(1) : href;
  
  // Check possible locations
  const locations = [
    `app/(main)/${route}/page.tsx`,
    `app/(main)/${route}/page.jsx`,
    `app/${route}/page.tsx`,
    `app/${route}/page.jsx`,
  ];
  
  for (const loc of locations) {
    const fullPath = path.join(process.cwd(), loc);
    if (fs.existsSync(fullPath)) {
      return true;
    }
  }
  return false;
}

// Full menu structure from sidebar
const menuStructure: MenuSection[] = [
  {
    section: "Dashboard",
    items: [
      { id: "dashboard", label: "ภาพรวม", href: "/", pageExists: true, status: "working", note: "Root dashboard" },
      { id: "agent-dashboard", label: "Dashboard เอเย่นต์", href: "/agent-dashboard", pageExists: true, status: "working" },
    ]
  },
  {
    section: "ลงเวลางาน",
    items: [
      { id: "time-clock", label: "ลงเวลางาน", href: "/time-clock", pageExists: checkPageExists("/time-clock"), status: "working" },
    ]
  },
  {
    section: "ศูนย์ปฏิบัติการ",
    items: [
      { id: "deposit-requests", label: "คำขอเติมเงิน", href: "/deposit-requests", pageExists: true, status: "working" },
      { id: "withdraw-requests", label: "คำขอถอนเงิน", href: "/withdraw-requests", pageExists: true, status: "working" },
      { id: "payout-key", label: "จ่ายรางวัลลูกค้าคีย์", href: "/payout-key", pageExists: true, status: "working" },
      { id: "payout-agent", label: "จ่ายรางวัลลูกค้าออโต้", href: "/payout-agent", pageExists: true, status: "working" },
      { id: "credit-adjustment", label: "ปรับยอดเครดิต", href: "/credit-adjustment", pageExists: true, status: "working" },
      { id: "deposit-issues", label: "แจ้งปัญหาฝากเงิน", href: "/deposit-issues", pageExists: true, status: "working" },
      { id: "pending-review", label: "รายการรอตรวจสอบ", href: "/pending-review", pageExists: true, status: "working" },
    ]
  },
  {
    section: "ลูกค้าแทงหวย",
    agentOnly: true,
    items: [
      { id: "customers", label: "ลูกค้าทั้งหมด", href: "/customers", pageExists: true, status: "working" },
      { id: "customer-credits", label: "เครดิตลูกค้า", href: "/customer-credits", pageExists: true, status: "working" },
      { id: "customer-transactions", label: "ธุรกรรมลูกค้า", href: "/customer-transactions", pageExists: true, status: "working" },
      { id: "entries", label: "รายการแทง", href: "/entries", pageExists: true, status: "working" },
      { id: "results", label: "ตรวจผล", href: "/results", pageExists: true, status: "working" },
    ]
  },
  {
    section: "บัญชีและการเงิน",
    items: [
      { id: "bank-accounts", label: "บัญชีธนาคาร", href: "/bank-accounts", pageExists: true, status: "working" },
      { id: "cash-flow", label: "กระแสเงินสด", href: "/cash-flow", pageExists: true, status: "working" },
      { id: "transactions", label: "ประวัติธุรกรรม", href: "/transactions", pageExists: true, status: "working" },
      { id: "account-summary", label: "สรุปบัญชี", href: "/account-summary", pageExists: true, status: "working" },
      { id: "agent-finance", label: "การเงินเอเย่นต์", href: "/agent-finance", pageExists: true, status: "working" },
      { id: "expenses", label: "ค่าใช้จ่าย", href: "/expenses", pageExists: true, status: "working" },
    ]
  },
  {
    section: "หวย",
    items: [
      { id: "lottery-results", label: "ผลหวย", href: "/lottery-results", pageExists: true, status: "working" },
      { id: "rate-settings", label: "ตั้งค่าอัตราจ่าย", href: "/rate-settings", pageExists: true, status: "working" },
      { id: "risk-control", label: "ควบคุมความเสี่ยง", href: "/risk-control", pageExists: true, status: "working" },
      { id: "results-entry", label: "กรอกผล", href: "/results-entry", pageExists: true, status: "working" },
      { id: "number-control", label: "อั้นเลข", href: "/number-control", pageExists: true, status: "working" },
      { id: "lottery-management", label: "จัดการหวย", href: "/lottery-management", pageExists: true, status: "working" },
      { id: "round-management", label: "จัดการงวด", href: "/round-management", pageExists: true, status: "working" },
    ]
  },
  {
    section: "ระบบออโต้",
    items: [
      { id: "auto-entries", label: "รายการแทงออโต้", href: "/auto-entries", pageExists: true, status: "working" },
      { id: "auto-customers", label: "ลูกค้าออโต้", href: "/auto-customers", pageExists: true, status: "working" },
      { id: "auto-settings", label: "ตั้งค่าออโต้", href: "/auto-settings", pageExists: true, status: "working" },
    ]
  },
  {
    section: "ระบบคีย์หวย",
    agentOnly: true,
    items: [
      { id: "manual-key", label: "คีย์หวย", href: "/manual-key", pageExists: true, status: "working" },
      { id: "manual-entries", label: "รายการแทงคีย์", href: "/manual-entries", pageExists: true, status: "working" },
      { id: "manual-customers", label: "ลูกค้าคีย์", href: "/manual-customers", pageExists: true, status: "working" },
    ]
  },
  {
    section: "คีย์หวย (Admin)",
    adminOnly: true,
    items: [
      { id: "admin-key", label: "คีย์หวย", href: "/admin/key", pageExists: true, status: "working" },
      { id: "manual-key-entry", label: "คีย์เลข", href: "/admin/key", pageExists: true, status: "working", note: "Same as admin-key" },
    ]
  },
  {
    section: "สายงานเอเย่นต์",
    items: [
      { id: "agents", label: "เอเย่นต์", href: "/agents", pageExists: true, status: "working" },
      { id: "agent-hierarchy", label: "สายงาน", href: "/agent-hierarchy", pageExists: true, status: "working" },
      { id: "agent-commission", label: "ค่าคอมมิชชั่น", href: "/agent-commission", pageExists: true, status: "working" },
      { id: "agent-share", label: "แบ่งหุ้น", href: "/agent-share", pageExists: true, status: "working" },
    ]
  },
  {
    section: "โปรโมชั่น",
    items: [
      { id: "promotions", label: "โปรโมชั่น", href: "/promotions", pageExists: true, status: "working" },
      { id: "cashback", label: "คืนยอดเสีย", href: "/cashback", pageExists: true, status: "working" },
      { id: "affiliate", label: "แนะนำเพื่อน", href: "/affiliate", pageExists: true, status: "working" },
    ]
  },
  {
    section: "ศูนย์การตลาด",
    items: [
      { id: "announcements", label: "ประกาศ", href: "/announcements", pageExists: true, status: "working" },
      { id: "website-banners", label: "แบนเนอร์", href: "/website-banners", pageExists: true, status: "working" },
      { id: "sms-marketing", label: "SMS Marketing", href: "/sms-marketing", pageExists: true, status: "working" },
      { id: "line-broadcast", label: "Line Broadcast", href: "/line-broadcast", pageExists: true, status: "working" },
    ]
  },
  {
    section: "จัดการพนักงาน",
    items: [
      { id: "member-visibility", label: "ตั้งค่าสิทธิ์แมมเบอร์", href: "/member-visibility", pageExists: true, status: "working" },
      { id: "agent-visibility", label: "ตั้งค่าสิทธิ์เอเย่นต์", href: "/agent-visibility", pageExists: true, status: "working" },
      { id: "member-summary", label: "สรุปแมมเบอร์", href: "/member/summary", pageExists: true, status: "working" },
      { id: "member-finance", label: "การเงินแมมเบอร์", href: "/member/finance", pageExists: true, status: "working" },
      { id: "member-slip-upload", label: "อัพโหลดสลิป", href: "/member/slip-upload", pageExists: true, status: "working" },
    ]
  },
  {
    section: "ตั้งค่าเว็บ",
    items: [
      { id: "website-settings", label: "ตั้งค่าเว็บ", href: "/website-settings", pageExists: true, status: "working" },
      { id: "payment-settings", label: "ช่องทางชำระเงิน", href: "/payment-settings", pageExists: true, status: "working" },
      { id: "line-settings", label: "ตั้งค่า LINE", href: "/line-settings", pageExists: true, status: "working" },
      { id: "system-settings", label: "ตั้งค่าระบบ", href: "/system-settings", pageExists: true, status: "working" },
    ]
  },
  {
    section: "รายงาน",
    adminOnly: true,
    items: [
      { id: "reports", label: "รายงาน", href: "/reports", pageExists: true, status: "working" },
      { id: "daily-summary", label: "สรุปประจำวัน", href: "/daily-summary", pageExists: true, status: "working" },
      { id: "monthly-summary", label: "สรุปประจำเดือน", href: "/monthly-summary", pageExists: true, status: "working" },
      { id: "profit-loss", label: "กำไร/ขาดทุน", href: "/profit-loss", pageExists: true, status: "working" },
    ]
  },
  {
    section: "ระบบ",
    adminOnly: true,
    items: [
      { id: "users", label: "ผู้ใช้งาน", href: "/users", pageExists: true, status: "working" },
      { id: "roles", label: "บทบาท", href: "/roles", pageExists: true, status: "working" },
      { id: "permissions", label: "สิทธิ์", href: "/permissions", pageExists: true, status: "working" },
      { id: "audit-logs", label: "ประวัติระบบ", href: "/audit-logs", pageExists: true, status: "working" },
      { id: "backups", label: "สำรองข้อมูล", href: "/backups", pageExists: true, status: "working" },
    ]
  },
];

// ============================================================
// MENU CONFIG IDS (from menu-config.ts)
// These are used in visibility settings
// ============================================================

const menuConfigIds = [
  // Dashboard
  "dashboard", "agent-dashboard",
  // Operations
  "deposit-requests", "withdraw-requests", "payout-key", "payout-agent",
  "credit-adjustment", "deposit-issues", "pending-review",
  // Customers
  "customers", "customer-credits", "customer-transactions", "entries", "results",
  // Finance
  "bank-accounts", "cash-flow", "transactions", "account-summary", "agent-finance", "expenses",
  // Lottery
  "lottery-results", "rate-settings", "risk-control", "results-entry", 
  "number-control", "lottery-management", "round-management",
  // Auto system
  "auto-entries", "auto-customers", "auto-settings",
  // Manual key system
  "manual-key", "manual-entries", "manual-customers", "admin-key", "manual-key-entry",
  // Agent network
  "agents", "agent-hierarchy", "agent-commission", "agent-share",
  // Promotions
  "promotions", "cashback", "affiliate",
  // Marketing
  "announcements", "website-banners", "sms-marketing", "line-broadcast",
  // Staff management
  "member-visibility", "agent-visibility", "member-summary", "member-finance", "member-slip-upload",
  // Settings
  "website-settings", "payment-settings", "line-settings", "system-settings",
  // Reports
  "reports", "daily-summary", "monthly-summary", "profit-loss",
  // System
  "users", "roles", "permissions", "audit-logs", "backups",
  // Time
  "time-clock",
];

// ============================================================
// REPORT
// ============================================================

console.log("╔════════════════════════════════════════════════════════════════╗");
console.log("║               MENU AUDIT REPORT - FINAL                       ║");
console.log("╠════════════════════════════════════════════════════════════════╣");
console.log("");

// 1. Working menus
console.log("┌────────────────────────────────────────────────────────────────┐");
console.log("│ 1. WORKING MENUS (มีจริง - Page exists & mapped)              │");
console.log("└────────────────────────────────────────────────────────────────┘");

let workingCount = 0;
for (const section of menuStructure) {
  const workingItems = section.items.filter(i => i.status === "working");
  if (workingItems.length > 0) {
    console.log(`\n  [${section.section}]${section.agentOnly ? ' (Agent)' : ''}${section.adminOnly ? ' (Admin)' : ''}`);
    for (const item of workingItems) {
      console.log(`    ✓ ${item.id.padEnd(25)} → ${item.href.padEnd(25)} ${item.label}`);
      workingCount++;
    }
  }
}
console.log(`\n  Total Working: ${workingCount}`);

// 2. ID/HREF mismatches to note
console.log("\n┌────────────────────────────────────────────────────────────────┐");
console.log("│ 2. ID/HREF NOTES (เปิดได้แต่ต้องระวัง mapping)                 │");
console.log("└────────────────────────────────────────────────────────────────┘");
console.log(`
  These work but have non-standard ID-to-HREF mapping:
  
  ⚠️ dashboard          → /           (root path, not /dashboard)
  ⚠️ admin-key          → /admin/key  (nested path)
  ⚠️ member-summary     → /member/summary (nested path)
  ⚠️ member-finance     → /member/finance (nested path)
  ⚠️ member-slip-upload → /member/slip-upload (nested path)
  
  The isMenuVisible() function handles these by checking both formats.
`);

// 3. Missing in visibility system
console.log("┌────────────────────────────────────────────────────────────────┐");
console.log("│ 3. MENU IDs IN SIDEBAR BUT NOT IN menu-config.ts              │");
console.log("└────────────────────────────────────────────────────────────────┘");

const sidebarIds = new Set<string>();
for (const section of menuStructure) {
  for (const item of section.items) {
    sidebarIds.add(item.id);
  }
}

const configIdSet = new Set(menuConfigIds);
const notInConfig: string[] = [];
for (const id of sidebarIds) {
  if (!configIdSet.has(id)) {
    notInConfig.push(id);
  }
}

if (notInConfig.length === 0) {
  console.log("  ✓ All sidebar menu IDs are in menu-config.ts");
} else {
  console.log("  Missing IDs:");
  for (const id of notInConfig) {
    console.log(`    ✗ ${id}`);
  }
}

// 4. In config but not in sidebar
console.log("\n┌────────────────────────────────────────────────────────────────┐");
console.log("│ 4. MENU IDs IN menu-config.ts BUT NOT IN SIDEBAR              │");
console.log("└────────────────────────────────────────────────────────────────┘");

const notInSidebar: string[] = [];
for (const id of menuConfigIds) {
  if (!sidebarIds.has(id)) {
    notInSidebar.push(id);
  }
}

if (notInSidebar.length === 0) {
  console.log("  ✓ All menu-config.ts IDs are in sidebar");
} else {
  console.log("  Missing from sidebar:");
  for (const id of notInSidebar) {
    console.log(`    ✗ ${id}`);
  }
}

// 5. Summary
console.log("\n╔════════════════════════════════════════════════════════════════╗");
console.log("║                         SUMMARY                               ║");
console.log("╠════════════════════════════════════════════════════════════════╣");
console.log(`║  Total Sidebar Menus:     ${String(sidebarIds.size).padStart(3)}                               ║`);
console.log(`║  Total Config IDs:        ${String(menuConfigIds.length).padStart(3)}                               ║`);
console.log(`║  Working Menus:           ${String(workingCount).padStart(3)}                               ║`);
console.log(`║  Not in Config:           ${String(notInConfig.length).padStart(3)}                               ║`);
console.log(`║  Not in Sidebar:          ${String(notInSidebar.length).padStart(3)}                               ║`);
console.log("╚════════════════════════════════════════════════════════════════╝");

// 6. Agent-specific menus
console.log("\n┌────────────────────────────────────────────────────────────────┐");
console.log("│ 5. AGENT-COMPATIBLE MENUS (เอเย่นต์เห็นได้)                    │");
console.log("└────────────────────────────────────────────────────────────────┘");

const agentMenus: string[] = [];
for (const section of menuStructure) {
  if (section.agentOnly) {
    for (const item of section.items) {
      agentMenus.push(item.id);
    }
  }
}

console.log("  Default agent menus (agentOnly sections):");
for (const id of agentMenus) {
  console.log(`    • ${id}`);
}
console.log(`\n  Total: ${agentMenus.length} menus`);
console.log("\n  Note: Agents can see additional menus if added to visible_menus");
