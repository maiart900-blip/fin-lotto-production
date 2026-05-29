'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Users,
  RefreshCw,
  Download,
  Crown,
  Wallet,
  Building2,
  AlertTriangle,
  ShieldCheck,
  UserCog
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

// =====================================================
// MASTER AGENT FINANCIAL PERFORMANCE SUMMARY
// =====================================================
// This screen is EXCLUSIVELY for the Master Agent role
// to monitor all underlying Agents' financial performance.
// Data comes ONLY from manual_key entries (no Auto API).
// =====================================================

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
};

interface AgentPerformance {
  id: string;
  name: string;                      // เอเย่นต์
  total_volume: number;              // ยอดถือหุ้น/เครดิตรวม
  net_profit_loss: number;           // ผลงานเอเย่นต์ บวก/เสีย
  customer_winnings: number;         // ยอดลูกค้าถูกรางวัล
  company_share: number;             // ส่งบริษัท
  master_net_share: number;          // กำไรสุทธิมาสเตอร์
  total_tickets: number;             // จำนวนโพย
  total_customers: number;           // จำนวนลูกค้า
  share_percent: number;             // เปอร์เซ็นต์ส่งบริษัท
  is_profitable: boolean;            // กำไรหรือขาดทุน
}

interface PerformanceSummary {
  total_active_agents: number;       // จำนวนเอเย่นต์ที่ใช้งาน
  global_master_profit: number;      // กำไรสุทธิมาสเตอร์วันนี้
  is_global_profitable: boolean;     // กำไรหรือขาดทุนรวม
  total_pending_transfers: number;   // ยอดรอส่งบริษัท
  total_volume: number;              // ยอดรวมทั้งหมด
  total_customer_winnings: number;   // ยอดลูกค้าถูกรวม
}

export default function MasterAgentPerformancePage() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch performance data (Manual Key Only - Today)
  const { data, isLoading, mutate } = useSWR<{
    agents: AgentPerformance[];
    summary: PerformanceSummary;
    lastUpdated: string;
  }>('/api/master/agent-financial-performance?source_type=manual_key', fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds
  });

  const agents = data?.agents || [];
  const summary = data?.summary;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await mutate();
    setIsRefreshing(false);
  };

  // Export to CSV
  const handleExport = () => {
    if (!agents.length) {
      toast.error('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    const headers = ['ลำดับ', 'เอเย่นต์', 'เครดิตรวม', 'ผลงาน บวก/เสีย', 'ลูกค้าถูกรางวัล', 'ส่งบริษัท', 'กำไรสุทธิมาสเตอร์'];
    const rows = agents.map((a, i) => [
      i + 1,
      a.name,
      a.total_volume,
      a.net_profit_loss,
      a.customer_winnings,
      a.company_share,
      a.master_net_share
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `master-agent-performance-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('ส่งออกไฟล์สำเร็จ');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header with Role Badge */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="size-6 text-purple-400" />
              Agent Financial Performance Summary
            </h1>
            <Badge className="bg-purple-600 text-white">
              <ShieldCheck className="size-3 mr-1" />
              Master Agent Only
            </Badge>
          </div>
          <p className="text-white/60">
            สรุปผลการเงินเอเย่นต์ทั้งหมดในสายงาน - ข้อมูลจากระบบคีย์หวยมือวันนี้
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={handleExport}
            className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
          >
            <Download className="size-4 mr-2" />
            ส่งออก CSV
          </Button>
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
          >
            <RefreshCw className={`size-4 mr-2 ${isLoading || isRefreshing ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* Data Isolation Alert */}
      <Alert className="bg-purple-500/10 border-purple-500/30">
        <AlertTriangle className="size-4 text-purple-400" />
        <AlertDescription className="text-purple-200">
          <strong>Manual Key Data Only:</strong> ข้อมูลทั้งหมดในหน้านี้มาจากระบบคีย์หวยมือ (Manual Key) ประจำวันนี้เท่านั้น 
          ไม่รวมข้อมูลจากระบบ Auto API
        </AlertDescription>
      </Alert>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Active Agents */}
        <Card className="bg-[#0D1321] border-blue-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">เอเย่นต์ที่ใช้งาน</p>
                <p className="text-3xl font-bold text-blue-400">
                  {summary?.total_active_agents || 0}
                </p>
                <p className="text-xs text-white/40 mt-1">ราย (วันนี้)</p>
              </div>
              <div className="p-4 rounded-full bg-blue-500/20">
                <Users className="size-8 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Global Master Profit Today */}
        <Card className={`bg-[#0D1321] ${summary?.is_global_profitable ? 'border-green-500/30' : 'border-red-500/30'}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">กำไรสุทธิมาสเตอร์วันนี้</p>
                <p className={`text-3xl font-bold ${summary?.is_global_profitable ? 'text-green-400' : 'text-red-400'}`}>
                  {summary?.is_global_profitable ? '+' : ''}{formatCurrency(summary?.global_master_profit || 0)}
                </p>
                <Badge className={`mt-2 ${summary?.is_global_profitable ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {summary?.is_global_profitable ? 'ยอดเขียว (กำไร)' : 'ยอดแดง (ขาดทุน)'}
                </Badge>
              </div>
              <div className={`p-4 rounded-full ${summary?.is_global_profitable ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                {summary?.is_global_profitable ? (
                  <TrendingUp className="size-8 text-green-400" />
                ) : (
                  <TrendingDown className="size-8 text-red-400" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Pending Company Transfers */}
        <Card className="bg-[#0D1321] border-amber-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">ยอดรอส่งบริษัท</p>
                <p className="text-3xl font-bold text-amber-400">
                  {formatCurrency(summary?.total_pending_transfers || 0)}
                </p>
                <p className="text-xs text-white/40 mt-1">Mother Web Share</p>
              </div>
              <div className="p-4 rounded-full bg-amber-500/20">
                <Building2 className="size-8 text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Performance Table */}
      <Card className="bg-[#0D1321] border-purple-500/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-purple-400 flex items-center gap-2">
                <UserCog className="size-5" />
                ตารางสรุปผลการเงินเอเย่นต์ (วันนี้)
              </CardTitle>
              <CardDescription className="text-white/50">
                ข้อมูลจากระบบคีย์หวยมือ (Manual Key) เท่านั้น - เรียงตามยอดสูงสุด
              </CardDescription>
            </div>
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
              Manual Key Only
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead className="text-slate-400">เอเย่นต์</TableHead>
                <TableHead className="text-slate-400 text-right">ยอดถือหุ้น/เครดิตรวม</TableHead>
                <TableHead className="text-slate-400 text-right">ผลงานเอเย่นต์ บวก/เสีย</TableHead>
                <TableHead className="text-slate-400 text-right">ยอดลูกค้าถูกรางวัล</TableHead>
                <TableHead className="text-slate-400 text-right">ส่งบริษัท</TableHead>
                <TableHead className="text-slate-400 text-right">กำไรสุทธิมาสเตอร์</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    <RefreshCw className="size-5 animate-spin mx-auto mb-2" />
                    กำลังโหลดข้อมูล...
                  </TableCell>
                </TableRow>
              ) : agents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    ยังไม่มีข้อมูลเอเย่นต์วันนี้
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {agents.map((agent, index) => (
                    <TableRow key={agent.id} className="border-slate-800 hover:bg-white/5">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {index < 3 ? (
                            <Crown className={`size-5 ${
                              index === 0 ? 'text-yellow-400' : 
                              index === 1 ? 'text-slate-400' : 
                              'text-amber-600'
                            }`} />
                          ) : (
                            <span className="w-5 text-center text-slate-500">{index + 1}</span>
                          )}
                          <div>
                            <p className="text-white font-medium">{agent.name}</p>
                            <p className="text-xs text-slate-500">{agent.total_tickets} โพย / {agent.total_customers} ลูกค้า</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-white font-mono">{formatCurrency(agent.total_volume)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className={`font-mono font-bold ${agent.is_profitable ? 'text-green-400' : 'text-red-400'}`}>
                            {agent.is_profitable ? '+' : ''}{formatCurrency(agent.net_profit_loss)}
                          </span>
                          <Badge className={`text-xs mt-1 ${agent.is_profitable ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {agent.is_profitable ? 'ยอดเขียว' : 'ยอดแดง'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-red-400 font-mono">-{formatCurrency(agent.customer_winnings)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-amber-400 font-mono">{formatCurrency(agent.company_share)}</span>
                          <span className="text-xs text-slate-500">({agent.share_percent}%)</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-mono font-bold ${agent.master_net_share >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {agent.master_net_share >= 0 ? '+' : ''}{formatCurrency(agent.master_net_share)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Summary Row */}
                  <TableRow className="border-t-2 border-purple-500/30 bg-purple-500/10">
                    <TableCell className="font-bold text-white">
                      รวมทั้งหมด ({agents.length} เอเย่นต์)
                    </TableCell>
                    <TableCell className="text-right text-white font-mono font-bold">
                      {formatCurrency(summary?.total_volume || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono font-bold ${summary?.is_global_profitable ? 'text-green-400' : 'text-red-400'}`}>
                        {summary?.is_global_profitable ? '+' : ''}{formatCurrency(agents.reduce((sum, a) => sum + a.net_profit_loss, 0))}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-red-400 font-mono font-bold">
                      -{formatCurrency(summary?.total_customer_winnings || 0)}
                    </TableCell>
                    <TableCell className="text-right text-amber-400 font-mono font-bold">
                      {formatCurrency(summary?.total_pending_transfers || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono font-bold ${summary?.is_global_profitable ? 'text-emerald-400' : 'text-red-400'}`}>
                        {summary?.is_global_profitable ? '+' : ''}{formatCurrency(summary?.global_master_profit || 0)}
                      </span>
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
