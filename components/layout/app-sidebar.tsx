'use client';

// Sidebar navigation component - FIN LOTTO R+ v3 Production

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import useSWR from 'swr';
import {
  LayoutDashboard,
  PenLine,
  List,
  Calculator,
  Users,
  User,
  Settings,
  Crown,
  LogOut,
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
  Infinity,
  PieChart,
  CreditCard,
  QrCode,
  Network,
  Building2,
  MonitorSmartphone,
  Smartphone,
  Landmark,
  AlertTriangle,
  ArrowDownToLine,
  History,
  Ban,
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
  Target,
  Bot,
  ChevronDown,
  Headphones,
  Image,
  Megaphone,
  UserPlus,
  Eye,
  Lock,
  Key,
  Activity,
  HardDrive,
  CheckCircle,
  Clock,
  UserX,
  Receipt,
  ArrowUpDown,
  Upload,
  ArrowUpRight,
  Keyboard,
  Zap,
  GitBranch,
  Scale,
  FileBarChart,
  Coins,
  Send,
  Terminal,
  Percent,
  Globe,
  Radio,
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState } from 'react';
import { fetcher } from '@/lib/fetcher';

interface PendingCounts {
  topupPending: number;
  withdrawPending: number;
  newCustomersToday: number;
  newEntriesToday: number;
  depositIssuesPending: number;
  totalPending: number;
}

// 0. ลงเวลา (สำหรับแอดมิน)
const attendanceItem = {
  id: 'attendance',
  title: 'ลงเวลางาน',
  href: '/attendance',
  icon: Clock,
};

// 1. Dashboard (ไม่มี submenu) - หน้า Dashboard คือ / (main page)
const dashboardItem = {
  id: 'dashboard',
  title: 'Dashboard',
  href: '/',
  icon: LayoutDashboard,
};

// 2. ศูนย์ปฏิบัติการแอดมิน
const operationItems = [
  { id: 'topup-requests', title: 'คำขอเติมเงิน', href: '/topup-requests', icon: CreditCard, badgeKey: 'topupPending' as const },
  { id: 'withdraw-requests', title: 'คำขอถอนเงิน', href: '/withdraw-requests', icon: ArrowDownToLine, badgeKey: 'withdrawPending' as const },
  { id: 'prize-payout', title: 'จ่ายรางวัลลูกค้าคีย์', href: '/prize-payout', icon: Trophy },
  { id: 'credits', title: 'ปรับยอดเครดิต', href: '/credits', icon: Wallet },
  { id: 'deposit-issues', title: 'แจ้งปัญหาฝากเงิน', href: '/deposit-issues', icon: AlertTriangle, badgeKey: 'depositIssuesPending' as const },
  { id: 'pending-review', title: 'รายการรอตรวจสอบ', href: '/pending-review', icon: ClipboardCheck },
];

// 3. ลูกค้าแทงหวย (Customers - ไม่ใช่พนักงาน)
const memberItems = [
  { id: 'customers', title: 'รายชื่อลูกค้าแทงหวย', href: '/customers', icon: Users },
  { id: 'customer-history', title: 'ประวัติลูกค้า', href: '/customer-history', icon: History },
  { id: 'customer-banks', title: 'ธนาคารลูกค้า', href: '/customer-banks', icon: Landmark },
  { id: 'member-summary', title: 'สรุปลูกค้า', href: '/member-summary', icon: UsersRound },
];

// 4. ธุรกรรมการเงิน (แยกจากการเดิมพัน)
const financeItems = [
  { id: 'payment-gateway', title: 'จัดการ Payment Gateway', href: '/payment-gateway', icon: CreditCard },
  { id: 'wallet-manager', title: 'จัดการกระเป๋าเงิน', href: '/wallet-manager', icon: Wallet },
  { id: 'bank-settings', title: 'ตั้งค่าธนาคาร', href: '/bank-settings', icon: Landmark },
  { id: 'payment-accounts', title: 'บัญชีรับเงิน', href: '/payment-accounts', icon: QrCode },
  { id: 'withdraw-accounts', title: 'บัญชีถอนเงิน', href: '/withdraw-accounts', icon: ArrowDownToLine },
  { id: 'scb-maemanee', title: 'SCB แม่มณี', href: '/scb-maemanee', icon: Landmark },
  { id: 'finance-transactions', title: 'ธุรกรรมการเงิน', href: '/finance/transactions', icon: Receipt },
  { id: 'finance-reports', title: 'รายงานการเงิน', href: '/finance-reports', icon: FileBarChart },
];

// 4.5 ประวัติการเดิมพัน (แยกจากการเงิน)
const bettingHistoryItems = [
  { id: 'betting-history', title: 'ประวัติการเดิมพัน', href: '/betting/history', icon: Ticket },
  { id: 'betting-reports', title: 'รายงานการเดิมพัน', href: '/betting/reports', icon: FileBarChart },
];

// 5. หวย (รวมทุกอย่างที่เกี่ยวกับการคีย์หวยไว้ที่นี่)
const lotteryItems = [
  { id: 'admin-key', title: 'คีย์หวย', href: '/admin/key', icon: PenLine },
  { id: 'entries', title: 'รายการทั้งหมด', href: '/entries', icon: List },
  { id: 'lotteries', title: 'จัดการหวย', href: '/lotteries', icon: Ticket },
  { id: 'results', title: 'ผลหวย', href: '/results', icon: Trophy },
];

// 6. โปรโมชั่น
const promoItems = [
  { id: 'promotions', title: 'จัดการโปรโมชั่น', href: '/promotions', icon: Sparkles },
  { id: 'referrals', title: 'แนะนำลูกค้า', href: '/referrals', icon: Gift },
  { id: 'affiliate', title: 'ลิงก์แนะนำเพื่อน', href: '/affiliate', icon: Link2 },
  { id: 'agent-system', title: 'สายงานเอเย่นต์', href: '/agent-system', icon: Network },
];

// 7. การตลาด
const marketingItems = [
  { id: 'lead-users', title: 'ยูสนำแทง', href: '/lead-users', icon: Crown },
  { id: 'member-links', title: 'ลิงก์สมาชิก', href: '/member-links', icon: Link2 },
  { id: 'notifications', title: 'การแจ้งเตือน', href: '/notifications', icon: Bell },
  { id: 'content-pages', title: 'คู่มือ/กติกา', href: '/content-pages', icon: FileText },
];

// 7.1 ศูนย์การตลาด (Marketing Center)
const marketingCenterItems = [
  { id: 'marketing-lead-users', title: 'ยูสนำแทง', href: '/lead-users', icon: Crown },
  { id: 'marketing-center', title: 'ลิงก์ทั้งหมด', href: '/marketing-center', icon: Link2 },
  { id: 'marketing-agent', title: 'แดชบอร์ดเอเย่นต์', href: '/marketing-center/agent', icon: UsersRound },
  { id: 'marketing-member', title: 'หน้าหลักสมาชิก', href: '/marketing-center/member', icon: Users },
  { id: 'marketing-partner', title: 'หน้าข้อมูลพาร์ทเนอร์', href: '/marketing-center/partner', icon: Handshake },
  { id: 'qr-generator', title: 'สร้าง QR Code', href: '/marketing-center/qr-generator', icon: QrCode },
  { id: 'marketing-links', title: 'ลิงก์สมาชิก', href: '/member-links', icon: Link2 },
];

// 7.5. เอเย่น / Partner (รวมเมนูที่ซ้ำซ้อนให้กระชับ)
const agentPartnerItems = [
  { id: 'agents', title: 'รายชื่อเอเย่น', href: '/agents', icon: UsersRound },
  { id: 'agent-system', title: 'สายงานเอเย่นต์', href: '/agent-system', icon: Network },
  { id: 'agent-members', title: 'สมาชิกใต้สาย', href: '/agent-members', icon: Users },
  { id: 'agent-commissions', title: 'คอมมิชชั่น', href: '/agent-commissions', icon: DollarSign },
  { id: 'agent-reports', title: 'รายงาน', href: '/agent-reports', icon: BarChart3 },
  { id: 'agent-transfer', title: 'โยกย้ายลูกค้า', href: '/agent-transfer', icon: ArrowUpDown },
];

// 8. รายงาน
const reportItems = [
  { id: 'omni-channel', title: 'Omni-Channel', href: '/reports/omni-channel', icon: Globe },
  { id: 'daily-closing', title: 'รายงานย้อนหลัง', href: '/reports/daily-closing', icon: History },
  { id: 'kpi-dashboard', title: 'KPI Dashboard', href: '/kpi-dashboard', icon: Target },
  { id: 'analysis', title: 'วิเคราะห์ยอดเลข', href: '/analysis', icon: BarChart3 },
  { id: 'profit-loss', title: 'กำไร/ขาดทุน', href: '/profit-loss', icon: PieChart },
  { id: 'reports', title: 'รายงาน', href: '/reports', icon: FileDown },
];

// 9. ตั้งค่าเว็บ
const webSettingsItems = [
  { id: 'web-theme', title: 'ตั้งค่าธีม', href: '/web-theme', icon: Palette },
  { id: 'manage-images', title: 'จัดการรูปภาพ', href: '/manage-images', icon: Image },
  { id: 'desktop-settings', title: 'ตั้งค่าหน้าเว็บ', href: '/desktop-settings', icon: MonitorSmartphone },
  { id: 'settings', title: 'ตั้งค่าทั่วไป', href: '/settings', icon: Settings },
];

// 10. ความปลอดภัย (Super Admin)
const securityItems = [
  { id: 'users', title: 'จัดการผู้ใช้', href: '/users', icon: UsersRound },
  { id: 'roles-permissions', title: 'สิทธิ์การใช้งาน', href: '/roles-permissions', icon: Shield },
  { id: 'admin-attendance-report', title: 'รายงานเข้างานแอดมิน', href: '/admin-attendance-report', icon: Clock },
  { id: 'payroll', title: 'สรุปเงินเดือน', href: '/payroll', icon: Wallet },
  { id: 'security-dashboard', title: 'Security Dashboard', href: '/security-dashboard', icon: ShieldAlert },
  { id: '2fa', title: 'ยืนยันตัวตน 2 ชั้น (2FA)', href: '/security/2fa', icon: Smartphone },
  { id: 'audit-logs', title: 'ประวัติการใช้งาน', href: '/audit-logs', icon: History },
  { id: 'backup', title: 'สำรองข้อมูล', href: '/backup', icon: Database },
  { id: 'health-check', title: 'Health Check', href: '/health-check', icon: Activity },
];

// 11. เครือข่าย (Super Admin)
const networkItems = [
  { id: 'master-credit', title: 'เครดิตแม่', href: '/master-credit', icon: Infinity },
  { id: 'network-agent-system', title: 'สายงานเอเย่นต์', href: '/agent-system', icon: Network },
  { id: 'partners', title: 'หุ้นส่วน', href: '/partners', icon: Handshake },
];

// 12. ระบบคีย์หวย (Manual Key)
const manualKeyItems = [
  { id: 'manual-key', title: 'ภาพรวมคีย์หวย', href: '/manual-key', icon: Keyboard },
  { id: 'manual-key-entry', title: 'คีย์โพย', href: '/admin/key', icon: PenLine },
  { id: 'manual-key-entries', title: 'รายการคีย์หวย', href: '/manual-key/entries', icon: List },
  { id: 'manual-key-customers', title: 'ลูกค้าคีย์หวย', href: '/manual-key/customers', icon: Users },
  { id: 'manual-key-rates', title: 'ตั้งค่าเรท', href: '/manual-key/rates', icon: DollarSign },
];

// 12.1 Agent Terminal (รวมเข้าไปใน หวย แล้ว - ใช้ /entry)
// ลบออกเพื่อลดความซ้ำซ้อน - ให้เอเย่นต์ใช้ หวย > คีย์หวย แทน

// === AGENT DASHBOARD MENUS (แยกจาก Admin) ===
// เมนูสำหรับ Agent โดยเฉพาะ - ใช้ menu_ids ตรงกับ tier_permissions
const agentDashboardItem = {
  id: 'dashboard',
  title: 'Dashboard',
  href: '/',
  icon: LayoutDashboard,
};

// Agent Operation Items - ใช้ menu_ids จาก tier_permissions
const agentOperationItems = [
  { id: 'attendance', title: 'ลงเวลางาน', href: '/attendance', icon: Clock },
  { id: 'prize-payout', title: 'จ่ายรางวัลลูกค้าคีย์', href: '/prize-payout', icon: Trophy },
];

// Agent Downline Items - ยังคงเดิม (ถ้ามีใน tier_permissions)
const agentDownlineItems = [
  { id: 'agent-members', title: 'ลูกค้าใต้สาย', href: '/agent-members', icon: Users },
  { id: 'agent-commission', title: 'คอมมิชชั่น', href: '/agent/commission', icon: DollarSign },
  { id: 'agent-profit-loss', title: 'รายงานแพ้ชนะ', href: '/agent-profit-loss', icon: PieChart },
  { id: 'agent-withdraw-history', title: 'ถอนคอมมิชชั่น', href: '/agent-withdraw-history', icon: ArrowDownToLine },
];

// Agent Key Items - ใช้ menu_ids ตรงกับ tier_permissions (manual-key-*)
const agentBettingItems = [
  { id: 'manual-key', title: 'ภาพรวมคีย์หวย', href: '/manual-key', icon: Keyboard },
  { id: 'manual-key-entry', title: 'คีย์โพย', href: '/admin/key', icon: PenLine },
  { id: 'manual-key-entries', title: 'รายการคีย์หวย', href: '/manual-key/entries', icon: List },
  { id: 'manual-key-customers', title: 'ลูกค้าคีย์หวย', href: '/manual-key/customers', icon: Users },
  { id: 'results', title: 'ผลหวย', href: '/results', icon: Trophy },
];

// === SUB-AGENT MENUS (พนักงานคีย์หวย) ===
// เมนูเฉพาะระดับ (Manual Key) สำหรับ Sub-Agent - 4 เมนู
const subAgentKeyItems = [
  { id: 'sub-agent-key-daily', title: 'หน้าจอคีย์���ลขหวยรายวัน', href: '/sub-agent/key-daily', icon: PenLine },
  { id: 'sub-agent-key-history', title: 'ประวัติการคีย์วันนี้', href: '/sub-agent/key-history', icon: History },
  { id: 'sub-agent-customer-list', title: 'รายชื่อลูกค้า', href: '/sub-agent/customers', icon: Users },
  { id: 'sub-agent-results', title: 'ดูผลหวย', href: '/sub-agent/results', icon: Trophy },
];

// 12.2 สายงานเอเย่นต์ Manual (Manual Downline Management)
const manualDownlineItems = [
  { id: 'manual-downline', title: 'โครงสร้างสายงาน', href: '/manual-downline', icon: GitBranch },
  { id: 'manual-downline-credit', title: 'จัดการเครดิต', href: '/manual-downline/credit', icon: CreditCard },
  { id: 'manual-downline-commission', title: 'ตั้งค่า PT/คอม', href: '/manual-downline/commission', icon: Percent },
  { id: 'manual-downline-members', title: 'รายชื่อลูกค้า', href: '/manual-downline/members', icon: Users },
  { id: 'manual-downline-report', title: 'รายงานแพ้ชนะ', href: '/manual-downline/report', icon: BarChart3 },
];

// 13. ระบบออโต้ (Auto)
const autoSystemItems = [
  { id: 'auto-system', title: 'ภาพรวมออโต้', href: '/auto-system', icon: Zap },
  { id: 'auto-system-entries', title: 'รายการออโต้', href: '/auto-system/entries', icon: List },
  { id: 'auto-system-customers', title: 'ลูกค้าออโต้', href: '/auto-system/customers', icon: Users },
  { id: 'auto-system-settings', title: 'ตั้งค่าออโต้', href: '/auto-system/settings', icon: Settings },
];

// 14. สายง������������เอเย่นต์ (รวม ออโต้ และ คีย์หวย)
const agentSystemItems = [
  { id: 'agent-system-manage', title: '���ัดการเอเย่นต์', href: '/agent-system', icon: UsersRound },
  { id: 'agent-system-members', title: 'จัดการพนักงาน/ทีมงาน', href: '/agent-system/members', icon: Users },
  { id: 'agent-system-commission', title: 'คอมมิชชั่น', href: '/agent-system/commission', icon: DollarSign },
  { id: 'agent-system-bank-settings', title: 'ตั้งค่าธนาคาร', href: '/agent-system/bank-settings', icon: Building2 },
  { id: 'agent-system-site-settings', title: 'ตั้งค่าเว็บลูก', href: '/agent-system/site-settings', icon: Settings },
  { id: 'agent-system-settlement', title: 'ส่งยอดเข้าเว็บกลาง', href: '/agent-system/settlement', icon: Send },
  { id: 'agent-system-report', title: 'รายงาน', href: '/agent-system/report', icon: BarChart3 },
];

// 16. การตลาดคีย์หวย
const manualKeyMarketingItems = [
  { id: 'manual-key-marketing', title: 'ภาพรวม', href: '/manual-key-marketing', icon: Target },
  { id: 'manual-key-marketing-campaigns', title: 'แคมเปญ', href: '/manual-key-marketing/campaigns', icon: Megaphone },
  { id: 'manual-key-marketing-links', title: 'ลิงก์สมัคร', href: '/manual-key-marketing/links', icon: Link2 },
  { id: 'manual-key-marketing-report', title: 'รายงาน', href: '/manual-key-marketing/report', icon: BarChart3 },
];

// 17. การตลาดออโต้
const autoMarketingItems = [
  { id: 'auto-marketing', title: 'ภาพรวม', href: '/auto-marketing', icon: Target },
  { id: 'auto-marketing-campaigns', title: 'แคมเปญ', href: '/auto-marketing/campaigns', icon: Megaphone },
  { id: 'auto-marketing-links', title: 'ลิงก์สมัคร', href: '/auto-marketing/links', icon: Link2 },
  { id: 'auto-marketing-report', title: 'รายงาน', href: '/auto-marketing/report', icon: BarChart3 },
];

// 18. หุ้นลม / Credit Line
const creditLineItems = [
  { id: 'credit-line', title: 'ภาพรวม Credit Line', href: '/credit-line', icon: Scale },
  { id: 'credit-line-manage', title: 'จัดการหุ้นลม', href: '/credit-line/manage', icon: Coins },
  { id: 'credit-line-history', title: 'ประวัติ', href: '/credit-line/history', icon: History },
  { id: 'credit-line-settings', title: 'ตั้งค่า', href: '/credit-line/settings', icon: Settings },
];

// 19. รายงานเปรียบเทียบ
const comparisonReportItems = [
  { id: 'comparison-report', title: 'เปรียบเทียบ คีย์หวย vs ออโต้', href: '/comparison-report', icon: FileBarChart },
  { id: 'comparison-report-daily', title: 'รายงานรายวัน', href: '/comparison-report/daily', icon: BarChart3 },
  { id: 'comparison-report-monthly', title: 'รายงานรายเดือน', href: '/comparison-report/monthly', icon: PieChart },
];

// 19.3 ศูนย์แอดมิน (สำหรับ member/พนักงาน)
  const memberAdminItems = [
  { id: 'member-summary', title: 'สรุปยอด', href: '/member/summary', icon: BarChart3 },
  { id: 'member-finance', title: 'การเงิน', href: '/member/finance', icon: Wallet },
  { id: 'member-slip-upload', title: 'อัปโหลดสลิป / ถอนเงิน', href: '/member/slip-upload', icon: Upload },
  ];

// 19.5 จัดการพนักงาน/แอดมิน (เว็บแม่และเอเย่นต์ดูได้)
const staffManagementItems = [
  { id: 'admin-attendance-report', title: 'รายงานเข้างานแอดมิน', href: '/admin-attendance-report', icon: Clock },
  { id: 'admin-performance', title: 'ตรวจสอบการทำงาน', href: '/admin-performance', icon: ClipboardCheck },
  { id: 'staff-performance', title: 'Staff Performance', href: '/staff-performance', icon: TrendingUp },
  { id: 'payroll', title: 'สรุปเงินเดือน', href: '/payroll', icon: Wallet },
  { id: 'payroll-settings', title: 'ตั้งค่า Payroll', href: '/payroll/settings', icon: Settings },
  { id: 'ot-report', title: 'รายงานโอที', href: '/payroll/ot-report', icon: Clock },
  { id: 'admin-sales-report', title: 'รายงานยอดแอดมิน', href: '/admin-sales-report', icon: BarChart3 },
];

// 20. Super Admin - เจ้าของระบบ (เว็บแม่เท่านั้น)
const superAdminItems = [
  { title: 'จัดการสายงาน', href: '/super-admin/downline', icon: Crown },
  // REMOVED: ตั้งค่าการมองเห็นเอเย่น and ตั้งค่าการมองเห็นแมมเบอร์ - now consolidated into /roles-permissions
  { title: 'ควบคุมความเสี่ยง', href: '/risk-management', icon: TrendingUp },
  { title: 'Master Control', href: '/master-control', icon: Shield },
  { title: 'ตั้งค่าระบบ', href: '/settings/system', icon: Settings },
];

// 20.1 ถ่ายทอดสด (Admin เห็นได้)
const liveStreamItems = [
  { title: 'ถ่ายทอดสด', href: '/live-draw', icon: Tv },
  { title: 'Global Live Stream', href: '/live-stream', icon: Radio },
  { title: 'บอทประกาศผล', href: '/result-announcement', icon: Bot },
];

// 21. Multi-Tenant / White Label Management (Super Admin Only)
const multiTenantItems = [
  { title: 'Dashboard ยอดรวม', href: '/multi-tenant/dashboard', icon: BarChart3 },
  { title: 'รายการส่งยอด', href: '/multi-tenant/settlements', icon: Receipt },
  { title: 'Enterprise Summary', href: '/enterprise-summary', icon: Crown },
  { title: 'จัดการเว็บลูก', href: '/sub-sites', icon: Globe },
  { title: 'VIP Dashboard', href: '/vip-dashboard', icon: Crown },
  { title: 'Billion Dashboard', href: '/billion-dashboard', icon: TrendingUp },
  { title: 'Tenant Manager', href: '/tenant-manager', icon: Globe },
  { title: 'Site Manager', href: '/site-manager', icon: Globe },
  { title: 'Branding/Theme', href: '/site-manager/branding', icon: Palette },
  { title: 'เรท/อั้นกลาง', href: '/master-rates', icon: DollarSign },
  { title: 'Financial Hub', href: '/financial-hub', icon: Wallet },
  { title: 'Risk Control', href: '/risk-control', icon: Shield },
  { title: 'API Docs', href: '/api-docs', icon: FileText },
];

interface MenuSection {
  title: string;
  icon: React.ElementType;
  items: Array<{
    id?: string;
    title: string;
    href: string;
    icon: React.ElementType;
    badgeKey?: 'topupPending' | 'withdrawPending' | 'depositIssuesPending' | 'newCustomersToday';
  }>;
  defaultOpen?: boolean;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  masterOnly?: boolean; // เฉพาะเว็บแม่เท่านั้น
  agentOnly?: boolean;
  subAgentOnly?: boolean; // เฉพาะ Sub-Agent (พนักงานคีย์หวย)
  agentVisible?: boolean; // ถ้า true = agent เห็นได้ (เว็บแม่อนุญาต)
  memberVisible?: boolean; // ถ้า true = member เห็นได้
  staffVisible?: boolean; // ถ้า true = staff (พนักงาน) เห็นได้
}

// STABLE VERSION - จัดระเบียบแล้ว (ลบเมนูซ้ำซ้อน)
// แยก Dashboard ตาม Role:
// - super_admin, admin: เห็นทุกเมนู
// - agent: เห็นเฉพาะเมนู agentVisible (ข้อมูลลูกค้าใต้สาย, คอมมิชชั่นตัวเอง)
// - member: เห็นเฉพาะเมนูสำหรับทำงาน (ศูนย์ปฏิบัติการ, หวย)
const menuSections: MenuSection[] = [
  // === ADMIN MENUS (เฉพาะ Admin/Super Admin) ===
  { title: 'ศูนย์ปฏิบัติการ', icon: Headphones, items: operationItems, defaultOpen: true, adminOnly: true, staffVisible: true, memberVisible: true },
  { title: 'ศูนย์แอดมิน', icon: User, items: memberAdminItems, defaultOpen: false, adminOnly: true },
  { title: 'ลูกค้าแทงหวย', icon: Users, items: memberItems, defaultOpen: false, adminOnly: true, staffVisible: true },
  { title: 'ธุรกรรมการเงิน', icon: Wallet, items: financeItems, defaultOpen: false, adminOnly: true, staffVisible: true, memberVisible: true },
  { title: 'ประวัติการเดิมพัน', icon: Ticket, items: bettingHistoryItems, defaultOpen: false, adminOnly: true, staffVisible: true },
  { title: 'หวย', icon: Ticket, items: lotteryItems, defaultOpen: false, adminOnly: true, staffVisible: true, memberVisible: true },
  { title: 'ระบบออโต้', icon: Zap, items: autoSystemItems, defaultOpen: false, adminOnly: true },
  { title: 'ระบบคีย์หวย', icon: Keyboard, items: manualKeyItems, defaultOpen: false, adminOnly: true },
  { title: 'สายงานเอเย่นต์', icon: GitBranch, items: agentSystemItems, defaultOpen: false, adminOnly: true },
  { title: 'โปรโมชั่น', icon: Sparkles, items: promoItems, defaultOpen: false, adminOnly: true },
  { title: 'ศูนย์การตลาด', icon: Megaphone, items: marketingCenterItems, defaultOpen: false, adminOnly: true },
  { title: 'รายงาน', icon: BarChart3, items: reportItems, defaultOpen: false, adminOnly: true, staffVisible: true },
  { title: 'จัดการพนักงาน', icon: UsersRound, items: staffManagementItems, defaultOpen: false, adminOnly: true },
  { title: 'ตั้งค่าเว็บ', icon: Settings, items: webSettingsItems, defaultOpen: false, adminOnly: true },
  { title: 'ไลฟ์สด', icon: Tv, items: liveStreamItems, defaultOpen: false, adminOnly: true },
  { title: 'Multi-Tenant', icon: Globe, items: multiTenantItems, defaultOpen: false, superAdminOnly: true, masterOnly: true },
  { title: 'Super Admin', icon: Crown, items: superAdminItems, defaultOpen: false, superAdminOnly: true },
  { title: 'ความปลอดภัย', icon: Shield, items: securityItems, defaultOpen: false, superAdminOnly: true },
  
  // === AGENT MENUS (เฉพาะ Agent) ===
  { title: 'ศูนย์การเงิน', icon: Wallet, items: agentOperationItems, defaultOpen: true, agentOnly: true },
  { title: 'ลูกค้าใต้สาย', icon: Users, items: agentDownlineItems, defaultOpen: false, agentOnly: true },
  { title: 'คีย์หวย', icon: Ticket, items: agentBettingItems, defaultOpen: false, agentOnly: true },
  
  // === SUB-AGENT MENUS (เฉพาะ Sub-Agent / พนักงานคีย์หวย) ===
  { title: 'เมนูเฉพาะระดับ (Manual Key)', icon: Keyboard, items: subAgentKeyItems, defaultOpen: true, subAgentOnly: true },
];

// HIDDEN MENUS (ยังไม่พร้อม - จะเปิดเมื่อพัฒนาเสร็จ):
// - ระบบคีย์หว��� (manualKeyItems)
// - สายงานคีย์หวย (manualKeyAgentItems)
// - การตลาดคีย์หวย (manualKeyMarketingItems)
// - การตลาดออโต้ (autoMarketingItems)
// - หุ้นลม / Credit Line (creditLineItems)
// - รายงานเปรียบเทียบ (comparisonReportItems)

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout, canAccess, canSeeMenu, isSuperAdmin, isAdmin, isMasterBranch } = useAuth();
  
  // Fetch pending counts with auto-refresh every 5 seconds
  const { data: pendingCounts } = useSWR<PendingCounts>(
    '/api/admin/pending-counts',
    fetcher,
    { refreshInterval: 5000 }
  );

  // Determine user's tier for permissions
  const getUserTier = () => {
    if (user?.role === 'agent' || user?.role === 'agent_key' || 
        user?.role === 'partner' || user?.user_type === 'manual_key_agent') {
      return 'agent';
    }
    if (user?.role === 'sub_agent') return 'sub_agent';
    if (user?.role === 'master_agent') return 'master';
    return 'internal'; // default for staff/admin
  };
  const userTier = getUserTier();

  // Fetch tier permissions from database (includes all tiers)
  const { data: tierPermissionsData } = useSWR<{ 
    permissions: Array<{ tier: string; menu_id: string; can_view: boolean }> 
  }>(
    user ? '/api/tier-permissions' : null,
    fetcher
  );

  // Get allowed menu_ids for current user's tier
  const dbAllowedMenus = (tierPermissionsData?.permissions || [])
    .filter(p => p.tier === userTier && p.can_view)
    .map(p => p.menu_id);

  // Track open sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    menuSections.forEach(section => {
      initial[section.title] = section.defaultOpen || false;
    });
    return initial;
  });

  const toggleSection = (title: string) => {
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const handleLogout = async () => {
    await logout();
    toast.success('ออกจากระบบสำเร็จ');
  };

  // Check if user is agent (includes agent_key, partner, and manual_key_agent)
  const isAgent = userTier === 'agent';
  const isSubAgent = userTier === 'sub_agent';
  const isMasterAgent = userTier === 'master';
  const isMember = user?.role === 'member';
  const isStaff = user?.role === 'staff';
  
  // Get user's visible menus from session (loaded at login)
  // For non-agents, this comes from users.visible_menus column
  const userVisibleMenus = user?.visible_menus || [];
  const userHiddenMenus = user?.hidden_menus || [];
  const hasMenuRestrictions = userVisibleMenus.length > 0;

  // Helper to check if a menu item is visible based on user's permissions
  // For agents: uses menu_id from tier_permissions table ONLY (no fallback)
  // For others: uses href matching
  const isMenuVisible = (itemId: string | undefined, href: string): boolean => {
    // For agents: match by item.id against tier_permissions menu_id
    if (isAgent || isSubAgent || isMasterAgent) {
      // Use DB permissions ONLY - no hardcoded fallback
      if (dbAllowedMenus.length > 0) {
        // Primary: match by item.id (recommended)
        if (itemId && dbAllowedMenus.includes(itemId)) {
          return true;
        }
        // Fallback: try to match by href patterns
        const menuKey = href.startsWith('/') ? href.slice(1) : href;
        const isAllowed = dbAllowedMenus.some(permKey => {
          return menuKey === permKey || 
                 menuKey.startsWith(permKey + '/') ||
                 menuKey.startsWith(permKey + '-') ||
                 href === '/' + permKey ||
                 href.startsWith('/' + permKey + '/');
        });
        return isAllowed;
      }
      // If DB permissions not loaded, only show Dashboard (href === '/')
      return href === '/';
    }
    
    // For non-agents: use original href-based logic
    const menuKey = href.startsWith('/') ? href.slice(1) : href;
    
    // Check if menu is in hidden list
    if (userHiddenMenus.includes(href) || userHiddenMenus.includes(menuKey)) {
      return false;
    }
    
    // If no menu restrictions, allow (for admins)
    if (!hasMenuRestrictions) return true;
    
    // Check if menu is in visible_menus list (match both formats)
    return userVisibleMenus.includes(href) || userVisibleMenus.includes(menuKey);
  };

  // Filter sections based on user role and branch type
  const visibleSections = menuSections.filter(section => {
    // Master only sections - hide from sub-sites (web ลูก)
    if (section.masterOnly && !isMasterBranch && !isSuperAdmin) return false;
    
    // Super Admin only sections
    if (section.superAdminOnly && !isSuperAdmin) return false;
    
    // === AGENT/SUB-AGENT/MASTER: Filter based on DATABASE permissions ===
    if (isAgent || isSubAgent || isMasterAgent) {
      // Check if ANY item in this section is allowed by DB permissions
      const hasAllowedItems = section.items.some(item => isMenuVisible(item.id, item.href));
      return hasAllowedItems;
    }
    
    // === MEMBER: เห็นเฉพาะ memberVisible sections ===
    if (isMember) {
      return section.memberVisible === true;
    }
    
    // === STAFF (พนักงาน): เห็นเฉพาะ staffVisible sections ===
    if (isStaff) {
      return section.staffVisible === true;
    }
    
    // === ADMIN / SUPER ADMIN: เห็นทุกเมนูยกเว้น agentOnly และ subAgentOnly ===
    if (section.agentOnly && !isAgent) {
      return false;
    }
    
    // Sub-Agent only sections - hide from non-sub-agents
    if (section.subAgentOnly && !isSubAgent) {
      return false;
    }
    
    // Admin only sections
    if (section.adminOnly) {
      return isAdmin || isSuperAdmin;
    }
    
    return true;
  }).map(section => {
    // Filter items within each section based on permissions
    if (isAgent || isSubAgent || isMasterAgent || (hasMenuRestrictions && !isSuperAdmin && !isAdmin)) {
      const filteredItems = section.items.filter(item => isMenuVisible(item.id, item.href));
      return { ...section, items: filteredItems };
    }
    return section;
  }).filter(section => section.items.length > 0);

  return (
    <Sidebar className="bg-black">
      <SidebarHeader className="border-b border-[rgba(212,175,55,0.2)] p-4 bg-black">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] via-[#F5D061] to-[#B8860B] shadow-[0_0_20px_rgba(212,175,55,0.5)]">
            <Crown className="size-5 text-black drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)]" />
            <div className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-[#22C55E] border-2 border-black animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold bg-gradient-to-r from-[#F5D061] via-[#D4AF37] to-[#B8860B] bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(212,175,55,0.5)]">
              FIN LOTTO R+
            </span>
            <span className="text-[10px] tracking-widest text-[#D4AF37]/80 font-medium">
              PREMIUM ADMIN
            </span>
          </div>
        </Link>
      </SidebarHeader>
      
      <SidebarContent className="px-2 bg-black">
        {/* 1. Dashboard - แยกตาม role */}
        <SidebarGroup className="py-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === (isAgent ? agentDashboardItem.href : dashboardItem.href)}
                tooltip={isAgent ? agentDashboardItem.title : dashboardItem.title}
                className="h-10 hover:bg-[rgba(212,175,55,0.1)] data-[active=true]:bg-[rgba(212,175,55,0.15)] data-[active=true]:border-l-2 data-[active=true]:border-[#D4AF37]"
              >
                <Link href={isAgent ? agentDashboardItem.href : dashboardItem.href}>
                  {isAgent ? (
                    <agentDashboardItem.icon className="size-4 text-[#D4AF37] drop-shadow-[0_0_4px_rgba(212,175,55,0.5)]" />
                  ) : (
                    <dashboardItem.icon className="size-4 text-[#D4AF37] drop-shadow-[0_0_4px_rgba(212,175,55,0.5)]" />
                  )}
                  <span className="font-medium text-[#E5E5E5]">
                    {isAgent ? agentDashboardItem.title : dashboardItem.title}
                  </span>
                  {!isAgent && pendingCounts && pendingCounts.totalPending > 0 && (
                    <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1 text-xs shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                      {pendingCounts.totalPending > 99 ? '99+' : pendingCounts.totalPending}
                    </Badge>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {/* ลงเวลางาน - สำหรับแอดมินทุกคน */}
            {(isAdmin || isSuperAdmin) && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === attendanceItem.href}
                  tooltip={attendanceItem.title}
                  className="h-10 hover:bg-[rgba(212,175,55,0.1)] data-[active=true]:bg-[rgba(212,175,55,0.15)] data-[active=true]:border-l-2 data-[active=true]:border-[#D4AF37]"
                >
                  <Link href={attendanceItem.href}>
                    <attendanceItem.icon className="size-4 text-green-500 drop-shadow-[0_0_4px_rgba(34,197,94,0.5)]" />
                    <span className="font-medium text-[#E5E5E5]">{attendanceItem.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroup>

        {/* Collapsible Sections */}
        {visibleSections.map((section) => (
          <Collapsible
            key={section.title}
            open={openSections[section.title]}
            onOpenChange={() => toggleSection(section.title)}
          >
            <SidebarGroup className="py-0">
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer hover:bg-[rgba(212,175,55,0.08)] rounded-md px-2 py-2 flex items-center justify-between group transition-colors">
                  <span className="flex items-center gap-2 text-xs font-semibold text-[#D4AF37]/80 uppercase tracking-wider">
                    <section.icon className="size-3.5 text-[#D4AF37] drop-shadow-[0_0_3px_rgba(212,175,55,0.4)]" />
                    {section.title}
                  </span>
                  <ChevronDown className={`size-3.5 text-[#D4AF37]/60 transition-transform duration-200 ${openSections[section.title] ? 'rotate-180' : ''}`} />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => {
                      const badgeCount = item.badgeKey && pendingCounts ? pendingCounts[item.badgeKey] : 0;
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            asChild
                            isActive={pathname === item.href}
                            tooltip={item.title}
                            className="h-9 hover:bg-[rgba(212,175,55,0.08)] data-[active=true]:bg-black data-[active=true]:border data-[active=true]:border-[#D4AF37]/50 data-[active=true]:shadow-[0_0_10px_rgba(212,175,55,0.2)] data-[active=true]:rounded-md"
                          >
                            <Link 
                              href={item.href} 
                              className="flex items-center justify-between w-full"
                            >
                              <span className="flex items-center gap-2">
                                <item.icon className="size-4 text-[#D4AF37] drop-shadow-[0_0_6px_rgba(212,175,55,0.6)]" />
                                <span className="text-[#F5F5F5] font-medium">{item.title}</span>
                              </span>
                              {badgeCount > 0 && (
                                <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1 text-xs animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]">
                                  {badgeCount > 99 ? '99+' : badgeCount}
                                </Badge>
                              )}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>
      
      <SidebarFooter className="border-t border-[rgba(212,175,55,0.2)] p-4 space-y-3 bg-black">
        {/* Current User */}
        {user && (
          <div className="flex items-center gap-3 p-2 rounded-lg bg-[rgba(212,175,55,0.05)] border border-[rgba(212,175,55,0.2)]">
            <div className={`size-8 rounded-full flex items-center justify-center ${
              isSuperAdmin 
                ? 'bg-gradient-to-br from-[#D4AF37] via-[#F5D061] to-[#B8860B] shadow-[0_0_12px_rgba(212,175,55,0.6)]' 
                : isAdmin 
                  ? 'bg-gradient-to-br from-[#D4AF37] to-[#B8860B] shadow-[0_0_8px_rgba(212,175,55,0.4)]' 
                  : 'bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] border border-[rgba(212,175,55,0.3)]'
            }`}>
              {isSuperAdmin ? (
                <Crown className="size-4 text-black drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)]" />
              ) : isAdmin ? (
                <ShieldCheck className="size-4 text-black" />
              ) : (
                <Users className="size-4 text-[#D4AF37]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-[#E5E5E5]">{user.displayName}</p>
              <p className="text-xs text-[#D4AF37] drop-shadow-[0_0_4px_rgba(212,175,55,0.3)]">
                {isSuperAdmin ? 'Super Admin' : isAdmin ? 'ผู้ดูแลระบบ' : isMasterAgent ? 'มาสเตอร์เอเย่นต์' : isAgent ? 'เอเย่นต์' : isSubAgent ? 'ซับเอเย่นต์' : isMember ? 'แมมเบอร์' : isStaff ? 'พนักงาน' : 'ผู้ใช้'}
              </p>
            </div>
          </div>
        )}
        
        {/* Logout Button */}
        <Button
          variant="outline"
          className="w-full justify-start border-[rgba(212,175,55,0.2)] text-[#888888] hover:text-[#EF4444] hover:border-[rgba(239,68,68,0.5)] hover:bg-[rgba(239,68,68,0.1)] bg-transparent"
          onClick={handleLogout}
        >
          <LogOut className="size-4 mr-2" />
          ออกจากระบบ
        </Button>
        
        <div className="text-xs text-center space-y-1">
          <p className="font-bold bg-gradient-to-r from-[#F5D061] via-[#D4AF37] to-[#B8860B] bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]">FIN LOTTO R+</p>
          <p className="text-[#555555]">Premium Admin v2.0</p>
          <p className="text-[#444444] text-[10px]">Build: d6bf199-{new Date().toISOString().slice(0,10)}</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
