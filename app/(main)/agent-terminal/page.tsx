'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  History,
  Calculator,
  Keyboard,
  AlertTriangle,
  RefreshCw,
  Clock,
  Zap,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AgentTerminalPage() {
  const [agentId, setAgentId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ดึง agent ID จาก localStorage
  useEffect(() => {
    let userStr = localStorage.getItem('lottery_session');
    if (!userStr) userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setAgentId(user.id);
      } catch { /* ignore */ }
    }
  }, []);

  // ดึงข้อมูลจาก API
  const { data: teamData, mutate: mutateTeam } = useSWR(
    agentId ? `/api/agent/team?agent_id=${agentId}` : null,
    fetcher
  );
  
  const { data: profitData, mutate: mutateProfit } = useSWR(
    agentId ? `/api/agent/profit?agent_id=${agentId}` : null,
    fetcher
  );

  // Map data จาก API - ถ้าไม่มีข้อมูลจะแสดง 0
  const agentData = {
    agentId: agentId || '-',
    agentName: teamData?.agent?.name || 'Agent',
    creditLimit: teamData?.agent?.credit_limit || 0,
    creditUsed: teamData?.stats?.total_used || 0,
    creditAvailable: (teamData?.agent?.credit_limit || 0) - (teamData?.stats?.total_used || 0),
    outstandingBalance: teamData?.stats?.outstanding || 0,
    commissionRate: teamData?.agent?.commission_rate || 0,
    todayBets: profitData?.summary?.total_amount || 0,
    todayCommission: profitData?.summary?.agent_share || 0,
    todayNet: profitData?.summary?.profit || 0,
    weeklyBets: 0,
    weeklyCommission: 0,
    status: teamData?.agent?.is_active ? 'active' : 'inactive' as const,
    lastActivity: new Date().toISOString(),
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([mutateTeam(), mutateProfit()]);
    setIsRefreshing(false);
  };

  const creditPercentage = (agentData.creditUsed / agentData.creditLimit) * 100;
  const creditWarning = creditPercentage > 80;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 
            className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
            style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
          >
            Agent Terminal
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {agentData.agentName} ({agentData.agentId})
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <RefreshCw className={`size-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
          <Badge 
            className={agentData.status === 'active' 
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
              : 'bg-red-500/20 text-red-400 border-red-500/30'
            }
          >
            {agentData.status === 'active' ? 'ใช้งานปกติ' : 'ระงับการใช้งาน'}
          </Badge>
        </div>
      </div>

      {/* Credit & Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Credit Limit Card */}
        <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30 shadow-[0_0_20px_rgba(255,215,0,0.1)]">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="size-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center border border-amber-500/30">
                <CreditCard className="size-6 text-amber-400" />
              </div>
              {creditWarning && (
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 animate-pulse">
                  <AlertTriangle className="size-3 mr-1" />
                  ใกล้เต็ม
                </Badge>
              )}
            </div>
            <p className="text-slate-400 text-sm mb-1">วงเงินเครดิต</p>
            <p 
              className="text-2xl font-bold text-amber-400"
              style={{ textShadow: '0 0 10px rgba(255,215,0,0.3)' }}
            >
              {agentData.creditLimit.toLocaleString()}
            </p>
            {/* Credit Bar */}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>ใช้ไป {agentData.creditUsed.toLocaleString()}</span>
                <span>{creditPercentage.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-black/50 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    creditWarning 
                      ? 'bg-gradient-to-r from-orange-500 to-red-500' 
                      : 'bg-gradient-to-r from-amber-500 to-yellow-500'
                  }`}
                  style={{ width: `${creditPercentage}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Available Credit */}
        <Card className="bg-black/40 backdrop-blur-xl border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
          <CardContent className="p-5">
            <div className="size-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center border border-emerald-500/30 mb-3">
              <Wallet className="size-6 text-emerald-400" />
            </div>
            <p className="text-slate-400 text-sm mb-1">เครดิตคงเหลือ</p>
            <p 
              className="text-2xl font-bold text-emerald-400"
              style={{ textShadow: '0 0 10px rgba(16,185,129,0.3)' }}
            >
              {agentData.creditAvailable.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 mt-2">พร้อมใช้งาน</p>
          </CardContent>
        </Card>

        {/* Outstanding Balance */}
        <Card className="bg-black/40 backdrop-blur-xl border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
          <CardContent className="p-5">
            <div className="size-12 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/10 flex items-center justify-center border border-red-500/30 mb-3">
              <TrendingDown className="size-6 text-red-400" />
            </div>
            <p className="text-slate-400 text-sm mb-1">ยอดค้างชำระ</p>
            <p 
              className="text-2xl font-bold text-red-400"
              style={{ textShadow: '0 0 10px rgba(239,68,68,0.3)' }}
            >
              {agentData.outstandingBalance.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 mt-2">กำหนดชำระ: ทุกวันจันทร์</p>
          </CardContent>
        </Card>

        {/* Commission Rate */}
        <Card className="bg-black/40 backdrop-blur-xl border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
          <CardContent className="p-5">
            <div className="size-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center border border-blue-500/30 mb-3">
              <Calculator className="size-6 text-blue-400" />
            </div>
            <p className="text-slate-400 text-sm mb-1">อัตราค่าคอม</p>
            <p 
              className="text-2xl font-bold text-blue-400"
              style={{ textShadow: '0 0 10px rgba(59,130,246,0.3)' }}
            >
              {agentData.commissionRate}%
            </p>
            <p className="text-xs text-slate-500 mt-2">หักอัตโนมัติจากยอดแทง</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* High-Speed Terminal */}
        <Link href="/agent-terminal/betting">
          <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30 hover:border-amber-400/60 hover:shadow-[0_0_30px_rgba(255,215,0,0.2)] transition-all duration-300 cursor-pointer group">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="size-16 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:scale-110 transition-transform">
                  <Keyboard className="size-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-1">คีย์เลขด่วน</h3>
                  <p className="text-sm text-slate-400">High-Speed Betting Terminal</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                      <Zap className="size-3 mr-1" />
                      Keyboard Friendly
                    </Badge>
                  </div>
                </div>
                <ArrowRight className="size-6 text-amber-400 group-hover:translate-x-2 transition-transform" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Commission Summary */}
        <Link href="/agent-terminal/commission">
          <Card className="bg-black/40 backdrop-blur-xl border-emerald-500/30 hover:border-emerald-400/60 hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] transition-all duration-300 cursor-pointer group">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="size-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform">
                  <TrendingUp className="size-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-1">สรุปคอมมิชชัน</h3>
                  <p className="text-sm text-slate-400">Commission Summary</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      วันนี้: {agentData.todayCommission.toLocaleString()} บาท
                    </Badge>
                  </div>
                </div>
                <ArrowRight className="size-6 text-emerald-400 group-hover:translate-x-2 transition-transform" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Today's Summary */}
      <Card className="bg-black/40 backdrop-blur-xl border-amber-500/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-amber-400 flex items-center gap-2">
              <Clock className="size-5" />
              สรุปวันนี้
            </CardTitle>
            <span className="text-xs text-slate-500">
              อัพเดทล่าสุด: {new Date().toLocaleTimeString('th-TH')}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-black/30 border border-white/5">
              <p className="text-xs text-slate-500 mb-1">ยอดแทงรวม</p>
              <p className="text-xl font-bold text-white">{agentData.todayBets.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-xl bg-black/30 border border-white/5">
              <p className="text-xs text-slate-500 mb-1">หักค่าคอม ({agentData.commissionRate}%)</p>
              <p className="text-xl font-bold text-emerald-400">-{agentData.todayCommission.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-xl bg-black/30 border border-white/5">
              <p className="text-xs text-slate-500 mb-1">ยอดสุทธิ</p>
              <p className="text-xl font-bold text-amber-400">{agentData.todayNet.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-xl bg-black/30 border border-white/5">
              <p className="text-xs text-slate-500 mb-1">ยอดสัปดาห์นี้</p>
              <p className="text-xl font-bold text-blue-400">{agentData.weeklyBets.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts Help */}
      <Card className="bg-black/40 backdrop-blur-xl border-slate-700/50 mt-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-400 flex items-center gap-2">
            <Keyboard className="size-4" />
            คีย์ลัดสำหรับการคีย์เลข
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono">Tab</kbd>
              <span className="text-slate-500">เปลี่ยนช่อง</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono">Enter</kbd>
              <span className="text-slate-500">บันทึก/ส่ง</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono">*</kbd>
              <span className="text-slate-500">คูณราคา (123*100)</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono">Esc</kbd>
              <span className="text-slate-500">ยกเลิก</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
