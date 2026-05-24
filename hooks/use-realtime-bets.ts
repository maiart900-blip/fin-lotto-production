'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './use-auth';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface RealtimeBet {
  id: string;
  number: string;
  bet_type: string;
  amount: number;
  customer_name: string;
  agent_name?: string;
  agent_id?: string;
  lottery_name: string;
  tenant_id?: string;
  tenant_name?: string;
  created_at: string;
  status: 'pending' | 'confirmed' | 'cancelled';
}

interface UseRealtimeBetsOptions {
  lotteryId?: string;
  agentId?: string;
  tenantId?: string;
  allTenants?: boolean; // View bets from all tenants (for master admin)
  limit?: number;
  enabled?: boolean;
}

export function useRealtimeBets(options: UseRealtimeBetsOptions = {}) {
  const { lotteryId, agentId, tenantId, allTenants = false, limit = 50, enabled = true } = options;
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [bets, setBets] = useState<RealtimeBet[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [newBetCount, setNewBetCount] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = createClient();

  // Fetch initial bets
  const fetchBets = useCallback(async () => {
    let query = supabase
      .from('entries')
      .select(`
        id,
        number,
        bet_type,
        amount,
        status,
        created_at,
        tenant_id,
        customers:customer_id (name),
        lotteries:lottery_id (name),
        users:user_id (display_name),
        tenants:tenant_id (name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    // RBAC: Filter based on role
    if (!isSuperAdmin && !isAdmin) {
      // Agent only sees their own bets
      if (user?.id) {
        query = query.eq('user_id', user.id);
      }
    } else if (agentId) {
      // Master/Admin can filter by specific agent
      query = query.eq('user_id', agentId);
    }

    // Tenant filter (for multi-site support)
    if (tenantId && !allTenants) {
      query = query.eq('tenant_id', tenantId);
    }
    // If allTenants is true, don't filter - show all

    if (lotteryId) {
      query = query.eq('lottery_id', lotteryId);
    }

    const { data, error } = await query;

    if (error) {
      return;
    }

    const formattedBets: RealtimeBet[] = (data || []).map((entry: any) => ({
      id: entry.id,
      number: entry.number,
      bet_type: entry.bet_type,
      amount: entry.amount,
      customer_name: entry.customers?.name || 'ไม่ระบุ',
      agent_name: entry.users?.display_name || 'ไม่ระบุ',
      agent_id: entry.user_id,
      lottery_name: entry.lotteries?.name || 'ไม่ระบุ',
      tenant_id: entry.tenant_id,
      tenant_name: entry.tenants?.name || 'เว็บหลัก',
      created_at: entry.created_at,
      status: entry.status || 'confirmed',
    }));

    setBets(formattedBets);
    setLastUpdate(new Date());
  }, [supabase, lotteryId, agentId, tenantId, allTenants, limit, user, isAdmin, isSuperAdmin]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!enabled || !user) return;

    // Initial fetch
    fetchBets();

    // Set up real-time subscription
    const channel = supabase
      .channel('entries-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'entries',
        },
        async (payload) => {
          // RBAC: Check if user should see this bet
          const newEntry = payload.new as any;
          
          // If not admin and not the agent who placed it, skip
          if (!isSuperAdmin && !isAdmin && newEntry.user_id !== user?.id) {
            return;
          }

          // If filtering by agent and doesn't match, skip
          if (agentId && newEntry.user_id !== agentId) {
            return;
          }

          // If filtering by lottery and doesn't match, skip
          if (lotteryId && newEntry.lottery_id !== lotteryId) {
            return;
          }

          // Fetch full entry data with relations
          const { data: fullEntry } = await supabase
            .from('entries')
            .select(`
              id,
              number,
              bet_type,
              amount,
              status,
              created_at,
              customers:customer_id (name),
              lotteries:lottery_id (name),
              users:user_id (display_name)
            `)
            .eq('id', newEntry.id)
            .single();

          if (fullEntry) {
            const newBet: RealtimeBet = {
              id: fullEntry.id,
              number: fullEntry.number,
              bet_type: fullEntry.bet_type,
              amount: fullEntry.amount,
              customer_name: (fullEntry.customers as any)?.name || 'ไม่ระบุ',
              agent_name: (fullEntry.users as any)?.display_name || 'ไม่ระบุ',
              agent_id: newEntry.user_id,
              lottery_name: (fullEntry.lotteries as any)?.name || 'ไม่ระบุ',
              created_at: fullEntry.created_at,
              status: fullEntry.status || 'confirmed',
            };

            setBets((prev) => [newBet, ...prev.slice(0, limit - 1)]);
            setNewBetCount((prev) => prev + 1);
            setLastUpdate(new Date());
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'entries',
        },
        (payload) => {
          const updatedEntry = payload.new as any;
          setBets((prev) =>
            prev.map((bet) =>
              bet.id === updatedEntry.id
                ? { ...bet, status: updatedEntry.status, amount: updatedEntry.amount }
                : bet
            )
          );
          setLastUpdate(new Date());
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [enabled, user, lotteryId, agentId, fetchBets, supabase, isAdmin, isSuperAdmin, limit]);

  // Reset new bet count
  const resetNewBetCount = useCallback(() => {
    setNewBetCount(0);
  }, []);

  // Manual refresh
  const refresh = useCallback(() => {
    fetchBets();
    setNewBetCount(0);
  }, [fetchBets]);

  return {
    bets,
    isConnected,
    lastUpdate,
    newBetCount,
    resetNewBetCount,
    refresh,
  };
}

// Hook for real-time credit updates
export function useRealtimeCredit(userId?: string) {
  const { user } = useAuth();
  const [credit, setCredit] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (!targetUserId) return;

    // Fetch initial credit
    const fetchCredit = async () => {
      const { data } = await supabase
        .from('users')
        .select('credit_balance')
        .eq('id', targetUserId)
        .single();
      
      if (data) {
        setCredit(data.credit_balance || 0);
      }
      setIsLoading(false);
    };

    fetchCredit();

    // Subscribe to credit changes
    const channel = supabase
      .channel(`credit-${targetUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${targetUserId}`,
        },
        (payload) => {
          const newData = payload.new as any;
          setCredit(newData.credit_balance || 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [targetUserId, supabase]);

  return { credit, isLoading };
}
