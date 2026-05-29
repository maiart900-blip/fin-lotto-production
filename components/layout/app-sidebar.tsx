'use client';

// Enterprise-Grade Sidebar Navigation - FIN LOTTO R+ Production
// 8 Category Architecture - Billion Baht Ready

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import useSWR from 'swr';
import {
  LayoutDashboard,
  PenLine,
  List,
  Users,
  Settings,
  Crown,
  LogOut,
  UsersRound,
  Handshake,
  Gift,
  Ticket,
  DollarSign,
  Trophy,
  Wallet,
  BarChart3,
  PieChart,
  CreditCard,
  QrCode,
  Network,
  Building2,
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
  ShieldAlert,
  Target,
  Bot,
  ChevronDown,
  Megaphone,
  Eye,
  Activity,
  Receipt,
  GitBranch,
  FileBarChart,
  Globe,
  Smartphone,
  Scale,
  Percent,
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
// ENTERPRISE 8-CATEGORY MENU STRUCTURE
// =====================================================

// 1. MAIN DASHBOARD - Single Source of Truth
const dashboardItem = {
  title: 'Dashboard',
  href: '/',
  icon: LayoutDashboard,
};

// 2. SUPER ADMIN & MULTI-TENANT
const superAdminItems = [
  { title: 'จัดการเว็บลูก (Tenant)', href: '/sub-sites', icon: Globe },
  { title: 'Tenant Manager', href: '/tenant-manager', icon: Building2 },
  { title: 'จัดการผู้ใช้ & สิทธิ์', href: '/users', icon: UsersRound },
  { title: 'Roles & Permissions', href: '/roles-permissions', icon: Shield },
  { title: 'Security Dashboard', href: '/security-dashboard', icon: ShieldAlert },
  { title: '2FA Settings', href: '/security/2fa', icon: Smartphone },
  { title: 'Audit Logs', href: '/audit-logs', icon: History },
  { title: 'System Settings', href: '/settings/system', icon: Settings },
  { title: 'Backup & Recovery', href: '/backup', icon: Database },
  { title: 'Health Check', href: '/health-check', icon: Activity },
];

// 3. FINANCIAL HUB (Unified Cash Flow)
const financialHubItems = [
  { title: 'คำขอฝากเงิน', href: '/topup-requests', icon: CreditCard, badgeKey: 'topupPending' as const },
  { title: 'คำขอถอนเงิน', href: '/withdraw-requests', icon: ArrowDownToLine, badgeKey: 'withdrawPending' as const },
  { title: 'แจ้งปัญหาฝากเงิน', href: '/deposit-issues', icon: AlertTriangle, badgeKey: 'depositIssuesPending' as const },
  { title: 'ปรับยอดเครดิต', href: '/credits', icon: Wallet },
  { title: 'Payment Gateway', href: '/payment-gateway', icon: CreditCard },
  { title: 'ตั้งค่าธนาคาร', href: '/bank-settings', icon: Landmark },
  { title: 'บัญชีรับเงิน', href: '/payment-accounts', icon: QrCode },
  { title: 'บัญชีถอนเงิน', href: '/withdraw-accounts', icon: ArrowDownToLine },
  { title: 'SCB แม่มณี', href: '/scb-maemanee', icon: Landmark },
  { title: 'Transaction History', href: '/finance/transactions', icon: Receipt },
];

// 4. AGENT & AFFILIATE NETWORK (Unified Agent Management)
const agentNetworkItems = [
  { title: 'Agent Hierarchy', href: '/agent-system', icon: GitBranch },
  { title: 'โครงสร้างสายงาน', href: '/manual-downline', icon: Network },
  { title: 'Commission & PT Settings', href: '/manual-downline/commission', icon: Percent },
  { title: 'จัดการเครดิตเอเย่นต์', href: '/manual-downline/credit', icon: CreditCard },
  { title: 'Agent Members', href: '/agent-system/members', icon: Users },
  { title: 'Settlement Reports', href: '/agent-system/settlement', icon: Receipt },
  { title: 'รายงานแพ้ชนะเอเย่นต์', href: '/manual-downline/report', icon: BarChart3 },
];

// 5. GAMING & LOTTO HUB (Consolidated Betting)
const gamingHubItems = [
  { title: 'คีย์หวย', href: '/admin/key', icon: PenLine },
  { title: 'Betting Entries', href: '/entries', icon: List },
  { title: 'จัดการหวย', href: '/lotteries', icon: Ticket },
  { title: 'ตั้งค่าเรท / เลขอั้น', href: '/manual-key/rates', icon: DollarSign },
  { title: 'เรท/อั้นกลาง (Master)', href: '/master-rates', icon: Scale },
  { title: 'ผลหวย / Draw Results', href: '/results', icon: Trophy },
  { title: 'จ่ายรางวัล / Payout', href: '/prize-payout', icon: Trophy },
  { title: 'Risk Control', href: '/risk-control', icon: Shield },
];

// 6. CUSTOMER MANAGEMENT
const customerItems = [
  { title: 'Member Directory', href: '/customers', icon: Users },
  { title: 'ประวัติลูกค้า', href: '/customer-history', icon: History },
  { title: 'ธนาคารลูกค้า', href: '/customer-banks', icon: Landmark },
  { title: 'Credit Adjustments', href: '/credits', icon: Wallet },
  { title: 'Betting History', href: '/betting/history', icon: Ticket },
  { title: 'Transaction History', href: '/finance/transactions', icon: Receipt },
  { title: 'สรุปลูกค้า', href: '/member-summary', icon: UsersRound },
];

// 7. MARKETING & PROMOTIONS
const marketingItems = [
  { title: 'โปรโมชั่น', href: '/promotions', icon: Sparkles },
  { title: 'Affiliate Links', href: '/affiliate', icon: Link2 },
  { title: 'QR Code Generator', href: '/marketing-center/qr-generator', icon: QrCode },
  { title: 'ยูสนำแทง', href: '/lead-users', icon: Crown },
  { title: 'แนะนำลูกค้า', href: '/referrals', icon: Gift },
  { title: 'Marketing Center', href: '/marketing-center', icon: Link2 },
  { title: 'Bot ประกาศผล', href: '/result-announcement', icon: Bot },
];

// 8. ADVANCED ANALYTICS & REPORTS
const analyticsItems = [
  { title: 'P&L Summary', href: '/profit-loss', icon: PieChart },
  { title: 'Risk Dashboard', href: '/network/risk-dashboard', icon: TrendingUp },
  { title: 'Omni-Channel Report', href: '/reports/omni-channel', icon: Globe },
  { title: 'วิเคราะห์ยอดเลข', href: '/analysis', icon: BarChart3 },
  { title: 'Enterprise Summary', href: '/enterprise-summary', icon: Crown },
  { title: 'Financial Reports', href: '/finance-reports', icon: FileBarChart },
  { title: 'Betting Reports', href: '/betting/reports', icon: FileBarChart },
  { title: 'All Reports', href: '/reports', icon: FileText },
];

// =====================================================
// AGENT-SPECIFIC MENUS (For Agent Role Only)
// =====================================================
const agentDashboardItem = {
  title: 'Agent Dashboard',
  href: '/agent-dashboard',
  icon: LayoutDashboard,
};

const agentFinanceItems = [
  { title: 'ศูนย์การเงิน', href: '/member/slip-upload', icon: Wallet },
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

// =====================================================
// MENU SECTION DEFINITIONS
// =====================================================
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
  masterOnly?: boolean;
  agentOnly?: boolean;
}

// ADMIN MENU SECTIONS (8 Categories)
const adminMenuSections: MenuSection[] = [
  { title: 'Super Admin & Tenant', icon: Crown, items: superAdminItems, defaultOpen: false, superAdminOnly: true },
  { title: 'Financial Hub', icon: Wallet, items: financialHubItems, defaultOpen: true, adminOnly: true },
  { title: 'Agent Network', icon: Network, items: agentNetworkItems, defaultOpen: false, adminOnly: true },
  { title: 'Gaming & Lotto', icon: Ticket, items: gamingHubItems, defaultOpen: false, adminOnly: true },
  { title: 'Customers', icon: Users, items: customerItems, defaultOpen: false, adminOnly: true },
  { title: 'Marketing', icon: Megaphone, items: marketingItems, defaultOpen: false, adminOnly: true },
  { title: 'Analytics & Reports', icon: BarChart3, items: analyticsItems, defaultOpen: false, adminOnly: true },
];

// AGENT MENU SECTIONS
const agentMenuSections: MenuSection[] = [
  { title: 'ศูนย์การเงิน', icon: Wallet, items: agentFinanceItems, defaultOpen: true, agentOnly: true },
  { title: 'ลูกค้าใต้สาย', icon: Users, items: agentDownlineItems, defaultOpen: false, agentOnly: true },
  { title: 'คีย์หวย', icon: Ticket, items: agentBettingItems, defaultOpen: false, agentOnly: true },
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

  // Track open sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    [...adminMenuSections, ...agentMenuSections].forEach(section => {
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

  // Role checks
  const isAgent = user?.role === 'agent' || user?.role === 'agent_key' || user?.role === 'partner';
  
  // Determine which menu sections to show
  const menuSections = isAgent ? agentMenuSections : adminMenuSections;
  const dashboardLink = isAgent ? agentDashboardItem : dashboardItem;

  // Filter sections based on role
  const filteredSections = menuSections.filter(section => {
    if (section.superAdminOnly && !isSuperAdmin) return false;
    if (section.masterOnly && !isMasterBranch) return false;
    if (section.adminOnly && !isAdmin) return false;
    if (section.agentOnly && !isAgent) return false;
    return true;
  });

  return (
    <Sidebar className="border-r border-amber-900/30 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <SidebarHeader className="border-b border-amber-900/30 p-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20">
            <Crown className="size-6 text-slate-900" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">FIN LOTTO R+</h1>
            <p className="text-[10px] font-medium text-amber-500 tracking-widest uppercase">
              {isSuperAdmin ? 'ENTERPRISE ADMIN' : isAgent ? 'AGENT PORTAL' : 'PREMIUM ADMIN'}
            </p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {/* Dashboard Link */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === dashboardLink.href}
                className="group transition-all duration-200 hover:bg-amber-500/10"
              >
                <Link href={dashboardLink.href} className="flex items-center gap-3">
                  <dashboardLink.icon className={`size-5 ${pathname === dashboardLink.href ? 'text-amber-400' : 'text-slate-400 group-hover:text-amber-400'}`} />
                  <span className={pathname === dashboardLink.href ? 'text-white font-medium' : 'text-slate-300 group-hover:text-white'}>
                    {dashboardLink.title}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Menu Sections */}
        {filteredSections.map((section) => (
          <SidebarGroup key={section.title}>
            <Collapsible
              open={openSections[section.title]}
              onOpenChange={() => toggleSection(section.title)}
            >
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer hover:bg-amber-500/5 rounded-lg px-2 py-2 transition-colors flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <section.icon className="size-4 text-amber-500/80" />
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {section.title}
                    </span>
                  </div>
                  <ChevronDown className={`size-4 text-slate-500 transition-transform duration-200 ${openSections[section.title] ? 'rotate-180' : ''}`} />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => {
                      const isActive = pathname === item.href;
                      const badgeCount = item.badgeKey ? pendingCounts?.[item.badgeKey] : undefined;
                      
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            className="group transition-all duration-200 hover:bg-amber-500/10"
                          >
                            <Link href={item.href} className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <item.icon className={`size-4 ${isActive ? 'text-amber-400' : 'text-slate-500 group-hover:text-amber-400'}`} />
                                <span className={`text-sm ${isActive ? 'text-white font-medium' : 'text-slate-400 group-hover:text-white'}`}>
                                  {item.title}
                                </span>
                              </div>
                              {badgeCount && badgeCount > 0 && (
                                <Badge className="bg-red-500/20 text-red-400 border-red-500/40 text-[10px] px-1.5 py-0.5">
                                  {badgeCount}
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
            </Collapsible>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-amber-900/30 p-4">
        {user && (
          <div className="mb-3 rounded-lg bg-slate-800/50 p-3 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600">
                <Crown className="size-4 text-slate-900" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.username}</p>
                <p className="text-xs text-amber-500 capitalize">{user.role?.replace('_', ' ')}</p>
              </div>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-500/10"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 size-4" />
          ออกจากระบบ
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
