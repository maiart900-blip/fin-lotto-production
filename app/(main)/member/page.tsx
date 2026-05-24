'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Crown, Star, Gem, Award, TrendingUp, Wallet, Gift, Clock,
  ChevronRight, Play, History, Ticket, ArrowUpRight, ArrowDownRight,
  Trophy, Sparkles, Target, Percent, CreditCard, Banknote, Zap,
  Bell, Settings, QrCode
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

// VIP Level Configuration
const VIP_LEVELS = {
  member: { name: 'Member', color: '#64748B', icon: Star, minPoints: 0, maxPoints: 1000, bonus: 0 },
  bronze: { name: 'Bronze', color: '#CD7F32', icon: Award, minPoints: 1000, maxPoints: 5000, bonus: 1 },
  silver: { name: 'Silver', color: '#C0C0C0', icon: Star, minPoints: 5000, maxPoints: 20000, bonus: 2 },
  gold: { name: 'Gold', color: '#FFD700', icon: Crown, minPoints: 20000, maxPoints: 100000, bonus: 3 },
  platinum: { name: 'Platinum', color: '#E5E4E2', icon: Crown, minPoints: 100000, maxPoints: 500000, bonus: 5 },
  diamond: { name: 'Diamond', color: '#B9F2FF', icon: Gem, minPoints: 500000, maxPoints: 1000000, bonus: 8 },
};

// Mock member data
const mockMemberData = {
  username: 'lucky_player',
  vipLevel: 'gold',
  vipPoints: 45000,
  creditBalance: 12500,
  totalBets: 850000,
  totalWins: 125000,
  todayProfit: 8500,
  pendingBets: 3,
  bonusBalance: 500,
  recentActivity: [
    { type: 'bet', lottery: 'หวยรัฐบาล', amount: 500, time: '10 นาทีที่แล้ว' },
    { type: 'win', lottery: 'หวยฮานอย', amount: 15000, time: '2 ชั่วโมงที่แล้ว' },
    { type: 'deposit', amount: 5000, time: '5 ชั่วโมงที่แล้ว' },
    { type: 'bet', lottery: 'หวยลาว', amount: 300, time: '1 วันที่แล้ว' },
  ],
  upcomingLotteries: [
    { name: 'หวยรัฐบาล', drawTime: '2024-01-16 15:00', status: 'open', flag: '🇹🇭' },
    { name: 'หวยฮานอย VIP', drawTime: '2024-01-15 18:30', status: 'open', flag: '🇻🇳' },
    { name: 'หวยลาว Star', drawTime: '2024-01-15 20:00', status: 'open', flag: '🇱🇦' },
  ],
};

// Shimmer Badge Component
function ShimmerBadge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div 
      className="relative px-4 py-1.5 rounded-full text-sm font-bold overflow-hidden"
      style={{ 
        background: `linear-gradient(135deg, ${color}, ${color}CC)`,
        color: '#0F172A'
      }}
    >
      {/* Shimmer Effect */}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite]">
        <div className="h-full w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12" />
      </div>
      <span className="relative z-10">{children}</span>
    </div>
  );
}

// 3D Metallic Gold Button Component
function MetallicGoldButton({ 
  children, 
  icon: Icon, 
  href,
  variant = 'primary'
}: { 
  children: React.ReactNode; 
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const baseClasses = `
    relative group px-6 py-4 rounded-xl font-bold text-base
    transition-all duration-300 ease-out
    transform hover:scale-105 hover:-translate-y-1
    active:scale-95 active:translate-y-0
    flex items-center justify-center gap-2
    overflow-hidden
  `;

  const variantClasses = {
    primary: `
      bg-gradient-to-b from-[#FFD700] via-[#DAA520] to-[#B8860B]
      text-[#1a0f00]
      shadow-[0_6px_20px_rgba(234,179,8,0.4),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-2px_0_rgba(0,0,0,0.2)]
      hover:shadow-[0_8px_30px_rgba(234,179,8,0.6),inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-2px_0_rgba(0,0,0,0.2)]
      border-2 border-[#FFD700]/50
    `,
    secondary: `
      bg-gradient-to-b from-[#2a2a2a] via-[#1a1a1a] to-[#0a0a0a]
      text-[#FFD700]
      shadow-[0_6px_20px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-2px_0_rgba(0,0,0,0.3)]
      hover:shadow-[0_8px_30px_rgba(234,179,8,0.3),inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-2px_0_rgba(0,0,0,0.3)]
      border-2 border-[#FFD700]/30
      hover:border-[#FFD700]/50
    `,
    danger: `
      bg-gradient-to-b from-[#ef4444] via-[#dc2626] to-[#b91c1c]
      text-white
      shadow-[0_6px_20px_rgba(239,68,68,0.4),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-2px_0_rgba(0,0,0,0.2)]
      hover:shadow-[0_8px_30px_rgba(239,68,68,0.6),inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-2px_0_rgba(0,0,0,0.2)]
      border-2 border-red-400/50
    `,
  };

  const content = (
    <button className={`${baseClasses} ${variantClasses[variant]}`}>
      {/* Shine overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent h-1/2 rounded-t-xl" />
      {Icon && <Icon className="size-5 relative z-10" />}
      <span className="relative z-10">{children}</span>
    </button>
  );

  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }
  return content;
}

// 3D Gold Icon Component
function GoldIcon({ icon: Icon, size = 'md', hot = false }: { 
  icon: React.ComponentType<{ className?: string }>; 
  size?: 'sm' | 'md' | 'lg';
  hot?: boolean;
}) {
  const sizes = {
    sm: 'size-10',
    md: 'size-14',
    lg: 'size-20',
  };
  const iconSizes = {
    sm: 'size-5',
    md: 'size-7',
    lg: 'size-10',
  };

  return (
    <div className="relative">
      <div className={`
        ${sizes[size]} rounded-2xl flex items-center justify-center
        bg-gradient-to-b from-[#FFD700] via-[#DAA520] to-[#B8860B]
        shadow-[0_4px_15px_rgba(234,179,8,0.4),inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-2px_0_rgba(0,0,0,0.2)]
      `}>
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent h-1/2 rounded-t-2xl" />
        <Icon className={`${iconSizes[size]} text-[#1a0f00] relative z-10`} />
      </div>
      {hot && (
        <div className="absolute -top-2 -right-2 px-2 py-0.5 text-[10px] font-bold rounded-full 
          bg-gradient-to-r from-red-500 via-orange-500 to-red-500 text-white
          animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]
          border border-red-400/50">
          HOT
        </div>
      )}
    </div>
  );
}

export default function MemberHomePage() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const currentLevel = VIP_LEVELS[mockMemberData.vipLevel as keyof typeof VIP_LEVELS];
  const nextLevel = Object.values(VIP_LEVELS).find(l => l.minPoints > mockMemberData.vipPoints);
  const progressToNext = nextLevel 
    ? ((mockMemberData.vipPoints - currentLevel.minPoints) / (nextLevel.minPoints - currentLevel.minPoints)) * 100
    : 100;

  const LevelIcon = currentLevel.icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712]">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#FFD700]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#FFD700]/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        
        {/* === WALLET & BALANCE SECTION === */}
        <div className={`
          relative rounded-3xl overflow-hidden transition-all duration-700
          ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        `}>
          {/* Glassmorphism Card */}
          <div className="
            backdrop-blur-xl bg-black/40
            border border-[#FFD700]/20
            rounded-3xl p-6 md:p-8
            shadow-[0_0_40px_rgba(234,179,8,0.1)]
          ">
            {/* VIP Badge Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-4">
                {/* VIP Badge with Glow */}
                <div 
                  className="relative w-20 h-20 rounded-full flex items-center justify-center"
                  style={{ 
                    background: `linear-gradient(135deg, ${currentLevel.color}40, ${currentLevel.color}10)`,
                    border: `3px solid ${currentLevel.color}`,
                    boxShadow: `0 0 30px ${currentLevel.color}50, 0 0 60px ${currentLevel.color}20`
                  }}
                >
                  <LevelIcon className="size-10" style={{ color: currentLevel.color }} />
                  {/* Pulse ring */}
                  <div 
                    className="absolute inset-0 rounded-full animate-ping opacity-30"
                    style={{ border: `2px solid ${currentLevel.color}` }}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl md:text-3xl font-bold text-[#FFFBEB]">
                      {mockMemberData.username}
                    </h1>
                    <ShimmerBadge color={currentLevel.color}>
                      VIP {currentLevel.name}
                    </ShimmerBadge>
                  </div>
                  <p className="text-[#94A3B8] text-sm">
                    โบนัสเพิ่ม <span className="text-[#FFD700] font-semibold">+{currentLevel.bonus}%</span> ทุกการจ่ายรางวัล
                  </p>
                </div>
              </div>

              {/* Quick Icons */}
              <div className="flex items-center gap-3">
                <button className="p-3 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/20 hover:bg-[#FFD700]/20 transition-colors">
                  <Bell className="size-5 text-[#FFD700]" />
                </button>
                <button className="p-3 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/20 hover:bg-[#FFD700]/20 transition-colors">
                  <QrCode className="size-5 text-[#FFD700]" />
                </button>
                <button className="p-3 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/20 hover:bg-[#FFD700]/20 transition-colors">
                  <Settings className="size-5 text-[#FFD700]" />
                </button>
              </div>
            </div>

            {/* Main Balance Display */}
            <div className="text-center mb-8">
              <p className="text-[#94A3B8] text-sm mb-2">ยอดเงินคงเหลือ</p>
              <h2 className="
                text-5xl md:text-7xl font-black tracking-tight
                bg-gradient-to-r from-[#FFD700] via-[#FFF8DC] to-[#DAA520]
                bg-clip-text text-transparent
                drop-shadow-[0_0_30px_rgba(234,179,8,0.4)]
              ">
                {mockMemberData.creditBalance.toLocaleString()}
              </h2>
              <p className="text-[#94A3B8] text-lg mt-1">บาท</p>
            </div>

            {/* 3D Metallic Action Buttons */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <MetallicGoldButton icon={CreditCard} href="/deposit">
                เติมเงิน
              </MetallicGoldButton>
              <MetallicGoldButton icon={Banknote} href="/withdraw" variant="secondary">
                ถอนเงิน
              </MetallicGoldButton>
              <MetallicGoldButton icon={Zap} href="/entry" variant="primary">
                แทงหวย
              </MetallicGoldButton>
            </div>

            {/* VIP Progress */}
            <div className="bg-black/30 rounded-2xl p-4 border border-[#FFD700]/10">
              <div className="flex items-center justify-between text-sm mb-3">
                <span className="text-[#94A3B8]">
                  คะแนน VIP: <span className="text-[#FFD700] font-bold">{mockMemberData.vipPoints.toLocaleString()}</span>
                </span>
                {nextLevel && (
                  <span className="text-[#64748B]">
                    อีก <span className="text-[#10B981]">{(nextLevel.minPoints - mockMemberData.vipPoints).toLocaleString()}</span> ถึง {nextLevel.name}
                  </span>
                )}
              </div>
              <div className="relative h-4 bg-[#1E293B] rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ 
                    width: `${progressToNext}%`,
                    background: `linear-gradient(90deg, ${currentLevel.color}, ${nextLevel?.color || currentLevel.color})`,
                    boxShadow: `0 0 10px ${currentLevel.color}60`
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* === STATS CARDS === */}
        <div className={`
          grid grid-cols-2 lg:grid-cols-4 gap-4
          transition-all duration-700 delay-100
          ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        `}>
          {/* Today Profit */}
          <div className="
            backdrop-blur-xl bg-black/40 rounded-2xl p-5
            border border-[#FFD700]/20
            hover:border-[#FFD700]/40 hover:shadow-[0_0_30px_rgba(234,179,8,0.15)]
            transition-all duration-300
          ">
            <div className="flex items-center gap-3 mb-3">
              <GoldIcon icon={TrendingUp} size="sm" />
              <span className="text-sm text-[#94A3B8]">กำไรวันนี้</span>
            </div>
            <p className="text-2xl font-bold text-[#10B981]">
              +{mockMemberData.todayProfit.toLocaleString()}
            </p>
            <p className="text-xs text-[#64748B] mt-1">บาท</p>
          </div>

          {/* Total Bets */}
          <div className="
            backdrop-blur-xl bg-black/40 rounded-2xl p-5
            border border-[#FFD700]/20
            hover:border-[#FFD700]/40 hover:shadow-[0_0_30px_rgba(234,179,8,0.15)]
            transition-all duration-300
          ">
            <div className="flex items-center gap-3 mb-3">
              <GoldIcon icon={Ticket} size="sm" />
              <span className="text-sm text-[#94A3B8]">โพยวันนี้</span>
            </div>
            <p className="text-2xl font-bold text-[#FFFBEB]">
              {mockMemberData.pendingBets}
            </p>
            <p className="text-xs text-[#64748B] mt-1">รายการ</p>
          </div>

          {/* Bonus Balance */}
          <div className="
            backdrop-blur-xl bg-black/40 rounded-2xl p-5
            border border-[#FFD700]/20
            hover:border-[#FFD700]/40 hover:shadow-[0_0_30px_rgba(234,179,8,0.15)]
            transition-all duration-300
          ">
            <div className="flex items-center gap-3 mb-3">
              <GoldIcon icon={Gift} size="sm" hot />
              <span className="text-sm text-[#94A3B8]">โบนัส</span>
            </div>
            <p className="text-2xl font-bold text-[#FFD700]">
              {mockMemberData.bonusBalance.toLocaleString()}
            </p>
            <p className="text-xs text-[#64748B] mt-1">บาท</p>
          </div>

          {/* Total Wins */}
          <div className="
            backdrop-blur-xl bg-black/40 rounded-2xl p-5
            border border-[#FFD700]/20
            hover:border-[#FFD700]/40 hover:shadow-[0_0_30px_rgba(234,179,8,0.15)]
            transition-all duration-300
          ">
            <div className="flex items-center gap-3 mb-3">
              <GoldIcon icon={Trophy} size="sm" />
              <span className="text-sm text-[#94A3B8]">ชนะสะสม</span>
            </div>
            <p className="text-2xl font-bold text-[#10B981]">
              {mockMemberData.totalWins.toLocaleString()}
            </p>
            <p className="text-xs text-[#64748B] mt-1">บาท</p>
          </div>
        </div>

        {/* === MENU ICONS GRID === */}
        <div className={`
          backdrop-blur-xl bg-black/40 rounded-2xl p-6
          border border-[#FFD700]/20
          transition-all duration-700 delay-200
          ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        `}>
          <h3 className="text-lg font-bold text-[#FFD700] mb-4 flex items-center gap-2">
            <Sparkles className="size-5" />
            เมนูหลัก
          </h3>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
            {[
              { icon: Zap, label: 'แทงด่วน', href: '/entry', hot: true },
              { icon: History, label: 'ประวัติ', href: '/history' },
              { icon: Wallet, label: 'กระเป๋า', href: '/wallet' },
              { icon: Gift, label: 'โปรโมชั่น', href: '/promotions', hot: true },
              { icon: Trophy, label: 'ผลรางวัล', href: '/results' },
              { icon: Target, label: 'เลขเด็ด', href: '/predictions' },
              { icon: Crown, label: 'VIP', href: '/vip' },
              { icon: Settings, label: 'ตั้งค่า', href: '/settings' },
            ].map((item, idx) => (
              <Link key={idx} href={item.href}>
                <div className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[#FFD700]/10 transition-colors cursor-pointer group">
                  <GoldIcon icon={item.icon} size="md" hot={item.hot} />
                  <span className="text-xs text-[#94A3B8] group-hover:text-[#FFD700] transition-colors text-center">
                    {item.label}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* === UPCOMING LOTTERIES === */}
        <div className={`
          backdrop-blur-xl bg-black/40 rounded-2xl p-6
          border border-[#FFD700]/20
          transition-all duration-700 delay-300
          ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        `}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#FFD700] flex items-center gap-2">
              <Ticket className="size-5" />
              หวยที่เปิดรับ
            </h3>
            <Link href="/lotteries">
              <Button variant="ghost" className="text-[#FFD700] hover:text-[#FDE047] hover:bg-[#FFD700]/10">
                ดูทั้งหมด <ChevronRight className="size-4 ml-1" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mockMemberData.upcomingLotteries.map((lottery, idx) => (
              <Link href="/entry" key={idx}>
                <div className="
                  relative rounded-2xl p-4 
                  bg-gradient-to-br from-[#1a1a2e]/80 to-[#0a0a0f]/80
                  border border-[#FFD700]/20
                  hover:border-[#FFD700]/50
                  hover:shadow-[0_0_30px_rgba(234,179,8,0.2)]
                  transition-all duration-300
                  cursor-pointer group
                  overflow-hidden
                ">
                  {/* Shine effect on hover */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FFD700]/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  </div>

                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{lottery.flag}</span>
                        <h4 className="font-bold text-[#FFFBEB]">{lottery.name}</h4>
                      </div>
                      <span className="
                        px-2 py-1 text-xs font-semibold rounded-full
                        bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30
                      ">
                        เปิดรับ
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#94A3B8] mb-3">
                      <Clock className="size-4" />
                      <span>{new Date(lottery.drawTime).toLocaleString('th-TH')}</span>
                    </div>
                    <MetallicGoldButton icon={Play} href="/entry">
                      แทงเลย
                    </MetallicGoldButton>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* === RECENT ACTIVITY === */}
        <div className={`
          backdrop-blur-xl bg-black/40 rounded-2xl p-6
          border border-[#FFD700]/20
          transition-all duration-700 delay-400
          ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        `}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-[#FFD700] flex items-center gap-2">
              <History className="size-5" />
              กิจกรรมล่าสุด
            </h3>
            <Link href="/history">
              <Button variant="ghost" className="text-[#FFD700] hover:text-[#FDE047] hover:bg-[#FFD700]/10">
                ดูทั้งหมด <ChevronRight className="size-4 ml-1" />
              </Button>
            </Link>
          </div>

          <div className="space-y-3">
            {mockMemberData.recentActivity.map((activity, idx) => (
              <div 
                key={idx} 
                className="
                  flex items-center gap-4 p-4 rounded-xl
                  bg-gradient-to-r from-[#1a1a2e]/50 to-transparent
                  border border-[#FFD700]/10
                  hover:border-[#FFD700]/30
                  transition-all duration-300
                "
              >
                <div className={`
                  p-3 rounded-xl
                  ${activity.type === 'win' ? 'bg-[#10B981]/20' :
                    activity.type === 'bet' ? 'bg-[#FFD700]/20' : 'bg-[#10B981]/20'}
                `}>
                  {activity.type === 'win' ? (
                    <Trophy className="size-5 text-[#10B981]" />
                  ) : activity.type === 'bet' ? (
                    <Ticket className="size-5 text-[#FFD700]" />
                  ) : (
                    <ArrowDownRight className="size-5 text-[#10B981]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#FFFBEB] truncate">
                    {activity.type === 'win' ? `ถูกรางวัล ${activity.lottery}` :
                     activity.type === 'bet' ? `แทง ${activity.lottery}` : 'เติมเงิน'}
                  </p>
                  <p className="text-xs text-[#64748B]">{activity.time}</p>
                </div>
                <span className={`
                  font-bold text-lg
                  ${activity.type === 'win' ? 'text-[#10B981]' :
                    activity.type === 'bet' ? 'text-[#94A3B8]' : 'text-[#10B981]'}
                `}>
                  {activity.type === 'bet' ? '-' : '+'}{activity.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
