'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

// =============================================================================
// GLOBAL UI CUSTOMIZATION SYSTEM (Dynamic UI Injection)
// =============================================================================
// เว็บแม่สามารถอัปโหลดโลโก้และตั้งค่าโทนสีให้แต่ละเว็บลูกได้จาก Dashboard
// =============================================================================

export interface SiteTheme {
  siteId: string;
  siteName: string;
  branding: {
    logo: string;
    logoAlt?: string;
    favicon: string;
    appName: string;
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
    success: string;
    warning: string;
    error: string;
  };
  typography: {
    fontFamily: string;
    headingFont: string;
  };
  darkMode: boolean;
  customCSS?: string;
}

// Default Master Theme (Midnight Gold)
export const MASTER_THEME: SiteTheme = {
  siteId: 'master',
  siteName: 'FinLotto Master',
  branding: {
    logo: '/logos/finlotto.png',
    favicon: '/favicon.ico',
    appName: 'FinLotto',
  },
  colors: {
    primary: '#FFD700',
    secondary: '#1a1a2e',
    accent: '#10B981',
    background: '#030712',
    surface: '#0a0f1a',
    text: '#ffffff',
    textMuted: '#94a3b8',
    border: 'rgba(255, 215, 0, 0.3)',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
  typography: {
    fontFamily: 'Inter, sans-serif',
    headingFont: 'Inter, sans-serif',
  },
  darkMode: true,
};

// Site Theme Presets
export const THEME_PRESETS: Record<string, Partial<SiteTheme['colors']>> = {
  gold: {
    primary: '#FFD700',
    secondary: '#1a1a2e',
    accent: '#10B981',
  },
  blue: {
    primary: '#3B82F6',
    secondary: '#1e3a5f',
    accent: '#F59E0B',
  },
  red: {
    primary: '#EF4444',
    secondary: '#2d1a1a',
    accent: '#FFD700',
  },
  green: {
    primary: '#10B981',
    secondary: '#1a2e1a',
    accent: '#8B5CF6',
  },
  purple: {
    primary: '#8B5CF6',
    secondary: '#1a1a2e',
    accent: '#F59E0B',
  },
};

// Theme Context
interface ThemeContextType {
  theme: SiteTheme;
  setTheme: (theme: Partial<SiteTheme>) => void;
  applyThemeForSite: (siteId: string) => void;
  resetToMasterTheme: () => void;
  generateCSSVariables: () => string;
  previewTheme: (theme: Partial<SiteTheme>) => void;
  isPreviewMode: boolean;
  exitPreview: () => void;
  refreshWebImages: () => Promise<void>;
  webImages: Record<string, string>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Mock site themes (would come from database in production)
const SITE_THEMES: Record<string, SiteTheme> = {
  master: MASTER_THEME,
  site_a: {
    ...MASTER_THEME,
    siteId: 'site_a',
    siteName: 'LottoKing',
    branding: {
      logo: '/logos/lottoking.png',
      favicon: '/favicons/lottoking.ico',
      appName: 'LottoKing',
    },
    colors: {
      ...MASTER_THEME.colors,
      primary: '#3B82F6',
      secondary: '#1e3a5f',
      accent: '#F59E0B',
      border: 'rgba(59, 130, 246, 0.3)',
    },
  },
  site_b: {
    ...MASTER_THEME,
    siteId: 'site_b',
    siteName: 'GoldLotto',
    branding: {
      logo: '/logos/goldlotto.png',
      favicon: '/favicons/goldlotto.ico',
      appName: 'GoldLotto',
    },
    colors: {
      ...MASTER_THEME.colors,
      primary: '#FFD700',
      secondary: '#2d2d2d',
      accent: '#EF4444',
    },
  },
  site_c: {
    ...MASTER_THEME,
    siteId: 'site_c',
    siteName: 'LuckyDraw',
    branding: {
      logo: '/logos/luckydraw.png',
      favicon: '/favicons/luckydraw.ico',
      appName: 'LuckyDraw',
    },
    colors: {
      ...MASTER_THEME.colors,
      primary: '#10B981',
      secondary: '#1a2e1a',
      accent: '#8B5CF6',
      border: 'rgba(16, 185, 129, 0.3)',
    },
  },
};

// Provider Component
export function DynamicThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<SiteTheme>(MASTER_THEME);
  const [previewThemeState, setPreviewThemeState] = useState<SiteTheme | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [webImages, setWebImages] = useState<Record<string, string>>({});

  // Fetch web images from database
  useEffect(() => {
    const fetchWebImages = async () => {
      try {
        const response = await fetch('/api/web-images');
        if (response.ok) {
          const data = await response.json();
          const imagesMap: Record<string, string> = {};
          data.forEach((img: { key: string; image_url: string }) => {
            if (img.image_url) {
              imagesMap[img.key] = img.image_url;
            }
          });
          setWebImages(imagesMap);
        }
      } catch (error) {
        console.error('Failed to fetch web images:', error);
      }
    };
    fetchWebImages();
  }, []);

  // Get current active theme with web images merged
  const activeTheme = isPreviewMode && previewThemeState ? previewThemeState : {
    ...theme,
    branding: {
      ...theme.branding,
      logo: webImages['site_logo'] || theme.branding.logo,
      favicon: webImages['favicon'] || theme.branding.favicon,
    }
  };

  // Apply theme to document
  useEffect(() => {
    applyThemeToDOM(activeTheme);
  }, [activeTheme]);

  // Set theme
  const setTheme = (newTheme: Partial<SiteTheme>) => {
    setThemeState(prev => ({ ...prev, ...newTheme }));
  };

  // Apply theme for specific site
  const applyThemeForSite = (siteId: string) => {
    const siteTheme = SITE_THEMES[siteId] || MASTER_THEME;
    setThemeState(siteTheme);
  };

  // Reset to master theme
  const resetToMasterTheme = () => {
    setThemeState(MASTER_THEME);
  };

  // Generate CSS variables string
  const generateCSSVariables = (): string => {
    return `
      :root {
        --color-primary: ${activeTheme.colors.primary};
        --color-secondary: ${activeTheme.colors.secondary};
        --color-accent: ${activeTheme.colors.accent};
        --color-background: ${activeTheme.colors.background};
        --color-surface: ${activeTheme.colors.surface};
        --color-text: ${activeTheme.colors.text};
        --color-text-muted: ${activeTheme.colors.textMuted};
        --color-border: ${activeTheme.colors.border};
        --color-success: ${activeTheme.colors.success};
        --color-warning: ${activeTheme.colors.warning};
        --color-error: ${activeTheme.colors.error};
        --font-family: ${activeTheme.typography.fontFamily};
        --font-heading: ${activeTheme.typography.headingFont};
      }
    `;
  };

  // Preview theme without saving
  const previewTheme = (newTheme: Partial<SiteTheme>) => {
    setPreviewThemeState({ ...theme, ...newTheme });
    setIsPreviewMode(true);
  };

  // Exit preview mode
  const exitPreview = () => {
    setPreviewThemeState(null);
    setIsPreviewMode(false);
  };

  // Refresh web images from database
  const refreshWebImages = async () => {
    try {
      const response = await fetch('/api/web-images');
      if (response.ok) {
        const data = await response.json();
        const imagesMap: Record<string, string> = {};
        data.forEach((img: { key: string; image_url: string }) => {
          if (img.image_url) {
            imagesMap[img.key] = img.image_url;
          }
        });
        setWebImages(imagesMap);
      }
    } catch (error) {
      console.error('Failed to refresh web images:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{
      theme: activeTheme,
      setTheme,
      applyThemeForSite,
      resetToMasterTheme,
      generateCSSVariables,
      previewTheme,
      isPreviewMode,
      exitPreview,
      refreshWebImages,
      webImages,
    }}>
      {children}
      {/* Inject dynamic CSS */}
      <style dangerouslySetInnerHTML={{ __html: generateCSSVariables() }} />
    </ThemeContext.Provider>
  );
}

// Hook
export function useDynamicTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useDynamicTheme must be used within a DynamicThemeProvider');
  }
  return context;
}

// Helper function to apply theme to DOM
function applyThemeToDOM(theme: SiteTheme) {
  const root = document.documentElement;
  
  // Set CSS custom properties
  root.style.setProperty('--color-primary', theme.colors.primary);
  root.style.setProperty('--color-secondary', theme.colors.secondary);
  root.style.setProperty('--color-accent', theme.colors.accent);
  root.style.setProperty('--color-background', theme.colors.background);
  root.style.setProperty('--color-surface', theme.colors.surface);
  root.style.setProperty('--color-text', theme.colors.text);
  root.style.setProperty('--color-text-muted', theme.colors.textMuted);
  root.style.setProperty('--color-border', theme.colors.border);

  // Update favicon
  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (favicon) {
    favicon.href = theme.branding.favicon;
  }

  // Update title
  document.title = theme.branding.appName;
}

// Color picker component for admin
export function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm text-slate-400 w-32">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg cursor-pointer border-2 border-amber-500/30"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 px-3 py-2 bg-black/40 border border-amber-500/30 rounded-lg text-white text-sm"
        />
      </div>
    </div>
  );
}

// Theme preview card
export function ThemePreviewCard({ theme }: { theme: SiteTheme }) {
  return (
    <div 
      className="p-4 rounded-xl border-2"
      style={{ 
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div 
          className="size-10 rounded-lg flex items-center justify-center text-white font-bold"
          style={{ backgroundColor: theme.colors.primary }}
        >
          {theme.branding.appName.charAt(0)}
        </div>
        <div>
          <p style={{ color: theme.colors.text }} className="font-bold">
            {theme.branding.appName}
          </p>
          <p style={{ color: theme.colors.textMuted }} className="text-sm">
            {theme.siteName}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <div 
          className="px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: theme.colors.primary }}
        >
          Primary
        </div>
        <div 
          className="px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: theme.colors.accent }}
        >
          Accent
        </div>
        <div 
          className="px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: theme.colors.success }}
        >
          Success
        </div>
      </div>
    </div>
  );
}
