'use client';

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Lottery, getLotteryStatus, formatTimeRemaining } from '@/lib/lottery-utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  Clock, CheckCircle, XCircle, AlertTriangle, Sparkles, Play, Ticket
} from 'lucide-react';

// Premium Color-Coding System for Lottery Types
// =====================================
// หวยลาว = Royal Blue น้ำเงินพรีเมียม
// หวยฮานอย/นอย = Ruby Red แดงหรู  
// หวยรัฐบาลไทย = Brilliant Gold ทองสว่าง
// หวยหุ้น = Emerald Green เขียวมรกต
// =====================================

const FLAG_MAPPING: Record<string, { 
  flag: string; 
  colors: string; 
  gradient: string; 
  glow: string;
  borderColor: string;
  iconBg: string;
  category: 'laos' | 'hanoi' | 'thai' | 'stock' | 'other';
}> = {
  // ==================== หวยลาว - Royal Blue ====================
  'ลาว': { 
    flag: '🇱🇦', 
    colors: 'from-blue-600 via-blue-500 to-blue-700',
    gradient: 'bg-gradient-to-br from-blue-900/60 via-blue-800/40 to-blue-900/60',
    glow: 'shadow-[0_0_30px_rgba(59,130,246,0.4)]',
    borderColor: 'border-blue-500/50',
    iconBg: 'bg-gradient-to-br from-blue-600 to-blue-800',
    category: 'laos'
  },
  
  // ==================== หวยฮานอย/นอย - Ruby Red ====================
  'ฮานอย': { 
    flag: '🇻🇳', 
    colors: 'from-red-600 via-red-500 to-red-700',
    gradient: 'bg-gradient-to-br from-red-900/60 via-red-800/40 to-red-900/60',
    glow: 'shadow-[0_0_30px_rgba(220,38,38,0.4)]',
    borderColor: 'border-red-500/50',
    iconBg: 'bg-gradient-to-br from-red-600 to-red-800',
    category: 'hanoi'
  },
  'นอย': { 
    flag: '🇻🇳', 
    colors: 'from-red-600 via-red-500 to-red-700',
    gradient: 'bg-gradient-to-br from-red-900/60 via-red-800/40 to-red-900/60',
    glow: 'shadow-[0_0_30px_rgba(220,38,38,0.4)]',
    borderColor: 'border-red-500/50',
    iconBg: 'bg-gradient-to-br from-red-600 to-red-800',
    category: 'hanoi'
  },
  
  // ==================== หวยรัฐบาลไทย - Brilliant Gold ====================
  'รัฐบาล': { 
    flag: '🇹🇭', 
    colors: 'from-amber-500 via-yellow-400 to-amber-600',
    gradient: 'bg-gradient-to-br from-amber-900/60 via-yellow-800/40 to-amber-900/60',
    glow: 'shadow-[0_0_30px_rgba(245,158,11,0.5)]',
    borderColor: 'border-amber-400/60',
    iconBg: 'bg-gradient-to-br from-amber-500 to-yellow-600',
    category: 'thai'
  },
  'ไทย': { 
    flag: '🇹🇭', 
    colors: 'from-amber-500 via-yellow-400 to-amber-600',
    gradient: 'bg-gradient-to-br from-amber-900/60 via-yellow-800/40 to-amber-900/60',
    glow: 'shadow-[0_0_30px_rgba(245,158,11,0.5)]',
    borderColor: 'border-amber-400/60',
    iconBg: 'bg-gradient-to-br from-amber-500 to-yellow-600',
    category: 'thai'
  },
  
  // ==================== หวยหุ้น - Emerald Green ====================
  'นิเคอิ': { 
    flag: '🇯🇵', 
    colors: 'from-emerald-600 via-emerald-500 to-emerald-700',
    gradient: 'bg-gradient-to-br from-emerald-900/60 via-emerald-800/40 to-emerald-900/60',
    glow: 'shadow-[0_0_30px_rgba(16,185,129,0.4)]',
    borderColor: 'border-emerald-500/50',
    iconBg: 'bg-gradient-to-br from-emerald-600 to-emerald-800',
    category: 'stock'
  },
  'จีน': { 
    flag: '🇨🇳', 
    colors: 'from-emerald-600 via-emerald-500 to-emerald-700',
    gradient: 'bg-gradient-to-br from-emerald-900/60 via-emerald-800/40 to-emerald-900/60',
    glow: 'shadow-[0_0_30px_rgba(16,185,129,0.4)]',
    borderColor: 'border-emerald-500/50',
    iconBg: 'bg-gradient-to-br from-emerald-600 to-emerald-800',
    category: 'stock'
  },
  'ฮั่งเส็ง': { 
    flag: '🇭🇰', 
    colors: 'from-emerald-600 via-emerald-500 to-emerald-700',
    gradient: 'bg-gradient-to-br from-emerald-900/60 via-emerald-800/40 to-emerald-900/60',
    glow: 'shadow-[0_0_30px_rgba(16,185,129,0.4)]',
    borderColor: 'border-emerald-500/50',
    iconBg: 'bg-gradient-to-br from-emerald-600 to-emerald-800',
    category: 'stock'
  },
  'ไต้หวัน': { 
    flag: '🇹🇼', 
    colors: 'from-emerald-600 via-emerald-500 to-emerald-700',
    gradient: 'bg-gradient-to-br from-emerald-900/60 via-emerald-800/40 to-emerald-900/60',
    glow: 'shadow-[0_0_30px_rgba(16,185,129,0.4)]',
    borderColor: 'border-emerald-500/50',
    iconBg: 'bg-gradient-to-br from-emerald-600 to-emerald-800',
    category: 'stock'
  },
  'เกาหลี': { 
    flag: '🇰🇷', 
    colors: 'from-emerald-600 via-emerald-500 to-emerald-700',
    gradient: 'bg-gradient-to-br from-emerald-900/60 via-emerald-800/40 to-emerald-900/60',
    glow: 'shadow-[0_0_30px_rgba(16,185,129,0.4)]',
    borderColor: 'border-emerald-500/50',
    iconBg: 'bg-gradient-to-br from-emerald-600 to-emerald-800',
    category: 'stock'
  },
  'สิงคโปร์': { 
    flag: '🇸🇬', 
    colors: 'from-emerald-600 via-emerald-500 to-emerald-700',
    gradient: 'bg-gradient-to-br from-emerald-900/60 via-emerald-800/40 to-emerald-900/60',
    glow: 'shadow-[0_0_30px_rgba(16,185,129,0.4)]',
    borderColor: 'border-emerald-500/50',
    iconBg: 'bg-gradient-to-br from-emerald-600 to-emerald-800',
    category: 'stock'
  },
  'อังกฤษ': { 
    flag: '🇬🇧', 
    colors: 'from-emerald-600 via-emerald-500 to-emerald-700',
    gradient: 'bg-gradient-to-br from-emerald-900/60 via-emerald-800/40 to-emerald-900/60',
    glow: 'shadow-[0_0_30px_rgba(16,185,129,0.4)]',
    borderColor: 'border-emerald-500/50',
    iconBg: 'bg-gradient-to-br from-emerald-600 to-emerald-800',
    category: 'stock'
  },
  'เยอรมัน': { 
    flag: '🇩🇪', 
    colors: 'from-emerald-600 via-emerald-500 to-emerald-700',
    gradient: 'bg-gradient-to-br from-emerald-900/60 via-emerald-800/40 to-emerald-900/60',
    glow: 'shadow-[0_0_30px_rgba(16,185,129,0.4)]',
    borderColor: 'border-emerald-500/50',
    iconBg: 'bg-gradient-to-br from-emerald-600 to-emerald-800',
    category: 'stock'
  },
  'รัสเซีย': { 
    flag: '🇷🇺', 
    colors: 'from-emerald-600 via-emerald-500 to-emerald-700',
    gradient: 'bg-gradient-to-br from-emerald-900/60 via-emerald-800/40 to-emerald-900/60',
    glow: 'shadow-[0_0_30px_rgba(16,185,129,0.4)]',
    borderColor: 'border-emerald-500/50',
    iconBg: 'bg-gradient-to-br from-emerald-600 to-emerald-800',
    category: 'stock'
  },
  'ดาวโจนส์': { 
    flag: '🇺🇸', 
    colors: 'from-emerald-600 via-emerald-500 to-emerald-700',
    gradient: 'bg-gradient-to-br from-emerald-900/60 via-emerald-800/40 to-emerald-900/60',
    glow: 'shadow-[0_0_30px_rgba(16,185,129,0.4)]',
    borderColor: 'border-emerald-500/50',
    iconBg: 'bg-gradient-to-br from-emerald-600 to-emerald-800',
    category: 'stock'
  },
  'หุ้น': { 
    flag: '📈', 
    colors: 'from-emerald-600 via-emerald-500 to-emerald-700',
    gradient: 'bg-gradient-to-br from-emerald-900/60 via-emerald-800/40 to-emerald-900/60',
    glow: 'shadow-[0_0_30px_rgba(16,185,129,0.4)]',
    borderColor: 'border-emerald-500/50',
    iconBg: 'bg-gradient-to-br from-emerald-600 to-emerald-800',
    category: 'stock'
  },
  
  // ==================== Other Lotteries ====================
  'มาเลย์': { 
    flag: '🇲🇾', 
    colors: 'from-purple-600 via-purple-500 to-purple-700',
    gradient: 'bg-gradient-to-br from-purple-900/60 via-purple-800/40 to-purple-900/60',
    glow: 'shadow-[0_0_30px_rgba(147,51,234,0.4)]',
    borderColor: 'border-purple-500/50',
    iconBg: 'bg-gradient-to-br from-purple-600 to-purple-800',
    category: 'other'
  },
  'อินเดีย': { 
    flag: '🇮🇳', 
    colors: 'from-orange-500 via-orange-400 to-orange-600',
    gradient: 'bg-gradient-to-br from-orange-900/60 via-orange-800/40 to-orange-900/60',
    glow: 'shadow-[0_0_30px_rgba(249,115,22,0.4)]',
    borderColor: 'border-orange-500/50',
    iconBg: 'bg-gradient-to-br from-orange-500 to-orange-700',
    category: 'other'
  },
  'ยี่กี': { 
    flag: '🎲', 
    colors: 'from-pink-600 via-pink-500 to-pink-700',
    gradient: 'bg-gradient-to-br from-pink-900/60 via-pink-800/40 to-pink-900/60',
    glow: 'shadow-[0_0_30px_rgba(236,72,153,0.4)]',
    borderColor: 'border-pink-500/50',
    iconBg: 'bg-gradient-to-br from-pink-600 to-pink-800',
    category: 'other'
  },
  
  // ==================== Default ====================
  'default': { 
    flag: '🎰', 
    colors: 'from-slate-600 via-slate-500 to-slate-700',
    gradient: 'bg-gradient-to-br from-slate-900/60 via-slate-800/40 to-slate-900/60',
    glow: 'shadow-[0_0_20px_rgba(100,116,139,0.3)]',
    borderColor: 'border-slate-500/50',
    iconBg: 'bg-gradient-to-br from-slate-600 to-slate-800',
    category: 'other'
  },
};

// Get flag and colors for a lottery
function getLotteryTheme(lotteryName: string) {
  const name = lotteryName.toLowerCase();
  
  for (const [keyword, theme] of Object.entries(FLAG_MAPPING)) {
    if (keyword !== 'default' && name.includes(keyword.toLowerCase())) {
      return theme;
    }
  }
  
  return FLAG_MAPPING['default'];
}

interface LotterySelectorProps {
  lotteries: Lottery[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
  isSuperAdmin?: boolean;
}

export function LotterySelector({ lotteries, selectedId, onSelect, className, isSuperAdmin = false }: LotterySelectorProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const sortedLotteries = useMemo(() => {
    return [...lotteries].sort((a, b) => {
      const statusA = getLotteryStatus(a, isSuperAdmin);
      const statusB = getLotteryStatus(b, isSuperAdmin);
      if (statusA.canAccept && !statusB.canAccept) return -1;
      if (!statusA.canAccept && statusB.canAccept) return 1;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
  }, [lotteries, now, isSuperAdmin]);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Ticket className="size-4" />
        <span>เลือกประเภทหวย</span>
        <Badge variant="outline" className="ml-auto text-xs">
          {lotteries.filter(l => getLotteryStatus(l, isSuperAdmin).canAccept).length} เปิดรับ
        </Badge>
      </div>
      
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-3">
          {/* No selection option */}
          <button
            type="button"
            onClick={() => onSelect('')}
            className={cn(
              "flex-shrink-0 w-32 p-3 rounded-2xl border-2 transition-all duration-300",
              "flex flex-col items-center gap-2 text-center",
              "hover:scale-105 hover:-translate-y-1",
              !selectedId
                ? "border-amber-500 bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-transparent shadow-lg shadow-amber-500/20"
                : "border-border/50 bg-card/50 hover:border-amber-500/50 hover:shadow-md"
            )}
          >
            <div className={cn(
              "size-14 rounded-full flex items-center justify-center text-3xl",
              "bg-gradient-to-br from-gray-700/50 to-gray-800/50 border-2",
              !selectedId ? "border-amber-500" : "border-gray-600"
            )}>
              🎲
            </div>
            <div className="space-y-0.5">
              <p className={cn(
                "text-sm font-bold",
                !selectedId ? "text-amber-400" : "text-foreground"
              )}>
                ไม่ระบุ
              </p>
              <p className="text-[10px] text-muted-foreground">เลือกทั้งหมด</p>
            </div>
          </button>
          
          {sortedLotteries.map((lottery) => (
            <LotteryCard
              key={lottery.id}
              lottery={lottery}
              isSelected={selectedId === lottery.id}
              onClick={() => onSelect(lottery.id)}
              isSuperAdmin={isSuperAdmin}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

interface LotteryCardProps {
  lottery: Lottery;
  isSelected: boolean;
  onClick: () => void;
  isSuperAdmin?: boolean;
}

function LotteryCard({ lottery, isSelected, onClick, isSuperAdmin = false }: LotteryCardProps) {
  const [now, setNow] = useState(new Date());
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const status = getLotteryStatus(lottery, isSuperAdmin);
  const timeRemaining = status.countdown ? formatTimeRemaining(status.countdown) : '--:--';
  const theme = getLotteryTheme(lottery.name);

  const getStatusConfig = () => {
    if (!status.canAccept) {
      return {
        badge: 'ปิดงวด',
        badgeClass: 'bg-red-500/90 text-white',
        icon: <XCircle className="size-3" />,
      };
    }
    switch (status.status) {
      case 'closing_soon':
        return {
          badge: 'ใกล้ปิด',
          badgeClass: 'bg-orange-500/90 text-white animate-pulse',
          icon: <AlertTriangle className="size-3" />,
        };
      case 'result_announced':
        return {
          badge: 'งวดถัดไป',
          badgeClass: 'bg-blue-500/90 text-white',
          icon: <Sparkles className="size-3" />,
        };
      default:
        return {
          badge: 'เปิดรับ',
          badgeClass: 'bg-green-500/90 text-white',
          icon: <Play className="size-3" />,
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!status.canAccept}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        // Base styles - Clean card design
        "flex-shrink-0 w-36 p-3 rounded-xl transition-all duration-300 ease-out",
        "flex flex-col gap-2 text-center relative overflow-hidden",
        "bg-gradient-to-b from-slate-800/90 to-slate-900/95",
        // Border
        "border",
        isSelected && status.canAccept 
          ? "border-amber-400" 
          : "border-slate-700/50 hover:border-slate-600",
        // Hover effects
        "hover:scale-105 hover:-translate-y-1",
        // Disabled state
        !status.canAccept && "opacity-50 cursor-not-allowed",
        // Selected state - Golden highlight
        isSelected && status.canAccept && "ring-2 ring-amber-400/40 shadow-lg shadow-amber-500/20",
      )}
    >
      {/* Top row: Small flag icon + Status badge */}
      <div className="flex items-center justify-between w-full">
        <div className={cn(
          "size-8 rounded-lg flex items-center justify-center text-lg",
          "bg-slate-700/50 border border-slate-600/50"
        )}>
          {theme.flag}
        </div>
        <div className={cn(
          "px-2 py-0.5 rounded-full text-[10px] font-semibold",
          "flex items-center gap-1",
          statusConfig.badgeClass
        )}>
          {statusConfig.icon}
          <span>{statusConfig.badge}</span>
        </div>
      </div>

      {/* Lottery Name - HERO ELEMENT */}
      <div className="flex-1 flex items-center justify-center min-h-[40px]">
        <p className={cn(
          "text-base font-bold leading-tight text-center",
          isSelected && status.canAccept 
            ? "text-amber-300" 
            : "text-white"
        )}>
          {lottery.name}
        </p>
      </div>
      
      {/* Time Display */}
      {status.canAccept ? (
        <div className={cn(
          "flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg",
          "bg-slate-800/80 border border-slate-700/50"
        )}>
          <Clock className={cn(
            "size-3.5",
            status.isClosingSoon ? "text-orange-400 animate-bounce" : "text-green-400"
          )} />
          <span className={cn(
            "text-sm font-mono font-bold tracking-wide",
            status.isClosingSoon ? "text-orange-400" : "text-green-400"
          )}>
            {status.status === 'result_announced' ? 'พร้อม' : timeRemaining}
          </span>
        </div>
      ) : (
        <div className="px-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30">
          <span className="text-xs text-red-400">{status.statusText}</span>
        </div>
      )}
    </button>
  );
}

// Grid version for full page display
export function LotterySelectorGrid({ lotteries, selectedId, onSelect, className, isSuperAdmin = false }: LotterySelectorProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const sortedLotteries = useMemo(() => {
    return [...lotteries].sort((a, b) => {
      const statusA = getLotteryStatus(a, isSuperAdmin);
      const statusB = getLotteryStatus(b, isSuperAdmin);
      if (statusA.canAccept && !statusB.canAccept) return -1;
      if (!statusA.canAccept && statusB.canAccept) return 1;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
  }, [lotteries, now, isSuperAdmin]);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Ticket className="size-5 text-amber-400" />
          <span className="text-lg font-bold">เลือกหวย</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
            <CheckCircle className="size-3 mr-1" />
            {lotteries.filter(l => getLotteryStatus(l, isSuperAdmin).canAccept).length} เปิดรับ
          </Badge>
          <Badge className="bg-red-500/20 text-red-400 border-red-500/50">
            <XCircle className="size-3 mr-1" />
            {lotteries.filter(l => !getLotteryStatus(l, isSuperAdmin).canAccept).length} ปิด
          </Badge>
        </div>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {sortedLotteries.map((lottery) => (
          <LotteryCardGrid
            key={lottery.id}
            lottery={lottery}
            isSelected={selectedId === lottery.id}
            onClick={() => onSelect(lottery.id)}
            isSuperAdmin={isSuperAdmin}
          />
        ))}
      </div>
    </div>
  );
}

function LotteryCardGrid({ lottery, isSelected, onClick, isSuperAdmin = false }: LotteryCardProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const status = getLotteryStatus(lottery, isSuperAdmin);
  const timeRemaining = status.countdown ? formatTimeRemaining(status.countdown) : '--:--';
  const theme = getLotteryTheme(lottery.name);

  const getStatusConfig = () => {
    if (!status.canAccept) {
      return {
        badge: 'ปิดงวด',
        badgeClass: 'bg-red-500/90 text-white',
        dotClass: 'bg-red-500',
      };
    }
    switch (status.status) {
      case 'closing_soon':
        return {
          badge: 'ใกล้ปิด',
          badgeClass: 'bg-orange-500/90 text-white animate-pulse',
          dotClass: 'bg-orange-500 animate-pulse',
        };
      case 'result_announced':
        return {
          badge: 'งวดถัดไป',
          badgeClass: 'bg-blue-500/90 text-white',
          dotClass: 'bg-blue-500',
        };
      default:
        return {
          badge: 'เปิดรับ',
          badgeClass: 'bg-green-500/90 text-white',
          dotClass: 'bg-green-500',
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!status.canAccept}
      className={cn(
        // Clean card design - name focused
        "relative p-4 rounded-xl border transition-all duration-300",
        "flex flex-col gap-3 text-center",
        "bg-gradient-to-b from-slate-800/90 to-slate-900/95",
        "hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-lg",
        !status.canAccept && "opacity-50 cursor-not-allowed",
        isSelected && status.canAccept
          ? "border-amber-400 ring-2 ring-amber-400/30 shadow-lg shadow-amber-500/20"
          : status.canAccept
          ? "border-slate-700/50 hover:border-amber-500/50"
          : "border-red-500/20",
      )}
    >
      {/* Top row: Small flag + Status */}
      <div className="flex items-center justify-between w-full">
        <div className={cn(
          "size-10 rounded-lg flex items-center justify-center text-xl",
          "bg-slate-700/50 border border-slate-600/50"
        )}>
          {theme.flag}
        </div>
        <div className={cn(
          "absolute top-3 right-3 size-2.5 rounded-full",
          statusConfig.dotClass
        )} />
      </div>

      {/* Lottery Name - HERO ELEMENT */}
      <div className="flex-1 flex items-center justify-center min-h-[48px]">
        <p className={cn(
          "text-lg font-bold leading-tight text-center",
          isSelected && status.canAccept 
            ? "text-amber-300" 
            : "text-white"
        )}>
          {lottery.name}
        </p>
      </div>
      
      {/* Status Badge */}
      <Badge className={cn("text-xs w-fit mx-auto", statusConfig.badgeClass)}>
        {statusConfig.badge}
      </Badge>
      
      {/* Time Display */}
      {status.canAccept && status.status !== 'result_announced' && (
        <div className="flex items-center justify-center gap-1.5 text-sm">
          <Clock className={cn(
            "size-4",
            status.isClosingSoon ? "text-orange-400" : "text-green-400"
          )} />
          <span className={cn(
            "font-mono font-bold",
            status.isClosingSoon ? "text-orange-400" : "text-green-400"
          )}>
            {timeRemaining}
          </span>
        </div>
      )}
      
      {/* Close time */}
      {lottery.close_time && (
        <p className="text-xs text-slate-400">
          ปิด {lottery.close_time.slice(0, 5)} น.
        </p>
      )}
    </button>
  );
}

// Compact version
export function LotterySelectorCompact({ lotteries, selectedId, onSelect, className, isSuperAdmin = false }: LotterySelectorProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const sortedLotteries = useMemo(() => {
    return [...lotteries].sort((a, b) => {
      const statusA = getLotteryStatus(a, isSuperAdmin);
      const statusB = getLotteryStatus(b, isSuperAdmin);
      if (statusA.canAccept && !statusB.canAccept) return -1;
      if (!statusA.canAccept && statusB.canAccept) return 1;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
  }, [lotteries, now, isSuperAdmin]);

  const selectedLottery = lotteries.find(l => l.id === selectedId);
  const selectedStatus = selectedLottery ? getLotteryStatus(selectedLottery, isSuperAdmin) : null;
  const selectedTheme = selectedLottery ? getLotteryTheme(selectedLottery.name) : null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Ticket className="size-4" />
          <span>ประเภทหวย</span>
        </div>
        
        {selectedLottery && selectedStatus && selectedTheme && (
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
            selectedStatus.canAccept
              ? selectedStatus.isClosingSoon
                ? "bg-orange-500/20 text-orange-400"
                : selectedStatus.status === 'result_announced'
                ? "bg-blue-500/20 text-blue-400"
                : "bg-green-500/20 text-green-400"
              : "bg-red-500/20 text-red-400"
          )}>
            <span className="text-base">{selectedTheme.flag}</span>
            {selectedStatus.canAccept ? (
              selectedStatus.status === 'result_announced' ? (
                <>
                  <Sparkles className="size-3" />
                  <span>งวดถัดไป</span>
                </>
              ) : (
                <>
                  <Clock className={cn("size-3", selectedStatus.isClosingSoon && "animate-bounce")} />
                  <span className="font-mono">{selectedStatus.countdown ? formatTimeRemaining(selectedStatus.countdown) : '--:--'}</span>
                </>
              )
            ) : (
              <>
                <XCircle className="size-3" />
                <span>ปิดงวด</span>
              </>
            )}
          </div>
        )}
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-1.5 pb-2">
          <button
            type="button"
            onClick={() => onSelect('')}
            className={cn(
              "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              "border flex items-center gap-1.5",
              !selectedId
                ? "border-amber-500 bg-amber-500 text-black"
                : "border-border bg-secondary/50 hover:bg-secondary"
            )}
          >
            🎲 ทั้งหมด
          </button>
          
          {sortedLotteries.map((lottery) => {
            const status = getLotteryStatus(lottery, isSuperAdmin);
            const theme = getLotteryTheme(lottery.name);
            return (
              <button
                key={lottery.id}
                type="button"
                onClick={() => onSelect(lottery.id)}
                disabled={!status.canAccept}
                className={cn(
                  "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  "border flex items-center gap-1.5",
                  !status.canAccept && "opacity-40 cursor-not-allowed",
                  selectedId === lottery.id && status.canAccept
                    ? "border-amber-500 bg-amber-500 text-black"
                    : status.canAccept
                    ? status.isClosingSoon
                      ? "border-orange-500/50 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20"
                      : status.status === 'result_announced'
                      ? "border-blue-500/50 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                      : "border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                    : "border-red-500/30 bg-red-500/5 text-red-400"
                )}
              >
                <span>{theme.flag}</span>
                {lottery.name}
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
