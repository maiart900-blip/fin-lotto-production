"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';

interface Branch {
  id: string;
  code: string;
  name: string;
  branch_type: 'master' | 'branch' | 'sub_branch';
  is_master: boolean;
  is_active: boolean;
  parent_branch_id: string | null;
}

interface BranchContextType {
  // Current branch info
  currentBranch: Branch | null;
  isMaster: boolean;
  isLoading: boolean;
  
  // Branch hierarchy
  parentBranch: Branch | null;
  childBranches: Branch[];
  allAccessibleBranches: Branch[];
  
  // Realtime sync status
  isRealtimeConnected: boolean;
  lastSyncAt: Date | null;
  
  // Branch operations
  switchBranch: (branchId: string) => Promise<void>;
  refreshBranches: () => Promise<void>;
  
  // Data filtering helpers
  getBranchFilter: () => { branch_id: string } | { branch_id: { in: string[] } } | {};
  canAccessBranch: (branchId: string) => boolean;
  
  // Realtime push to parent
  pushToParent: (eventType: string, data: any) => Promise<void>;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isSuperAdmin } = useAuth();
  const supabase = createClient();
  
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [parentBranch, setParentBranch] = useState<Branch | null>(null);
  const [childBranches, setChildBranches] = useState<Branch[]>([]);
  const [allAccessibleBranches, setAllAccessibleBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const isMaster = currentBranch?.is_master === true || currentBranch?.branch_type === 'master';

  // Load branch data
  const loadBranchData = useCallback(async () => {
    if (!user?.branch_id) {
      setIsLoading(false);
      return;
    }

    try {
      // Get current branch
      const { data: branch } = await supabase
        .from('branches')
        .select('*')
        .eq('id', user.branch_id)
        .single();

      if (branch) {
        setCurrentBranch(branch);

        // Get parent branch if exists
        if (branch.parent_branch_id) {
          const { data: parent } = await supabase
            .from('branches')
            .select('*')
            .eq('id', branch.parent_branch_id)
            .single();
          setParentBranch(parent);
        }

        // Get child branches if this is master or parent
        if (branch.is_master || branch.branch_type === 'master' || branch.branch_type === 'branch') {
          const { data: children } = await supabase
            .from('branches')
            .select('*')
            .eq('parent_branch_id', branch.id)
            .eq('is_active', true);
          setChildBranches(children || []);
        }

        // Build accessible branches list
        const accessible: Branch[] = [branch];
        if (branch.is_master) {
          // Master can see all branches
          const { data: allBranches } = await supabase
            .from('branches')
            .select('*')
            .eq('is_active', true);
          setAllAccessibleBranches(allBranches || []);
        } else if (branch.branch_type === 'branch') {
          // Branch can see itself and sub-branches
          const { data: subBranches } = await supabase
            .from('branches')
            .select('*')
            .eq('parent_branch_id', branch.id)
            .eq('is_active', true);
          setAllAccessibleBranches([branch, ...(subBranches || [])]);
        } else {
          // Sub-branch can only see itself
          setAllAccessibleBranches([branch]);
        }
      }
    } catch (error) {
      console.error('Error loading branch data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.branch_id, supabase]);

  // Setup realtime subscription
  useEffect(() => {
    if (!currentBranch) return;

    // Subscribe to branch updates
    const channel = supabase
      .channel(`branch-sync-${currentBranch.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'branches',
          filter: `id=eq.${currentBranch.id}`,
        },
        (payload) => {
          setCurrentBranch(payload.new as Branch);
          setLastSyncAt(new Date());
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bets',
          filter: `branch_id=eq.${currentBranch.id}`,
        },
        () => {
          setLastSyncAt(new Date());
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
        },
        () => {
          setLastSyncAt(new Date());
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentBranch, supabase]);

  // Initial load
  useEffect(() => {
    if (isAuthenticated && user) {
      loadBranchData();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, user, loadBranchData]);

  // Switch branch (for master/admin users)
  const switchBranch = useCallback(async (branchId: string) => {
    if (!canAccessBranch(branchId)) {
      throw new Error('No permission to access this branch');
    }

    const { data: branch } = await supabase
      .from('branches')
      .select('*')
      .eq('id', branchId)
      .single();

    if (branch) {
      setCurrentBranch(branch);
      setLastSyncAt(new Date());
    }
  }, [supabase]);

  // Refresh branches
  const refreshBranches = useCallback(async () => {
    await loadBranchData();
    setLastSyncAt(new Date());
  }, [loadBranchData]);

  // Get filter for database queries
  const getBranchFilter = useCallback(() => {
    if (isSuperAdmin) {
      return {}; // No filter for super admin
    }
    
    if (isMaster) {
      // Master sees all branches
      const branchIds = allAccessibleBranches.map(b => b.id);
      return branchIds.length > 0 ? { branch_id: { in: branchIds } } : {};
    }
    
    if (currentBranch) {
      // Include current branch and all child branches
      const branchIds = [currentBranch.id, ...childBranches.map(b => b.id)];
      return { branch_id: { in: branchIds } };
    }
    
    return {};
  }, [isSuperAdmin, isMaster, currentBranch, childBranches, allAccessibleBranches]);

  // Check if can access a specific branch
  const canAccessBranch = useCallback((branchId: string): boolean => {
    if (isSuperAdmin) return true;
    if (!currentBranch) return false;
    
    // Can access own branch
    if (currentBranch.id === branchId) return true;
    
    // Master can access all
    if (isMaster) return true;
    
    // Can access child branches
    if (childBranches.some(b => b.id === branchId)) return true;
    
    return false;
  }, [isSuperAdmin, currentBranch, isMaster, childBranches]);

  // Push data to parent branch in realtime
  const pushToParent = useCallback(async (eventType: string, data: any) => {
    if (!currentBranch || !parentBranch) return;

    try {
      // Insert into realtime sync log
      await supabase.from('branch_sync_logs').insert({
        source_branch_id: currentBranch.id,
        target_branch_id: parentBranch.id,
        event_type: eventType,
        data: data,
        synced_at: new Date().toISOString(),
      });

      // Broadcast via realtime channel
      const channel = supabase.channel(`branch-${parentBranch.id}`);
      await channel.send({
        type: 'broadcast',
        event: eventType,
        payload: {
          source_branch_id: currentBranch.id,
          source_branch_name: currentBranch.name,
          data: data,
          timestamp: new Date().toISOString(),
        },
      });

      setLastSyncAt(new Date());
    } catch (error) {
      console.error('Error pushing to parent:', error);
    }
  }, [currentBranch, parentBranch, supabase]);

  return (
    <BranchContext.Provider
      value={{
        currentBranch,
        isMaster,
        isLoading,
        parentBranch,
        childBranches,
        allAccessibleBranches,
        isRealtimeConnected,
        lastSyncAt,
        switchBranch,
        refreshBranches,
        getBranchFilter,
        canAccessBranch,
        pushToParent,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranchContext() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error('useBranchContext must be used within a BranchProvider');
  }
  return context;
}

// Hook for easy branch-filtered data fetching
export function useBranchData<T>(
  tableName: string,
  options?: {
    select?: string;
    orderBy?: string;
    limit?: number;
    additionalFilters?: Record<string, any>;
  }
) {
  const { currentBranch, getBranchFilter, isLoading: branchLoading } = useBranchContext();
  const supabase = createClient();
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (branchLoading) return;

    const fetchData = async () => {
      try {
        let query = supabase
          .from(tableName)
          .select(options?.select || '*');

        // Apply branch filter
        const branchFilter = getBranchFilter();
        if ('branch_id' in branchFilter) {
          if (typeof branchFilter.branch_id === 'object' && 'in' in branchFilter.branch_id) {
            query = query.in('branch_id', branchFilter.branch_id.in);
          } else {
            query = query.eq('branch_id', branchFilter.branch_id);
          }
        }

        // Apply additional filters
        if (options?.additionalFilters) {
          Object.entries(options.additionalFilters).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }

        // Apply ordering
        if (options?.orderBy) {
          query = query.order(options.orderBy, { ascending: false });
        }

        // Apply limit
        if (options?.limit) {
          query = query.limit(options.limit);
        }

        const { data: result, error: fetchError } = await query;

        if (fetchError) throw fetchError;
        setData((result || []) as T[]);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [tableName, branchLoading, currentBranch, supabase, getBranchFilter, options]);

  return { data, isLoading, error };
}
