'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Menu, 
  Bell, 
  ChevronRight, 
  Plus,
  Home,
  Ticket,
  History,
  User,
  Trophy,
  Clock,
  FileText,
  Wallet,
  Radio,
} from 'lucide-react';
import useSWR from 'swr';
import { BannerCarousel } from '@/components/customer/banner-carousel';
import { FeatureBar } from '@/components/customer/feature-bar';
import { PopularLotteries } from '@/components/customer/popular-lotteries';

interface CustomerData {
  id: string;
  name: string;
  username?: string;
  credit_balance: number;
  referral_code: string;
  vip_level?: number;
  current_turnover?: number;
  required_turnover?: number;
}

interface SiteSettings {
  logo_url?: string;
  banner_url?: string;
  promo_banner_url?: string;
  site_name?: string;
  welcome_message?: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function CustomerDashboard() {
  const { data: customerData } = useSWR<CustomerData>('/api/customer/me', fetcher);
  const { data: settings } = useSWR('/api/settings', fetcher);
  
  const turnoverEnabled = settings?.turnover_enabled ?? false;
  const { data: siteSettings } = useSWR<SiteSettings>('/api/site-settings', fetcher);
  
  const customer = customerData;

  const formatBalance = (balance: number) => {
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(balance || 0);
  };

  // Menu items for quick actions
  const menuItems = [
    { icon: Ticket, label: 'แทงหวย', href: '/c/lotteries', color: 'text-amber-400' },
    { icon: Trophy, label: 'ผลรางวัล', href: '/c/results', color: 'text-amber-400' },
    { icon: Radio, label: 'ดูไลฟ์สด', href: '/c/live', color: 'text-red-500' },
    { icon: FileText, label: 'รายการโพย', href: '/c/tickets', color: 'text-amber-400' },
    { icon: History, label: 'ประวัติการเล่น', href: '/c/history', color: 'text-amber-400' },
  ];

  return (
    <div className="min-h-screen bg-black pb-24 premium-bg-pattern" style={{ fontFamily: "'Kanit', sans-serif" }}>
      {/* Animated Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[400px] h-[300px] bg-amber-500/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-40 right-0 w-[300px] h-[300px] bg-amber-600/3 rounded-full blur-[80px]" />
      </div>
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-amber-500/20">
        <div className="flex items-center justify-between px-4 h-16">
          <button className="w-10 h-10 rounded-xl bg-neutral-900/80 border border-amber-500/30 flex items-center justify-center hover:bg-neutral-800 hover:border-amber-500/50 transition-all">
            <Menu className="w-5 h-5 text-amber-400" />
          </button>
          
          <div className="relative">
            <div className="absolute inset-0 blur-lg bg-amber-500/20 rounded-full scale-75" />
            {siteSettings?.logo_url ? (
              <img
                src={siteSettings.logo_url}
                alt={siteSettings?.site_name || 'FIN LOTTO'}
                className="relative h-[45px] w-auto drop-shadow-[0_0_15px_rgba(255,215,0,0.4)]"
              />
            ) : (
              <Image
                src="/images/fin-lotto-logo.png"
                alt="FIN LOTTO P+"
                width={130}
                height={45}
                className="relative drop-shadow-[0_0_15px_rgba(255,215,0,0.4)]"
              />
            )}
          </div>
          
          <button className="w-10 h-10 rounded-xl bg-neutral-900/80 border border-amber-500/30 flex items-center justify-center relative hover:bg-neutral-800 hover:border-amber-500/50 transition-all">
            <Bell className="w-5 h-5 text-amber-400" />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-red-500 to-red-600 rounded-full text-[10px] text-white flex items-center justify-center font-bold shadow-lg shadow-red-500/30">3</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10">
        {/* Banner Carousel */}
        <div className="px-4 pt-5">
          <BannerCarousel />
        </div>
        
        {/* Feature Bar */}
        <div className="mt-4">
          <FeatureBar />
        </div>
        
        <div className="px-4 pt-5 space-y-5 pb-24">
        
        {/* User Profile Card - Premium */}
        <div className="premium-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <User className="w-7 h-7 text-black" />
              </div>
              <div>
                <p className="text-neutral-400 text-sm">สวัสดีครับ</p>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-lg">{customer?.name || 'FIN PLAYER'}</span>
                  <span className="vip-badge">
                    VIP {customer?.vip_level || 8}
                  </span>
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-amber-500/50" />
          </div>
        </div>

        {/* Wallet Balance Card - Premium with Glow */}
        <div className="premium-card p-5 glow-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/30 to-amber-600/20 border border-amber-500/40 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-neutral-400 text-sm">ยอดเงินคงเหลือ</p>
                <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400">
                  {formatBalance(customer?.credit_balance || 0)} <span className="text-base font-normal text-neutral-400">บาท</span>
                </p>
              </div>
            </div>
            <button className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500/30 to-amber-600/20 border border-amber-500/40 flex items-center justify-center hover:from-amber-500/40 hover:to-amber-600/30 transition-all">
              <Plus className="w-6 h-6 text-amber-400" />
            </button>
          </div>
          
          {/* Deposit & Withdraw Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/c/topup">
              <button className="btn-luxury w-full h-12 rounded-xl text-base">
                เติมเงิน
              </button>
            </Link>
            <Link href="/c/withdraw">
              <button className="w-full h-12 rounded-xl text-base font-semibold bg-gradient-to-r from-neutral-800 to-neutral-700 border border-amber-500/40 text-amber-400 hover:from-neutral-700 hover:to-neutral-600 hover:border-amber-500/60 transition-all shadow-lg">
                ถอนเงิน
              </button>
            </Link>
          </div>
          
          {/* Turnover Mini Progress - Only show if enabled */}
          {turnoverEnabled && customer?.required_turnover && customer.required_turnover > 0 && (
            <div className="mt-4 pt-4 border-t border-amber-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-neutral-400">ยอดเทิร์นโอเวอร์</span>
                <span className={`text-xs font-medium ${(customer?.current_turnover || 0) >= customer.required_turnover ? 'text-green-400' : 'text-amber-400'}`}>
                  {((customer?.current_turnover || 0) / customer.required_turnover * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${(customer?.current_turnover || 0) >= customer.required_turnover ? 'bg-green-500' : 'bg-gradient-to-r from-amber-500 to-amber-400'}`}
                  style={{ width: `${Math.min(100, ((customer?.current_turnover || 0) / customer.required_turnover) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] text-neutral-500">
                  {(customer?.current_turnover || 0).toLocaleString()}
                </span>
                <span className="text-[10px] text-neutral-500">
                  {customer.required_turnover.toLocaleString()} บาท
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Menu - Premium */}
        <div className="grid grid-cols-4 gap-3">
          {menuItems.map((item, index) => (
            <Link key={index} href={item.href}>
              <div className="premium-card p-3 flex flex-col items-center gap-2 hover:scale-105 transition-transform">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center">
                  <item.icon className={`w-6 h-6 ${item.color}`} />
                </div>
                <span className="text-white text-xs text-center font-medium">{item.label}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Popular Lotteries Section */}
        <PopularLotteries />

        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-neutral-900/95 backdrop-blur-sm border-t border-amber-500/20">
        <div className="flex items-center justify-around h-16 px-2 max-w-md mx-auto">
          <Link href="/c" className="flex flex-col items-center gap-1">
            <Home className="w-5 h-5 text-amber-400" />
            <span className="text-amber-400 text-xs">หน้าหลัก</span>
          </Link>
          
          <Link href="/c/lotteries" className="flex flex-col items-center gap-1">
            <Ticket className="w-5 h-5 text-neutral-400" />
            <span className="text-neutral-400 text-xs">แทงหวย</span>
          </Link>
          
          {/* Center Diamond Button */}
          <Link href="/c/rewards" className="relative -mt-6">
            <div 
              className="w-16 h-16 rounded-2xl rotate-45 flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #FFD700 0%, #B8860B 50%, #DAA520 100%)',
                boxShadow: '0 4px 20px rgba(255, 215, 0, 0.5)',
              }}
            >
              <div className="-rotate-45">
                <svg className="w-7 h-7 text-black" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
              </div>
            </div>
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-amber-400 text-xs whitespace-nowrap">โพยของฉัน</span>
          </Link>
          
          <Link href="/c/transactions" className="flex flex-col items-center gap-1">
            <Clock className="w-5 h-5 text-neutral-400" />
            <span className="text-neutral-400 text-xs">รายการเติมเงิน</span>
          </Link>
          
          <Link href="/c/profile" className="flex flex-col items-center gap-1">
            <User className="w-5 h-5 text-neutral-400" />
            <span className="text-neutral-400 text-xs">โปรไฟล์</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
