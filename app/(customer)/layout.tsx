'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
  Home,
  Ticket,
  ClipboardList,
  Trophy,
  Wallet,
  Menu,
  X,
  LogOut,
  User,
  Bell,
  Settings,
  ChevronRight,
  Crown,
  Sparkles,
  Gift,
  History,
  HelpCircle,
  Phone,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { PromoPopup } from '@/components/customer/promo-popup';

interface CustomerUser {
  id: string;
  phone: string;
  first_name: string;
  last_name: string;
  credit_balance: number;
  avatar_url?: string;
}

interface SiteSettings {
  logo_url?: string;
  favicon_url?: string;
  site_name?: string;
}

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  });

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Check if current page is login, register, lotto, home, or promotions (public pages)
  const isAuthPage = pathname === '/c/login' || pathname === '/c/register' || pathname.startsWith('/c/lotto') || pathname === '/c' || pathname === '/c/promotions' || pathname === '/c/promotion' || pathname === '/c/lotteries' || pathname === '/c/tickets' || pathname === '/c/results' || pathname === '/c/history' || pathname === '/c/transactions';
  
  // Fetch site settings for favicon and logo
  const { data: siteSettings } = useSWR<SiteSettings>('/api/site-settings', fetcher);
  
  // Use SWR to fetch customer data - only if NOT on auth page
  const { data: customer, error, isLoading, mutate } = useSWR<CustomerUser>(
    isAuthPage ? null : '/api/customer/me',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );

  // Redirect to login if not authenticated and not on auth page
  useEffect(() => {
    // Skip if on auth page
    if (isAuthPage) return;
    
    // Skip if still loading
    if (isLoading) return;
    
    // If error (not authenticated), redirect to login
    if (error && !customer) {
      router.replace('/c/login');
    }
  }, [error, customer, isLoading, isAuthPage, router]);

  // Store customer in localStorage for backwards compatibility
  useEffect(() => {
    if (customer) {
      localStorage.setItem('customer', JSON.stringify(customer));
    }
  }, [customer]);

  // Update favicon dynamically from site settings
  useEffect(() => {
    if (siteSettings?.favicon_url) {
      // Update favicon link
      let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = siteSettings.favicon_url;
      
      // Update page title if site_name is set
      if (siteSettings.site_name) {
        document.title = siteSettings.site_name;
      }
    }
  }, [siteSettings]);

  const handleLogout = async () => {
    try {
      await fetch('/api/customer/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore errors
    }
    localStorage.removeItem('customer');
    localStorage.removeItem('customer_token');
    mutate(undefined, false);
    toast.success('ออกจากระบบสำเร็จ');
    router.push('/c/login');
  };

  // For auth pages, just render children immediately
  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-[#0A0F1C]">
        {children}
        {/* PromoPopup with session storage - shows once per session */}
        <PromoPopup />
      </div>
    );
  }

  // Show loading only during initial load (not on auth pages)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute w-96 h-96 -top-48 -right-48 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="absolute w-64 h-64 top-1/2 -left-32 bg-primary/10 rounded-full blur-3xl" />
        </div>
        <div className="relative flex flex-col items-center gap-4">
          <div className="size-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 animate-pulse">
            <Crown className="size-8 text-white" />
          </div>
          <p className="text-amber-400/80 text-sm mt-2">กำลังโหลด...</p>
          <div className="flex gap-1">
            <div className="size-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="size-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="size-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  // If not loading but no customer (will redirect), show loading
  if (!customer) {
    return (
      <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center animate-pulse">
            <Crown className="size-6 text-white" />
          </div>
          <p className="text-amber-400/60 text-sm">กำลังนำคุณไปหน้าเข้าสู่ระบบ...</p>
        </div>
      </div>
    );
  }

  // Navigation items (lotto only)
  const bottomNavItems = [
    { href: '/c', icon: Home, label: 'หน้าหลัก' },
    { href: '/c/lotteries', icon: Ticket, label: 'แทงหวย' },
    { href: '/c/promotions', icon: Sparkles, label: 'โปรโมชั่น', isCenter: true },
    { href: '/c/transactions', icon: History, label: 'รายการเติมเงิน' },
    { href: '/c/profile', icon: User, label: 'โปรไฟล์' },
  ];

  const menuItems = [
    { href: '/c', icon: Home, label: 'หน้าหลัก', description: 'กลับสู่หน้าหลัก' },
    { href: '/c/buy', icon: Ticket, label: 'แทงหวย', description: 'เลือกหวยและแทง' },
    { href: '/c/history', icon: ClipboardList, label: 'โพยของฉัน', description: 'ดูโพยที่แทงไว้' },
    { href: '/c/results', icon: Trophy, label: 'ผลรางวัล', description: 'ตรวจผลรางวัล' },
    { href: '/c/wallet', icon: Wallet, label: 'กระเป๋าเงิน', description: 'เติมเงิน/ถอนเงิน' },
    { href: '/c/bank-account', icon: Building2, label: 'ผูกบัญชี', description: 'ผูกบัญชีธนาคาร' },
    { href: '/c/promotions', icon: Gift, label: 'โปรโมชั่น', description: 'โปรโมชั่นพิเศษ' },
    { href: '/c/profile', icon: User, label: 'โปรไฟล์', description: 'จัดการบัญชี' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0F1C] text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0D1321]/95 backdrop-blur-md border-b border-amber-500/10">
        <div className="flex items-center justify-between px-4 h-14">
          {/* Logo */}
          <Link href="/c" className="flex items-center gap-2">
            {siteSettings?.logo_url ? (
              <img
                src={siteSettings.logo_url}
                alt={siteSettings?.site_name || 'FIN LOTTO'}
                className="h-8 w-auto"
              />
            ) : (
              <>
                <div className="size-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                  <Crown className="size-5 text-white" />
                </div>
                <span className="font-bold text-lg">
                  <span className="text-amber-400">FIN LOTTO</span>
                </span>
              </>
            )}
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Credit Display */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-500/30">
              <Sparkles className="size-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-400">
                {customer.credit_balance.toLocaleString()}
              </span>
            </div>

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative text-[#94A3B8] hover:text-white hover:bg-white/5">
              <Bell className="size-5" />
              <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-red-500 text-[10px] flex items-center justify-center text-white font-bold">
                2
              </span>
            </Button>

            {/* Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMenuOpen(true)}
              className="text-[#94A3B8] hover:text-white hover:bg-white/5"
            >
              <Menu className="size-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Side Menu Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />

          {/* Menu Panel */}
          <div className="absolute right-0 top-0 h-full w-80 bg-[#0D1321] border-l border-amber-500/10 shadow-2xl overflow-y-auto">
            {/* Menu Header */}
            <div className="sticky top-0 bg-[#0D1321] border-b border-white/5 p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-semibold text-white">เมนู</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMenuOpen(false)}
                  className="text-[#64748B] hover:text-white hover:bg-white/5"
                >
                  <X className="size-5" />
                </Button>
              </div>

              {/* User Info */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20">
                <Avatar className="size-12 border-2 border-amber-500/50">
                  <AvatarFallback className="bg-gradient-to-br from-amber-500 to-amber-600 text-white font-bold">
                    {customer.first_name?.[0] || customer.phone?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">
                    {customer.first_name || 'ผู้ใช้'} {customer.last_name || ''}
                  </p>
                  <p className="text-sm text-[#64748B]">{customer.phone}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Sparkles className="size-3 text-amber-400" />
                    <span className="text-xs text-amber-400 font-medium">
                      {customer.credit_balance.toLocaleString()} เครดิต
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="p-3 space-y-1">
              {menuItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-xl transition-all',
                      isActive
                        ? 'bg-gradient-to-r from-amber-500/20 to-transparent border border-amber-500/30 text-white'
                        : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
                    )}
                  >
                    <div
                      className={cn(
                        'size-10 rounded-lg flex items-center justify-center',
                        isActive
                          ? 'bg-gradient-to-br from-amber-500 to-amber-600'
                          : 'bg-white/5'
                      )}
                    >
                      <item.icon
                        className={cn('size-5', isActive ? 'text-white' : 'text-[#64748B]')}
                      />
                    </div>
                    <div className="flex-1">
                      <p className={cn('font-medium', isActive && 'text-white')}>{item.label}</p>
                      <p className="text-xs text-[#64748B]">{item.description}</p>
                    </div>
                    <ChevronRight className="size-4 text-[#64748B]" />
                  </Link>
                );
              })}
            </div>

            {/* Support Section */}
            <div className="p-3 border-t border-white/5">
              <p className="px-3 py-2 text-xs font-medium text-[#64748B] uppercase tracking-wider">
                ช่วยเหลือ
              </p>
              <Link
                href="/c/help"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-[#94A3B8] hover:text-white hover:bg-white/5 transition-all"
              >
                <div className="size-10 rounded-lg bg-white/5 flex items-center justify-center">
                  <HelpCircle className="size-5 text-[#64748B]" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">ศูนย์ช่วยเหลือ</p>
                  <p className="text-xs text-[#64748B]">FAQ และการใช้งาน</p>
                </div>
                <ChevronRight className="size-4 text-[#64748B]" />
              </Link>
              <Link
                href="/c/contact"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-[#94A3B8] hover:text-white hover:bg-white/5 transition-all"
              >
                <div className="size-10 rounded-lg bg-white/5 flex items-center justify-center">
                  <Phone className="size-5 text-[#64748B]" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">ติดต่อเรา</p>
                  <p className="text-xs text-[#64748B]">Line: @huayjaa</p>
                </div>
                <ChevronRight className="size-4 text-[#64748B]" />
              </Link>
            </div>

            {/* Logout */}
            <div className="p-3 border-t border-white/5">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  handleLogout();
                }}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all w-full"
              >
                <div className="size-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <LogOut className="size-5 text-red-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">ออกจากระบบ</p>
                  <p className="text-xs text-red-400/60">กลับสู่หน้า Login</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 pb-20">{children}</main>

      {/* PromoPopup with session storage - shows once per session */}
      <PromoPopup />

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0D1321]/95 backdrop-blur-md border-t border-amber-500/10 safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {bottomNavItems.map((item) => {
            const isActive = pathname === item.href;
            const isCenter = (item as any).isCenter;
            
            if (isCenter) {
              // Center promotion button with special style
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center justify-center -mt-6"
                >
                  <div className="size-14 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30 flex items-center justify-center transform rotate-45">
                    <item.icon className="size-7 text-white transform -rotate-45" />
                  </div>
                  <span className={cn(
                    'text-[10px] font-medium mt-1',
                    isActive ? 'text-amber-400' : 'text-[#64748B]'
                  )}>
                    {item.label}
                  </span>
                </Link>
              );
            }
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[60px]',
                  isActive
                    ? 'text-amber-400'
                    : 'text-[#64748B] hover:text-white'
                )}
              >
                <div
                  className={cn(
                    'size-8 rounded-lg flex items-center justify-center transition-all',
                    isActive && 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-500/20'
                  )}
                >
                  <item.icon className={cn('size-5', isActive && 'text-white')} />
                </div>
                <span className={cn('text-[10px] font-medium', isActive && 'text-amber-400')}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
