'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// =============================================================================
// MASTER PLATFORM CORE SYSTEM
// =============================================================================
// ระบบแกนกลางสำหรับ Multi-Tenant White Label Platform
// Super Admin มีอำนาจเหนือทุก Site ID ในเครือ
// =============================================================================

// Types
export interface Site {
  id: string;
  name: string;
  domain: string;
  apiKey: string;
  status: 'active' | 'suspended' | 'pending';
  createdAt: Date;
  settings: SiteSettings;
  stats: SiteStats;
}

export interface SiteSettings {
  branding: {
    logo: string;
    favicon: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    darkMode: boolean;
  };
  rates: {
    useGlobalRates: boolean;
    customRates?: Record<string, number>;
  };
  limits: {
    useGlobalLimits: boolean;
    customLimits?: Record<string, number>;
  };
  features: {
    autoDeposit: boolean;
    autoWithdraw: boolean;
    liveStream: boolean;
    promotions: boolean;
  };
}

export interface SiteStats {
  totalMembers: number;
  totalAgents: number;
  totalVolume: number;
  totalRevenue: number;
  todayVolume: number;
  todayRevenue: number;
}

export interface MasterAdmin {
  id: string;
  role: 'super_admin';
  permissions: MasterPermissions;
  creditLimit: 'infinity';
}

export interface MasterPermissions {
  canCreateSites: boolean;
  canDeleteSites: boolean;
  canSuspendSites: boolean;
  canManageAllAgents: boolean;
  canOverrideRates: boolean;
  canAccessAllWallets: boolean;
  canForceSettlement: boolean;
  canEmergencyStop: boolean;
}

// Default Master Admin Permissions (Full Access)
export const MASTER_ADMIN_PERMISSIONS: MasterPermissions = {
  canCreateSites: true,
  canDeleteSites: true,
  canSuspendSites: true,
  canManageAllAgents: true,
  canOverrideRates: true,
  canAccessAllWallets: true,
  canForceSettlement: true,
  canEmergencyStop: true,
};

// Master Platform Context
interface MasterPlatformContextType {
  // Current user
  isMasterAdmin: boolean;
  masterAdmin: MasterAdmin | null;
  
  // Sites management
  sites: Site[];
  currentSiteId: string | null;
  setCurrentSiteId: (id: string | null) => void;
  
  // Site operations
  createSite: (data: Partial<Site>) => Promise<Site>;
  updateSite: (id: string, data: Partial<Site>) => Promise<Site>;
  deleteSite: (id: string) => Promise<void>;
  suspendSite: (id: string) => Promise<void>;
  activateSite: (id: string) => Promise<void>;
  
  // Global operations
  getGlobalStats: () => GlobalStats;
  emergencyStopAll: () => Promise<void>;
  forceSettlementAll: () => Promise<void>;
  
  // Filtering
  filterBySiteId: <T extends { siteId: string }>(data: T[], siteId?: string | null) => T[];
  
  // Loading states
  isLoading: boolean;
  error: string | null;
}

interface GlobalStats {
  totalSites: number;
  activeSites: number;
  totalMembers: number;
  totalAgents: number;
  totalVolume: number;
  totalRevenue: number;
  todayVolume: number;
  todayRevenue: number;
}

const MasterPlatformContext = createContext<MasterPlatformContextType | undefined>(undefined);

// Mock Data for Development
const MOCK_SITES: Site[] = [
  {
    id: 'site_master',
    name: 'FinLotto Master',
    domain: 'finlotto.com',
    apiKey: 'master_api_key_xxxxx',
    status: 'active',
    createdAt: new Date('2024-01-01'),
    settings: {
      branding: {
        logo: '/logos/master.png',
        favicon: '/favicons/master.ico',
        primaryColor: '#FFD700',
        secondaryColor: '#1a1a2e',
        accentColor: '#10B981',
        darkMode: true,
      },
      rates: { useGlobalRates: true },
      limits: { useGlobalLimits: true },
      features: {
        autoDeposit: true,
        autoWithdraw: true,
        liveStream: true,
        promotions: true,
      },
    },
    stats: {
      totalMembers: 0,
      totalAgents: 0,
      totalVolume: 0,
      totalRevenue: 0,
      todayVolume: 0,
      todayRevenue: 0,
    },
  },
  {
    id: 'site_a',
    name: 'LottoKing',
    domain: 'lottoking.com',
    apiKey: 'site_a_api_key_xxxxx',
    status: 'active',
    createdAt: new Date('2024-03-15'),
    settings: {
      branding: {
        logo: '/logos/lottoking.png',
        favicon: '/favicons/lottoking.ico',
        primaryColor: '#3B82F6',
        secondaryColor: '#1e3a5f',
        accentColor: '#F59E0B',
        darkMode: true,
      },
      rates: { useGlobalRates: true },
      limits: { useGlobalLimits: true },
      features: {
        autoDeposit: true,
        autoWithdraw: true,
        liveStream: true,
        promotions: true,
      },
    },
    stats: {
      totalMembers: 15420,
      totalAgents: 245,
      totalVolume: 89500000,
      totalRevenue: 4475000,
      todayVolume: 2850000,
      todayRevenue: 142500,
    },
  },
  {
    id: 'site_b',
    name: 'GoldLotto',
    domain: 'goldlotto.net',
    apiKey: 'site_b_api_key_xxxxx',
    status: 'active',
    createdAt: new Date('2024-05-01'),
    settings: {
      branding: {
        logo: '/logos/goldlotto.png',
        favicon: '/favicons/goldlotto.ico',
        primaryColor: '#FFD700',
        secondaryColor: '#2d2d2d',
        accentColor: '#EF4444',
        darkMode: true,
      },
      rates: { useGlobalRates: false, customRates: { '3_top': 850, '2_bottom': 95 } },
      limits: { useGlobalLimits: true },
      features: {
        autoDeposit: true,
        autoWithdraw: true,
        liveStream: false,
        promotions: true,
      },
    },
    stats: {
      totalMembers: 8750,
      totalAgents: 120,
      totalVolume: 45200000,
      totalRevenue: 2260000,
      todayVolume: 1520000,
      todayRevenue: 76000,
    },
  },
  {
    id: 'site_c',
    name: 'LuckyDraw',
    domain: 'luckydraw.co',
    apiKey: 'site_c_api_key_xxxxx',
    status: 'suspended',
    createdAt: new Date('2024-06-01'),
    settings: {
      branding: {
        logo: '/logos/luckydraw.png',
        favicon: '/favicons/luckydraw.ico',
        primaryColor: '#10B981',
        secondaryColor: '#1a2e1a',
        accentColor: '#8B5CF6',
        darkMode: true,
      },
      rates: { useGlobalRates: true },
      limits: { useGlobalLimits: true },
      features: {
        autoDeposit: false,
        autoWithdraw: false,
        liveStream: true,
        promotions: false,
      },
    },
    stats: {
      totalMembers: 3200,
      totalAgents: 45,
      totalVolume: 12800000,
      totalRevenue: 640000,
      todayVolume: 0,
      todayRevenue: 0,
    },
  },
];

// Provider Component
export function MasterPlatformProvider({ children }: { children: React.ReactNode }) {
  const [sites, setSites] = useState<Site[]>(MOCK_SITES);
  const [currentSiteId, setCurrentSiteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Master Admin (always true for now - will integrate with auth later)
  const masterAdmin: MasterAdmin = {
    id: 'master_001',
    role: 'super_admin',
    permissions: MASTER_ADMIN_PERMISSIONS,
    creditLimit: 'infinity',
  };

  // Create Site
  const createSite = useCallback(async (data: Partial<Site>): Promise<Site> => {
    setIsLoading(true);
    try {
      const newSite: Site = {
        id: `site_${Date.now()}`,
        name: data.name || 'New Site',
        domain: data.domain || 'newsite.com',
        apiKey: `api_${Math.random().toString(36).substring(7)}`,
        status: 'pending',
        createdAt: new Date(),
        settings: data.settings || {
          branding: {
            logo: '',
            favicon: '',
            primaryColor: '#FFD700',
            secondaryColor: '#1a1a2e',
            accentColor: '#10B981',
            darkMode: true,
          },
          rates: { useGlobalRates: true },
          limits: { useGlobalLimits: true },
          features: {
            autoDeposit: true,
            autoWithdraw: true,
            liveStream: true,
            promotions: true,
          },
        },
        stats: {
          totalMembers: 0,
          totalAgents: 0,
          totalVolume: 0,
          totalRevenue: 0,
          todayVolume: 0,
          todayRevenue: 0,
        },
      };
      setSites(prev => [...prev, newSite]);
      return newSite;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update Site
  const updateSite = useCallback(async (id: string, data: Partial<Site>): Promise<Site> => {
    setIsLoading(true);
    try {
      let updatedSite: Site | undefined;
      setSites(prev => prev.map(site => {
        if (site.id === id) {
          updatedSite = { ...site, ...data };
          return updatedSite;
        }
        return site;
      }));
      if (!updatedSite) throw new Error('Site not found');
      return updatedSite;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Delete Site
  const deleteSite = useCallback(async (id: string): Promise<void> => {
    setIsLoading(true);
    try {
      setSites(prev => prev.filter(site => site.id !== id));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Suspend Site
  const suspendSite = useCallback(async (id: string): Promise<void> => {
    await updateSite(id, { status: 'suspended' });
  }, [updateSite]);

  // Activate Site
  const activateSite = useCallback(async (id: string): Promise<void> => {
    await updateSite(id, { status: 'active' });
  }, [updateSite]);

  // Get Global Stats
  const getGlobalStats = useCallback((): GlobalStats => {
    const activeSites = sites.filter(s => s.status === 'active');
    return {
      totalSites: sites.length,
      activeSites: activeSites.length,
      totalMembers: sites.reduce((sum, s) => sum + s.stats.totalMembers, 0),
      totalAgents: sites.reduce((sum, s) => sum + s.stats.totalAgents, 0),
      totalVolume: sites.reduce((sum, s) => sum + s.stats.totalVolume, 0),
      totalRevenue: sites.reduce((sum, s) => sum + s.stats.totalRevenue, 0),
      todayVolume: sites.reduce((sum, s) => sum + s.stats.todayVolume, 0),
      todayRevenue: sites.reduce((sum, s) => sum + s.stats.todayRevenue, 0),
    };
  }, [sites]);

  // Emergency Stop All Sites
  const emergencyStopAll = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      setSites(prev => prev.map(site => ({ ...site, status: 'suspended' as const })));
      console.log('[EMERGENCY] All sites suspended');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Force Settlement All
  const forceSettlementAll = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      console.log('[SETTLEMENT] Force settlement initiated for all sites');
      // Implementation will connect to actual settlement system
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Filter by Site ID
  const filterBySiteId = useCallback(<T extends { siteId: string }>(
    data: T[],
    siteId?: string | null
  ): T[] => {
    if (!siteId || siteId === 'all') return data;
    return data.filter(item => item.siteId === siteId);
  }, []);

  const value: MasterPlatformContextType = {
    isMasterAdmin: true,
    masterAdmin,
    sites,
    currentSiteId,
    setCurrentSiteId,
    createSite,
    updateSite,
    deleteSite,
    suspendSite,
    activateSite,
    getGlobalStats,
    emergencyStopAll,
    forceSettlementAll,
    filterBySiteId,
    isLoading,
    error,
  };

  return (
    <MasterPlatformContext.Provider value={value}>
      {children}
    </MasterPlatformContext.Provider>
  );
}

// Hook
export function useMasterPlatform() {
  const context = useContext(MasterPlatformContext);
  if (context === undefined) {
    throw new Error('useMasterPlatform must be used within a MasterPlatformProvider');
  }
  return context;
}

// Site Selector Component
export function SiteSelector({ 
  value, 
  onChange,
  showAllOption = true,
  className = ''
}: { 
  value: string | null; 
  onChange: (siteId: string | null) => void;
  showAllOption?: boolean;
  className?: string;
}) {
  const { sites } = useMasterPlatform();

  return (
    <select
      value={value || 'all'}
      onChange={(e) => onChange(e.target.value === 'all' ? null : e.target.value)}
      className={`px-4 py-2 rounded-lg bg-black/40 border border-amber-500/30 text-white focus:border-amber-400 focus:outline-none ${className}`}
    >
      {showAllOption && <option value="all">ทุกเว็บลูก</option>}
      {sites.map(site => (
        <option key={site.id} value={site.id}>
          {site.name} ({site.domain})
        </option>
      ))}
    </select>
  );
}

// Format currency for display
export function formatMasterCurrency(amount: number | 'infinity'): string {
  if (amount === 'infinity') return '∞ (ไม่จำกัด)';
  if (amount >= 1000000000) {
    return `฿${(amount / 1000000000).toFixed(2)}B`;
  }
  if (amount >= 1000000) {
    return `฿${(amount / 1000000).toFixed(2)}M`;
  }
  return `฿${amount.toLocaleString()}`;
}
