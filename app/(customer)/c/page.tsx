'use client';

import { useState } from 'react';
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
  Sparkles,
  Gamepad2,
  Dices,
  Key,
  Zap,
  Shield,
  Gift,
  TrendingUp,
  Star,
  Crown,
  Copy,
  Check,
} from 'lucide-react';
import useSWR from 'swr';
import { BannerCarousel } from '@/components/customer/banner-carousel';
import { FeatureBar } from '@/components/customer/feature-bar';
import { toast } from 'sonner';

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
  const [copied, setCopied] = useState(false);
  
  const turnoverEnabled = settings?.turnover_enabled ?? false;
  const { data: siteSettings } = useSWR<SiteSettings>('/api/site-settings', fetcher);
  
  const customer = customerData;

  const formatBalance = (balance: number) => {
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(balance || 0);
  };

  const copyReferralCode = () => {
    if (customer?.referral_code) {
      navigator.clipboard.writeText(customer.referral_code);
      setCopied(true);
      toast.success('คัดลอกรหัสแนะนำแล้ว');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Auto System Menu Items (Casino/Slots/Sports - No Agent)
  const autoSystemItems = [
    { icon: Dices, label: 'หวยออโต้', href: '/c/lotteries', color: 'from-amber-500 to-amber-600', description: 'ฝากถอนอัตโนมัติ' },
    { icon: Gamepad2, label: 'คาสิโน', href: '/c/casino', color: 'from-red-500 to-pink-600', description: 'บาคาร่า รูเล็ต' },
    { icon: Sparkles, label: 'สล็อต', href: '/c/slots', color: 'from-purple-500 to-violet-600', description: 'เกมสล็อตออนไลน์' },
    { icon: Trophy, label: 'กีฬา', href: '/c/arcade', color: 'from-green-500 to-emerald-600', description: 'แทงบอลออนไลน์' },
  ];

  // Manual Key System (Agent-based lottery)
  const keySystemItems = [
    { icon: Key, label: 'หวยคีย์', href: '/c/agent/key-lottery', color: 'from-cyan-500 to-blue-600', description: 'ผ่านเอเย่นต์' },
  ];

  // Quick Action Items
  const quickMenuItems = [
    { icon: Ticket, label: 'แทงหวย', href: '/c/lotteries', color: 'text-amber-400' },
    { icon: Trophy, label: 'ผลรางวัล', href: '/c/results', color: 'text-amber-400' },
    { icon: Radio, label: 'ดูไลฟ์สด', href: '/c/live', color: 'text-red-500' },
    { icon: FileText, label: 'รายการโพย', href: '/c/tickets', color: 'text-amber-400' },
  ];

  return (
    <div className="min-h-screen bg-black pb-24 premium-bg-pattern" style={{ fontFamily: "'Kanit', sans-serif" }}>
      {/* Animated Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[400px] bg-amber-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-40 right-0 w-[400px] h-[400px] bg-amber-600/3 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-0 w-[300px] h-[300px] bg-blue-500/3 rounded-full blur-[80px]" />
      </div>
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-amber-500/20">
        <div className="flex items-center justify-between px-4 h-16">
          <button className="w-10 h-10 rounded-xl bg-neutral-900/80 border border-amber-500/30 flex items-center justify-center hover:bg-neutral-800 hover:border-amber-500/50 transition-all group">
            <Menu className="w-5 h-5 text-amber-400 group-hover:text-amber-300" />
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
          
          <button className="w-10 h-10 rounded-xl bg-neutral-900/80 border border-amber-500/30 flex items-center justify-center relative hover:bg-neutral-800 hover:border-amber-500/50 transition-all group">
            <Bell className="w-5 h-5 text-amber-400 group-hover:text-amber-300" />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-red-500 to-red-600 rounded-full text-[10px] text-white flex items-center justify-center font-bold shadow-lg shadow-red-500/30 animate-pulse">3</span>
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
        
        {/* User Profile Card - Ultra Premium Glassmorphic */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/40 reflective-shine">
                  <User className="w-7 h-7 text-black" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center border-2 border-black">
                  <Crown className="w-3 h-3 text-black" />
                </div>
              </div>
              <div>
                <p className="text-neutral-400 text-sm">Welcome back</p>
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold text-lg">{customer?.name || 'FIN PLAYER'}</span>
                  <span className="vip-badge flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    VIP {customer?.vip_level || 1}
                  </span>
                </div>
              </div>
            </div>
            <Link href="/c/profile">
              <ChevronRight className="w-5 h-5 text-amber-500/50 hover:text-amber-400 transition-colors" />
            </Link>
          </div>
        </div>

        {/* Wallet Balance Card - Premium with Glow */}
        <div className="glass-card-gold p-5 glow-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/30 to-amber-600/20 border border-amber-500/40 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-neutral-400 text-sm">ยอดเงินคงเหลือ</p>
                <p className="text-3xl font-bold gold-amount">
                  {formatBalance(customer?.credit_balance || 0)} <span className="text-base font-normal text-neutral-400">บาท</span>
                </p>
              </div>
            </div>
            <Link href="/c/topup">
              <button className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/30 btn-gold-glow">
                <Plus className="w-6 h-6 text-black" />
              </button>
            </Link>
          </div>
          
          {/* Deposit & Withdraw Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/c/topup">
              <button className="btn-luxury w-full h-12 rounded-xl text-base reflective-shine">
                <Zap className="w-4 h-4 mr-2 inline" />
                เติมเงิน
              </button>
            </Link>
            <Link href="/c/withdraw">
              <button className="w-full h-12 rounded-xl text-base font-semibold bg-gradient-to-r from-neutral-800 to-neutral-700 border border-amber-500/40 text-amber-400 hover:from-neutral-700 hover:to-neutral-600 hover:border-amber-500/60 transition-all shadow-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 mr-2" />
                ถอนเงิน
              </button>
            </Link>
          </div>
          
          {/* Turnover Mini Progress - Only show if enabled */}
          {turnoverEnabled && customer?.required_turnover && customer.required_turnover > 0 && (
            <div className="mt-4 pt-4 border-t border-amber-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-neutral-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  ยอดเทิร์นโอเวอร์
                </span>
                <span className={`text-xs font-medium ${(customer?.current_turnover || 0) >= customer.required_turnover ? 'text-green-400' : 'text-amber-400'}`}>
                  {((customer?.current_turnover || 0) / customer.required_turnover * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${(customer?.current_turnover || 0) >= customer.required_turnover ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-amber-500 to-amber-400'}`}
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

        {/* Referral Code Card */}
        {customer?.referral_code && (
          <div className="glass-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-violet-600/20 border border-purple-500/30 flex items-center justify-center">
                  <Gift className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-neutral-400">รหัสแนะนำเพื่อน</p>
                  <p className="font-mono font-bold text-white tracking-wider">{customer.referral_code}</p>
                </div>
              </div>
              <button 
                onClick={copyReferralCode}
                className="px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 transition-all flex items-center gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span className="text-sm">{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ======================================
            SYSTEM SEPARATION UI
            Auto System vs Manual Key Lottery
            ====================================== */}
        
        {/* Section: Auto System (Casino/Slots/Sports/Auto Lottery) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">ระบบเว็บออโต้</h2>
              <p className="text-[10px] text-neutral-500">ฝาก-ถอนอัตโนมัติ ไม่ต้องผ่านเอเย่นต์</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {autoSystemItems.map((item, index) => (
              <Link key={index} href={item.href}>
                <div className="glass-card p-4 hover:scale-[1.02] transition-all group">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-lg`}>
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-white font-semibold text-sm">{item.label}</h3>
                  <p className="text-[10px] text-neutral-500 mt-0.5">{item.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Section: Manual Key System (Agent-based) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center">
              <Key className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">ระบบหวยคีย์</h2>
              <p className="text-[10px] text-neutral-500">ซื้อผ่านสายงานเอเย่นต์</p>
            </div>
          </div>
          
          <Link href="/c/agent/key-lottery">
            <div className="glass-card p-4 hover:scale-[1.01] transition-all group border-cyan-500/20 hover:border-cyan-500/40">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-cyan-500/30">
                  <Key className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold">แทงหวยคีย์</h3>
                  <p className="text-xs text-neutral-400 mt-0.5">สำหรับลูกค้าที่ซื้อผ่านระบบเอเย่นต์</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px]">4-Tier Commission</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px]">Manual Key</span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-cyan-500/50 group-hover:text-cyan-400" />
              </div>
            </div>
          </Link>
        </div>

        {/* Quick Menu - Premium */}
        <div className="space-y-3">
          <h2 className="font-bold text-white text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            เมนูลัด
          </h2>
          <div className="grid grid-cols-4 gap-3">
            {quickMenuItems.map((item, index) => (
              <Link key={index} href={item.href}>
                <div className="glass-card p-3 flex flex-col items-center gap-2 hover:scale-105 transition-transform">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center">
                    <item.icon className={`w-6 h-6 ${item.color}`} />
                  </div>
                  <span className="text-white text-xs text-center font-medium">{item.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Live Stream Section */}
        <Link href="/c/live">
          <div className="glass-card overflow-hidden group hover:scale-[1.01] transition-all">
            <div className="relative h-32 bg-gradient-to-r from-red-600/20 to-pink-600/20 flex items-center justify-center">
              <div className="absolute inset-0 bg-[url('/images/live-bg.jpg')] bg-cover bg-center opacity-30" />
              <div className="relative text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 font-bold text-sm uppercase tracking-wider">LIVE NOW</span>
                </div>
                <Radio className="w-10 h-10 text-white mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-white font-semibold">ถ่ายทอดสดผลหวย</p>
                <p className="text-xs text-neutral-400">ดูการออกรางวัลแบบเรียลไทม์</p>
              </div>
            </div>
          </div>
        </Link>

        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-neutral-900/95 backdrop-blur-xl border-t border-amber-500/20">
        <div className="flex items-center justify-around h-16 px-2 max-w-md mx-auto">
          <Link href="/c" className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Home className="w-4 h-4 text-white" />
            </div>
            <span className="text-amber-400 text-[10px] font-medium">หน้าหลัก</span>
          </Link>
          
          <Link href="/c/lotteries" className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center">
              <Ticket className="w-4 h-4 text-neutral-400" />
            </div>
            <span className="text-neutral-400 text-[10px]">แทงหวย</span>
          </Link>
          
          {/* Center Diamond Button */}
          <Link href="/c/tickets" className="relative -mt-6">
            <div 
              className="w-16 h-16 rounded-2xl rotate-45 flex items-center justify-center reflective-shine"
              style={{
                background: 'linear-gradient(135deg, #FFD700 0%, #B8860B 50%, #DAA520 100%)',
                boxShadow: '0 4px 20px rgba(255, 215, 0, 0.5), 0 0 40px rgba(255, 215, 0, 0.3)',
              }}
            >
              <div className="-rotate-45">
                <FileText className="w-7 h-7 text-black" />
              </div>
            </div>
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-amber-400 text-[10px] whitespace-nowrap font-medium">โพยของฉัน</span>
          </Link>
          
          <Link href="/c/transactions" className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center">
              <Clock className="w-4 h-4 text-neutral-400" />
            </div>
            <span className="text-neutral-400 text-[10px]">รายการ</span>
          </Link>
          
          <Link href="/c/profile" className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center">
              <User className="w-4 h-4 text-neutral-400" />
            </div>
            <span className="text-neutral-400 text-[10px]">โปรไฟล์</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
