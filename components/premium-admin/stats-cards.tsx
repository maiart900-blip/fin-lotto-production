'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ========================================
// PREMIUM STATS CARDS
// Dashboard Summary Cards (4-Grid Layout)
// ========================================

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'gold';
  suffix?: string;
  prefix?: string;
}

interface StatsGridProps {
  stats: StatCardProps[];
  columns?: 2 | 3 | 4;
}

const variantStyles = {
  default: 'text-white',
  success: 'text-emerald-400',
  warning: 'text-orange-400',
  danger: 'text-red-400',
  gold: 'text-amber-400',
};

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendValue,
  variant = 'default',
  suffix,
  prefix,
}: StatCardProps) {
  const formattedValue = typeof value === 'number' ? value.toLocaleString() : value;
  
  return (
    <div className="p-4 rounded-xl bg-black/40 border border-amber-500/20 hover:border-amber-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
        {Icon && <Icon className="size-4 text-amber-500/50" />}
      </div>
      <div className={cn(
        "text-2xl font-bold font-mono",
        variantStyles[variant]
      )}>
        {prefix}{formattedValue}{suffix}
      </div>
      {trend && trendValue && (
        <div className={cn(
          "text-xs mt-1 flex items-center gap-1",
          trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-400'
        )}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
        </div>
      )}
    </div>
  );
}

export function StatsGrid({ stats, columns = 4 }: StatsGridProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
  };

  return (
    <div className={cn("grid gap-4 mb-6", gridCols[columns])}>
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
}

// Pre-configured Stats for Common Use Cases
export function MemberStats({ 
  total, 
  active, 
  outstanding, 
  profitLoss 
}: { 
  total: number; 
  active: number; 
  outstanding: number; 
  profitLoss: number; 
}) {
  return (
    <StatsGrid
      stats={[
        { label: 'สมาชิกทั้งหมด', value: total, variant: 'default' },
        { label: 'ใช้งานปกติ', value: active, variant: 'success' },
        { label: 'ยอดค้างรวม', value: outstanding, variant: 'warning' },
        { 
          label: 'กำไร/ขาดทุน', 
          value: Math.abs(profitLoss), 
          prefix: profitLoss >= 0 ? '+' : '-',
          variant: profitLoss >= 0 ? 'success' : 'danger' 
        },
      ]}
    />
  );
}

export function TransactionStats({ 
  deposits, 
  withdrawals, 
  pending, 
  today 
}: { 
  deposits: number; 
  withdrawals: number; 
  pending: number; 
  today: number; 
}) {
  return (
    <StatsGrid
      stats={[
        { label: 'ยอดฝากรวม', value: deposits, variant: 'success', prefix: '฿' },
        { label: 'ยอดถอนรวม', value: withdrawals, variant: 'danger', prefix: '฿' },
        { label: 'รอดำเนินการ', value: pending, variant: 'warning' },
        { label: 'ยอดวันนี้', value: today, variant: 'gold', prefix: '฿' },
      ]}
    />
  );
}

export function BettingStats({ 
  totalBets, 
  totalAmount, 
  wins, 
  losses 
}: { 
  totalBets: number; 
  totalAmount: number; 
  wins: number; 
  losses: number; 
}) {
  return (
    <StatsGrid
      stats={[
        { label: 'โพยทั้งหมด', value: totalBets, variant: 'default' },
        { label: 'ยอดแทงรวม', value: totalAmount, variant: 'gold', prefix: '฿' },
        { label: 'ชนะ', value: wins, variant: 'success' },
        { label: 'แพ้', value: losses, variant: 'danger' },
      ]}
    />
  );
}
