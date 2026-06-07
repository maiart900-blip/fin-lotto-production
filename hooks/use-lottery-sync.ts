'use client';

import useSWR from 'swr';
import { useTenant } from '@/lib/tenant-context';

interface Lottery {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
  open_time: string;
  close_time: string;
  draw_days: string[];
  flag_emoji?: string;
  sort_order: number;
}

interface PayoutRate {
  id: string;
  lottery_id: string;
  bet_type: string;
  pay_rate: number;
  is_active: boolean;
}

interface SyncData {
  lotteries: Lottery[];
  payout_rates: PayoutRate[];
  blocked_numbers: any[];
  risk_settings: any[];
  bet_types: any[];
  synced_at: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Sync failed');
  return res.json();
};

/**
 * Hook สำหรับ Sync ข้อมูลหวยจากเว็บแม่แบบ Real-time
 * - Auto-refresh ทุก 30 วินาที
 * - ดึงข้อมูลหวย, อัตราจ่าย, เลขอั้น จากเว็บแม่
 */
export function useLotterySync(options?: { 
  refreshInterval?: number;
  syncType?: 'all' | 'lotteries' | 'payout_rates' | 'blocked_numbers';
}) {
  const { tenant } = useTenant();
  const refreshInterval = options?.refreshInterval ?? 30000; // 30 seconds default
  const syncType = options?.syncType ?? 'all';
  
  const tenantParam = (tenant as any)?.slug ? `&tenant=${(tenant as any).slug}` : '';
  const url = `/api/sync/master-settings?type=${syncType}${tenantParam}`;
  
  const { data, error, isLoading, mutate } = useSWR<{ success: boolean; data: SyncData }>(
    url,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
      errorRetryCount: 3,
      onError: (err) => {
        console.error('Lottery sync error:', err);
      },
    }
  );
  
  return {
    // Synced data
    lotteries: data?.data?.lotteries || [],
    payoutRates: data?.data?.payout_rates || [],
    blockedNumbers: data?.data?.blocked_numbers || [],
    riskSettings: data?.data?.risk_settings || [],
    betTypes: data?.data?.bet_types || [],
    
    // Status
    isLoading,
    isError: !!error,
    syncedAt: data?.data?.synced_at,
    
    // Actions
    refresh: mutate,
    
    // Helper functions
    getLotteryPayoutRate: (lotteryId: string, betType: string) => {
      const rate = data?.data?.payout_rates?.find(
        (r: PayoutRate) => r.lottery_id === lotteryId && r.bet_type === betType
      );
      return rate?.pay_rate || getDefaultPayoutRate(betType);
    },
    
    isNumberBlocked: (number: string, lotteryId?: string) => {
      return data?.data?.blocked_numbers?.some(
        (b: any) => b.number === number && (!lotteryId || b.lottery_id === lotteryId)
      ) || false;
    },
    
    getActiveLotteries: () => {
      return data?.data?.lotteries?.filter((l: Lottery) => l.is_active) || [];
    },
  };
}

// Default payout rates if not found in database
function getDefaultPayoutRate(betType: string): number {
  const defaults: Record<string, number> = {
    '3top': 900,
    '3tode': 150,
    '2top': 90,
    '2bot': 90,
    'run_top': 3.2,
    'run_bot': 4.2,
    '3front': 450,
    '3back': 450,
  };
  return defaults[betType] || 0;
}

/**
 * Hook สำหรับดึงเฉพาะ Active Lotteries แบบ Real-time
 */
export function useActiveLotteries() {
  const { data, error, isLoading, mutate } = useSWR<Lottery[]>(
    '/api/lotteries?active=true',
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );
  
  return {
    lotteries: data || [],
    isLoading,
    isError: !!error,
    refresh: mutate,
    
    // Group by category
    groupedLotteries: groupLotteriesByCategory(data || []),
  };
}

function groupLotteriesByCategory(lotteries: Lottery[]) {
  const groups: Record<string, Lottery[]> = {};
  
  for (const lottery of lotteries) {
    const category = lottery.category || 'other';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(lottery);
  }
  
  return groups;
}

export default useLotterySync;
