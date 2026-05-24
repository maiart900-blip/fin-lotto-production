'use client';

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
  Target,
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

const fetcher = (url: string) => fetch(url).then(res => res.json());

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
  title: 'ลงเวลางาน',
  href: '/attendance',
  icon: Clock,
};

// 1. Dashboard (ไม่มี submenu) - หน้า Dashboard คือ / (main page)
const dashboardItem = {
  title: 'Dashboard',
  href: '/',
  icon: LayoutDashboard,
};

// 2. ศูนย์ปฏิบัติการแอดมิน
const operationItems = [
  { title: 'คำขอเติมเงิน', href: '/topup-requests', icon: CreditCard, badgeKey: 'topupPending' as const },
  { title: 'คำขอถอนเงิน', href: '/withdraw-requests', icon: ArrowDownToLine, badgeKey: 'withdrawPending' as const },
  { title: 'จ่ายรางวัลลูกค้าคีย์', href: '/prize-payout', icon: Trophy },
  { title: 'ปรับยอดเครดิต', href: '/credits', icon: Wallet },
  { title: 'แจ้งปัญหาฝากเงิน', href: '/deposit-issues', icon: AlertTriangle, badgeKey: 'depositIssuesPending' as const },
  { title: 'รายการรอตรวจสอบ', href: '/pending-review', icon: ClipboardCheck },
];

// 3. สมาชิก
const memberItems = [
  { title: 'รายชื่อสมาชิก', href: '/customers', icon: Users },
  { title: 'ประวัติสมาชิก', href: '/customer-history', icon: History },
  { title: 'ธนาคารลูกค้า', href: '/customer-banks', icon: Landmark },
  { title: 'สรุปแมมเบอร์', href: '/member-summary', icon: UsersRound },
];

// 4. บัญชีและการเงิน
const financeItems = [
  { title: 'จัดการ Payment Gateway', href: '/payment-gateway', icon: CreditCard },
  { title: 'จัดการกระเป๋าเงิน', href: '/wallet-manager', icon: Wallet },
  { title: 'ตั้งค่าธนาคาร', href: '/bank-settings', icon: Landmark },
  { title: 'บัญชีรับเงิน', href: '/payment-accounts', icon: QrCode },
  { title: 'บัญชีถอนเงิน', href: '/withdraw-accounts', icon: ArrowDownToLine },
  { title: 'SCB แม่มณี', href: '/scb-maemanee', icon: Landmark },
  { title: 'ประวัติธุรกรรม', href: '/transactions', icon: Receipt },
  { title: 'รายงานการเงิน', href: '/finance-reports', icon: FileBarChart },
];

// 5. หวย (รวมทุกอย่างที่เกี่ยวกับการคีย์หวยไว้ที่นี่)
const lotteryItems = [
  { title: 'คีย์หวย', href: '/admin/key', icon: PenLine },
  { title: 'รายการทั้งหมด', href: '/entries', icon: List },
  { title: 'จัดการหวย', href: '/lotteries', icon: Ticket },
  { title: 'ผลหวย', href: '/results', icon: Trophy },
];

// 6. โปรโมชั่น
const promoItems = [
  { title: 'จัดการโปรโมชั่น', href: '/promotions', icon: Sparkles },
  { title: 'แนะนำลูกค้า', href: '/referrals', icon: Gift },
  { title: 'ลิงก์แนะนำเพื่อน', href: '/affiliate', icon: Link2 },
  { title: 'สายงานเอเย่นต์', href: '/agent-system', icon: Network },
];

// 7. การตลาด
const marketingItems = [
  { title: 'ยูสนำแทง', href: '/lead-users', icon: Crown },
  { title: 'ลิงก์สมาชิก', href: '/member-links', icon: Link2 },
  { title: 'การแจ้งเตือน', href: '/notifications', icon: Bell },
  { title: 'คู่มือ/กติกา', href: '/content-pages', icon: FileText },
];

// 7.1 ศูนย์การตลาด (Marketing Center)
const marketingCenterItems = [
  { title: 'ยูสนำแทง', href: '/lead-users', icon: Crown },
  { title: 'ลิงก์ทั้งหมด', href: '/marketing-center', icon: Link2 },
  { title: 'แดชบอร์ดเอเย่นต์', href: '/marketing-center/agent', icon: UsersRound },
  { title: 'หน้าหลักสมาชิก', href: '/marketing-center/member', icon: Users },
  { title: 'หน้าข้อมูลพาร์ทเนอร์', href: '/marketing-center/partner', icon: Handshake },
  { title: 'สร้าง QR Code', href: '/marketing-center/qr-generator', icon: QrCode },
  { title: 'ลิงก์สมาชิก', href: '/member-links', icon: Link2 },
];

// 7.5. เอเย่น / Partner (รวมเมนูที่ซ้ำซ้อนให้กระชับ)
const agentPartnerItems = [
  { title: 'รายชื่อเอเย่น', href: '/agents', icon: UsersRound },
  { title: 'สายงานเอเย่นต์', href: '/agent-system', icon: Network },
  { title: 'สมาชิกใต้สาย', href: '/agent-members', icon: Users },
  { title: 'คอมมิชชั่น', href: '/agent-commissions', icon: DollarSign },
  { title: 'รายงาน', href: '/agent-reports', icon: BarChart3 },
  { title: 'โยกย้ายลูกค้า', href: '/agent-transfer', icon: ArrowUpDown },
];

// 8. รายงาน
const reportItems = [
  { title: 'Omni-Channel', href: '/reports/omni-channel', icon: Globe },
  { title: 'รายงานย้อนหลัง', href: '/reports/daily-closing', icon: History },
  { title: 'วิเคราะห์ยอดเลข', href: '/analysis', icon: BarChart3 },
  { title: 'กำไร/ขาดทุน', href: '/profit-loss', icon: PieChart },
  { title: 'รายงาน', href: '/reports', icon: FileDown },
];

// 9. ตั้งค่าเว็บ
const webSettingsItems = [
  { title: 'ตั้งค่าธีม', href: '/web-theme', icon: Palette },
  { title: 'จัดการรูปภาพ', href: '/manage-images', icon: Image },
  { title: 'ตั้งค่าหน้าเว็บ', href: '/desktop-settings', icon: MonitorSmartphone },
  { title: 'ตั้งค่าทั่วไป', href: '/settings', icon: Settings },
];

// 10. ความปลอดภัย (Super Admin)
const securityItems = [
  { title: 'จัดการผู้ใช้', href: '/users', icon: UsersRound },
  { title: 'สิทธิ์การใช้งาน', href: '/roles-permissions', icon: Shield },
  { title: 'รายงานเข้างานแอดมิน', href: '/admin-attendance-report', icon: Clock },
  { title: 'สรุปเงินเดือน', href: '/payroll', icon: Wallet },
  { title: 'Security Dashboard', href: '/security-dashboard', icon: ShieldAlert },
  { title: 'ยืนยันตัวตน 2 ชั้น (2FA)', href: '/security/2fa', icon: Smartphone },
  { title: 'ประวัติการใช้งาน', href: '/audit-logs', icon: History },
  { title: 'สำรองข้อมูล', href: '/backup', icon: Database },
  { title: 'Health Check', href: '/health-check', icon: Activity },
];

// 11. เครือข่าย (Super Admin)
const networkItems = [
  { title: 'เครดิตแม่', href: '/master-credit', icon: Infinity },
  { title: 'สายงานเอเย่นต์', href: '/agent-system', icon: Network },
  { title: 'หุ้นส่วน', href: '/partners', icon: Handshake },
];

// 12. ระบบคีย์หวย (Manual Key)
const manualKeyItems = [
  { title: 'ภาพรวมคีย์หวย', href: '/manual-key', icon: Keyboard },
  { title: 'คีย์โพย', href: '/admin/key', icon: PenLine },
  { title: 'รายการคีย์หวย', href: '/manual-key/entries', icon: List },
  { title: 'ลูกค้าคีย์หวย', href: '/manual-key/customers', icon: Users },
  { title: 'ตั้งค่าเรท', href: '/manual-key/rates', icon: DollarSign },
];

// 12.1 Agent Terminal (รวมเข้าไปใน หวย แล้ว - ใช้ /entry)
// ลบออกเพื่อลดความซ้ำซ้อน - ให้เอเย่นต์ใช้ หวย > คีย์หวย แทน

// === AGENT DASHBOARD MENUS (แยกจาก Admin) ===
// เมนูสำหรับ Agent โดยเฉพาะ - ไม่เห็นข้อมูลเว็บแม่
const agentDashboardItem = {
  title: 'Dashboard เอเย่นต์',
  href: '/agent-dashboard',
  icon: LayoutDashboard,
};

const agentOperationItems = [
  { title: 'ศูนย์การเงิน', href: '/member/slip-upload', icon: Upload },
  { title: 'สรุปรายได้', href: '/member/summary', icon: DollarSign },
  { title: 'ประวัติธุรกรรม', href: '/member/finance', icon: Receipt },
];

const agentDownlineItems = [
  { title: 'ลูกค้าใต้สาย', href: '/agent-members', icon: Users },
  { title: 'คอมมิชชั่น', href: '/agent/commission', icon: DollarSign },
  { title: 'รายงานแพ้ชนะ', href: '/agent-profit-loss', icon: PieChart },
  { title: 'ถอนคอมมิชชั่น', href: '/agent-withdraw-history', icon: ArrowDownToLine },
];

const agentBettingItems = [
  { title: 'คีย์โพย', href: '/agent-terminal/betting', icon: PenLine },
  { title: 'รายการโพย', href: '/entries', icon: List },
  { title: 'ผลหวย', href: '/results', icon: Trophy },
];

// 12.2 สายงานเอเย่นต์ Manual (Manual Downline Management)
const manualDownlineItems = [
  { title: 'โครงสร้างสายงาน', href: '/manual-downline', icon: GitBranch },
  { title: 'จัดการเครดิต', href: '/manual-downline/credit', icon: CreditCard },
  { title: 'ตั้งค่า PT/คอม', href: '/manual-downline/commission', icon: Percent },
  { title: 'รายชื่อลูกค้า', href: '/manual-downline/members', icon: Users },
  { title: 'รายงานแพ้ชนะ', href: '/manual-downline/report', icon: BarChart3 },
];

// 13. ระบบออโต้ (Auto)
const autoSystemItems = [
  { title: 'ภาพรวมออโต้', href: '/auto-system', icon: Zap },
  { title: 'รายการออโต้', href: '/auto-system/entries', icon: List },
  { title: 'ลูกค้าออโต้', href: '/auto-system/customers', icon: Users },
  { title: 'ตั้งค่าออโต้', href: '/auto-system/settings', icon: Settings },
];

// 14. สายงานเอเย่นต์ (รวม ออโต้ และ คีย์หวย)
const agentSystemItems = [
  { title: 'จัดการเอเย่นต์', href: '/agent-system', icon: UsersRound },
  { title: 'จัดการแมมเบอร์', href: '/agent-system/members', icon: Users },
  { title: 'คอมมิชชั่น', href: '/agent-system/commission', icon: DollarSign },
  { title: 'ตั้งค่าธนาคาร', href: '/agent-system/bank-settings', icon: Building2 },
  { title: 'ตั้งค่าเว็บลูก', href: '/agent-system/site-settings', icon: Settings },
  { title: 'ส่งยอดเข้าเว็บกลาง', href: '/agent-system/settlement', icon: Send },
  { title: 'รายงาน', href: '/agent-system/report', icon: BarChart3 },
];

// 16. การตลาดคีย์หวย
const manualKeyMarketingItems = [
  { title: 'ภาพรวม', href: '/manual-key-marketing', icon: Target },
  { title: 'แคมเปญ', href: '/manual-key-marketing/campaigns', icon: Megaphone },
  { title: 'ลิงก์สมัคร', href: '/manual-key-marketing/links', icon: Link2 },
  { title: 'รายงาน', href: '/manual-key-marketing/report', icon: BarChart3 },
];

// 17. การตลาดออโต้
const autoMarketingItems = [
  { title: 'ภาพรวม', href: '/auto-marketing', icon: Target },
  { title: 'แคมเปญ', href: '/auto-marketing/campaigns', icon: Megaphone },
  { title: 'ลิงก์สมัคร', href: '/auto-marketing/links', icon: Link2 },
  { title: 'รายงาน', href: '/auto-marketing/report', icon: BarChart3 },
];

// 18. หุ้นลม / Credit Line
const creditLineItems = [
  { title: 'ภาพรวม Credit Line', href: '/credit-line', icon: Scale },
  { title: 'จัดการหุ้นลม', href: '/credit-line/manage', icon: Coins },
  { title: 'ประวัติ', href: '/credit-line/history', icon: History },
  { title: 'ตั้งค่า', href: '/credit-line/settings', icon: Settings },
];

// 19. รายงานเปรียบเทียบ
const comparisonReportItems = [
  { title: 'เปรียบเทียบ คีย์หวย vs ออโต้', href: '/comparison-report', icon: FileBarChart },
  { title: 'รายงานรายวัน', href: '/comparison-report/daily', icon: BarChart3 },
  { title: 'รายงานรายเดือน', href: '/comparison-report/monthly', icon: PieChart },
];

// 19.3 ศูนย์แอดมิน (สำหรับ member/พนักงาน)
  const memberAdminItems = [
  { title: 'สรุปยอด', href: '/member/summary', icon: BarChart3 },
  { title: 'การเงิน', href: '/member/finance', icon: Wallet },
  { title: 'อัปโหลดสลิป / ถอนเงิน', href: '/member/slip-upload', icon: Upload },
  ];

// 19.5 จัดการพนักงาน/แอดมิน (เว็บแม่และเอเย่นต์ดูได้)
const staffManagementItems = [
  { title: 'รายงานเข้างานแอดมิน', href: '/admin-attendance-report', icon: Clock },
  { title: 'ตรวจสอบการทำงาน', href: '/admin-performance', icon: ClipboardCheck },
  { title: 'สรุปเงินเดือน', href: '/payroll', icon: Wallet },
  { title: 'ตั้งค่า Payroll', href: '/payroll/settings', icon: Settings },
  { title: 'รายงานโ���ที', href: '/payroll/ot-report', icon: Clock },
  { title: 'รายงานยอดแอดมิน', href: '/admin-sales-report', icon: BarChart3 },
];

// 20. Super Admin - เจ้าของระบบ (เว็บแม่เท่านั้น)
const superAdminItems = [
  { title: 'จัดการสายงาน', href: '/super-admin/downline', icon: Crown },
  { title: 'ตั้งค่าการมองเห็นเอเย่น', href: '/agent-visibility', icon: Eye },
  { title: 'ตั้งค่าการมองเห็นแมมเบอร์', href: '/member-visibility', icon: Users },
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
  { title: 'สมาชิก', icon: Users, items: memberItems, defaultOpen: false, adminOnly: true, staffVisible: true },
  { title: 'บัญชีและการเงิน', icon: Wallet, items: financeItems, defaultOpen: false, adminOnly: true, staffVisible: true, memberVisible: true },
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
];

// HIDDEN MENUS (ยังไม่พร้อม - จะเปิดเมื่อพัฒนาเสร็จ):
// - ระบบคีย์หวย (manualKeyItems)
// - สายงานคีย์หวย (manualKeyAgentItems)
// - การตลาดคีย์หวย (manualKeyMarketingItems)
// - การตลาดออโต้ (autoMarketingItems)
// - หุ���นลม / Credit Line (creditLineItems)
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

  // Check if user is agent
  const isAgent = user?.role === 'agent';
  const isMember = user?.role === 'member';
  const isStaff = user?.role === 'staff';
  
  // Get user's visible menus from session (loaded at login)
  const userVisibleMenus = user?.visible_menus || [];
  const userHiddenMenus = user?.hidden_menus || [];
  const hasMenuRestrictions = userVisibleMenus.length > 0;

  // Filter sections based on user role and branch type
  const visibleSections = menuSections.filter(section => {
    // Master only sections - hide from sub-sites (web ลูก)
    if (section.masterOnly && !isMasterBranch && !isSuperAdmin) return false;
    
    // Super Admin only sections
    if (section.superAdminOnly && !isSuperAdmin) return false;
    
    // === AGENT: เห็นเฉพาะ agentOnly sections เท่านั้น ===
    if (isAgent) {
      return section.agentOnly === true;
    }
    
    // === MEMBER: เห็นเฉพาะ memberVisible sections ===
    if (isMember) {
      return section.memberVisible === true;
    }
    
    // === STAFF (พนักงาน): เห็นเฉพาะ staffVisible sections ===
    if (isStaff) {
      return section.staffVisible === true;
    }
    
    // === ADMIN / SUPER ADMIN: เห็นทุกเมนูยกเว้น agentOnly ===
    // (agentOnly เป็นเมนูเฉพาะ Agent ไม่ต้องแสดงใน Admin Dashboard)
    if (section.agentOnly && !isAgent) {
      return false;
    }
    
    // Admin only sections
    if (section.adminOnly) {
      return isAdmin || isSuperAdmin;
    }
    
    return true;
  }).map(section => {
    // If user has menu restrictions, filter items within each section
    if (hasMenuRestrictions && !isSuperAdmin && !isAdmin) {
      const filteredItems = section.items.filter(item => {
        // Check if menu href is in hidden list
        if (userHiddenMenus.includes(item.href)) return false;
        // If visible_menus is set, check if this menu is allowed
        return userVisibleMenus.includes(item.href) || userVisibleMenus.length === 0;
      });
      return { ...section, items: filteredItems };
    }
    return section;
  }).filter(section => section.items.length > 0); // Remove empty sections

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
                {isSuperAdmin ? 'Super Admin' : isAdmin ? 'ผู้ดูแลระบบ' : 'พนักงาน'}
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
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
