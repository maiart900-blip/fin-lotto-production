'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Shield,
  AlertTriangle,
  TrendingUp,
  Ban,
  Percent,
  RefreshCw,
  Search,
  Activity,
  Zap,
  Globe,
  Users,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import useSWR from 'swr';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface NumberRisk {
  number: string;
  totalAmount: number;
  betCount: number;
  potentialPayout: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  sources: { siteId: string; siteName: string; amount: number }[];
}

interface AgentStats {
  id: string;
  name: string;
  totalBets: number;
  totalAmount: number;
  riskNumbers: number;
}

// Risk level colors
const RISK_COLORS = {
  critical: '#EF4444',
  high: '#F59E0B',
  medium: '#EAB308',
  low: '#22C55E',
};

// Gold-themed chart colors
const CHART_COLORS = ['#EAB308', '#FDE047', '#B8860B', '#FACC15', '#CA8A04'];

// Custom Tooltip for Gold Theme
const GoldTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0F172A] border border-[#EAB308]/30 rounded-lg p-3 shadow-lg">
      <p className="text-[#EAB308] font-bold mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-[#F8FAFC] text-sm">
          {entry.name}: <span className="font-mono text-[#FDE047]">{entry.value?.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
};

export default function MasterRiskPanelPage() {
  const [searchNumber, setSearchNumber] = useState('');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch risk data
  const { data: riskData, mutate: mutateRisk, isValidating } = useSWR<{
    numbers: NumberRisk[];
    summary: {
      totalVolume: number;
      criticalCount: number;
      highCount: number;
      potentialExposure: number;
    };
    agentStats: AgentStats[];
    hourlyTrend: { hour: string; amount: number }[];
  }>('/api/risk-management/analysis', fetcher, { refreshInterval: 5000 });

  const numbers = riskData?.numbers || [];
  const summary = riskData?.summary || { totalVolume: 0, criticalCount: 0, highCount: 0, potentialExposure: 0 };
  const agentStats = riskData?.agentStats || [];
  const hourlyTrend = riskData?.hourlyTrend || [];

  // Filter numbers
  const filteredNumbers = useMemo(() => {
    return numbers.filter(n => {
      const matchesSearch = !searchNumber || n.number.includes(searchNumber);
      const matchesRisk = selectedRiskLevel === 'all' || n.riskLevel === selectedRiskLevel;
      return matchesSearch && matchesRisk;
    });
  }, [numbers, searchNumber, selectedRiskLevel]);

  // Top 10 for chart
  const top10Numbers = useMemo(() => {
    return [...numbers]
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);
  }, [numbers]);

  // Risk distribution for pie chart
  const riskDistribution = useMemo(() => {
    const dist = { critical: 0, high: 0, medium: 0, low: 0 };
    numbers.forEach(n => dist[n.riskLevel]++);
    return [
      { name: 'Critical', value: dist.critical, fill: RISK_COLORS.critical },
      { name: 'High', value: dist.high, fill: RISK_COLORS.high },
      { name: 'Medium', value: dist.medium, fill: RISK_COLORS.medium },
      { name: 'Low', value: dist.low, fill: RISK_COLORS.low },
    ];
  }, [numbers]);

  // Actions
  const handleBlockNumber = async (number: string, broadcast = true) => {
    setActionLoading(number);
    try {
      const res = await fetch('/api/risk-management/numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'block', number, broadcastToNetwork: broadcast }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`บล็อคเลข ${number} แล้ว${broadcast ? ` (Sync ${data.syncedSites} sites)` : ''}`);
        mutateRisk();
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReduceRate = async (number: string, rate: number) => {
    setActionLoading(number);
    try {
      const res = await fetch('/api/risk-management/numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reduce_rate', number, rate, broadcastToNetwork: true }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`ลดเรทเลข ${number} เป็น ${rate}%`);
        mutateRisk();
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="live-midnight-canvas -m-6 p-6 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] shadow-lg shadow-[#EAB308]/30">
                <Shield className="size-6 text-[#0F172A]" />
              </div>
              <span className="text-gold-gradient">MASTER RISK PANEL</span>
            </h1>
            <p className="text-[#64748B] mt-1">Real-time Risk Management Across All Network</p>
          </div>

          <div className="flex items-center gap-3">
            <Badge className={`${isValidating ? 'animate-pulse' : ''} bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30`}>
              <Activity className="size-3 mr-1" />
              Live
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => mutateRisk()}
              className="border-[#EAB308]/30 text-[#EAB308] hover:bg-[#EAB308]/10"
            >
              <RefreshCw className={`size-4 mr-1 ${isValidating ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="gold-stats-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#64748B] text-sm">Total Volume</p>
                  <p className="text-2xl font-bold text-[#FDE047] font-mono">
                    {summary.totalVolume.toLocaleString()}
                  </p>
                </div>
                <TrendingUp className="size-8 text-[#EAB308]/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="gold-stats-card border-[#EF4444]/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#64748B] text-sm">Critical Numbers</p>
                  <p className="text-2xl font-bold text-[#EF4444] font-mono">
                    {summary.criticalCount}
                  </p>
                </div>
                <AlertTriangle className="size-8 text-[#EF4444]/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="gold-stats-card border-[#F59E0B]/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#64748B] text-sm">High Risk</p>
                  <p className="text-2xl font-bold text-[#F59E0B] font-mono">
                    {summary.highCount}
                  </p>
                </div>
                <Zap className="size-8 text-[#F59E0B]/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="gold-stats-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#64748B] text-sm">Potential Exposure</p>
                  <p className="text-2xl font-bold text-[#FDE047] font-mono">
                    {summary.potentialExposure.toLocaleString()}
                  </p>
                </div>
                <Globe className="size-8 text-[#EAB308]/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top 10 Numbers Bar Chart */}
          <Card className="bg-[#0F172A] border-[#EAB308]/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="size-5 text-[#EAB308]" />
                Top 10 High Volume Numbers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top10Numbers} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" stroke="#64748B" tickFormatter={(v) => v.toLocaleString()} />
                    <YAxis dataKey="number" type="category" stroke="#64748B" width={50} />
                    <Tooltip content={<GoldTooltip />} />
                    <Bar dataKey="totalAmount" name="ยอดแทง" radius={[0, 4, 4, 0]}>
                      {top10Numbers.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={RISK_COLORS[entry.riskLevel]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Risk Distribution Pie Chart */}
          <Card className="bg-[#0F172A] border-[#EAB308]/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="size-5 text-[#EAB308]" />
                Risk Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {riskDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<GoldTooltip />} />
                    <Legend 
                      wrapperStyle={{ color: '#94A3B8' }}
                      formatter={(value) => <span className="text-[#94A3B8]">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Hourly Trend Area Chart */}
          <Card className="bg-[#0F172A] border-[#EAB308]/20 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="size-5 text-[#EAB308]" />
                Betting Volume Trend (Today)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyTrend}>
                    <defs>
                      <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EAB308" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#EAB308" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="hour" stroke="#64748B" />
                    <YAxis stroke="#64748B" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<GoldTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="amount" 
                      name="ยอดแทง"
                      stroke="#EAB308" 
                      strokeWidth={2}
                      fill="url(#goldGradient)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Risk Numbers Table */}
        <Card className="bg-[#0F172A] border-[#EAB308]/20">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="size-5 text-[#EAB308]" />
                Risk Numbers Analysis
              </CardTitle>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#64748B]" />
                  <Input
                    placeholder="ค้นหาเลข..."
                    value={searchNumber}
                    onChange={(e) => setSearchNumber(e.target.value)}
                    className="pl-10 w-[150px] bg-[#1E293B] border-[#334155] text-white"
                  />
                </div>

                <Select value={selectedRiskLevel} onValueChange={setSelectedRiskLevel}>
                  <SelectTrigger className="w-[130px] bg-[#1E293B] border-[#334155] text-white">
                    <SelectValue placeholder="Risk Level" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1E293B] border-[#334155]">
                    <SelectItem value="all" className="text-white">All Levels</SelectItem>
                    <SelectItem value="critical" className="text-[#EF4444]">Critical</SelectItem>
                    <SelectItem value="high" className="text-[#F59E0B]">High</SelectItem>
                    <SelectItem value="medium" className="text-[#EAB308]">Medium</SelectItem>
                    <SelectItem value="low" className="text-[#22C55E]">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredNumbers.length === 0 ? (
                <p className="text-center text-[#64748B] py-8">ไม่พบข้อมูล</p>
              ) : (
                filteredNumbers.map((item) => (
                  <div
                    key={item.number}
                    className={`
                      p-4 rounded-lg border transition-all hover:scale-[1.01]
                      ${item.riskLevel === 'critical' ? 'risk-critical' : ''}
                      ${item.riskLevel === 'high' ? 'risk-high' : ''}
                      ${item.riskLevel === 'medium' ? 'risk-medium' : ''}
                      ${item.riskLevel === 'low' ? 'risk-low' : ''}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-2xl font-bold">{item.number}</span>
                        <div>
                          <p className="text-sm opacity-80">
                            ยอดแทง: <span className="font-mono font-bold">{item.totalAmount.toLocaleString()}</span>
                          </p>
                          <p className="text-xs opacity-60">
                            {item.betCount} รายการ | Exposure: {item.potentialPayout.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReduceRate(item.number, 50)}
                          disabled={actionLoading === item.number}
                          className="border-[#F59E0B]/50 text-[#F59E0B] hover:bg-[#F59E0B]/20"
                        >
                          <Percent className="size-3 mr-1" />
                          50%
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleBlockNumber(item.number)}
                          disabled={actionLoading === item.number}
                        >
                          <Ban className="size-3 mr-1" />
                          Block
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
