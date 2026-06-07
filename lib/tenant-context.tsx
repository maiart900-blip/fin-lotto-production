'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// =====================================
// Multi-Tenant Context for White Label
// =====================================
// รองรับ Sub-domain: site-a.finlotto.com, site-b.finlotto.com
// แยกข้อมูลตาม site_id แต่ใช้ Backend เดียวกัน

export interface TenantConfig {
  siteId: string;
  siteName: string;
  domain: string;
  
  // Branding
  logo: string;
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  
  // Theme
  theme: 'dark' | 'light' | 'midnight-gold';
  fontFamily: string;
  
  // Features
  features: {
    autoDeposit: boolean;
    autoWithdraw: boolean;
    lineNotify: boolean;
    liveStream: boolean;
    referralSystem: boolean;
  };
  
  // Settings
  useGlobalRates: boolean;
  useGlobalLimits: boolean;
  useGlobalWallet: boolean;
  
  // Contact
  lineId: string;
  phoneNumber: string;
  
  // Custom Text
  welcomeText: string;
  footerText: string;
  
  // Status
  isActive: boolean;
  isMaster: boolean;
}

const defaultMasterConfig: TenantConfig = {
  siteId: 'master',
  siteName: 'FIN LOTTO R+ Master',
  domain: 'finlotto.com',
  logo: '/images/logo-gold.png',
  favicon: '/favicon.ico',
  primaryColor: '#FFD700',
  secondaryColor: '#DAA520',
  accentColor: '#10B981',
  theme: 'midnight-gold',
  fontFamily: 'Prompt',
  features: {
    autoDeposit: true,
    autoWithdraw: true,
    lineNotify: true,
    liveStream: true,
    referralSystem: true,
  },
  useGlobalRates: true,
  useGlobalLimits: true,
  useGlobalWallet: true,
  lineId: '@finlotto',
  phoneNumber: '02-xxx-xxxx',
  welcomeText: 'ยินดีต้อนรับสู่ FIN LOTTO R+',
  footerText: '© 2024 FIN LOTTO R+ - Premium Lottery Platform',
  isActive: true,
  isMaster: true,
};

interface TenantContextType {
  tenant: TenantConfig;
  isLoading: boolean;
  isMaster: boolean;
  updateTenant: (config: Partial<TenantConfig>) => void;
  getSiteId: () => string;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

// Extract site_id from subdomain
function extractSiteId(hostname: string): string {
  // Examples:
  // site-a.finlotto.com -> site-a
  // site-b.finlotto.com -> site-b
  // finlotto.com -> master
  // localhost:3000 -> master (dev)
  
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return 'master';
  }
  
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    // Has subdomain
    return parts[0];
  }
  
  return 'master';
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<TenantConfig>(defaultMasterConfig);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadTenantConfig() {
      try {
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        const siteId = extractSiteId(hostname);
        
        if (siteId === 'master') {
          setTenant(defaultMasterConfig);
          setIsLoading(false);
          return;
        }
        
        // Fetch tenant config from API
        const response = await fetch(`/api/tenant/${siteId}`);
        if (response.ok) {
          const config = await response.json();
          setTenant(config);
        } else {
          // Fallback to master config with site_id
          setTenant({ ...defaultMasterConfig, siteId, isMaster: false });
        }
      } catch (error) {
        console.error('Failed to load tenant config:', error);
        setTenant(defaultMasterConfig);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadTenantConfig();
  }, []);

  // Apply dynamic theme CSS variables
  useEffect(() => {
    if (!isLoading && tenant) {
      const root = document.documentElement;
      root.style.setProperty('--tenant-primary', tenant.primaryColor);
      root.style.setProperty('--tenant-secondary', tenant.secondaryColor);
      root.style.setProperty('--tenant-accent', tenant.accentColor);
      
      // Update favicon
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (favicon && tenant.favicon) {
        favicon.href = tenant.favicon;
      }
      
      // Update title
      document.title = tenant.siteName;
    }
  }, [tenant, isLoading]);

  const updateTenant = (config: Partial<TenantConfig>) => {
    setTenant(prev => ({ ...prev, ...config }));
  };

  const getSiteId = () => tenant.siteId;

  return (
    <TenantContext.Provider value={{
      tenant,
      isLoading,
      isMaster: tenant.isMaster,
      updateTenant,
      getSiteId,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
}

// Hook for getting site-specific data
export function useSiteId() {
  const { tenant } = useTenant();
  return tenant.siteId;
}

// Hook for checking if current user is on master site
export function useIsMaster() {
  const { isMaster } = useTenant();
  return isMaster;
}
