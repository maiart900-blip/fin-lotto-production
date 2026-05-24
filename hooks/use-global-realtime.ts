'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import useSWR from 'swr';

interface GlobalStats {
  totalDeposits: number;
  totalWithdrawals: number;
  totalBets: number;
  totalPayouts: number;
  netProfit: number;
  activeCustomers: number;
  activeTenants: number;
}

interface TenantBreakdown {
  id: string;
  name: string;
  domain: string;
  deposits: number;
  withdrawals: number;
  bets: number;
  payouts: number;
  netProfit: number;
  isActive: boolean;
}

interface ActivityItem {
  id: string;
  type: 'deposit' | 'withdraw' | 'bet';
  amount: number;
  status: string;
  createdAt: string;
  tenantId: string;
  customerName: string;
  customerPhone?: string;
  lotteryName?: string;
}

interface GlobalRealtimeData {
  stats: GlobalStats;
  tenantBreakdown: TenantBreakdown[];
  activity: ActivityItem[];
  timestamp: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useGlobalRealtime() {
  const [realtimeActivity, setRealtimeActivity] = useState<ActivityItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch initial data with SWR
  const { data, error, mutate } = useSWR<{ success: boolean } & GlobalRealtimeData>(
    '/api/realtime/global-stats',
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds as fallback
      revalidateOnFocus: true,
    }
  );

  // Add new activity item to the list
  const addActivity = useCallback((item: ActivityItem) => {
    setRealtimeActivity(prev => {
      const newList = [item, ...prev].slice(0, 50); // Keep last 50 items
      return newList;
    });
  }, []);

  // Subscribe to Supabase Realtime
  useEffect(() => {
    const supabase = createClient();

    // Subscribe to transactions table
    const transactionsChannel = supabase
      .channel('global-transactions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
        },
        async (payload) => {
          const newTransaction = payload.new as any;
          
          // Fetch customer info
          const { data: customer } = await supabase
            .from('customers')
            .select('name, phone')
            .eq('id', newTransaction.customer_id)
            .single();

          addActivity({
            id: newTransaction.id,
            type: newTransaction.type === 'deposit' ? 'deposit' : 'withdraw',
            amount: Number(newTransaction.amount),
            status: newTransaction.status,
            createdAt: newTransaction.created_at,
            tenantId: newTransaction.tenant_id,
            customerName: customer?.name || 'ไม่ระบุ',
            customerPhone: customer?.phone,
          });

          // Refresh stats
          mutate();
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    // Subscribe to entries (bets) table
    const entriesChannel = supabase
      .channel('global-entries')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'entries',
        },
        async (payload) => {
          const newEntry = payload.new as any;
          
          // Fetch customer and lottery info
          const [customerResult, lotteryResult] = await Promise.all([
            supabase.from('customers').select('name').eq('id', newEntry.customer_id).single(),
            supabase.from('lotteries').select('name').eq('id', newEntry.lottery_id).single(),
          ]);

          addActivity({
            id: newEntry.id,
            type: 'bet',
            amount: Number(newEntry.total_amount),
            status: newEntry.status,
            createdAt: newEntry.created_at,
            tenantId: newEntry.tenant_id,
            customerName: customerResult.data?.name || 'ไม่ระบุ',
            lotteryName: lotteryResult.data?.name,
          });

          // Refresh stats
          mutate();
        }
      )
      .subscribe();

    // Subscribe to status updates
    const statusChannel = supabase
      .channel('global-status-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transactions',
        },
        () => {
          mutate(); // Refresh stats when transaction status changes
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'entries',
        },
        () => {
          mutate(); // Refresh stats when entry status changes
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(transactionsChannel);
      supabase.removeChannel(entriesChannel);
      supabase.removeChannel(statusChannel);
    };
  }, [addActivity, mutate]);

  // Merge realtime activity with fetched activity
  const mergedActivity = [...realtimeActivity, ...(data?.activity || [])]
    .filter((item, index, self) => 
      index === self.findIndex(t => t.id === item.id)
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50);

  return {
    stats: data?.stats || {
      totalDeposits: 0,
      totalWithdrawals: 0,
      totalBets: 0,
      totalPayouts: 0,
      netProfit: 0,
      activeCustomers: 0,
      activeTenants: 0,
    },
    tenantBreakdown: data?.tenantBreakdown || [],
    activity: mergedActivity,
    isLoading: !data && !error,
    isError: !!error,
    isConnected,
    refresh: mutate,
  };
}
