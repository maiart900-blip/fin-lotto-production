'use client';

import { useAuth, BranchInfo } from './use-auth';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';

export interface BranchWithDetails extends BranchInfo {
  branch_settings?: {
    site_name: string;
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    line_id?: string;
    support_phone?: string;
  };
  branch_finance?: {
    credit_limit: number;
    credit_used: number;
    credit_available: number;
    revenue_share_percent: number;
    total_revenue: number;
  };
}

export function useBranch() {
  const { user, branchId, branch, isMasterBranch, canAccessBranch } = useAuth();
  
  // Fetch branch details if user has a branch
  const { data: branchDetails, error, mutate } = useSWR<BranchWithDetails>(
    branchId ? `/api/admin/branches/${branchId}` : null,
    fetcher,
    { refreshInterval: 60000 } // Refresh every minute
  );

  // Fetch all child branches if user is master branch admin
  const { data: childBranches } = useSWR<{ branches: BranchWithDetails[] }>(
    isMasterBranch ? '/api/admin/branches?branch_type=branch' : null,
    fetcher,
    { refreshInterval: 60000 }
  );

  return {
    // Current branch info
    branchId,
    branch: branchDetails || branch,
    branchName: branchDetails?.name || branch?.name || 'ไม่ระบุสาขา',
    branchCode: branchDetails?.code || branch?.code || '',
    
    // Branch type flags
    isMasterBranch,
    isBranch: branch?.branch_type === 'branch',
    isSubBranch: branch?.branch_type === 'sub_branch',
    hasBranch: !!branchId,
    
    // Child branches (for master branch)
    childBranches: childBranches?.branches || [],
    
    // Branch settings
    branchSettings: branchDetails?.branch_settings,
    branchFinance: branchDetails?.branch_finance,
    
    // Helpers
    canAccessBranch,
    
    // Loading/error states
    isLoading: !branchDetails && !error && !!branchId,
    error,
    
    // Refresh
    refresh: mutate,
  };
}

// Hook to get branch-filtered data
export function useBranchFilter() {
  const { branchId, isMasterBranch } = useBranch();
  const { isSuperAdmin } = useAuth();
  
  // Build query params for branch filtering
  const getBranchQueryParams = (additionalParams?: Record<string, string>) => {
    const params = new URLSearchParams(additionalParams);
    
    // Super admin and master branch see all data
    if (!isSuperAdmin && !isMasterBranch && branchId) {
      params.set('branch_id', branchId);
    }
    
    return params.toString();
  };
  
  // Check if data belongs to current branch
  const belongsToBranch = (dataBranchId?: string | null) => {
    if (isSuperAdmin || isMasterBranch) return true;
    if (!branchId) return true; // No branch restriction
    return dataBranchId === branchId;
  };
  
  return {
    branchId,
    isMasterBranch,
    getBranchQueryParams,
    belongsToBranch,
    shouldFilterByBranch: !isSuperAdmin && !isMasterBranch && !!branchId,
  };
}
