'use client';

// Sidebar navigation component - FIN LOTTO R+ v3 Production
// Reorganized according to Super Admin menu blueprint

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import useSWR from 'swr';
import {
  LayoutDashboard,
  List,
  Users,
  User,
  Settings,
  Crown,
  LogOut,
  UsersRound,
  Handshake,
  Gift,
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
  Smartphone,
  Landmark,
  AlertTriangle,
  ArrowDownToLine,
  History,
  Database,
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
  Activity,
  Clock,
  Receipt,
  Upload,
  Zap,
  FileBarChart,
  Send,
  Globe,
  Radio,
  PenLine,
  Ticket,
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

// =====================================================
// STANDALONE ITEMS (Group 1: หน้าหลักและแผงควบคุม)
// แสดงบนสุดแบบไม่มีเมนูย่อย
// =====================================================

const dashboardItem = {
  id: 'dashboard',
  title: 'Dashboard',
  href: '/',
  icon: LayoutDashboard,
};

const attendanceItem = {
  id: 'attendance',
  title: 'ลงเวลางาน',
  href: '/attendance',
  icon: Clock,
};

// =====================================================
// GROUP 2: ระบบเว็บออโต้ (100% Auto System)
// =====================================================

const autoWebSystemItems = [
  { id: 'auto-system', title: 'ระบบออโต้ (คาสิโน/สล็อต/กีฬา)', href: '/auto-system', icon: Zap },
  { id: 'live-stream', title: 'ไลฟ์สด', href: '/live-stream', icon: Radio },
  { id: 'live-draw', title: 'ถ่ายทอดสดหวย', href: '/live-draw', icon: Tv },
  { id: 'promotions', title: 'โปรโมชั่น', href: '/promotions', icon: Sparkles },
  { id: 'marketing-center', title: 'ศูนย์การตลาด', href: '/marketing-center', icon: Megaphone },
  { id: 'affiliate', title: 'ลิงก์แนะนำเพื่อน', href: '/affiliate', icon: Link2 },
  { id: 'referrals', title: 'แนะนำลูกค้า', href: '/referrals', icon: Gift },
  { id: 'qr-generator', title: 'สร้าง QR Code', href: '/marketing-center/qr-generator', icon: QrCode },
  { id: 'result-announcement', title: 'บอทประกาศผล', href: '/result-announcement', icon: Bot },
  { id: 'lead-users', title: 'ยูสนำแทง', href: '/lead-users', icon: Crown },
];

// =====================================================
// GROUP 3: ธุรกรรมการเงิน
// =====================================================

const financeTransactionItems = [
  { id: 'topup-requests', title: 'คำขอเติมเงิน', href: '/topup-requests', icon: CreditCard, badgeKey: 'topupPending' as const },
  { id: 'withdraw-requests', title: 'คำขอถอนเงิน', href: '/withdraw-requests', icon: ArrowDownToLine, badgeKey: 'withdrawPending' as const },
  { id: 'deposit-issues', title: 'แจ้งปัญหาฝากเงิน', href: '/deposit-issues', icon: AlertTriangle, badgeKey: 'depositIssuesPending' as const },
  { id: 'pending-review', title: 'รายการรอตรวจสอบ', href: '/pending-review', icon: ClipboardCheck },
  { id: 'credits', title: 'ปรับยอดเครดิต', href: '/credits', icon: Wallet },
  { id: 'wallet-manager', title: 'จัดการกระเป๋าเงิน', href: '/wallet-manager', icon: Wallet },
  { id: 'bank-settings', title: 'ตั้งค่าธนาคาร', href: '/bank-settings', icon: Landmark },
  { id: 'payment-accounts', title: 'บัญชีรับเงิน', href: '/payment-accounts', icon: QrCode },
  { id: 'withdraw-accounts', title: 'บัญชีถอนเงิน', href: '/withdraw-accounts', icon: ArrowDownToLine },
  { id: 'scb-maemanee', title: 'SCB แม่มณี', href: '/scb-maemanee', icon: Landmark },
  { id: 'payment-gateway', title: 'จัดการ Payment Gateway', href: '/payment-gateway', icon: CreditCard },
  { id: 'finance-transactions', title: 'ประวัติธุรกรรมรวม', href: '/finance/transactions', icon: Receipt },
];

// =====================================================
// GROUP 5: การจัดการสมาชิก
// แยกชัดเจน: ลูกค้า / แอดมินภายใน / พนักงานออฟฟิศ
// =====================================================

// 5.1 ลูกค้าหวยคีย์ (ลูกค้าภายนอก)
const customerManagementItems = [
  { id: 'customers', title: 'ลูกค้าแทงหวย', href: '/customers', icon: Users },
  { id: 'customer-history', title: 'ประวัติลูกค้า', href: '/customer-history', icon: History },
  { id: 'customer-banks', title: 'ธนาคารลูกค้า', href: '/customer-banks', icon: Landmark },
  { id: 'member-summary', title: 'สรุปลูกค้า', href: '/member-summary', icon: UsersRound },
];

// 5.2 ศูนย์แอดมิน (พนักงานภายใน + สิทธิ์การใช้งาน)
const adminCenterItems = [
  { id: 'users', title: 'ศูนย์ปฏิบัติการ/ศูนย์แอดมิน', href: '/users', icon: Headphones },
  { id: 'roles-permissions', title: 'สิทธิ์การใช้งาน', href: '/roles-permissions', icon: Shield },
];

// 5.3 จัดการพนักงาน/ทีมงาน (Staff ออฟฟิศที่ดูแลระบบ)
const staffManagementItems = [
  { id: 'staff-management', title: 'จัดการพนักงาน', href: '/staff-management', icon: Users },
  { id: 'admin-attendance-report', title: 'รายงานเข้างานแอดมิน', href: '/admin-attendance-report', icon: Clock },
  { id: 'admin-performance', title: 'ตรวจสอบการทำงาน', href: '/admin-performance', icon: ClipboardCheck },
  { id: 'staff-performance', title: 'ผลงานพนักงาน', href: '/staff-performance', icon: Target },
  { id: 'payroll', title: 'สรุปเงินเดือน', href: '/payroll', icon: Wallet },
];

// =====================================================
// GROUP 6: รายงานสรุปผล
// =====================================================

const reportsItems = [
  { id: 'reports', title: 'รายงาน (ยอดแทง/ชนะ/แพ้)', href: '/reports', icon: FileDown },
  { id: 'omni-channel', title: 'Omni-Channel', href: '/reports/omni-channel', icon: Globe },
  { id: 'analysis', title: 'วิเคราะห์ยอดเลข', href: '/analysis', icon: BarChart3 },
  { id: 'profit-loss', title: 'กำไร/ขาดทุน', href: '/profit-loss', icon: PieChart },
  { id: 'finance-reports', title: 'รายงานการเงิน', href: '/finance-reports', icon: FileBarChart },
  { id: 'betting-reports', title: 'รายงานการเดิมพัน', href: '/betting/reports', icon: FileBarChart },
];

// =====================================================
// GROUP 7: ตั้งค่า & ความปลอดภัย
// =====================================================

const settingsSecurityItems = [
  { id: 'web-theme', title: 'ตั้งค่าธีม', href: '/web-theme', icon: Palette },
  { id: 'manage-images', title: 'จัดการรูปภาพ', href: '/manage-images', icon: Image },
  { id: 'desktop-settings', title: 'ตั้งค่าหน้าเว็บ', href: '/desktop-settings', icon: MonitorSmartphone },
  { id: 'settings', title: 'ตั้งค่าทั่วไป', href: '/settings', icon: Settings },
];

// Multi-Tenant (Super Admin Only)
const multiTenantItems = [
  { id: 'mt-dashboard', title: 'Dashboard ยอดรวม', href: '/multi-tenant/dashboard', icon: BarChart3 },
  { id: 'mt-settlements', title: 'รายการส่งยอด', href: '/multi-tenant/settlements', icon: Receipt },
  { id: 'enterprise-summary', title: 'Enterprise Summary', href: '/enterprise-summary', icon: Crown },
  { id: 'sub-sites', title: 'จัดการเว็บลูก', href: '/sub-sites', icon: Globe },
  { id: 'tenant-manager', title: 'Tenant Manager', href: '/tenant-manager', icon: Globe },
  { id: 'site-manager', title: 'Site Manager', href: '/site-manager', icon: Globe },
  { id: 'site-branding', title: 'Branding/Theme', href: '/site-manager/branding', icon: Palette },
  { id: 'master-rates', title: 'เรท/อั้นกลาง', href: '/master-rates', icon: DollarSign },
  { id: 'financial-hub', title: 'Financial Hub', href: '/financial-hub', icon: Wallet },
  { id: 'risk-control', title: 'Risk Control', href: '/risk-control', icon: Shield },
  { id: 'api-docs', title: 'API Docs', href: '/api-docs', icon: FileText },
];

// Super Admin Only
const superAdminItems = [
  { id: 'super-downline', title: 'จัดการสายงาน', href: '/super-admin/downline', icon: Crown },
  { id: 'risk-management', title: 'ควบคุมความเสี่ยง', href: '/risk-management', icon: TrendingUp },
  { id: 'master-control', title: 'Master Control', href: '/master-control', icon: Shield },
  { id: 'system-settings', title: 'ตั้งค่าระบบ', href: '/settings/system', icon: Settings },
];

// Security Items
const securityItems = [
  { id: 'security-dashboard', title: 'Security Dashboard', href: '/security-dashboard', icon: ShieldAlert },
  { id: '2fa', title: 'ยืนยันตัวตน 2 ชั้น (2FA)', href: '/security/2fa', icon: Smartphone },
  { id: 'audit-logs', title: 'ประวัติการใช้งาน', href: '/audit-logs', icon: History },
  { id: 'backup', title: 'สำรองข้อมูล', href: '/backup', icon: Database },
  { id: 'health-check', title: 'Health Check', href: '/health-check', icon: Activity },
];

// =====================================================
// AGENT-SPECIFIC MENUS
// =====================================================

const agentOperationItems = [
  { id: 'attendance', title: 'ลงเวลางาน', href: '/attendance', icon: Clock },
  { id: 'prize-payout', title: 'จ่ายรางวัลลูกค้าคีย์', href: '/prize-payout', icon: Trophy },
];

const agentDownlineItems = [
  { id: 'agent-members', title: 'ลูกค้าใต้สาย', href: '/agent-members', icon: Users },
  { id: 'agent-commission', title: 'คอมมิชชั่น', href: '/agent/commission', icon: DollarSign },
  { id: 'agent-profit-loss', title: 'รายงานแพ้ชนะ', href: '/agent-profit-loss', icon: PieChart },
  { id: 'agent-withdraw-history', title: 'ถอนคอมมิชชั่น', href: '/agent-withdraw-history', icon: ArrowDownToLine },
];

const agentBettingItems = [
  { id: 'manual-key', title: 'ภาพรวมระบบ', href: '/manual-key', icon: BarChart3 },
  { id: 'manual-key-entry', title: 'รายการเดิมพัน', href: '/admin/key', icon: List },
  { id: 'manual-key-entries', title: 'ประวัติการเดิมพัน', href: '/manual-key/entries', icon: History },
  { id: 'manual-key-customers', title: 'ลูกค้าในระบบ', href: '/manual-key/customers', icon: Users },
  { id: 'results', title: 'ผลหวย', href: '/results', icon: Trophy },
];

// Sub-Agent Items
const subAgentKeyItems = [
  { id: 'sub-agent-key-daily', title: 'หน้าจอคีย์เลขหวยรายวัน', href: '/sub-agent/key-daily', icon: PenLine },
  { id: 'sub-agent-key-history', title: 'ประวัติการคีย์วันนี้', href: '/sub-agent/key-history', icon: History },
  { id: 'sub-agent-customer-list', title: 'รายชื่อลูกค้า', href: '/sub-agent/customers', icon: Users },
  { id: 'sub-agent-results', title: 'ดูผลหวย', href: '/sub-agent/results', icon: Trophy },
];

// Member/Staff Admin Items
const memberAdminItems = [
  { id: 'member-summary', title: 'สรุปยอด', href: '/member/summary', icon: BarChart3 },
  { id: 'member-finance', title: 'การเงิน', href: '/member/finance', icon: Wallet },
  { id: 'member-slip-upload', title: 'อัปโหลดสลิป / ถอนเงิน', href: '/member/slip-upload', icon: Upload },
];

// =====================================================
// MENU SECTIONS DEFINITION
// =====================================================

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
  masterOnly?: boolean;
  agentOnly?: boolean;
  subAgentOnly?: boolean;
  agentVisible?: boolean;
  memberVisible?: boolean;
  staffVisible?: boolean;
}

// Main menu sections - reorganized according to blueprint
const menuSections: MenuSection[] = [
  // === GROUP 2: ระบบเว็บออโต้ (100% Auto System) ===
  { 
    title: 'ระบบเว็บออโต้', 
    icon: Zap, 
    items: autoWebSystemItems, 
    defaultOpen: true, 
    adminOnly: true 
  },
  
  // === GROUP 3: ธุรกรรมการเงิน ===
  { 
    title: 'ธุรกรรมการเงิน', 
    icon: Wallet, 
    items: financeTransactionItems, 
    defaultOpen: true, 
    adminOnly: true, 
    staffVisible: true, 
    memberVisible: true 
  },
  
  // === GROUP 4: จัดการลูกค้า ===
  { 
    title: 'จัดการลูกค้า', 
    icon: Users, 
    items: customerManagementItems, 
    defaultOpen: false, 
    adminOnly: true, 
    staffVisible: true 
  },
  
  // === GROUP 5: ศูนย์แอดมิน (สิทธิ์การใช้งาน) ===
  { 
    title: 'ศูนย์แอดมิน', 
    icon: Headphones, 
    items: adminCenterItems, 
    defaultOpen: false, 
    adminOnly: true, 
  },
  
  // === GROUP 6: จัดการพนักงาน ===
  { 
    title: 'จัดการพนักงาน', 
    icon: UsersRound, 
    items: staffManagementItems, 
    defaultOpen: false, 
    adminOnly: true, 
  },
  
  // === GROUP 7: รายงานสรุปผล ===
  { 
    title: 'รายงานสรุปผล', 
    icon: BarChart3, 
    items: reportsItems, 
    defaultOpen: false, 
    adminOnly: true, 
    staffVisible: true 
  },
  
  // === GROUP 8: ตั้งค่า & ความปลอดภัย ===
  { 
    title: 'ตั้งค่าเว็บ', 
    icon: Settings, 
    items: settingsSecurityItems, 
    defaultOpen: false, 
    adminOnly: true 
  },
  { 
    title: 'MULTI-TENANT', 
    icon: Globe, 
    items: multiTenantItems, 
    defaultOpen: false, 
    superAdminOnly: true, 
    masterOnly: true 
  },
  { 
    title: 'SUPER ADMIN', 
    icon: Crown, 
    items: superAdminItems, 
    defaultOpen: false, 
    superAdminOnly: true 
  },
  { 
    title: 'ความปลอดภัย', 
    icon: Shield, 
    items: securityItems, 
    defaultOpen: false, 
    superAdminOnly: true 
  },
  
  // === AGENT MENUS ===
  { 
    title: 'ศูนย์การเงิน', 
    icon: Wallet, 
    items: agentOperationItems, 
    defaultOpen: true, 
    agentOnly: true 
  },
  { 
    title: 'ลูกค้าใต้สาย', 
    icon: Users, 
    items: agentDownlineItems, 
    defaultOpen: false, 
    agentOnly: true 
  },
  { 
    title: 'รายการเดิมพัน', 
    icon: Ticket, 
    items: agentBettingItems, 
    defaultOpen: false, 
    agentOnly: true 
  },
  
  // === SUB-AGENT MENUS ===
  { 
    title: 'เมนูระดับย่อย', 
    icon: User, 
    items: subAgentKeyItems, 
    defaultOpen: true, 
    subAgentOnly: true 
  },
  
  // === MEMBER/STAFF MENUS ===
  { 
    title: 'เมนูสมาชิก', 
    icon: User, 
    items: memberAdminItems, 
    defaultOpen: false, 
    adminOnly: true 
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout, isSuperAdmin, isAdmin, isMasterBranch } = useAuth();
  
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
    return 'internal';
  };
  const userTier = getUserTier();

  // Fetch tier permissions from database
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

  // Check user roles
  const isAgent = userTier === 'agent';
  const isSubAgent = userTier === 'sub_agent';
  const isMasterAgent = userTier === 'master';
  const isMember = user?.role === 'member';
  const isStaff = user?.role === 'staff';
  
  // Get user's visible menus from session
  const userVisibleMenus = user?.visible_menus || [];
  const userHiddenMenus = user?.hidden_menus || [];
  const hasMenuRestrictions = userVisibleMenus.length > 0;

  // Helper to check menu visibility
  const isMenuVisible = (itemId: string | undefined, href: string): boolean => {
    if (isAgent || isSubAgent || isMasterAgent) {
      if (dbAllowedMenus.length > 0) {
        if (itemId && dbAllowedMenus.includes(itemId)) {
          return true;
        }
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
      return href === '/';
    }
    
    const menuKey = href.startsWith('/') ? href.slice(1) : href;
    
    if (userHiddenMenus.includes(href) || userHiddenMenus.includes(menuKey)) {
      return false;
    }
    
    if (!hasMenuRestrictions) return true;
    
    return userVisibleMenus.includes(href) || userVisibleMenus.includes(menuKey);
  };

  // Filter sections based on user role
  const visibleSections = menuSections.filter(section => {
    if (section.masterOnly && !isMasterBranch && !isSuperAdmin) return false;
    if (section.superAdminOnly && !isSuperAdmin) return false;
    
    if (isAgent || isSubAgent || isMasterAgent) {
      const hasAllowedItems = section.items.some(item => isMenuVisible(item.id, item.href));
      return hasAllowedItems;
    }
    
    if (isMember) {
      return section.memberVisible === true;
    }
    
    if (isStaff) {
      return section.staffVisible === true;
    }
    
    if (section.agentOnly && !isAgent) {
      return false;
    }
    
    if (section.subAgentOnly && !isSubAgent) {
      return false;
    }
    
    if (section.adminOnly) {
      return isAdmin || isSuperAdmin;
    }
    
    return true;
  }).map(section => {
    if (isAgent || isSubAgent || isMasterAgent || (hasMenuRestrictions && !isSuperAdmin && !isAdmin)) {
      const filteredItems = section.items.filter(item => isMenuVisible(item.id, item.href));
      return { ...section, items: filteredItems };
    }
    return section;
  }).filter(section => section.items.length > 0);

  return (
    <Sidebar className="bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 border-r border-amber-500/20">
      <SidebarHeader className="p-4 border-b border-amber-500/30">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
            <Crown className="w-6 h-6 text-black" />
          </div>
          <div>
            <div className="font-bold text-amber-400 text-lg tracking-wide">FIN LOTTO R+</div>
            <div className="text-[10px] text-amber-500/70 uppercase tracking-widest">Premium Admin</div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {/* GROUP 1: Dashboard & Attendance - Standalone */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === '/'}>
                <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-amber-400 hover:bg-amber-500/10 transition-all">
                  <LayoutDashboard className="w-5 h-5" />
                  <span className="font-medium">Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === '/attendance'}>
                <Link href="/attendance" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-amber-400 hover:bg-amber-500/10 transition-all">
                  <Clock className="w-5 h-5" />
                  <span className="font-medium">ลงเวลางาน</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Menu Sections with Collapsible Groups */}
        {visibleSections.map((section) => (
          <SidebarGroup key={section.title}>
            <Collapsible
              open={openSections[section.title]}
              onOpenChange={() => toggleSection(section.title)}
            >
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="flex items-center justify-between px-3 py-2.5 cursor-pointer rounded-lg text-amber-400/80 hover:text-amber-400 hover:bg-amber-500/5 transition-all group">
                  <div className="flex items-center gap-2">
                    <section.icon className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">{section.title}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${openSections[section.title] ? 'rotate-180' : ''}`} />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={pathname === item.href || pathname.startsWith(item.href + '/')}>
                          <Link
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2 ml-2 rounded-lg transition-all ${
                              pathname === item.href || pathname.startsWith(item.href + '/')
                                ? 'bg-amber-500/20 text-amber-400 border-l-2 border-amber-500'
                                : 'text-gray-400 hover:text-amber-400 hover:bg-amber-500/10'
                            }`}
                          >
                            <item.icon className="w-4 h-4" />
                            <span className="text-sm">{item.title}</span>
                            {item.badgeKey && pendingCounts && pendingCounts[item.badgeKey] > 0 && (
                              <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 py-0 min-w-[18px] h-[18px] bg-red-500 animate-pulse">
                                {pendingCounts[item.badgeKey]}
                              </Badge>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-amber-500/30">
        {user && (
          <div className="flex items-center gap-3 mb-3 p-2 rounded-lg bg-gray-800/50">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600">
              <User className="w-5 h-5 text-black" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-400 truncate">
                {user.displayName || user.username}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {user.role?.replace('_', ' ')}
              </p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" />
          <span>ออกจากระบบ</span>
        </Button>
        
        <div className="mt-3 pt-3 border-t border-gray-800 text-center">
          <p className="text-[10px] text-amber-500/50 uppercase tracking-widest">FIN LOTTO P+</p>
          <p className="text-[10px] text-gray-600">v1.0.0</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
