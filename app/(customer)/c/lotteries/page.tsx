'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Clock, Bell, Menu, Home, Ticket, FileText, History, User, Flag, Sun, Building, Moon, Star, Crown, TrendingUp, Landmark, TreePalm } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Lottery {
  id: string;
  name: string;
  close_time: string;
  flag_emoji?: string;
  is_active: boolean;
  icon?: string;
  icon_url?: string | null;
  flag_url?: string | null;
  bg_color?: string | null;
  text_color?: string | null;
  country_code?: string;
  background_image?: string | null;
  card_color?: string | null;
}

// Icon mapping for lottery icons
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'flag': Flag,
  'sun': Sun,
  'building': Building,
  'moon': Moon,
  'star': Star,
  'crown': Crown,
  'line-chart': TrendingUp,
  'landmark': Landmark,
  'palmtree': TreePalm,
};

// Country code to flag emoji mapping
const COUNTRY_FLAGS: Record<string, string> = {
  'TH': '🇹🇭',
  'LA': '🇱🇦',
  'VN': '🇻🇳',
  'MY': '🇲🇾',
  'SG': '🇸🇬',
  'HK': '🇭🇰',
  'CN': '🇨🇳',
  'TW': '🇹🇼',
  'JP': '🇯🇵',
  'KR': '🇰🇷',
  'US': '🇺🇸',
  'GB': '🇬🇧',
  'DE': '🇩🇪',
  'RU': '🇷🇺',
  'IN': '🇮🇳',
};

// Legacy flags mapping for backwards compatibility
const FLAGS: Record<string, string> = {
  'หวยรัฐบาลไทย': '🇹🇭',
  'รัฐบาลไทย': '🇹🇭',
  'หวยลาว': '🇱🇦',
  'ลาว': '🇱🇦',
  'หวยฮานอย': '🇻🇳',
  'ฮานอย': '🇻🇳',
  'หวยหุ้นไทย': '📈',
  'หวยยี่กี่': '🎱',
  'หวยมาเลย์': '🇲🇾',
  'มาเลย์': '🇲🇾',
  'จีน': '🇨🇳',
  'ไต้หวัน': '🇹🇼',
  'ญี่ปุ่น': '🇯🇵',
  'นิเคอิ': '🇯🇵',
  'เกาหลี': '🇰🇷',
  'ฮั่งเส็ง': '🇭🇰',
  'สิงคโปร์': '🇸🇬',
  'อังกฤษ': '🇬🇧',
  'เยอรมัน': '🇩🇪',
  'รัสเซีย': '🇷🇺',
  'ดาวโจนส์': '🇺🇸',
  'default': '🎰'
};

export default function LotteriesPage() {
  const { data: lotteries, error, isLoading } = useSWR<Lottery[]>('/api/lotteries', fetcher);
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});

  // Calculate countdown for each lottery
  useEffect(() => {
    const calculateCountdown = () => {
      if (!lotteries) return;
      
      const now = new Date();
      const newCountdowns: Record<string, string> = {};
      
      lotteries.forEach(lottery => {
        const [hours, minutes] = lottery.close_time.split(':').map(Number);
        const closeTime = new Date();
        closeTime.setHours(hours, minutes, 0, 0);
        
        if (closeTime < now) {
          closeTime.setDate(closeTime.getDate() + 1);
        }
        
        const diff = closeTime.getTime() - now.getTime();
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        
        newCountdowns[lottery.id] = `${h.toString().padStart(2, '0')} : ${m.toString().padStart(2, '0')} : ${s.toString().padStart(2, '0')}`;
      });
      
      setCountdowns(newCountdowns);
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);
    return () => clearInterval(interval);
  }, [lotteries]);

  const getFlag = (lottery: Lottery) => {
    // Priority: flag_url > icon_url > country_code > name matching > default
    if (lottery.flag_url) {
      return { type: 'image', value: lottery.flag_url };
    }
    if (lottery.icon_url) {
      return { type: 'image', value: lottery.icon_url };
    }
    if (lottery.country_code && COUNTRY_FLAGS[lottery.country_code]) {
      return { type: 'emoji', value: COUNTRY_FLAGS[lottery.country_code] };
    }
    // Try to match name
    for (const key of Object.keys(FLAGS)) {
      if (lottery.name.includes(key) || key.includes(lottery.name)) {
        return { type: 'emoji', value: FLAGS[key] };
      }
    }
    // Use icon from database
    if (lottery.icon && ICON_MAP[lottery.icon]) {
      return { type: 'icon', value: lottery.icon };
    }
    return { type: 'emoji', value: FLAGS.default };
  };

  const renderLotteryIcon = (lottery: Lottery) => {
    const flag = getFlag(lottery);
    
    if (flag.type === 'image') {
      return (
        <Image 
          src={flag.value} 
          alt={lottery.name} 
          width={24} 
          height={24} 
          className="object-cover rounded"
        />
      );
    }
    
    if (flag.type === 'icon') {
      const IconComponent = ICON_MAP[flag.value];
      return <IconComponent className="w-5 h-5 text-amber-400" />;
    }
    
    return <span className="text-xl">{flag.value}</span>;
  };

  return (
    <div className="min-h-screen bg-black text-white premium-bg-pattern" style={{ fontFamily: 'Kanit, sans-serif' }}>
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[400px] h-[300px] bg-amber-500/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-40 right-0 w-[300px] h-[300px] bg-amber-600/3 rounded-full blur-[80px]" />
      </div>
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-amber-500/20">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/c" className="p-2 hover:bg-neutral-800 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-amber-400" />
          </Link>
          <h1 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500">แทงหวย</h1>
          <div className="relative">
            <Bell className="w-5 h-5 text-neutral-400" />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-red-500 to-red-600 rounded-full text-[10px] flex items-center justify-center font-bold shadow-lg shadow-red-500/30">3</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 pb-24 relative z-10">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-gradient-to-b from-amber-400 to-amber-600 rounded-full" />
          หวยทั้งหมด
        </h2>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-400 border-t-transparent"></div>
          </div>
        )}

        {error && (
          <div className="text-center py-12 text-red-400">
            เกิดข��อผิดพลาดในการโหลดข้อมูล
          </div>
        )}

        {lotteries && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {lotteries.filter(l => l.is_active).map((lottery) => (
              <Link
                key={lottery.id}
                href={`/c/lotto/${lottery.id}`}
                className="block"
              >
                <div 
                  className="relative p-4 rounded-xl bg-gradient-to-b from-slate-800/90 to-slate-900/95 border border-slate-700/50 hover:border-amber-500/50 hover:scale-[1.02] transition-all cursor-pointer group overflow-hidden"
                >
                  {/* Content */}
                  <div className="relative z-10 flex flex-col gap-3">
                    {/* Top row: Small flag + Status indicator */}
                    <div className="flex items-center justify-between">
                      <div className="size-10 rounded-lg bg-slate-700/50 border border-slate-600/50 flex items-center justify-center">
                        {renderLotteryIcon(lottery)}
                      </div>
                      <div className="size-2.5 rounded-full bg-green-500" />
                    </div>
                    
                    {/* Lottery Name - HERO ELEMENT */}
                    <div className="min-h-[48px] flex items-center justify-center">
                      <h3 
                        className="text-lg font-bold text-center leading-tight text-white group-hover:text-amber-300 transition-colors"
                      >
                        {lottery.name}
                      </h3>
                    </div>
                    
                    {/* Close time */}
                    <p className="text-xs text-slate-400 text-center">
                      ปิดรับ {lottery.close_time} น.
                    </p>
                    
                    {/* Countdown */}
                    <div className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/50">
                      <Clock className="size-4 text-green-400" />
                      <span className="text-sm font-mono font-bold text-green-400">
                        {countdowns[lottery.id] || '-- : -- : --'}
                      </span>
                    </div>
                    
                    {/* Button */}
                    <button className="w-full py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:from-amber-400 hover:to-amber-500 transition-all">
                      แทงหวย
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Bottom Navigation - Premium */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-md border-t border-amber-500/20 px-4 py-2 z-50">
        <div className="flex items-center justify-around">
          <Link href="/c" className="flex flex-col items-center gap-1 hover:opacity-80 transition-opacity">
            <Home className="w-5 h-5 text-neutral-400" />
            <span className="text-neutral-400 text-xs">หน้าหลัก</span>
          </Link>
          
          <Link href="/c/lotteries" className="flex flex-col items-center gap-1">
            <Ticket className="w-5 h-5 text-amber-400" />
            <span className="text-amber-400 text-xs font-medium">แทงหวย</span>
          </Link>
          
          {/* Center Diamond Button - Premium */}
          <Link href="/c/tickets" className="relative -mt-6">
            <div className="relative">
              <div className="absolute inset-0 blur-lg bg-amber-500/40 rounded-xl rotate-45 scale-75" />
              <div 
                className="relative w-14 h-14 rounded-xl rotate-45 flex items-center justify-center btn-luxury"
              >
                <FileText className="w-6 h-6 text-black -rotate-45" />
              </div>
            </div>
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-amber-400 text-xs whitespace-nowrap font-medium">โพยของฉัน</span>
          </Link>
          
          <Link href="/c/history" className="flex flex-col items-center gap-1 hover:opacity-80 transition-opacity">
            <History className="w-5 h-5 text-neutral-400" />
            <span className="text-neutral-400 text-xs">ประวัติ</span>
          </Link>
          
          <Link href="/c/profile" className="flex flex-col items-center gap-1 hover:opacity-80 transition-opacity">
            <User className="w-5 h-5 text-neutral-400" />
            <span className="text-neutral-400 text-xs">โปรไฟล์</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
