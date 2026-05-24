'use client';

import { useState, useCallback } from 'react';
import { 
  Coins, TrendingUp, Wallet, ArrowUpRight, 
  Calendar, Download, RefreshCw, Sparkles,
  ChevronLeft, ChevronRight, Clock, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import useSWR from 'swr';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Commission log type
interface CommissionLog {
  id: string;
  customer_name: string;
  lottery_name: string;
  bet_amount: number;
  bet_type: string;
  commission_rate: number;
  commission_amount: number;
  status: string;
  created_at: string;
}

// Stats type
interface CommissionStats {
  today: number;
  yesterday: number;
  thisWeek: number;
  thisMonth: number;
  total: number;
  pending: number;
  trend: Array<{ date: string; amount: number }>;
  byLottery: Array<{ name: string; amount: number }>;
}

// Gold-themed chart tooltip
function GoldTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="ultra-glass-card px-4 py-3">
      <p className="text-[#94A3B8] text-sm">{label}</p>
      <p className="text-[#FDE047] font-bold text-lg">
        ฿{payload[0].value?.toLocaleString()}
      </p>
    </div>
  );
}

// Animated transfer button
function TransferButton({ 
  amount, 
  onTransfer, 
  isLoading 
}: { 
  amount: number; 
  onTransfer: () => void; 
  isLoading: boolean;
}) {
  return (
    <button
      onClick={onTransfer}
      disabled={isLoading || amount <= 0}
      className={`
        relative overflow-hidden px-6 py-3 rounded-xl font-bold
        transition-all duration-300 group
        ${amount > 0 
          ? 'bg-gradient-to-r from-[#B8860B] via-[#EAB308] to-[#B8860B] text-[#0F172A] hover:shadow-lg hover:shadow-[#EAB308]/30 hover:scale-105' 
          : 'bg-[#1E293B] text-[#64748B] cursor-not-allowed'
        }
      `}
    >
      {/* Shimmer effect */}
      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
      
      <span className="relative flex items-center gap-2">
        {isLoading ? (
          <>
            <RefreshCw className="size-5 animate-spin" />
            กำลังโอน...
          </>
        ) : (
          <>
            <Wallet className="size-5" />
            โอนไปกระเป๋าหลัก
            <Sparkles className="size-4" />
          </>
        )}
      </span>
    </button>
  );
}

// Stats card with glassmorphism
function StatsCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue, 
  trend,
  color = 'gold'
}: { 
  icon: any; 
  label: string; 
  value: string; 
  subValue?: string;
  trend?: number;
  color?: 'gold' | 'green' | 'blue';
}) {
  const colors = {
    gold: {
      icon: 'text-[#EAB308]',
      glow: 'shadow-[#EAB308]/20',
      border: 'border-[#EAB308]/30',
      value: 'text-[#FDE047]'
    },
    green: {
      icon: 'text-[#22C55E]',
      glow: 'shadow-[#22C55E]/20',
      border: 'border-[#22C55E]/30',
      value: 'text-[#4ADE80]'
    },
    blue: {
      icon: 'text-[#3B82F6]',
      glow: 'shadow-[#3B82F6]/20',
      border: 'border-[#3B82F6]/30',
      value: 'text-[#60A5FA]'
    }
  };

  const c = colors[color];

  return (
    <div className={`
      ultra-glass-card p-6 
      hover:shadow-lg ${c.glow}
      transition-all duration-300 hover:-translate-y-1
    `}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl bg-gradient-to-br from-[#1E293B] to-[#0F172A] border ${c.border}`}>
          <Icon className={`size-6 ${c.icon}`} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-sm ${trend >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            <ArrowUpRight className={`size-4 ${trend < 0 ? 'rotate-180' : ''}`} />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="text-[#64748B] text-sm mb-1">{label}</p>
      <p className={`text-2xl font-bold ${c.value}`}>{value}</p>
      {subValue && <p className="text-[#475569] text-sm mt-1">{subValue}</p>}
    </div>
  );
}

// Commission table row
function CommissionRow({ log, index }: { log: CommissionLog; index: number }) {
  const betTypeLabels: Record<string, string> = {
    'top_three': '3 ตัวบน',
    'bottom_three': '3 ตัวล่าง',
    'top_two': '2 ตัวบน',
    'bottom_two': '2 ตัวล่าง',
    'run_top': 'วิ่งบน',
    'run_bottom': 'วิ่งล่าง',
    'tood': 'โต๊ด',
  };

  return (
    <tr 
      className="border-b border-[#1E293B] hover:bg-[#1E293B]/50 transition-colors"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-gradient-to-br from-[#EAB308]/20 to-[#B8860B]/20 flex items-center justify-center border border-[#EAB308]/30">
            <span className="text-[#EAB308] font-bold text-sm">
              {log.customer_name?.charAt(0) || 'U'}
            </span>
          </div>
          <div>
            <p className="text-white font-medium">{log.customer_name || 'Unknown'}</p>
            <p className="text-[#64748B] text-sm">{log.lottery_name}</p>
          </div>
        </div>
      </td>
      <td className="py-4 px-4">
        <span className="text-[#94A3B8]">
          {betTypeLabels[log.bet_type] || log.bet_type}
        </span>
      </td>
      <td className="py-4 px-4 text-right">
        <span className="text-white font-mono">
          ฿{log.bet_amount?.toLocaleString()}
        </span>
      </td>
      <td className="py-4 px-4 text-center">
        <span className="px-2 py-1 rounded-full text-sm bg-[#EAB308]/10 text-[#EAB308] border border-[#EAB308]/30">
          {log.commission_rate}%
        </span>
      </td>
      <td className="py-4 px-4 text-right">
        <span className="text-[#FDE047] font-bold font-mono">
          +฿{log.commission_amount?.toLocaleString()}
        </span>
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          {log.status === 'credited' ? (
            <span className="flex items-center gap-1 text-[#22C55E] text-sm">
              <CheckCircle2 className="size-4" />
              โอนแล้ว
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[#EAB308] text-sm">
              <Clock className="size-4" />
              รอดำเนินการ
            </span>
          )}
        </div>
      </td>
      <td className="py-4 px-4 text-right">
        <span className="text-[#64748B] text-sm">
          {new Date(log.created_at).toLocaleString('th-TH', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      </td>
    </tr>
  );
}

export default function AgentCommissionDashboard() {
  const [isTransferring, setIsTransferring] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');

  // Fetch commission stats
  const { data: stats, mutate: mutateStats } = useSWR<CommissionStats>(
    '/api/agent/commission/stats',
    fetcher,
    { refreshInterval: 30000 }
  );

  // Fetch commission logs
  const { data: logsData, mutate: mutateLogs } = useSWR<{ logs: CommissionLog[]; total: number }>(
    `/api/agent/commission/logs?page=${currentPage}&range=${dateRange}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Mock data for demo
  const mockStats: CommissionStats = {
    today: 12500,
    yesterday: 10800,
    thisWeek: 87500,
    thisMonth: 356000,
    total: 1250000,
    pending: 45000,
    trend: [
      { date: '1 พ.ค.', amount: 8500 },
      { date: '2 พ.ค.', amount: 12000 },
      { date: '3 พ.ค.', amount: 9800 },
      { date: '4 พ.ค.', amount: 15200 },
      { date: '5 พ.ค.', amount: 11500 },
      { date: '6 พ.ค.', amount: 18000 },
      { date: '7 พ.ค.', amount: 12500 },
    ],
    byLottery: [
      { name: 'หวยรัฐบาล', amount: 45000 },
      { name: 'หวยลาว', amount: 28000 },
      { name: 'หวยฮานอย', amount: 22000 },
      { name: 'หวยยี่กี', amount: 18000 },
    ]
  };

  const mockLogs: CommissionLog[] = [
    { id: '1', customer_name: 'สมชาย ใจดี', lottery_name: 'หวยรัฐบาล', bet_amount: 5000, bet_type: 'top_three', commission_rate: 3, commission_amount: 150, status: 'credited', created_at: new Date().toISOString() },
    { id: '2', customer_name: 'มานี มีทอง', lottery_name: 'หวยลาว', bet_amount: 10000, bet_type: 'top_two', commission_rate: 2.5, commission_amount: 250, status: 'credited', created_at: new Date().toISOString() },
    { id: '3', customer_name: 'วิชัย รวยมาก', lottery_name: 'หวยฮานอย', bet_amount: 8000, bet_type: 'bottom_two', commission_rate: 2, commission_amount: 160, status: 'pending', created_at: new Date().toISOString() },
    { id: '4', customer_name: 'สุภา สุขใจ', lottery_name: 'หวยยี่กี', bet_amount: 3000, bet_type: 'run_top', commission_rate: 5, commission_amount: 150, status: 'credited', created_at: new Date().toISOString() },
    { id: '5', customer_name: 'ประสิทธิ์ ดีเลิศ', lottery_name: 'หวยรัฐบาล', bet_amount: 15000, bet_type: 'tood', commission_rate: 2, commission_amount: 300, status: 'credited', created_at: new Date().toISOString() },
  ];

  const displayStats = stats || mockStats;
  const displayLogs = logsData?.logs || mockLogs;
  const todayTrend = displayStats.yesterday > 0 
    ? Math.round(((displayStats.today - displayStats.yesterday) / displayStats.yesterday) * 100)
    : 0;

  // Handle transfer
  const handleTransfer = useCallback(async () => {
    setIsTransferring(true);
    try {
      const res = await fetch('/api/agent/commission/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: displayStats.pending })
      });
      if (res.ok) {
        mutateStats();
        mutateLogs();
      }
    } catch (error) {
      console.error('Transfer failed:', error);
    } finally {
      setIsTransferring(false);
    }
  }, [displayStats.pending, mutateStats, mutateLogs]);

  return (
    <div className="min-h-screen live-midnight-canvas p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <span className="p-2 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B]">
                <Coins className="size-6 text-[#0F172A]" />
              </span>
              Commission Dashboard
            </h1>
            <p className="text-[#64748B] mt-2">ติดตามรายได้ค่าคอมมิชชันจากลูกสายงานของคุณ</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Date Range Filter */}
            <div className="flex rounded-xl overflow-hidden border border-[#334155]">
              {(['today', 'week', 'month'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    dateRange === range
                      ? 'bg-gradient-to-r from-[#EAB308] to-[#B8860B] text-[#0F172A]'
                      : 'bg-[#1E293B] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {range === 'today' ? 'วันนี้' : range === 'week' ? 'สัปดาห์' : 'เดือน'}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              className="border-[#334155] bg-[#1E293B] text-[#94A3B8] hover:text-white hover:border-[#EAB308]"
            >
              <Download className="size-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            icon={Coins}
            label="คอมมิชชันวันนี้"
            value={`฿${displayStats.today.toLocaleString()}`}
            subValue={`เมื่อวาน ฿${displayStats.yesterday.toLocaleString()}`}
            trend={todayTrend}
            color="gold"
          />
          <StatsCard
            icon={TrendingUp}
            label="รายได้สัปดาห์นี้"
            value={`฿${displayStats.thisWeek.toLocaleString()}`}
            color="green"
          />
          <StatsCard
            icon={Calendar}
            label="รายได้เดือนนี้"
            value={`฿${displayStats.thisMonth.toLocaleString()}`}
            color="blue"
          />
          <StatsCard
            icon={Wallet}
            label="รายได้สะสมทั้งหมด"
            value={`฿${displayStats.total.toLocaleString()}`}
            color="gold"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Income Trend Chart */}
          <div className="lg:col-span-2 ultra-glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">แนวโน้มรายได้</h2>
              <span className="text-[#EAB308] font-mono">7 วันล่าสุด</span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={displayStats.trend}>
                  <defs>
                    <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EAB308" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#EAB308" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#64748B" 
                    tick={{ fill: '#64748B', fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="#64748B" 
                    tick={{ fill: '#64748B', fontSize: 12 }}
                    tickFormatter={(v) => `฿${(v/1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<GoldTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#EAB308"
                    strokeWidth={3}
                    fill="url(#goldGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* By Lottery Chart */}
          <div className="ultra-glass-card p-6">
            <h2 className="text-xl font-bold text-white mb-6">รายได้ตามประเภทหวย</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={displayStats.byLottery} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" horizontal={false} />
                  <XAxis 
                    type="number" 
                    stroke="#64748B"
                    tick={{ fill: '#64748B', fontSize: 12 }}
                    tickFormatter={(v) => `฿${(v/1000).toFixed(0)}k`}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    stroke="#64748B"
                    tick={{ fill: '#94A3B8', fontSize: 12 }}
                    width={80}
                  />
                  <Tooltip content={<GoldTooltip />} />
                  <Bar 
                    dataKey="amount" 
                    fill="#EAB308" 
                    radius={[0, 8, 8, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Pending Commission & Transfer */}
        <div className="ultra-glass-card p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">ยอดคอมมิชชันรอโอน</h2>
              <p className="text-4xl font-bold text-[#FDE047]">
                ฿{displayStats.pending.toLocaleString()}
              </p>
              <p className="text-[#64748B] mt-1">พร้อมโอนเข้ากระเป๋าหลักของคุณ</p>
            </div>
            <TransferButton
              amount={displayStats.pending}
              onTransfer={handleTransfer}
              isLoading={isTransferring}
            />
          </div>
        </div>

        {/* Commission Logs Table */}
        <div className="ultra-glass-card overflow-hidden">
          <div className="p-6 border-b border-[#1E293B]">
            <h2 className="text-xl font-bold text-white">ประวัติค่าคอมมิชชัน</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#0F172A]/50 border-b border-[#1E293B]">
                  <th className="py-4 px-4 text-left text-[#64748B] font-medium">ลูกค้า</th>
                  <th className="py-4 px-4 text-left text-[#64748B] font-medium">ประเภท</th>
                  <th className="py-4 px-4 text-right text-[#64748B] font-medium">ยอดแทง</th>
                  <th className="py-4 px-4 text-center text-[#64748B] font-medium">เรทคอม</th>
                  <th className="py-4 px-4 text-right text-[#64748B] font-medium">คอมมิชชัน</th>
                  <th className="py-4 px-4 text-left text-[#64748B] font-medium">สถานะ</th>
                  <th className="py-4 px-4 text-right text-[#64748B] font-medium">เวลา</th>
                </tr>
              </thead>
              <tbody>
                {displayLogs.map((log, index) => (
                  <CommissionRow key={log.id} log={log} index={index} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-[#1E293B] flex items-center justify-between">
            <p className="text-[#64748B] text-sm">
              แสดง {displayLogs.length} จาก {logsData?.total || displayLogs.length} รายการ
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="border-[#334155] bg-[#1E293B] text-[#94A3B8] hover:text-white disabled:opacity-50"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="px-4 py-2 text-[#EAB308] font-mono">{currentPage}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => p + 1)}
                className="border-[#334155] bg-[#1E293B] text-[#94A3B8] hover:text-white"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
