'use client';

import { useParams, useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Settings, 
  TrendingUp,
  Wallet,
  LogOut,
  Menu,
  X,
  ChevronDown,
  CreditCard,
  ArrowDownToLine,
  AlertTriangle,
  History,
  Landmark,
  Receipt,
  PenLine,
  List,
  Ticket,
  Trophy,
  Sparkles,
  Gift,
  Link2,
  BarChart3,
  PieChart,
  Send,
  Bell,
  Image,
  Palette,
  QrCode,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}

// เมนูหลัก - แบ่งตามหมวด
const menuGroups = [
  {
    label: 'หลัก',
    items: [
      { href: '', icon: LayoutDashboard, label: 'แดชบอร์ด' },
    ]
  },
  {
    label: 'ศูนย์ปฏิบัติการ',
    items: [
      { href: '/topup-requests', icon: CreditCard, label: 'คำขอเติมเงิน' },
      { href: '/withdraw-requests', icon: ArrowDownToLine, label: 'คำขอถอนเงิน' },
      { href: '/credits', icon: Wallet, label: 'ปรับยอดเครดิต' },
      { href: '/deposit-issues', icon: AlertTriangle, label: 'แจ้งปัญหาฝากเงิน' },
    ]
  },
  {
    label: 'สมาชิก',
    items: [
      { href: '/customers', icon: Users, label: 'รายชื่อสมาชิก' },
      { href: '/customer-history', icon: History, label: 'ประวัติสมาชิก' },
      { href: '/customer-banks', icon: Landmark, label: 'ธนาคารลูกค้า' },
    ]
  },
  {
    label: 'การเงิน',
    items: [
      { href: '/payment-accounts', icon: QrCode, label: 'บัญชีรับเงิน' },
      { href: '/withdraw-accounts', icon: ArrowDownToLine, label: 'บัญชีถอนเงิน' },
      { href: '/transactions', icon: Receipt, label: 'ประวัติธุรกรรม' },
    ]
  },
  {
    label: 'หวย',
    items: [
      { href: '/key', icon: PenLine, label: 'คีย์หวย' },
      { href: '/bets', icon: List, label: 'รายการแทง' },
      { href: '/lotteries', icon: Ticket, label: 'จัดการหวย' },
      { href: '/results', icon: Trophy, label: 'ผลหวย' },
    ]
  },
  {
    label: 'โปรโมชั่น',
    items: [
      { href: '/promotions', icon: Sparkles, label: 'จัดการโปรโมชั่น' },
      { href: '/referrals', icon: Gift, label: 'แนะนำลูกค้า' },
      { href: '/affiliate', icon: Link2, label: 'ลิงก์แนะนำเพื่อน' },
    ]
  },
  {
    label: 'รายงาน',
    items: [
      { href: '/reports', icon: TrendingUp, label: 'รายงานทั่วไป' },
      { href: '/profit-loss', icon: PieChart, label: 'กำไร/ขาดทุน' },
      { href: '/analysis', icon: BarChart3, label: 'วิเคราะห์ยอดเลข' },
    ]
  },
  {
    label: 'เว็บกลาง',
    items: [
      { href: '/settlements', icon: Send, label: 'ส่งยอดเว็บกลาง' },
    ]
  },
  {
    label: 'ตั้งค่า',
    items: [
      { href: '/settings', icon: Settings, label: 'ตั้งค่าเว็บ' },
      { href: '/theme', icon: Palette, label: 'ธีม/สี' },
      { href: '/images', icon: Image, label: 'จัดการรูปภาพ' },
      { href: '/notifications', icon: Bell, label: 'การแจ้งเตือน' },
    ]
  },
];

export default function TenantAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const slug = params.slug as string;
  
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const res = await fetch(`/api/tenant/${slug}`);
        if (res.ok) {
          const data = await res.json();
          setTenant(data);
        } else {
          router.push('/');
        }
      } catch {
        router.push('/');
      } finally {
        setLoading(false);
      }
    };
    fetchTenant();
  }, [slug, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!tenant) return null;

  const basePath = `/t/${slug}/admin`;

  return (
    <div className="min-h-screen bg-[#0a0a1a]">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#0d0d24] border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <span className="font-bold text-amber-400">{tenant.name}</span>
          <div className="w-10" />
        </div>
      </header>

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-40 h-screen w-64 bg-[#0d0d24] border-r border-white/10 transition-transform lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="p-4 border-b border-white/10">
          <Link href={basePath} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black font-bold">
              {tenant.name.charAt(0)}
            </div>
            <div>
              <h1 className="font-bold text-amber-400 text-sm">{tenant.name}</h1>
              <p className="text-xs text-muted-foreground">Admin Panel</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="p-2 space-y-4 overflow-y-auto h-[calc(100vh-180px)]">
          {menuGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const href = `${basePath}${item.href}`;
                  const isActive = pathname === href || (item.href !== '' && pathname.startsWith(href));
                  
                  return (
                    <Link
                      key={item.href}
                      href={href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                        isActive 
                          ? "bg-amber-500/20 text-amber-400" 
                          : "text-gray-400 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <Link
            href={`/t/${slug}`}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <LogOut className="h-5 w-5" />
            กลับหน้าเว็บ
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:pl-64 pt-14 lg:pt-0">
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
