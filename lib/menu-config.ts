/**
 * Menu Configuration - Source of Truth
 * ใช้เป็น reference สำหรับ Sidebar และหน้าตั้งค่า Permission
 * ดึงโครงสร้างจาก app-sidebar.tsx
 */

import {
  LayoutDashboard,
  PenLine,
  List,
  Users,
  Settings,
  Crown,
  ShieldCheck,
  UsersRound,
  Handshake,
  Gift,
  Ticket,
  DollarSign,
  Trophy,
  Wallet,
  BarChart3,
  Tv,
  PieChart,
  CreditCard,
  QrCode,
  Network,
  Building2,
  MonitorSmartphone,
  Landmark,
  AlertTriangle,
  ArrowDownToLine,
  History,
  Database,
  Bell,
  Shield,
  Link2,
  TrendingUp,
  FileText,
  Sparkles,
  Palette,
  FileDown,
  ShieldAlert,
  ClipboardCheck,
  Bot,
  Headphones,
  Image,
  Megaphone,
  Eye,
  Activity,
  Clock,
  Receipt,
  ArrowUpDown,
  Upload,
  Keyboard,
  Zap,
  GitBranch,
  Target,
  FileBarChart,
  Coins,
  Send,
  Percent,
  Globe,
  Radio,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';

// Type definitions
export interface MenuItem {
  id: string;
  title: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  badgeKey?: 'topupPending' | 'withdrawPending' | 'depositIssuesPending' | 'newCustomersToday';
}

export interface MenuSection {
  id: string;
  title: string;
  icon: LucideIcon;
  items: MenuItem[];
  defaultOpen?: boolean;
  // Visibility flags
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  masterOnly?: boolean;
  agentOnly?: boolean;
  agentVisible?: boolean;
  memberVisible?: boolean;
  staffVisible?: boolean;
  // Restricted - cannot be given to agents/members even if enabled
  restricted?: boolean;
}

// =====================================================
// MENU SECTIONS - Source of Truth from Sidebar
// =====================================================

// Dashboard (standalone)
export const dashboardItem: MenuItem = {
  id: 'dashboard',
  title: 'Dashboard',
  href: '/',
  icon: LayoutDashboard,
  description: 'หน้าหลักแสดงภาพรวม',
};

// ลงเวลางาน (standalone)
export const attendanceItem: MenuItem = {
  id: 'attendance',
  title: 'ลงเวลางาน',
  href: '/attendance',
  icon: Clock,
  description: 'ระบบลงเวลาเข้า-ออกงาน',
};

// 1. ศูนย์ปฏิบัติการ
export const operationItems: MenuItem[] = [
  { id: 'topup-requests', title: 'คำขอเติมเงิน', href: '/topup-requests', icon: CreditCard, description: 'อนุมัติคำขอเติมเงิน', badgeKey: 'topupPending' },
  { id: 'withdraw-requests', title: 'คำขอถอนเงิน', href: '/withdraw-requests', icon: ArrowDownToLine, description: 'อนุมัติคำขอถอนเงิน', badgeKey: 'withdrawPending' },
  { id: 'prize-payout', title: 'จ่ายรางวัลลูกค้าคีย์', href: '/prize-payout', icon: Trophy, description: 'จ่ายรางวัลให้ลูกค้าที่ถูกหวย' },
  { id: 'credits', title: 'ปรับยอดเครดิต', href: '/credits', icon: Wallet, description: 'ปรับยอดเครดิตลูกค้า' },
  { id: 'deposit-issues', title: 'แจ้งปัญหาฝากเงิน', href: '/deposit-issues', icon: AlertTriangle, description: 'จัดการปัญหาฝากเงินไม่เข้า', badgeKey: 'depositIssuesPending' },
  { id: 'pending-review', title: 'รายการรอตรวจสอบ', href: '/pending-review', icon: ClipboardCheck, description: 'รายการที่ต้องตรวจสอบ' },
];

// 2. ศูนย์แอดมิน (สำหรับพนักงาน)
export const memberAdminItems: MenuItem[] = [
  { id: 'member-summary', title: 'สรุปยอด', href: '/member/summary', icon: BarChart3, description: 'สรุปยอดงานประจำวัน' },
  { id: 'member-finance', title: 'การเงิน', href: '/member/finance', icon: Wallet, description: 'ดูรายการทางการเงิน' },
  { id: 'member-slip-upload', title: 'อัปโหลดสลิป / ถอนเงิน', href: '/member/slip-upload', icon: Upload, description: 'อัปโหลดสลิปและถอนเงิน' },
];

// 3. สมาชิก
export const memberItems: MenuItem[] = [
  { id: 'customers', title: 'รายชื่อสมาชิก', href: '/customers', icon: Users, description: 'จัดการสมาชิกทั้งหมด' },
  { id: 'customer-history', title: 'ประวัติสมาชิก', href: '/customer-history', icon: History, description: 'ดูประวัติการใช้งานสมาชิก' },
  { id: 'customer-banks', title: 'ธนาคารลูกค้า', href: '/customer-banks', icon: Landmark, description: 'จัดการบัญชีธนาคารลูกค้า' },
  { id: 'member-summary-page', title: 'สรุปแมมเบอร์', href: '/member-summary', icon: UsersRound, description: 'สรุปข้อมูลแมมเบอร์' },
];

// 4. บัญชีและการเงิน
export const financeItems: MenuItem[] = [
  { id: 'payment-gateway', title: 'จัดการ Payment Gateway', href: '/payment-gateway', icon: CreditCard, description: 'ตั้งค่าช่องทางชำระเงิน' },
  { id: 'wallet-manager', title: 'จัดการกระเป๋าเงิน', href: '/wallet-manager', icon: Wallet, description: 'จัดการบัญชีธนาคาร / SCB แม่มณี' },
  { id: 'finance-transactions', title: 'ประวัติธุรกรรมรวม', href: '/finance/transactions', icon: Receipt, description: 'ประวัติฝาก/ถอน/โอน/ปรับยอด รายวัน/เดือน/ปี' },
  { id: 'finance-reports', title: 'รายงานการเงิน', href: '/finance-reports', icon: FileBarChart, description: 'รายงานทางการเงิน' },
];

// 4.1 จัดการกระเป๋าเงิน (Sub-menu ย่อย - ยุบเข้าใน wallet-manager)
export const walletSubItems: MenuItem[] = [
  { id: 'bank-settings', title: 'ตั้งค่าธนาคาร', href: '/bank-settings', icon: Landmark, description: 'ตั้งค่าบัญชีธนาคาร' },
  { id: 'payment-accounts', title: 'บัญชีรับเงิน', href: '/payment-accounts', icon: QrCode, description: 'จัดการบัญชีรับเงิน' },
  { id: 'withdraw-accounts', title: 'บัญชีถอนเงิน', href: '/withdraw-accounts', icon: ArrowDownToLine, description: 'จัดการบัญชีถอนเงิน' },
  { id: 'scb-maemanee', title: 'SCB แม่มณี', href: '/scb-maemanee', icon: Landmark, description: 'ตั้งค่า SCB แม่มณี' },
];

// 4.5 ประวัติการเดิมพัน (แยกจากการเงิน)
export const bettingHistoryItems: MenuItem[] = [
  { id: 'betting-history', title: 'ประวัติการเดิมพัน', href: '/betting/history', icon: Ticket, description: 'ประวัติแทงหวย/คาสิโน/สล็อต/กีฬา' },
  { id: 'betting-reports', title: 'รายงานการเดิมพัน', href: '/betting/reports', icon: FileBarChart, description: 'รายงานยอดแทง/ชนะ/แพ้' },
];

// 5. หวย
export const lotteryItems: MenuItem[] = [
  { id: 'admin-key', title: 'คีย์หวย', href: '/admin/key', icon: PenLine, description: 'คีย์หวยให้ลูกค้า' },
  { id: 'entries', title: 'รายการทั้งหมด', href: '/entries', icon: List, description: 'ดูรายการแทงทั้งหมด' },
  { id: 'lotteries', title: 'จัดการหวย', href: '/lotteries', icon: Ticket, description: 'ตั้งค่าหวยในระบบ' },
  { id: 'results', title: 'ผลหวย', href: '/results', icon: Trophy, description: 'กรอกและดูผลหวย' },
];

// 6. ระบบออโต้
export const autoSystemItems: MenuItem[] = [
  { id: 'auto-system', title: 'ภาพรวมออโต้', href: '/auto-system', icon: Zap, description: 'ดูภาพรวมระบบออโต้' },
  { id: 'auto-entries', title: 'รายการออโต้', href: '/auto-system/entries', icon: List, description: 'รายการแทงจากระบบออโต้' },
  { id: 'auto-customers', title: 'ลูกค้าออโต้', href: '/auto-system/customers', icon: Users, description: 'จัดการลูกค้าระบบออโต้' },
  { id: 'auto-settings', title: 'ตั้งค่าออโต้', href: '/auto-system/settings', icon: Settings, description: 'ตั้งค่าระบบออโต้' },
];

// 7. ระบบคีย์หวย
export const manualKeyItems: MenuItem[] = [
  { id: 'manual-key', title: 'ภาพรวมคีย์หวย', href: '/manual-key', icon: Keyboard, description: 'ดูภาพรวมระบบคีย์หวย' },
  { id: 'manual-key-entry', title: 'คีย์โพย', href: '/admin/key', icon: PenLine, description: 'คีย์โพยลูกค้า' },
  { id: 'manual-key-entries', title: 'รายการคีย์หวย', href: '/manual-key/entries', icon: List, description: 'รายการแทงจากคีย์หวย' },
  { id: 'manual-key-customers', title: 'ลูกค้าคีย์หวย', href: '/manual-key/customers', icon: Users, description: 'จัดการลูกค้าคีย์หวย' },
  { id: 'manual-key-rates', title: 'ตั้งค่าเรท', href: '/manual-key/rates', icon: DollarSign, description: 'ตั้งค่าเรทจ่าย' },
];

// 8. สายงานเอเย่นต์
export const agentSystemItems: MenuItem[] = [
  { id: 'agent-system', title: 'จัดการเอเย่นต์', href: '/agent-system', icon: UsersRound, description: 'จัดการเอเย่นต์ทั้งหมด' },
  { id: 'agent-system-members', title: 'จัดการแมมเบอร์', href: '/agent-system/members', icon: Users, description: 'จัดการแมมเบอร์ในระบบ' },
  { id: 'agent-system-commission', title: 'คอมมิชชั่น', href: '/agent-system/commission', icon: DollarSign, description: 'ตั้งค่าคอมมิชชั่น' },
  { id: 'agent-system-bank', title: 'ตั้งค่าธนาคาร', href: '/agent-system/bank-settings', icon: Building2, description: 'ตั้งค่าธนาคารเอเย่นต์' },
  { id: 'agent-system-site', title: 'ตั้งค่าเว็บลูก', href: '/agent-system/site-settings', icon: Settings, description: 'ตั้งค่าเว็บลูก' },
  { id: 'agent-system-settlement', title: 'ส่งยอดเข้าเว็บกลาง', href: '/agent-system/settlement', icon: Send, description: 'ส่งยอดให้เว็บแม่' },
  { id: 'agent-system-report', title: 'รายงาน', href: '/agent-system/report', icon: BarChart3, description: 'รายงานสายงาน' },
];

// 9. โปรโมชั่น
export const promoItems: MenuItem[] = [
  { id: 'promotions', title: 'จัดการโปรโมชั่น', href: '/promotions', icon: Sparkles, description: 'จัดการโปรโมชั่นทั้งหมด' },
  { id: 'referrals', title: 'แนะนำลูกค้า', href: '/referrals', icon: Gift, description: 'ระบบแนะนำลูกค้า' },
  { id: 'affiliate', title: 'ลิงก์แนะนำเพื่อน', href: '/affiliate', icon: Link2, description: 'จัดการลิงก์แนะนำเพื่อน' },
  { id: 'promo-agent-system', title: 'สายงานเอเย่นต์', href: '/agent-system', icon: Network, description: 'ระบบสายงานเอเย่นต์' },
];

// 10. ศูนย์การตลาด
export const marketingCenterItems: MenuItem[] = [
  { id: 'lead-users', title: 'ยูสนำแทง', href: '/lead-users', icon: Crown, description: 'จัดการยูสนำแทง' },
  { id: 'marketing-links', title: 'ลิงก์ทั้งหมด', href: '/marketing-center', icon: Link2, description: 'ลิงก์การตลาดทั้งหมด' },
  { id: 'marketing-agent', title: 'แดชบอร์ดเอเย่นต์', href: '/marketing-center/agent', icon: UsersRound, description: 'แดชบอร์ดเอเย่นต์' },
  { id: 'marketing-member', title: 'หน้าหลักสมาชิก', href: '/marketing-center/member', icon: Users, description: 'หน้าหลักสมาชิก' },
  { id: 'marketing-partner', title: 'หน้าข้อมูลพาร์ทเนอร์', href: '/marketing-center/partner', icon: Handshake, description: 'ข้อมูลพาร์ทเนอร์' },
  { id: 'qr-generator', title: 'สร้าง QR Code', href: '/marketing-center/qr-generator', icon: QrCode, description: 'สร้าง QR Code' },
  { id: 'member-links', title: 'ลิงก์สมาชิก', href: '/member-links', icon: Link2, description: 'จัดการลิงก์สมาชิก' },
];

// 11. รายงาน
export const reportItems: MenuItem[] = [
  { id: 'omni-channel', title: 'Omni-Channel', href: '/reports/omni-channel', icon: Globe, description: 'รายงาน Omni-Channel' },
  { id: 'analysis', title: 'วิเคราะห์ยอดเลข', href: '/analysis', icon: BarChart3, description: 'วิเคราะห์ยอดเลข' },
  { id: 'profit-loss', title: 'กำไร/ขาดทุน', href: '/profit-loss', icon: PieChart, description: 'รายงานกำไร/ขาดทุน' },
  { id: 'reports', title: 'รายงาน', href: '/reports', icon: FileDown, description: 'รายงานทั้งหมด' },
];

// 12. จัดการพนักงาน
export const staffManagementItems: MenuItem[] = [
  { id: 'staff-performance', title: 'ผลงานพนักงาน', href: '/staff-performance', icon: Target, description: 'ดูผลงานและค่าคอมมิชชั่นพนักงาน' },
  { id: 'admin-attendance-report', title: 'รายงานเข้างานแอดมิน', href: '/admin-attendance-report', icon: Clock, description: 'รายงานการเข้างาน' },
  { id: 'admin-performance', title: 'ตรวจสอบการทำงาน', href: '/admin-performance', icon: ClipboardCheck, description: 'ตรวจสอบผลการทำงาน' },
  { id: 'payroll', title: 'สรุปเงินเดือน', href: '/payroll', icon: Wallet, description: 'สรุปเงินเดือนพนักงาน' },
  { id: 'payroll-settings', title: 'ตั้งค่า Payroll', href: '/payroll/settings', icon: Settings, description: 'ตั้งค่าระบบเงินเดือน' },
  { id: 'ot-report', title: 'รายงานโอที', href: '/payroll/ot-report', icon: Clock, description: 'รายงานการทำโอที' },
  { id: 'admin-sales-report', title: 'รายงานยอดแอดมิน', href: '/admin-sales-report', icon: BarChart3, description: 'รายงานยอดขายแอดมิน' },
];

// 13. ตั้งค่าเว็บ
export const webSettingsItems: MenuItem[] = [
  { id: 'web-theme', title: 'ตั้งค่าธีม', href: '/web-theme', icon: Palette, description: 'ปรับแต่งธีมเว็บไซต์' },
  { id: 'manage-images', title: 'จัดการรูปภาพ', href: '/manage-images', icon: Image, description: 'จัดการรูปภาพในระบบ' },
  { id: 'desktop-settings', title: 'ตั้งค่าหน้าเว็บ', href: '/desktop-settings', icon: MonitorSmartphone, description: 'ตั้งค่าหน้าเว็บ' },
  { id: 'settings', title: 'ตั้งค่าทั่วไป', href: '/settings', icon: Settings, description: 'ตั้งค่าทั่วไป' },
];

// 14. ไลฟ์สด
export const liveStreamItems: MenuItem[] = [
  { id: 'live-draw', title: 'ถ่ายทอดสด', href: '/live-draw', icon: Tv, description: 'ถ่ายทอดสดออกรางวัล' },
  { id: 'live-stream', title: 'Global Live Stream', href: '/live-stream', icon: Radio, description: 'ไลฟ์สตรีมทั่วโลก' },
  { id: 'result-announcement', title: 'บอทประกาศผล', href: '/result-announcement', icon: Bot, description: 'บอทประกาศผลอัตโนมัติ' },
];

// 15. Multi-Tenant (Master Only)
export const multiTenantItems: MenuItem[] = [
  { id: 'mt-dashboard', title: 'Dashboard ยอดรวม', href: '/multi-tenant/dashboard', icon: BarChart3, description: 'ดูยอดรวมทุกเว็บลูก' },
  { id: 'mt-settlements', title: 'รายการส่งยอด', href: '/multi-tenant/settlements', icon: Receipt, description: 'รายการส่งยอดจากเว็บลูก' },
  { id: 'enterprise-summary', title: 'Enterprise Summary', href: '/enterprise-summary', icon: Crown, description: 'สรุปข้อมูล Enterprise' },
  { id: 'sub-sites', title: 'จัดการเว็บลูก', href: '/sub-sites', icon: Globe, description: 'จัดการเว็บลูกทั้งหมด' },
  { id: 'vip-dashboard', title: 'VIP Dashboard', href: '/vip-dashboard', icon: Crown, description: 'แดชบอร์ดลูกค้า VIP' },
  { id: 'billion-dashboard', title: 'Billion Dashboard', href: '/billion-dashboard', icon: TrendingUp, description: 'แดชบอร์ดยอดรวม' },
  { id: 'tenant-manager', title: 'Tenant Manager', href: '/tenant-manager', icon: Globe, description: 'จัดการ Tenant' },
  { id: 'site-manager', title: 'Site Manager', href: '/site-manager', icon: Globe, description: 'จัดการ Site' },
  { id: 'site-branding', title: 'Branding/Theme', href: '/site-manager/branding', icon: Palette, description: 'ตั้งค่าแบรนด์' },
  { id: 'master-rates', title: 'เรท/อั้นกลาง', href: '/master-rates', icon: DollarSign, description: 'ตั้งค่าเรทกลาง' },
  { id: 'financial-hub', title: 'Financial Hub', href: '/financial-hub', icon: Wallet, description: 'ศูนย์กลางการเงิน' },
  { id: 'risk-control', title: 'Risk Control', href: '/risk-control', icon: Shield, description: 'ควบคุมความเสี่ยง' },
  { id: 'api-docs', title: 'API Docs', href: '/api-docs', icon: FileText, description: 'เอกสาร API' },
];

// 16. Super Admin (Restricted - ต้อง master_admin เท่านั้น)
export const superAdminItems: MenuItem[] = [
  { id: 'super-downline', title: 'จัดการสายงาน', href: '/super-admin/downline', icon: Crown, description: 'จัดการสายงานทั้งหมด' },
  // REMOVED: agent-visibility and member-visibility - now consolidated into roles-permissions (ศูนย์กลาง)
  { id: 'risk-management', title: 'ควบคุมความเสี่ยง', href: '/risk-management', icon: TrendingUp, description: 'จัดการความเสี่ยง' },
  { id: 'master-control', title: 'Master Control', href: '/master-control', icon: Shield, description: 'ควบคุมระบบหลัก' },
  { id: 'system-settings', title: 'ตั้งค่าระบบ', href: '/settings/system', icon: Settings, description: 'ตั้งค่าระบบทั้งหมด' },
];

// 17. ความปลอดภัย (Restricted)
export const securityItems: MenuItem[] = [
  { id: 'users', title: 'จัดการผู้ใช้ (ศูนย์กลาง)', href: '/users', icon: UsersRound, description: 'จัดการผู้ใช้ทุกประเภท - พนักงานและสายงานเอเย่นต์คีย์หวย' },
  { id: 'roles-permissions', title: 'สิทธิ์การใช้งาน (ศูนย์กลาง)', href: '/roles-permissions', icon: Shield, description: 'จัดการสิทธิ์ทุกระดับ - Master/Agent/Sub-Agent/พนักงาน' },
  { id: 'security-attendance', title: 'รายงานเข้างานแอดมิน', href: '/admin-attendance-report', icon: Clock, description: 'รายงานการเข้างาน' },
  { id: 'security-payroll', title: 'สรุปเงินเดือน', href: '/payroll', icon: Wallet, description: 'สรุปเงินเดือน' },
  { id: 'security-dashboard', title: 'Security Dashboard', href: '/security-dashboard', icon: ShieldAlert, description: 'แดชบอร์ดความปลอดภัย' },
  { id: '2fa', title: 'ยืนยันตัวตน 2 ชั้น (2FA)', href: '/security/2fa', icon: Smartphone, description: 'ตั้งค่า 2FA' },
  { id: 'audit-logs', title: 'ประวัติการใช้งาน', href: '/audit-logs', icon: History, description: 'ดูประวัติการใช้งาน' },
  { id: 'backup', title: 'สำรองข้อมูล', href: '/backup', icon: Database, description: 'สำรองข้อมูลระบบ' },
  { id: 'health-check', title: 'Health Check', href: '/health-check', icon: Activity, description: 'ตรวจสอบสถานะระบบ' },
];

// === AGENT MENUS (เฉพาะ Agent) ===
export const agentOperationItems: MenuItem[] = [
  { id: 'agent-slip-upload', title: 'ศูนย์การเงิน', href: '/member/slip-upload', icon: Upload, description: 'อัปโหลดสลิปและถอนเงิน' },
  { id: 'agent-summary', title: 'สรุปรายได้', href: '/member/summary', icon: DollarSign, description: 'สรุปรายได้ทั้งหมด' },
  { id: 'agent-finance', title: 'ประวัติธุรกรรม', href: '/member/finance', icon: Receipt, description: 'ดูประวัติธุรกรรม' },
];

export const agentDownlineItems: MenuItem[] = [
  { id: 'agent-members', title: 'ลูกค้าใต้สาย', href: '/agent-members', icon: Users, description: 'จัดการลูกค้าใต้สาย' },
  { id: 'agent-commission', title: 'คอมมิชชั่น', href: '/agent/commission', icon: DollarSign, description: 'ดูคอมมิชชั���น' },
  { id: 'agent-profit-loss', title: 'รายงานแพ้ชนะ', href: '/agent-profit-loss', icon: PieChart, description: 'รายงานแพ้ชนะ' },
  { id: 'agent-withdraw-history', title: 'ถอนคอมมิชชั่น', href: '/agent-withdraw-history', icon: ArrowDownToLine, description: 'ถอนคอม���ิชชั่น' },
];

export const agentBettingItems: MenuItem[] = [
  { id: 'agent-betting', title: 'คีย์โพย', href: '/agent-terminal/betting', icon: PenLine, description: 'คีย์โพยให้ลูกค้า' },
  { id: 'agent-entries', title: 'รายการโพย', href: '/entries', icon: List, description: 'ดูรายการโพย' },
  { id: 'agent-results', title: 'ผลหวย', href: '/results', icon: Trophy, description: 'ดูผลหวย' },
];

// =====================================================
// COMPLETE MENU SECTIONS - ใช้ในหน้า Permission
// =====================================================

export const ALL_MENU_SECTIONS: MenuSection[] = [
  // Admin Menus
  { id: 'operation', title: 'ศูนย์ปฏิบัติการ', icon: Headphones, items: operationItems, defaultOpen: true, adminOnly: true, staffVisible: true, memberVisible: true },
  { id: 'member-admin', title: 'ศูนย์แอดมิน', icon: BarChart3, items: memberAdminItems, defaultOpen: false, adminOnly: true },
  { id: 'members', title: 'สมาชิก', icon: Users, items: memberItems, defaultOpen: false, adminOnly: true, staffVisible: true },
  { id: 'finance', title: 'ธุรกรรมการเงิน', icon: Wallet, items: financeItems, defaultOpen: false, adminOnly: true, staffVisible: true, memberVisible: true },
  { id: 'betting', title: 'ประวัติการเดิมพัน', icon: Ticket, items: bettingHistoryItems, defaultOpen: false, adminOnly: true, staffVisible: true },
  { id: 'lottery', title: 'หวย', icon: Ticket, items: lotteryItems, defaultOpen: false, adminOnly: true, staffVisible: true, memberVisible: true },
  { id: 'auto-system', title: 'ระบบออโต้', icon: Zap, items: autoSystemItems, defaultOpen: false, adminOnly: true },
  { id: 'manual-key', title: 'ระบบคีย์หวย', icon: Keyboard, items: manualKeyItems, defaultOpen: false, adminOnly: true },
  { id: 'agent-system', title: 'สายงานเอเย่นต์', icon: GitBranch, items: agentSystemItems, defaultOpen: false, adminOnly: true },
  { id: 'promotions', title: 'โปรโมชั่น', icon: Sparkles, items: promoItems, defaultOpen: false, adminOnly: true },
  { id: 'marketing-center', title: 'ศูนย์การตลาด', icon: Megaphone, items: marketingCenterItems, defaultOpen: false, adminOnly: true },
  { id: 'reports', title: 'รายงาน', icon: BarChart3, items: reportItems, defaultOpen: false, adminOnly: true, staffVisible: true },
  { id: 'staff-management', title: 'จัดการพนักงาน', icon: UsersRound, items: staffManagementItems, defaultOpen: false, adminOnly: true },
  { id: 'web-settings', title: 'ตั้งค่าเว็บ', icon: Settings, items: webSettingsItems, defaultOpen: false, adminOnly: true },
  { id: 'live-stream', title: 'ไลฟ์สด', icon: Tv, items: liveStreamItems, defaultOpen: false, adminOnly: true },
  { id: 'multi-tenant', title: 'Multi-Tenant', icon: Globe, items: multiTenantItems, defaultOpen: false, superAdminOnly: true, masterOnly: true },
  { id: 'super-admin', title: 'Super Admin', icon: Crown, items: superAdminItems, defaultOpen: false, superAdminOnly: true, restricted: true },
  { id: 'security', title: 'ความปลอดภัย', icon: Shield, items: securityItems, defaultOpen: false, superAdminOnly: true, restricted: true },
  
  // Agent Menus
  { id: 'agent-finance', title: 'ศูนย์การเงิน', icon: Wallet, items: agentOperationItems, defaultOpen: true, agentOnly: true },
  { id: 'agent-downline', title: 'ลูกค้าใต้สาย', icon: Users, items: agentDownlineItems, defaultOpen: false, agentOnly: true },
  { id: 'agent-betting', title: 'คีย์หวย', icon: Ticket, items: agentBettingItems, defaultOpen: false, agentOnly: true },
];

// Standalone items (Dashboard, Attendance)
export const STANDALONE_ITEMS: MenuItem[] = [
  dashboardItem,
  attendanceItem,
];

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get all menu item IDs for permission management
 */
export function getAllMenuIds(): string[] {
  const ids: string[] = [];
  
  // Add standalone items
  STANDALONE_ITEMS.forEach(item => ids.push(item.id));
  
  // Add section items
  ALL_MENU_SECTIONS.forEach(section => {
    ids.push(section.id); // Section ID
    section.items.forEach(item => ids.push(item.id)); // Item IDs
  });
  
  return ids;
}

/**
 * Get default permissions for a role
 */
export function getDefaultPermissions(role: 'master_admin' | 'admin' | 'agent' | 'member' | 'staff'): string[] {
  if (role === 'master_admin') {
    return getAllMenuIds(); // master_admin sees everything
  }
  
  if (role === 'admin') {
    // Admin sees everything except restricted sections
    return getAllMenuIds().filter(id => {
      const section = ALL_MENU_SECTIONS.find(s => s.id === id);
      return !section?.restricted;
    });
  }
  
  if (role === 'agent') {
    // Agent default: agent-specific sections only
    return ['dashboard', 'agent-finance', 'agent-slip-upload', 'agent-summary', 'agent-finance',
            'agent-downline', 'agent-members', 'agent-commission', 'agent-profit-loss', 'agent-withdraw-history',
            'agent-betting', 'agent-betting', 'agent-entries', 'agent-results'];
  }
  
  if (role === 'member' || role === 'staff') {
    // Member/Staff default: limited access
    return ['dashboard', 'operation', 'topup-requests', 'withdraw-requests', 
            'lottery', 'admin-key', 'entries', 'results'];
  }
  
  return ['dashboard'];
}

/**
 * Get restricted menu IDs (cannot be given to non-master_admin)
 */
export function getRestrictedMenuIds(): string[] {
  const restricted: string[] = [];
  
  ALL_MENU_SECTIONS.forEach(section => {
    if (section.restricted) {
      restricted.push(section.id);
      section.items.forEach(item => restricted.push(item.id));
    }
  });
  
  return restricted;
}

/**
 * Check if a menu ID is restricted
 */
export function isMenuRestricted(menuId: string): boolean {
  return getRestrictedMenuIds().includes(menuId);
}
