'use client';

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Lottery, getLotteryStatus, formatTimeRemaining } from '@/lib/lottery-utils';
import { CountdownTimer } from '@/components/customer/countdown-timer';
import { Clock, Ticket } from 'lucide-react';

// Category configurations
const CATEGORY_CONFIG = {
  yeekee: {
    label: 'กลุ่มหวยยี่กี',
    headerBg: 'bg-gradient-to-r from-pink-600 to-pink-500',
    keywords: ['ยี่กี'],
  },
  thai: {
    label: 'กลุ่มหวยไทย',
    headerBg: 'bg-gradient-to-r from-amber-600 to-yellow-500',
    keywords: ['รัฐบาล', 'ไทย'],
  },
  laos: {
    label: 'กลุ่มหวยลาว',
    headerBg: 'bg-gradient-to-r from-blue-600 to-blue-500',
    keywords: ['ลาว'],
  },
  vietnam: {
    label: 'กลุ่มหวยฮานอย',
    headerBg: 'bg-gradient-to-r from-red-600 to-red-500',
    keywords: ['ฮานอย', 'นอย'],
  },
  stock: {
    label: 'กลุ่มหวยหุ้น',
    headerBg: 'bg-gradient-to-r from-emerald-600 to-emerald-500',
    keywords: ['หุ้น', 'นิเคอิ', 'จีน', 'ฮั่งเส็ง', 'ไต้หวัน', 'เกาหลี', 'สิงคโปร์', 'อังกฤษ', 'เยอรมัน', 'รัสเซีย', 'ดาวโจนส์'],
  },
  foreign: {
    label: 'กลุ่มหวยต่างประเทศ',
    headerBg: 'bg-gradient-to-r from-purple-600 to-purple-500',
    keywords: ['มาเลย์', 'อินเดีย'],
  },
};

const FLAG_MAP: Record<string, string> = {
  'ลาว': '🇱🇦',
  'ฮานอย': '🇻🇳',
  'นอย': '🇻🇳',
  'รัฐบาล': '🇹🇭',
  'ไทย': '🇹🇭',
  'นิเคอิ': '🇯🇵',
  'จีน': '🇨🇳',
  'ฮั่งเส็ง': '🇭🇰',
  'ไต้หวัน': '🇹🇼',
  'เกาหลี': '🇰🇷',
  'สิงคโปร์': '🇸🇬',
  'อังกฤษ': '🇬🇧',
  'เยอรมัน': '🇩🇪',
  'รัสเซีย': '🇷🇺',
  'ดาวโจนส์': '🇺🇸',
  'มาเลย์': '🇲🇾',
  'อินเดีย': '🇮🇳',
  'ยี่กี': '🎲',
  'หุ้น': '📈',
};

function getLotteryFlag(name: string): string {
  const lowerName = name.toLowerCase();
  for (const [keyword, flag] of Object.entries(FLAG_MAP)) {
    if (lowerName.includes(keyword.toLowerCase())) {
      return flag;
    }
  }
  return '🎰';
}

function getLotteryCategory(name: string): keyof typeof CATEGORY_CONFIG | 'other' {
  const lowerName = name.toLowerCase();
  
  for (const [category, config] of Object.entries(CATEGORY_CONFIG)) {
    for (const keyword of config.keywords) {
      if (lowerName.includes(keyword.toLowerCase())) {
        return category as keyof typeof CATEGORY_CONFIG;
      }
    }
  }
  return 'other';
}

interface LotteryGridSelectorProps {
  lotteries: Lottery[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
}

export function LotteryGridSelector({ 
  lotteries, 
  selectedId, 
  onSelect, 
  className 
}: LotteryGridSelectorProps) {
  // Group lotteries by category
  const groupedLotteries = useMemo(() => {
    const groups: Record<string, Lottery[]> = {};
    
    for (const lottery of lotteries) {
      const category = getLotteryCategory(lottery.name);
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(lottery);
    }
    
    // Sort each group by sort_order
    for (const category of Object.keys(groups)) {
      groups[category].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }
    
    return groups;
  }, [lotteries]);

  // Order of categories to display
  const categoryOrder = ['yeekee', 'thai', 'laos', 'vietnam', 'stock', 'foreign', 'other'];

  return (
    <div className={cn('space-y-6', className)}>
      {categoryOrder.map((categoryKey) => {
        const categoryLotteries = groupedLotteries[categoryKey];
        if (!categoryLotteries || categoryLotteries.length === 0) return null;
        
        const config = CATEGORY_CONFIG[categoryKey as keyof typeof CATEGORY_CONFIG];
        const label = config?.label || 'หวยอื่นๆ';
        const headerBg = config?.headerBg || 'bg-gradient-to-r from-gray-600 to-gray-500';
        
        return (
          <div key={categoryKey} className="space-y-3">
            {/* Category Header */}
            <div className={cn('px-4 py-2 rounded-lg', headerBg)}>
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <Ticket className="h-4 w-4" />
                {label}
              </h3>
            </div>
            
            {/* 2-Column Grid */}
            <div className="grid grid-cols-2 gap-3">
              {categoryLotteries.map((lottery) => (
                <LotteryGridCard
                  key={lottery.id}
                  lottery={lottery}
                  isSelected={selectedId === lottery.id}
                  onClick={() => onSelect(lottery.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface LotteryGridCardProps {
  lottery: Lottery;
  isSelected: boolean;
  onClick: () => void;
}

function LotteryGridCard({ lottery, isSelected, onClick }: LotteryGridCardProps) {
  const [now, setNow] = useState(new Date());
  
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const status = getLotteryStatus(lottery, false);
  const flag = getLotteryFlag(lottery.name);
  
  // Calculate target close time
  const getCloseDateTime = (): Date => {
    const today = new Date();
    const [hours, minutes] = (lottery.close_time || '23:59').split(':').map(Number);
    const closeDate = new Date(today);
    closeDate.setHours(hours, minutes, 0, 0);
    
    // If close time has passed, it's for tomorrow
    if (closeDate < now) {
      closeDate.setDate(closeDate.getDate() + 1);
    }
    
    return closeDate;
  };

  const closeDateTime = getCloseDateTime();
  const isClosingSoon = status.isClosingSoon;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!status.canAccept}
      className={cn(
        'relative overflow-hidden rounded-xl p-3 transition-all duration-200',
        'flex flex-col gap-2 text-left',
        'bg-[#1a3d4d]/80 border',
        isSelected && status.canAccept
          ? 'border-emerald-400 ring-2 ring-emerald-400/30 shadow-lg shadow-emerald-500/20'
          : 'border-white/10 hover:border-white/20',
        !status.canAccept && 'opacity-50 cursor-not-allowed'
      )}
    >
      {/* Header Row: Flag + Name */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-lg">
          {flag}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn(
            'font-bold text-sm truncate',
            isSelected ? 'text-emerald-400' : 'text-white'
          )}>
            {lottery.name}
          </p>
        </div>
      </div>
      
      {/* Status & Time Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Clock className="h-3 w-3" />
          <span>ปิดรับ {lottery.close_time || '23:59'}</span>
        </div>
        
        {status.canAccept ? (
          <div className={cn(
            'px-2 py-0.5 rounded text-[10px] font-semibold',
            isClosingSoon
              ? 'bg-orange-500/20 text-orange-400'
              : 'bg-emerald-500/20 text-emerald-400'
          )}>
            {isClosingSoon ? 'ใกล้ปิด' : 'เปิดรับ'}
          </div>
        ) : (
          <div className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-400">
            ปิดรับ
          </div>
        )}
      </div>
      
      {/* Countdown Timer */}
      {status.canAccept && (
        <div className="pt-1 border-t border-white/10">
          <CountdownTimer 
            targetDate={closeDateTime} 
            compact 
            className={isClosingSoon ? 'text-orange-400' : 'text-yellow-400'}
          />
        </div>
      )}
    </button>
  );
}
