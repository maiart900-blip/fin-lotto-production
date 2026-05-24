'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Trophy, Sparkles, Crown, Star, Wifi, WifiOff } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
});

interface WinningEntry {
  id: string;
  customerName: string;
  agentName: string;
  lotteryName: string;
  lotteryIcon: string;
  number: string;
  betType: string;
  prizeAmount: number;
  timestamp: string;
}

// Bet type labels
const BET_TYPE_LABELS: Record<string, string> = {
  'top_three': '3 ตัวบน',
  'bottom_three': '3 ตัวล่าง',
  'top_two': '2 ตัวบน',
  'bottom_two': '2 ตัวล่าง',
  'run_top': 'วิ่งบน',
  'run_bottom': 'วิ่งล่าง',
  'tood': 'โต๊ด',
};

// Custom hook for SSE connection
function useWinnersSSE() {
  const [winners, setWinners] = useState<WinningEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [newWinnerFlash, setNewWinnerFlash] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource('/api/winners/stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'initial' || data.type === 'update') {
          setWinners(data.winners || []);
        } else if (data.type === 'new_winner') {
          // Flash animation for new winner
          setNewWinnerFlash(true);
          setTimeout(() => setNewWinnerFlash(false), 2000);
          
          // Add new winner to the top
          setWinners(prev => [data.winner, ...prev].slice(0, 20));
        }
      } catch (error) {
        console.error('SSE parse error:', error);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();
      // Reconnect after 5 seconds
      setTimeout(connect, 5000);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
      eventSourceRef.current?.close();
    };
  }, [connect]);

  return { winners, isConnected, newWinnerFlash };
}

export function WinningTicker() {
  const { winners, isConnected, newWinnerFlash } = useWinnersSSE();

  // Duplicate for seamless loop
  const tickerItems = [...winners, ...winners];

  if (winners.length === 0) {
    return (
      <div className="winning-ticker py-3">
        <div className="flex items-center justify-center gap-2 text-[#64748B]">
          <Trophy className="size-4" />
          <span>รอผลรางวัล...</span>
          {isConnected ? (
            <Wifi className="size-3 text-green-500" />
          ) : (
            <WifiOff className="size-3 text-red-500" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`winning-ticker py-2 relative ${newWinnerFlash ? 'ring-2 ring-[#EAB308] ring-opacity-50' : ''}`}>
      {/* Gold decorative edges */}
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-[#020617] to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[#020617] to-transparent z-10" />
      
      {/* Ticker header with connection indicator */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex items-center gap-2 bg-gradient-to-r from-[#EAB308] to-[#B8860B] text-[#0F172A] px-3 py-1 rounded-full text-sm font-bold shadow-lg shadow-[#EAB308]/30">
        <Crown className="size-4" />
        <span>BIG WINS</span>
        <span className={`size-2 rounded-full ${isConnected ? 'bg-green-600 animate-pulse' : 'bg-red-600'}`} />
      </div>
      
      {/* Scrolling content */}
      <div className="winning-ticker-content ml-36">
        {tickerItems.map((winner, idx) => (
          <div key={`${winner.id}-${idx}`} className="winning-ticker-item">
            <span className="text-lg">{winner.lotteryIcon || '🎰'}</span>
            <Trophy className="size-4 text-[#EAB308]" />
            <span className="text-[#94A3B8]">{winner.customerName}</span>
            <span className="text-[#475569]">@</span>
            <span className="text-[#64748B] text-sm">{winner.agentName}</span>
            <span className="text-[#334155]">|</span>
            <span className="text-[#EAB308]">{winner.lotteryName}</span>
            <span className="text-[#334155]">-</span>
            <span className="font-mono text-[#FDE047] font-bold">{winner.number}</span>
            <span className="text-[#475569] text-sm">({BET_TYPE_LABELS[winner.betType] || winner.betType})</span>
            <span className="text-[#334155]">|</span>
            <span className="amount font-mono font-bold text-lg">+{winner.prizeAmount.toLocaleString()}</span>
            <Sparkles className="size-4 text-[#EAB308] animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Extended winner interface for API response
interface RecentWinner {
  id: string;
  customer_name: string;
  payout: number;
}

// Compact version for sidebar or smaller spaces
export function WinningTickerCompact() {
  const { data: winners = [], error } = useSWR<RecentWinner[]>(
    '/api/winners/recent?limit=5',
    fetcher,
    { 
      refreshInterval: 10000,
      onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
        if (retryCount >= 3) return;
        setTimeout(() => revalidate({ retryCount }), 5000);
      }
    }
  );

  if (error) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-amber-600 font-semibold text-sm">
          <Trophy className="size-4" />
          <span>รางวัลล่าสุด</span>
        </div>
        <p className="text-gray-500 text-xs">กำลังโหลด...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-amber-600 font-semibold text-sm">
        <Trophy className="size-4" />
        <span>รางวัลล่าสุด</span>
      </div>
      <div className="space-y-1">
        {winners.length === 0 ? (
          <p className="text-gray-500 text-xs">ยังไม่มีรางวัล</p>
        ) : (
          winners.slice(0, 5).map((winner) => (
            <div 
              key={winner.id} 
              className="flex items-center justify-between text-xs p-2 rounded-lg bg-gray-50 border border-gray-200"
            >
              <div className="flex items-center gap-2">
                <Star className="size-3 text-amber-500" />
                <span className="text-gray-700 truncate max-w-[80px]">{winner.customer_name}</span>
              </div>
              <span className="font-mono text-green-600 font-bold">+{winner.payout?.toLocaleString() || 0}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
