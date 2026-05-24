'use client';

import { useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import useSWR from 'swr';

interface DownlineStats {
  id: string;
  name: string;
  phone: string;
  level: string;
  turnover: number;
  winAmount: number;
  netProfit: number;
  totalBets: number;
  winRate: number;
  creditBalance: number;
  isActive: boolean;
  lastActivity: string | null;
}

interface DownlineData {
  success: boolean;
  period: string;
  totalDownlines: number;
  totalTurnover: number;
  totalWinAmount: number;
  totalProfit: number;
  profitMargin: number;
  downlines: DownlineStats[];
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useAgentDownline(agentId: string | null, period: string = 'today') {
  const { data, error, mutate } = useSWR<DownlineData>(
    agentId ? `/api/agents/downline-stats?agentId=${agentId}&period=${period}` : null,
    fetcher,
    {
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: true,
    }
  );

  // Subscribe to realtime updates for downline entries
  useEffect(() => {
    if (!agentId || !data?.downlines) return;

    const supabase = createClient();
    const downlineIds = data.downlines.map(d => d.id);
    
    if (downlineIds.length === 0) return;

    // Subscribe to new entries from downlines
    const entriesChannel = supabase
      .channel(`agent-${agentId}-downline-entries`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'entries',
          filter: `customer_id=in.(${downlineIds.join(',')})`,
        },
        () => {
          // Refresh data when new bet is placed by any downline
          mutate();
        }
      )
      .subscribe();

    // Subscribe to entry status updates (win/lose)
    const statusChannel = supabase
      .channel(`agent-${agentId}-downline-status`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'entries',
          filter: `customer_id=in.(${downlineIds.join(',')})`,
        },
        () => {
          // Refresh data when bet result is determined
          mutate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(entriesChannel);
      supabase.removeChannel(statusChannel);
    };
  }, [agentId, data?.downlines, mutate]);

  return {
    totalDownlines: data?.totalDownlines || 0,
    totalTurnover: data?.totalTurnover || 0,
    totalWinAmount: data?.totalWinAmount || 0,
    totalProfit: data?.totalProfit || 0,
    profitMargin: data?.profitMargin || 0,
    downlines: data?.downlines || [],
    period: data?.period || period,
    isLoading: !data && !error,
    isError: !!error,
    refresh: mutate,
  };
}
