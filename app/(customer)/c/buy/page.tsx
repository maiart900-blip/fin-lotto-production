'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Clock, 
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Ticket,
  Search,
} from 'lucide-react';
import useSWR from 'swr';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { getFlagEmoji, detectCountryCode, COUNTRY_FLAGS } from '@/lib/country-flags';

interface Lottery {
  id: string;
  name: string;
  open_time: string;
  close_time: string;
  is_active: boolean;
  is_closed_temp: boolean;
  country_code?: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch');
  }
  return res.json();
};

// Countdown Timer Component with NaN protection
function CountdownTimer({ closeTime }: { closeTime: string | null | undefined }) {
  const [state, setState] = useState<{
    status: 'open' | 'closing' | 'closed' | 'unknown';
    display: string;
  }>({ status: 'unknown', display: '--:--:--' });

  useEffect(() => {
    // Validate closeTime
    if (!closeTime || typeof closeTime !== 'string') {
      setState({ status: 'unknown', display: '--:--:--' });
      return;
    }

    const updateTimer = () => {
      try {
        // Get current time in Bangkok timezone
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
        
        // Parse close time (format: HH:MM or HH:MM:SS)
        const timeParts = closeTime.split(':').map(Number);
        if (timeParts.some(isNaN) || timeParts.length < 2) {
          setState({ status: 'unknown', display: '--:--:--' });
          return;
        }
        
        const [closeH, closeM] = timeParts;
        if (closeH < 0 || closeH > 23 || closeM < 0 || closeM > 59) {
          setState({ status: 'unknown', display: '--:--:--' });
          return;
        }
        
        const closeDate = new Date(now);
        closeDate.setHours(closeH, closeM, 0, 0);
        
        const diff = closeDate.getTime() - now.getTime();
        
        if (diff <= 0) {
          setState({ status: 'closed', display: 'ปิดแล้ว' });
        } else {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          
          // NaN protection
          const safeHours = isNaN(hours) ? 0 : hours;
          const safeMinutes = isNaN(minutes) ? 0 : minutes;
          const safeSeconds = isNaN(seconds) ? 0 : seconds;
          
          const pad = (n: number) => n.toString().padStart(2, '0');
          const display = `${pad(safeHours)}:${pad(safeMinutes)}:${pad(safeSeconds)}`;
          const status = diff <= 30 * 60 * 1000 ? 'closing' : 'open';
          
          setState({ status, display });
        }
      } catch {
        setState({ status: 'unknown', display: '--:--:--' });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [closeTime]);

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-sm font-semibold",
      state.status === 'open' && "bg-emerald-500/20 text-emerald-400",
      state.status === 'closing' && "bg-amber-500/20 text-amber-400 animate-pulse",
      state.status === 'closed' && "bg-red-500/20 text-red-400",
      state.status === 'unknown' && "bg-slate-500/20 text-slate-400"
    )}>
      <Clock className="w-3.5 h-3.5" />
      {state.display}
    </div>
  );
}

// Flag Component
function LotteryFlag({ name, countryCode, size = 'md' }: { name: string; countryCode?: string; size?: 'sm' | 'md' | 'lg' }) {
  const flag = getFlagEmoji(name, countryCode);
  const sizeClass = size === 'sm' ? 'text-xl' : size === 'lg' ? 'text-4xl' : 'text-3xl';
  
  return (
    <div className={cn(
      "flex items-center justify-center rounded-full bg-slate-800/50 border border-slate-700/50",
      size === 'sm' && "w-8 h-8",
      size === 'md' && "w-12 h-12",
      size === 'lg' && "w-16 h-16",
    )}>
      <span className={sizeClass}>{flag}</span>
    </div>
  );
}

export default function BuyLotterySelectPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: lotteries, error, isLoading, mutate } = useSWR<Lottery[]>(
    '/api/lotteries',
    fetcher
  );

  // Filter active lotteries
  const activeLotteries = (lotteries || []).filter(l => l.is_active && !l.is_closed_temp);
  const closedLotteries = (lotteries || []).filter(l => !l.is_active || l.is_closed_temp);

  // Search filter
  const filteredActive = activeLotteries.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredClosed = closedLotteries.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] pb-20">
        <div className="sticky top-0 z-50 bg-[#0d1424] border-b border-slate-800">
          <div className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="w-10 h-10 rounded-full bg-slate-800" />
            <Skeleton className="h-6 w-32 bg-slate-800" />
          </div>
        </div>
        <div className="p-4 space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl bg-slate-800/50" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">เกิดข้อผิดพลาด</h2>
            <p className="text-sm text-slate-400">ไม่สามารถโหลดข้อมูลหวยได้</p>
          </div>
          <div className="flex gap-2 justify-center">
            <Button 
              onClick={() => mutate()} 
              variant="outline"
              className="border-slate-700 text-slate-300"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              ลองใหม่
            </Button>
            <Button onClick={() => router.push('/c')} variant="ghost" className="text-slate-400">
              กลับหน้าหลัก
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0d1424]/95 backdrop-blur-md border-b border-slate-800">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => router.back()}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">เลือกหวย</h1>
            <p className="text-xs text-slate-400">เลือกหวยที่ต้องการแทง</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => mutate()}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="ค้นหาหวย..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Active Lotteries */}
        {filteredActive.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-sm font-semibold text-slate-400">
                เปิดรับแทง ({filteredActive.length})
              </h2>
            </div>
            <div className="space-y-2">
              {filteredActive.map((lottery) => (
                <button
                  key={lottery.id}
                  onClick={() => router.push(`/c/lotto/${lottery.id}`)}
                  className="w-full bg-gradient-to-r from-slate-800/80 to-slate-800/40 hover:from-slate-700/80 hover:to-slate-700/40 border border-slate-700/50 hover:border-cyan-500/30 rounded-2xl p-4 flex items-center gap-4 transition-all duration-200 group"
                >
                  {/* Flag */}
                  <LotteryFlag name={lottery.name} countryCode={lottery.country_code} />
                  
                  {/* Info */}
                  <div className="flex-1 text-left">
                    <h3 className="font-bold text-white group-hover:text-cyan-400 transition-colors">
                      {lottery.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      ปิดรับ {lottery.close_time || '23:59'} น.
                    </p>
                  </div>

                  {/* Countdown */}
                  <div className="flex items-center gap-2">
                    <CountdownTimer closeTime={lottery.close_time} />
                    <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Closed Lotteries */}
        {filteredClosed.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <h2 className="text-sm font-semibold text-slate-400">
                ปิดรับแล้ว ({filteredClosed.length})
              </h2>
            </div>
            <div className="space-y-2 opacity-60">
              {filteredClosed.map((lottery) => (
                <div
                  key={lottery.id}
                  className="w-full bg-slate-800/30 border border-slate-800 rounded-2xl p-4 flex items-center gap-4"
                >
                  {/* Flag */}
                  <LotteryFlag name={lottery.name} countryCode={lottery.country_code} />
                  
                  {/* Info */}
                  <div className="flex-1 text-left">
                    <h3 className="font-bold text-slate-400">
                      {lottery.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      ปิดรับ {lottery.close_time || '23:59'} น.
                    </p>
                  </div>

                  {/* Badge */}
                  <Badge variant="secondary" className="bg-red-500/20 text-red-400 border-0">
                    ปิดรับแล้ว
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredActive.length === 0 && filteredClosed.length === 0 && (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-800/50 flex items-center justify-center">
              <Ticket className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">
              {searchQuery ? 'ไม่พบหวยที่ค้นหา' : 'ยังไม่มีหวยในระบบ'}
            </h3>
            <p className="text-sm text-slate-400">
              {searchQuery ? 'ลองค้นหาด้วยคำอื่น' : 'กรุณารอแอดมินเพิ่มหวย'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
