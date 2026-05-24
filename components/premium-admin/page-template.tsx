'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

// ========================================
// PREMIUM ADMIN PAGE TEMPLATE
// FIN LOTTO R+ - Dark Mode + Gold Theme
// ========================================

interface PageTemplateProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  children: ReactNode;
  tabs?: TabItem[];
  activeTab?: string;
  actions?: ReactNode;
}

interface TabItem {
  label: string;
  href: string;
  active?: boolean;
}

export function PremiumPageTemplate({
  title,
  subtitle,
  icon: Icon,
  children,
  tabs,
  activeTab,
  actions,
}: PageTemplateProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 
            className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 flex items-center gap-3"
            style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
          >
            {Icon && <Icon className="size-8 text-amber-400" />}
            {title}
          </h1>
          {subtitle && (
            <p className="text-slate-400 mt-2">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      {tabs && tabs.length > 0 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <a key={tab.href} href={tab.href}>
              <button
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200",
                  tab.active || tab.href === activeTab
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold shadow-lg shadow-amber-500/25" 
                    : "border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50"
                )}
              >
                {tab.label}
              </button>
            </a>
          ))}
        </div>
      )}

      {/* Page Content */}
      {children}
    </div>
  );
}
