'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ChevronRight } from 'lucide-react';

interface Lottery {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
  close_time: string;
  flag_emoji?: string;
  country_code?: string;
  badge_text?: string;
  badge_color?: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Calculate countdown to close time
function useCountdown(closeTime: string) {
  const [timeLeft, setTimeLeft] = useState('');
  
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const [hours, minutes] = closeTime.split(':').map(Number);
      const closeDate = new Date();
      closeDate.setHours(hours, minutes, 0, 0);
      
      // If close time has passed today, set to tomorrow
      if (closeDate <= now) {
        closeDate.setDate(closeDate.getDate() + 1);
      }
      
      const diff = closeDate.getTime() - now.getTime();
      
      if (diff <= 0) {
        return 'ปิดรับแทง';
      }
      
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };
    
    setTimeLeft(calculateTimeLeft());
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [closeTime]);
  
  return timeLeft;
}

function LotteryCard({ lottery }: { lottery: Lottery }) {
  const countdown = useCountdown(lottery.close_time || '14:00');
  
  // Format close time for display
  const formatCloseTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    return `ปิดรับ ${hours}:${minutes}:00 น.`;
  };
  
  // Get badge text based on category
  const getBadgeText = () => {
    if (lottery.badge_text) return lottery.badge_text;
    if (lottery.category === 'thai' || lottery.country_code === 'TH') return 'TH';
    if (lottery.category === 'laos' || lottery.country_code === 'LA') return 'LA';
    if (lottery.category === 'vietnam' || lottery.country_code === 'VN') return 'VN';
    return 'TH';
  };
  
  return (
    <div className="lottery-card flex-shrink-0 w-[280px] sm:w-[320px]">
      <div className="premium-card p-4 h-full flex flex-col">
        {/* Badge */}
        <div className="flex justify-center mb-3">
          <div className="w-14 h-14 rounded-full border-2 border-amber-500/50 flex items-center justify-center bg-neutral-900/80">
            <span className="text-white font-bold text-lg">{getBadgeText()}</span>
          </div>
        </div>
        
        {/* Lottery Name */}
        <h3 className="text-white font-semibold text-center mb-1 text-balance">
          {lottery.name}
        </h3>
        
        {/* Close Time */}
        <p className="text-neutral-400 text-xs text-center mb-2">
          {formatCloseTime(lottery.close_time || '14:00')}
        </p>
        
        {/* Countdown */}
        <div className="text-center mb-4">
          <span className="text-red-500 font-mono font-bold text-xl tracking-wider">
            {countdown}
          </span>
        </div>
        
        {/* Bet Button */}
        <Link href={`/c/bet/${lottery.id}`} className="mt-auto">
          <button className="btn-luxury w-full h-11 rounded-xl text-sm font-semibold">
            แทงหวย
          </button>
        </Link>
      </div>
    </div>
  );
}

export function PopularLotteries() {
  const { data: lotteries, isLoading } = useSWR<Lottery[]>(
    '/api/lotteries?active=true',
    fetcher,
    { refreshInterval: 30000 }
  );
  
  // Filter popular/active lotteries
  const popularLotteries = lotteries?.slice(0, 10) || [];
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg">หวยยอดนิยม</h2>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 w-[280px] sm:w-[320px]">
              <div className="premium-card p-4 h-[200px] animate-pulse">
                <div className="flex justify-center mb-3">
                  <div className="w-14 h-14 rounded-full bg-neutral-800" />
                </div>
                <div className="h-4 bg-neutral-800 rounded mx-auto w-24 mb-2" />
                <div className="h-3 bg-neutral-800 rounded mx-auto w-32 mb-3" />
                <div className="h-6 bg-neutral-800 rounded mx-auto w-20 mb-4" />
                <div className="h-11 bg-neutral-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  if (popularLotteries.length === 0) {
    return null;
  }
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-lg">หวยยอดนิยม</h2>
        <Link 
          href="/c/lotteries" 
          className="flex items-center gap-1 text-amber-400 text-sm hover:text-amber-300 transition-colors"
        >
          ดูทั้งหมด
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      
      {/* Lottery Cards - Horizontal Scroll */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
        {popularLotteries.map((lottery) => (
          <LotteryCard key={lottery.id} lottery={lottery} />
        ))}
      </div>
    </div>
  );
}
