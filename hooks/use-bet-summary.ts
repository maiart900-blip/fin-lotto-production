import useSWR from 'swr';

// ===== BET SUMMARY HOOK =====
// Hook กลางสำหรับดึงยอดแทง - ทุกหน้าต้องใช้ hook นี้เท่านั้น
// ห้ามคำนวณยอดแทงเองในแต่ละหน้า

export interface BetSummary {
  // ยอดรวมทั้งหมด
  totalAmount: number;
  totalCount: number;
  
  // ยอดวันนี้
  todayAmount: number;
  todayCount: number;
  
  // แยกตาม source
  autoAmount: number;
  autoCount: number;
  manualKeyAmount: number;
  manualKeyCount: number;
  
  // สถานะ
  pendingAmount: number;
  wonAmount: number;
  lostAmount: number;
  
  // รางวัล
  totalPayoutAmount: number;
  pendingPayoutAmount: number;
  
  // กำไร/ขาดทุน
  profitLoss: number;
  
  // Debug info (only when debug=true)
  debug?: {
    tablesUsed: string[];
    entriesFound: number;
    betsFound: number;
    betItemsFound: number;
    todayEntriesFound: number;
    todayBetsFound: number;
    dateFilter: string;
    statusFilter: string[];
    sourceFilter: string;
    ownerFilter: string | null;
    errors: string[];
  };
}

export interface UseBetSummaryOptions {
  date?: string;
  startDate?: string;
  endDate?: string;
  lotteryId?: string;
  ownerId?: string;
  source?: 'auto' | 'manual_key' | 'all';
  customerId?: string;
  debug?: boolean;
  refreshInterval?: number;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useBetSummary(options: UseBetSummaryOptions = {}) {
  // Build query string
  const params = new URLSearchParams();
  if (options.date) params.set('date', options.date);
  if (options.startDate) params.set('startDate', options.startDate);
  if (options.endDate) params.set('endDate', options.endDate);
  if (options.lotteryId) params.set('lotteryId', options.lotteryId);
  if (options.ownerId) params.set('ownerId', options.ownerId);
  if (options.source && options.source !== 'all') params.set('source', options.source);
  if (options.customerId) params.set('customerId', options.customerId);
  if (options.debug) params.set('debug', 'true');
  
  const queryString = params.toString();
  const url = `/api/bet-summary${queryString ? `?${queryString}` : ''}`;
  
  const { data, error, isLoading, mutate } = useSWR<BetSummary>(
    url,
    fetcher,
    {
      refreshInterval: options.refreshInterval ?? 30000, // Default 30 วินาที
      revalidateOnFocus: true,
    }
  );
  
  return {
    data: data || {
      totalAmount: 0,
      totalCount: 0,
      todayAmount: 0,
      todayCount: 0,
      autoAmount: 0,
      autoCount: 0,
      manualKeyAmount: 0,
      manualKeyCount: 0,
      pendingAmount: 0,
      wonAmount: 0,
      lostAmount: 0,
      totalPayoutAmount: 0,
      pendingPayoutAmount: 0,
      profitLoss: 0,
    },
    error,
    isLoading,
    refresh: mutate,
  };
}

// ===== HELPER FUNCTIONS =====

// Format number with comma
export function formatAmount(amount: number): string {
  return amount.toLocaleString('th-TH');
}

// Format number with suffix (K, M, B)
export function formatAmountShort(amount: number): string {
  if (amount >= 1000000000) {
    return `${(amount / 1000000000).toFixed(2)}B`;
  }
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(2)}M`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`;
  }
  return amount.toString();
}

// Get profit/loss color class
export function getProfitLossColor(amount: number): string {
  if (amount > 0) return 'text-green-500';
  if (amount < 0) return 'text-red-500';
  return 'text-muted-foreground';
}

// Get profit/loss prefix
export function getProfitLossPrefix(amount: number): string {
  if (amount > 0) return '+';
  return '';
}
