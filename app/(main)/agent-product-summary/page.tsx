'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { RouteGuard } from '@/components/security/route-guard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Ticket,
  Spade,
  Trophy,
  Gamepad2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Calculator,
  Lock,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const ICONS: Record<string, LucideIcon> = {
  Ticket,
  Spade,
  Trophy,
  Gamepad2,
};

interface ProductSummary {
  type: 'lottery' | 'casino' | 'sports' | 'game';
  label: string;
  description: string;
  status: 'active' | 'coming_soon';
  icon: string;
  totalBets: number;
  totalPayout: number;
  grossProfit: number;
  agentShare: number;
  agentCommission: number;
  entryCount: number;
}

interface SummaryResponse {
  period: { start: string; end: string };
  products: ProductSummary[];
  totals: {
    totalBets: number;
    totalPayout: number;
    grossProfit: number;
    agentShare: number;
    agentCommission: number;
    entryCount: number;
  };
}

function formatMoney(amount: number) {
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  return amount.toLocaleString();
}

export default function AgentProductSummaryPage() {
  const now = new Date();
  const [start, setStart] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
  );
  const [end, setEnd] = useState(now.toISOString().slice(0, 10));
  const [selected, setSelected] = useState<'all' | ProductSummary['type']>('all');

  const { data, isLoading, mutate } = useSWR<SummaryResponse>(
    `/api/agent-network/product-summary?start=${start}&end=${end}`,
    fetcher,
  );

  const products = data?.products ?? [];
  const totals = data?.totals ?? {
    totalBets: 0,
    totalPayout: 0,
    grossProfit: 0,
    agentShare: 0,
    agentCommission: 0,
    entryCount: 0,
  };

  const visibleProducts =
    selected === 'all' ? products : products.filter((p) => p.type === selected);

  return (
    <RouteGuard requireSuperAdmin>
      <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1
              className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
              style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
            >
              สรุปยอดเอเย่นต์แยกตามสินค้า
            </h1>
            <p className="text-slate-400 mt-1">
              รวมยอดได้-เสียและค่าคอมของทุกสินค้าในระบบ (หวยทำงานจริง สินค้าอื่นเปิดเร็วๆ นี้)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-[150px] bg-black/40 border-slate-700"
              aria-label="วันที่เริ่มต้น"
            />
            <span className="text-slate-500">ถึง</span>
            <Input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-[150px] bg-black/40 border-slate-700"
              aria-label="วันที่สิ้นสุด"
            />
            <Button
              variant="outline"
              className="border-slate-600"
              onClick={() => mutate()}
              disabled={isLoading}
            >
              <RefreshCw className={cn('size-4 mr-2', isLoading && 'animate-spin')} />
              รีเฟรช
            </Button>
          </div>
        </div>

        {/* Totals (active products only) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard icon={TrendingUp} label="ยอดแทงรวม" value={formatMoney(totals.totalBets)} color="blue" />
          <StatCard icon={TrendingDown} label="ยอดจ่ายรวม" value={formatMoney(totals.totalPayout)} color="red" />
          <StatCard
            icon={DollarSign}
            label="กำไรขั้นต้น"
            value={formatMoney(totals.grossProfit)}
            color={totals.grossProfit >= 0 ? 'emerald' : 'red'}
          />
          <StatCard icon={Percent} label="ส่วนแบ่ง PT" value={formatMoney(totals.agentShare)} color="purple" />
          <StatCard icon={Calculator} label="ค่าคอมรวม" value={formatMoney(totals.agentCommission)} color="cyan" />
        </div>

        {/* Product filter */}
        <div className="flex flex-wrap gap-2">
          <FilterChip active={selected === 'all'} onClick={() => setSelected('all')}>
            ทั้งหมด
          </FilterChip>
          {products.map((p) => (
            <FilterChip key={p.type} active={selected === p.type} onClick={() => setSelected(p.type)}>
              {p.label}
              {p.status === 'coming_soon' && <Lock className="size-3 ml-1 inline" />}
            </FilterChip>
          ))}
        </div>

        {/* Product cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleProducts.map((p) => {
            const Icon = ICONS[p.icon] ?? Ticket;
            const isActive = p.status === 'active';
            return (
              <Card
                key={p.type}
                className={cn(
                  'bg-black/40 backdrop-blur-xl border-amber-500/30',
                  !isActive && 'opacity-70',
                )}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-amber-300 flex items-center gap-2">
                      <Icon className="size-5" />
                      {p.label}
                    </CardTitle>
                    {isActive ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                        ทำงานจริง
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">
                        <Lock className="size-3 mr-1" />
                        เร็วๆ นี้
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">{p.description}</p>
                </CardHeader>
                <CardContent>
                  {isActive ? (
                    <div className="grid grid-cols-2 gap-4">
                      <Metric label="ยอดแทง" value={formatMoney(p.totalBets)} />
                      <Metric label="ยอดจ่าย" value={formatMoney(p.totalPayout)} />
                      <Metric
                        label="กำไร/ขาดทุน"
                        value={formatMoney(p.grossProfit)}
                        highlight={p.grossProfit >= 0 ? 'up' : 'down'}
                      />
                      <Metric label="จำนวนโพย" value={p.entryCount.toLocaleString()} />
                      <Metric label="ส่วนแบ่ง PT" value={formatMoney(p.agentShare)} />
                      <Metric label="ค่าคอม" value={formatMoney(p.agentCommission)} />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="size-14 rounded-2xl bg-slate-800/60 flex items-center justify-center mb-3">
                        <Icon className="size-7 text-slate-500" />
                      </div>
                      <p className="text-slate-400 font-medium">อยู่ระหว่างพัฒนา</p>
                      <p className="text-xs text-slate-600 mt-1">
                        โครงสร้างข้อมูลพร้อมแล้ว รอเชื่อมต่อผู้ให้บริการ
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </RouteGuard>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  color: 'blue' | 'red' | 'emerald' | 'purple' | 'cyan';
}) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-400 border-blue-500/30 from-blue-500/20 to-blue-600/10',
    red: 'text-red-400 border-red-500/30 from-red-500/20 to-red-600/10',
    emerald: 'text-emerald-400 border-emerald-500/30 from-emerald-500/20 to-emerald-600/10',
    purple: 'text-purple-400 border-purple-500/30 from-purple-500/20 to-purple-600/10',
    cyan: 'text-cyan-400 border-cyan-500/30 from-cyan-500/20 to-cyan-600/10',
  };
  const c = colorMap[color];
  return (
    <Card className={cn('bg-black/40 backdrop-blur-xl', c.split(' ').find((x) => x.startsWith('border')))}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn('size-10 rounded-xl bg-gradient-to-br flex items-center justify-center', c)}>
            <Icon className={cn('size-5', c.split(' ')[0])} />
          </div>
          <div>
            <p className="text-xs text-slate-400">{label}</p>
            <p className={cn('text-lg font-bold', c.split(' ')[0])}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: 'up' | 'down';
}) {
  return (
    <div className="p-3 rounded-lg bg-white/5">
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={cn(
          'text-base font-bold font-mono',
          highlight === 'up' && 'text-emerald-400',
          highlight === 'down' && 'text-red-400',
          !highlight && 'text-slate-200',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-full text-sm font-medium transition-colors border',
        active
          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
          : 'bg-black/40 text-slate-400 border-slate-700 hover:border-slate-500',
      )}
    >
      {children}
    </button>
  );
}
