'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { 
  Send, 
  Radio, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Shield,
  Zap,
  Globe,
  Activity,
  DollarSign,
  Users,
  Lock,
  Unlock,
  ChevronRight,
  Building2,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Stats Card with Midnight Gold Theme
function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  trendValue,
  variant = 'default' 
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string;
  icon: any; 
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'gold';
}) {
  const variantStyles = {
    default: 'border-[#334155] bg-gradient-to-br from-[#0F172A] to-[#1E293B]',
    success: 'border-green-500/30 bg-gradient-to-br from-green-950/30 to-[#0F172A]',
    warning: 'border-amber-500/30 bg-gradient-to-br from-amber-950/30 to-[#0F172A]',
    danger: 'border-red-500/30 bg-gradient-to-br from-red-950/30 to-[#0F172A]',
    gold: 'border-[#F5E1A4]/50 bg-gradient-to-br from-[#1E293B] to-[#0F172A] shadow-lg shadow-[#EAB308]/10',
  };

  return (
    <Card className={`${variantStyles[variant]} relative overflow-hidden`}>
      {variant === 'gold' && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#F5E1A4]/5 to-transparent animate-pulse" />
      )}
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-[#94A3B8]">{title}</p>
            <p className={`text-2xl font-bold ${variant === 'gold' ? 'text-[#F5E1A4]' : 'text-white'}`}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {subtitle && <p className="text-xs text-[#64748B]">{subtitle}</p>}
            {trend && trendValue && (
              <div className="flex items-center gap-1">
                {trend === 'up' && <TrendingUp className="size-3 text-green-500" />}
                {trend === 'down' && <TrendingDown className="size-3 text-red-500" />}
                <span className={`text-xs ${
                  trend === 'up' ? 'text-green-500' : 
                  trend === 'down' ? 'text-red-500' : 
                  'text-[#64748B]'
                }`}>
                  {trendValue}
                </span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-xl ${
            variant === 'gold' 
              ? 'bg-gradient-to-br from-[#EAB308]/20 to-[#B8860B]/10 border border-[#F5E1A4]/30' 
              : 'bg-[#1E293B]'
          }`}>
            <Icon className={`size-5 ${variant === 'gold' ? 'text-[#F5E1A4]' : 'text-[#94A3B8]'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Command Button
function CommandButton({ 
  label, 
  icon: Icon, 
  onClick, 
  variant = 'default',
  loading = false,
  disabled = false
}: { 
  label: string; 
  icon: any; 
  onClick: () => void;
  variant?: 'default' | 'danger' | 'warning' | 'gold';
  loading?: boolean;
  disabled?: boolean;
}) {
  const variantStyles = {
    default: 'bg-[#1E293B] border-[#334155] hover:bg-[#334155] text-white',
    danger: 'bg-red-950/50 border-red-500/50 hover:bg-red-900/50 text-red-400',
    warning: 'bg-amber-950/50 border-amber-500/50 hover:bg-amber-900/50 text-amber-400',
    gold: 'bg-gradient-to-r from-[#EAB308] to-[#B8860B] border-[#F5E1A4] hover:from-[#FDE047] hover:to-[#EAB308] text-[#0F172A] font-semibold',
  };

  return (
    <Button
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center gap-2 border ${variantStyles[variant]} transition-all`}
    >
      {loading ? (
        <RefreshCw className="size-4 animate-spin" />
      ) : (
        <Icon className="size-4" />
      )}
      {label}
    </Button>
  );
}

export default function MasterCommandCenterPage() {
  const [selectedMarket, setSelectedMarket] = useState<string>('all');
  const [commandLoading, setCommandLoading] = useState<string | null>(null);

  // Fetch data
  const { data: masterStatement, isLoading: loadingMaster } = useSWR('/api/ledger/master', fetcher, { refreshInterval: 5000 });
  const { data: agentsSummary, isLoading: loadingAgents } = useSWR('/api/ledger/agents', fetcher, { refreshInterval: 10000 });
  const { data: riskNumbers, isLoading: loadingRisk } = useSWR('/api/risk-management/numbers', fetcher, { refreshInterval: 5000 });
  const { data: networkStatus, isLoading: loadingNetwork } = useSWR('/api/network/status', fetcher, { refreshInterval: 10000 });
  const { data: hedgingStats, isLoading: loadingHedging } = useSWR('/api/hedging/stats', fetcher, { refreshInterval: 30000 });

  const isLoading = loadingMaster || loadingAgents || loadingRisk || loadingNetwork || loadingHedging;

  // ใช้ข้อมูลจริงจาก API เท่านั้น - ถ้าไม่มีข้อมูลจะแสดง 0
  const statement = {
    totalReceived: masterStatement?.totalReceived || 0,
    totalPayout: masterStatement?.totalPayout || 0,
    totalCommission: masterStatement?.totalCommission || 0,
    profitMargin: masterStatement?.profitMargin || 0,
    holdAmount: masterStatement?.holdAmount || 0,
  };

  const agents = {
    totalAgents: agentsSummary?.totalAgents || 0,
    totalCreditBalance: agentsSummary?.totalCreditBalance || 0,
    totalHoldBalance: agentsSummary?.totalHoldBalance || 0,
    totalAvailable: agentsSummary?.totalAvailable || 0,
    activeAgents: agentsSummary?.activeAgents || 0,
  };

  const risk = {
    criticalNumbers: riskNumbers?.criticalNumbers || 0,
    warningNumbers: riskNumbers?.warningNumbers || 0,
    blockedNumbers: riskNumbers?.blockedNumbers || 0,
  };

  const network = {
    connectedAgents: networkStatus?.connectedAgents || 0,
    totalAgents: networkStatus?.totalAgents || 0,
    lastSync: networkStatus?.lastSync || new Date().toISOString(),
    pendingCommands: networkStatus?.pendingCommands || 0,
  };

  const hedging = {
    totalExported: hedgingStats?.totalExported || 0,
    totalCommission: hedgingStats?.totalCommission || 0,
    pendingAmount: hedgingStats?.pendingAmount || 0,
    successRate: hedgingStats?.successRate || 0,
  };

  // Command handlers
  const sendCommand = async (command: string, payload?: any) => {
    setCommandLoading(command);
    try {
      await fetch('/api/command-center/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, payload, market: selectedMarket }),
      });
    } catch (error) {
      console.error('Command failed:', error);
    } finally {
      setCommandLoading(null);
    }
  };

  return (
    <div className="live-midnight-canvas min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-[#EAB308]/20 to-[#B8860B]/10 border border-[#F5E1A4]/30">
                <Radio className="size-6 text-[#F5E1A4]" />
              </div>
              Master Command Center
            </h1>
            <p className="text-[#94A3B8] mt-1">
              ศูนย์บัญชาการระบบ FIN LOTTO R+ - Real-time Control & Monitoring
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 px-3 py-1">
              <span className="size-2 rounded-full bg-green-500 animate-pulse mr-2" />
              LIVE
            </Badge>
            <Select value={selectedMarket} onValueChange={setSelectedMarket}>
              <SelectTrigger className="w-40 bg-[#1E293B] border-[#334155] text-white">
                <SelectValue placeholder="เลือกตลาด" />
              </SelectTrigger>
              <SelectContent className="bg-[#1E293B] border-[#334155]">
                <SelectItem value="all">ทุกตลาด</SelectItem>
                <SelectItem value="gov">หวยรัฐบาล</SelectItem>
                <SelectItem value="hanoi">หวยฮานอย</SelectItem>
                <SelectItem value="laos">หวยลาว</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Master Statement - Gold Premium Card */}
        <Card className="ultra-glass-card border-[#F5E1A4]/50 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#B8860B] via-[#F5E1A4] to-[#B8860B]" />
          <CardHeader className="pb-2">
            <CardTitle className="text-[#F5E1A4] flex items-center gap-2">
              <DollarSign className="size-5" />
              Master Statement
            </CardTitle>
            <CardDescription className="text-[#64748B]">
              งบดุลเว็บแม่แบบ Real-time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              <div className="text-center p-4 rounded-xl bg-[#0F172A]/50">
                <p className="text-sm text-[#94A3B8] mb-1">ยอดรับรวม</p>
                <p className="text-2xl font-bold text-[#F5E1A4]">
                  {statement.totalReceived.toLocaleString()}
                </p>
                <p className="text-xs text-green-500 flex items-center justify-center gap-1 mt-1">
                  <ArrowUpRight className="size-3" /> +12.5%
                </p>
              </div>
              <div className="text-center p-4 rounded-xl bg-[#0F172A]/50">
                <p className="text-sm text-[#94A3B8] mb-1">ยอดจ่ายรวม</p>
                <p className="text-2xl font-bold text-red-400">
                  {statement.totalPayout.toLocaleString()}
                </p>
                <p className="text-xs text-[#64748B] mt-1">71.5% ของยอดรับ</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-[#0F172A]/50">
                <p className="text-sm text-[#94A3B8] mb-1">ค่าคอมมิชชัน</p>
                <p className="text-2xl font-bold text-amber-400">
                  {statement.totalCommission.toLocaleString()}
                </p>
                <p className="text-xs text-[#64748B] mt-1">5% ของยอดรับ</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-[#0F172A]/50">
                <p className="text-sm text-[#94A3B8] mb-1">ยอดค้างจ่าย</p>
                <p className="text-2xl font-bold text-orange-400">
                  {statement.holdAmount.toLocaleString()}
                </p>
                <p className="text-xs text-[#64748B] mt-1">รอผลออก</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-gradient-to-br from-green-950/50 to-[#0F172A] border border-green-500/30">
                <p className="text-sm text-[#94A3B8] mb-1">กำไรสุทธิ</p>
                <p className="text-2xl font-bold text-green-400">
                  {statement.profitMargin.toLocaleString()}
                </p>
                <p className="text-xs text-green-500 flex items-center justify-center gap-1 mt-1">
                  <TrendingUp className="size-3" /> 23.4%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Agent Network"
            value={`${network.connectedAgents}/${network.totalAgents}`}
            subtitle="เชื่อมต่ออยู่"
            icon={Globe}
            variant="gold"
          />
          <StatCard
            title="เครดิตรวม Agents"
            value={agents.totalCreditBalance}
            subtitle={`พร้อมใช้: ${agents.totalAvailable.toLocaleString()}`}
            icon={Wallet}
            variant="default"
          />
          <StatCard
            title="เลขเสี่ยง"
            value={risk.criticalNumbers + risk.warningNumbers}
            subtitle={`Critical: ${risk.criticalNumbers} | Warning: ${risk.warningNumbers}`}
            icon={AlertTriangle}
            variant={risk.criticalNumbers > 0 ? 'danger' : 'warning'}
          />
          <StatCard
            title="Hedging Today"
            value={hedging.totalExported}
            subtitle={`Commission: ${hedging.totalCommission.toLocaleString()}`}
            icon={Shield}
            trend="up"
            trendValue={`${hedging.successRate}% success`}
            variant="success"
          />
        </div>

        {/* Command Tabs */}
        <Tabs defaultValue="commands" className="space-y-4">
          <TabsList className="bg-[#1E293B] border border-[#334155]">
            <TabsTrigger value="commands" className="data-[state=active]:bg-[#334155] data-[state=active]:text-[#F5E1A4]">
              Command Pipe
            </TabsTrigger>
            <TabsTrigger value="agents" className="data-[state=active]:bg-[#334155] data-[state=active]:text-[#F5E1A4]">
              Agent Wallets
            </TabsTrigger>
            <TabsTrigger value="hedging" className="data-[state=active]:bg-[#334155] data-[state=active]:text-[#F5E1A4]">
              Hedging Control
            </TabsTrigger>
            <TabsTrigger value="risk" className="data-[state=active]:bg-[#334155] data-[state=active]:text-[#F5E1A4]">
              Risk Management
            </TabsTrigger>
          </TabsList>

          {/* Commands Tab */}
          <TabsContent value="commands" className="space-y-4">
            <Card className="bg-[#0F172A] border-[#334155]">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Send className="size-5 text-[#F5E1A4]" />
                  Command Pipe - ส่งคำสั่งไป Agent
                </CardTitle>
                <CardDescription className="text-[#64748B]">
                  คำสั่งจะถูกส่งไปยังทุก Agent ที่เชื่อมต่ออยู่แบบ Real-time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <CommandButton
                    label="Force Sync All"
                    icon={RefreshCw}
                    onClick={() => sendCommand('FORCE_SYNC')}
                    loading={commandLoading === 'FORCE_SYNC'}
                    variant="gold"
                  />
                  <CommandButton
                    label="Open All Markets"
                    icon={Unlock}
                    onClick={() => sendCommand('OPEN_ALL_MARKETS')}
                    loading={commandLoading === 'OPEN_ALL_MARKETS'}
                    variant="default"
                  />
                  <CommandButton
                    label="Close All Markets"
                    icon={Lock}
                    onClick={() => sendCommand('CLOSE_ALL_MARKETS')}
                    loading={commandLoading === 'CLOSE_ALL_MARKETS'}
                    variant="warning"
                  />
                  <CommandButton
                    label="Emergency Stop"
                    icon={AlertTriangle}
                    onClick={() => sendCommand('EMERGENCY_STOP')}
                    loading={commandLoading === 'EMERGENCY_STOP'}
                    variant="danger"
                  />
                </div>

                {/* Quick Rate Adjustment */}
                <div className="mt-6 p-4 rounded-xl bg-[#1E293B] border border-[#334155]">
                  <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                    <Zap className="size-4 text-[#F5E1A4]" />
                    Quick Rate Adjustment
                  </h3>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-48">
                      <Label className="text-[#94A3B8]">ประเภท</Label>
                      <Select defaultValue="three_top">
                        <SelectTrigger className="bg-[#0F172A] border-[#334155] text-white mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1E293B] border-[#334155]">
                          <SelectItem value="three_top">3 ตัวบน</SelectItem>
                          <SelectItem value="three_tood">3 ตัวโต๊ด</SelectItem>
                          <SelectItem value="two_top">2 ตัวบน</SelectItem>
                          <SelectItem value="two_bottom">2 ตัวล่าง</SelectItem>
                          <SelectItem value="run_top">วิ่งบน</SelectItem>
                          <SelectItem value="run_bottom">วิ่งล่าง</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-32">
                      <Label className="text-[#94A3B8]">เรทใหม่</Label>
                      <Input 
                        type="number" 
                        placeholder="900" 
                        className="bg-[#0F172A] border-[#334155] text-white mt-1"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button 
                        className="bg-gradient-to-r from-[#EAB308] to-[#B8860B] text-[#0F172A] font-semibold hover:from-[#FDE047] hover:to-[#EAB308]"
                        onClick={() => sendCommand('UPDATE_RATES')}
                      >
                        <Send className="size-4 mr-2" />
                        Broadcast
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Command Log */}
                <div className="mt-6">
                  <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                    <Clock className="size-4 text-[#94A3B8]" />
                    Recent Commands
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {[
                      { cmd: 'FORCE_SYNC', time: '10:35:22', status: 'success', agents: 10 },
                      { cmd: 'UPDATE_RATES', time: '10:30:15', status: 'success', agents: 10 },
                      { cmd: 'BLOCK_NUMBER', time: '10:25:08', status: 'success', agents: 10 },
                    ].map((log, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-[#1E293B] border border-[#334155]">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="border-[#F5E1A4]/30 text-[#F5E1A4]">
                            {log.cmd}
                          </Badge>
                          <span className="text-sm text-[#64748B]">{log.time}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#94A3B8]">{log.agents} agents</span>
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            {log.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Agents Tab */}
          <TabsContent value="agents" className="space-y-4">
            <Card className="bg-[#0F172A] border-[#334155]">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Building2 className="size-5 text-[#F5E1A4]" />
                  Agent Wallets - Multi-Tier Ledger
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#334155]">
                        <th className="text-left py-3 px-4 text-[#94A3B8] font-medium">Agent</th>
                        <th className="text-right py-3 px-4 text-[#94A3B8] font-medium">Credit Balance</th>
                        <th className="text-right py-3 px-4 text-[#94A3B8] font-medium">Hold</th>
                        <th className="text-right py-3 px-4 text-[#94A3B8] font-medium">Available</th>
                        <th className="text-center py-3 px-4 text-[#94A3B8] font-medium">Status</th>
                        <th className="text-center py-3 px-4 text-[#94A3B8] font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { code: 'AG001', name: 'Gold Agent', balance: 1250000, hold: 45000, status: 'active' },
                        { code: 'AG002', name: 'Silver Agent', balance: 850000, hold: 32000, status: 'active' },
                        { code: 'AG003', name: 'Bronze Agent', balance: 520000, hold: 15000, status: 'active' },
                        { code: 'AG004', name: 'Diamond Agent', balance: 2100000, hold: 85000, status: 'active' },
                        { code: 'AG005', name: 'Platinum Agent', balance: 1800000, hold: 62000, status: 'inactive' },
                      ].map((agent, idx) => (
                        <tr key={idx} className="border-b border-[#1E293B] hover:bg-[#1E293B]/50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="text-white font-medium">{agent.code}</p>
                              <p className="text-sm text-[#64748B]">{agent.name}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-[#F5E1A4] font-mono font-medium">
                              {agent.balance.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-orange-400 font-mono">
                              {agent.hold.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-green-400 font-mono">
                              {(agent.balance - agent.hold).toLocaleString()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge className={agent.status === 'active' 
                              ? 'bg-green-500/20 text-green-400 border-green-500/30'
                              : 'bg-red-500/20 text-red-400 border-red-500/30'
                            }>
                              {agent.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Button size="sm" variant="ghost" className="text-[#94A3B8] hover:text-white">
                              <ChevronRight className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Hedging Tab */}
          <TabsContent value="hedging" className="space-y-4">
            <Card className="bg-[#0F172A] border-[#334155]">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="size-5 text-[#F5E1A4]" />
                  Hedging Control - กระจายความเสี่ยง
                </CardTitle>
                <CardDescription className="text-[#64748B]">
                  ส่งต่อยอดไปเจ้ามือรายใหญ่เพื่อกินหัวคิว
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4 mb-6">
                  <StatCard
                    title="ยอด Export วันนี้"
                    value={hedging.totalExported}
                    icon={ArrowUpRight}
                    variant="default"
                  />
                  <StatCard
                    title="Commission ได้รับ"
                    value={hedging.totalCommission}
                    icon={DollarSign}
                    variant="success"
                  />
                  <StatCard
                    title="รอยืนยัน"
                    value={hedging.pendingAmount}
                    icon={Clock}
                    variant="warning"
                  />
                  <StatCard
                    title="Success Rate"
                    value={`${hedging.successRate}%`}
                    icon={Activity}
                    variant="gold"
                  />
                </div>

                {/* Export Form */}
                <div className="p-4 rounded-xl bg-[#1E293B] border border-[#334155]">
                  <h3 className="text-white font-medium mb-4">Quick Export</h3>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <Label className="text-[#94A3B8]">Partner</Label>
                      <Select defaultValue="partner1">
                        <SelectTrigger className="bg-[#0F172A] border-[#334155] text-white mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1E293B] border-[#334155]">
                          <SelectItem value="partner1">Big Boss Lotto (5%)</SelectItem>
                          <SelectItem value="partner2">Lucky Star (4.5%)</SelectItem>
                          <SelectItem value="partner3">Gold Fortune (4%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[#94A3B8]">เลข</Label>
                      <Input 
                        placeholder="123" 
                        className="bg-[#0F172A] border-[#334155] text-white mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[#94A3B8]">ยอด</Label>
                      <Input 
                        type="number"
                        placeholder="50000" 
                        className="bg-[#0F172A] border-[#334155] text-white mt-1"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button className="w-full bg-gradient-to-r from-[#EAB308] to-[#B8860B] text-[#0F172A] font-semibold">
                        <ArrowUpRight className="size-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Risk Tab */}
          <TabsContent value="risk" className="space-y-4">
            <Card className="bg-[#0F172A] border-[#334155]">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <AlertTriangle className="size-5 text-[#F5E1A4]" />
                  Risk Management - Liability Limits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3 mb-6">
                  <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30">
                    <p className="text-sm text-red-400 mb-1">Critical (100%)</p>
                    <p className="text-3xl font-bold text-red-500">{risk.criticalNumbers}</p>
                    <p className="text-xs text-[#64748B] mt-1">ต้องอั้นทันที</p>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30">
                    <p className="text-sm text-amber-400 mb-1">Warning (70-99%)</p>
                    <p className="text-3xl font-bold text-amber-500">{risk.warningNumbers}</p>
                    <p className="text-xs text-[#64748B] mt-1">ควรพิจารณา</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#1E293B] border border-[#334155]">
                    <p className="text-sm text-[#94A3B8] mb-1">Blocked</p>
                    <p className="text-3xl font-bold text-[#64748B]">{risk.blockedNumbers}</p>
                    <p className="text-xs text-[#64748B] mt-1">ถูกอั้นอยู่</p>
                  </div>
                </div>

                {/* Risk Numbers Table */}
                <div className="space-y-2">
                  {[
                    { number: '456', volume: 485000, limit: 500000, percent: 97, level: 'critical' },
                    { number: '789', volume: 420000, limit: 500000, percent: 84, level: 'warning' },
                    { number: '123', volume: 380000, limit: 500000, percent: 76, level: 'warning' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-[#1E293B] border border-[#334155]">
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-2xl font-bold text-[#F5E1A4]">{item.number}</span>
                        <div>
                          <p className="text-white">{item.volume.toLocaleString()} / {item.limit.toLocaleString()}</p>
                          <div className="w-32 h-2 bg-[#334155] rounded-full mt-1">
                            <div 
                              className={`h-full rounded-full ${
                                item.level === 'critical' ? 'bg-red-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${item.percent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={item.level === 'critical' 
                          ? 'bg-red-500/20 text-red-400 border-red-500/30'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }>
                          {item.percent}%
                        </Badge>
                        <Button size="sm" variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/20">
                          <Lock className="size-4 mr-1" />
                          Block
                        </Button>
                        <Button size="sm" variant="outline" className="border-[#F5E1A4]/50 text-[#F5E1A4] hover:bg-[#F5E1A4]/10">
                          <ArrowUpRight className="size-4 mr-1" />
                          Hedge
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
