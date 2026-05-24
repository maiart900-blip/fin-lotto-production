'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, XCircle, AlertTriangle, RefreshCw,
  Database, Shield, Users, Wallet, BarChart3, Network,
  FileText, Clock, Zap
} from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json()).catch(() => null);

interface AuditResult {
  category: string;
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'mock';
  message: string;
  details?: any;
}

export default function ProductionAuditPage() {
  const [results, setResults] = useState<AuditResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // Fetch all data sources
  const { data: betSummary } = useSWR('/api/bet-summary?debug=true', fetcher);
  const { data: entries } = useSWR('/api/entries?limit=5', fetcher);
  const { data: bets } = useSWR('/api/bets?limit=5', fetcher);
  const { data: lotteryResults } = useSWR('/api/results?limit=5', fetcher);
  const { data: customers } = useSWR('/api/customers?limit=5', fetcher);
  const { data: agents } = useSWR('/api/agents?limit=5', fetcher);
  const { data: sites } = useSWR('/api/sites', fetcher);
  const { data: manualKeySlips } = useSWR('/api/manual-key/slips?limit=5', fetcher);
  const { data: dashboard } = useSWR('/api/master-dashboard', fetcher);

  const runAudit = () => {
    setIsRunning(true);
    const auditResults: AuditResult[] = [];

    // ===== A. PERMISSION SYSTEM =====
    auditResults.push({
      category: 'A. Permission',
      name: 'RBAC System',
      status: 'pass',
      message: 'lib/rbac.ts และ lib/permissions.ts มีระบบ role-based access control',
      details: 'Roles: super_admin, master_admin, admin, agent_auto, agent_key, agent, key_branch, staff, member'
    });

    auditResults.push({
      category: 'A. Permission',
      name: 'Owner ID Filtering',
      status: 'warning',
      message: 'entries/bets table ไม่มี owner_id column - ยังไม่ filter ตาม owner',
      details: 'ต้องเพิ่ม owner_id column และใช้ใน API queries'
    });

    auditResults.push({
      category: 'A. Permission',
      name: 'Hierarchy Filtering',
      status: 'warning',
      message: 'agents table ว่างเปล่า - ยังไม่มีโครงสร้างสายงาน',
      details: agents?.agents?.length > 0 ? `มี ${agents.agents.length} agents` : 'ไม่มี agents'
    });

    auditResults.push({
      category: 'A. Permission',
      name: 'Tenant ID Filtering',
      status: sites?.totalSites > 0 ? 'pass' : 'warning',
      message: sites?.totalSites > 0 ? `มี ${sites.totalSites} sites` : 'ยังไม่มี sub-sites',
      details: sites
    });

    // ===== B. DASHBOARD =====
    const dashboardData = dashboard?.data;
    auditResults.push({
      category: 'B. Dashboard',
      name: 'Dashboard API ใช้ข้อมูลจริง',
      status: dashboardData?.totalVolume > 0 ? 'pass' : 'warning',
      message: dashboardData ? `ยอดแทงรวม: ${dashboardData.totalVolume?.toLocaleString()} บาท` : 'ไม่มีข้อมูล',
      details: { totalVolume: dashboardData?.totalVolume, todayVolume: dashboardData?.todayVolume, totalProfit: dashboardData?.totalProfit }
    });

    auditResults.push({
      category: 'B. Dashboard',
      name: 'Dashboard แยกตาม Role',
      status: 'mock',
      message: 'ยังไม่มีการแยก Dashboard ตาม role - ทุก role เห็นข้อมูลเดียวกัน',
      details: 'ต้องเพิ่ม role-based filtering ใน API'
    });

    // ===== C. ระบบยอดแทง =====
    auditResults.push({
      category: 'C. ยอดแทง',
      name: 'getBetSummary() กลางตัวเดียว',
      status: 'pass',
      message: 'สร้าง /api/bet-summary API และ useBetSummary() hook แล้ว',
      details: betSummary
    });

    auditResults.push({
      category: 'C. ยอดแทง',
      name: 'รวม entries + bets ถูกต้อง',
      status: betSummary?.totalAmount > 0 ? 'pass' : 'warning',
      message: `entries: ${betSummary?.debug?.entriesCount || 0}, bets: ${betSummary?.debug?.betsCount || 0}`,
      details: { totalAmount: betSummary?.totalAmount, entriesTotal: betSummary?.debug?.entriesTotal, betsTotal: betSummary?.debug?.betsTotal }
    });

    auditResults.push({
      category: 'C. ยอดแทง',
      name: 'Owner ID Filtering ในยอดแทง',
      status: 'warning',
      message: 'API bet-summary ยังไม่ filter ตาม ownerId',
      details: 'ต้องเพิ่ม ownerId parameter และ filter ใน query'
    });

    // ===== D. ระบบเว็บลูก =====
    auditResults.push({
      category: 'D. เว็บลูก',
      name: 'Sites/Tenants Table',
      status: sites?.totalSites > 0 ? 'pass' : 'warning',
      message: sites?.totalSites > 0 ? `มี ${sites.totalSites} เว็บลูก` : 'ยังไม่มีเว็บลูก',
      details: sites?.sites
    });

    auditResults.push({
      category: 'D. เว็บลูก',
      name: 'สร้าง Agent ใหม่ได้จริง',
      status: agents?.agents?.length > 0 ? 'pass' : 'warning',
      message: agents?.agents?.length > 0 ? `มี ${agents.agents.length} agents` : 'ยังไม่มี agents - ลบไปแล้วยังไม่สร้างใหม่',
      details: agents?.agents
    });

    auditResults.push({
      category: 'D. เว็บลูก',
      name: 'Dashboard แยกแต่ละเว็บลูก',
      status: 'mock',
      message: 'ยังไม่มีการแยก Dashboard per tenant',
      details: 'ต้องเพิ่ม tenant_id filtering ใน API'
    });

    // ===== E. ระบบคีย์หวย =====
    const slips = manualKeySlips?.slips || [];
    auditResults.push({
      category: 'E. คีย์หวย',
      name: 'Key Staff คีย์โพยได้จริง',
      status: slips.length > 0 ? 'pass' : 'warning',
      message: slips.length > 0 ? `มี ${slips.length} โพยจากระบบคีย์` : 'ยังไม่มีโพยจากระบบคีย์',
      details: manualKeySlips?.summary
    });

    auditResults.push({
      category: 'E. คีย์หวย',
      name: 'โพยเข้าระบบจริง',
      status: Array.isArray(bets) && bets.length > 0 ? 'pass' : 'warning',
      message: Array.isArray(bets) ? `มี ${bets.length} bets ในระบบ` : 'ไม่สามารถดึงข้อมูล bets',
      details: Array.isArray(bets) ? bets.slice(0, 2) : bets
    });

    auditResults.push({
      category: 'E. คีย์หวย',
      name: 'เอเย่นหัวเห็นโพยลูกทีม',
      status: 'warning',
      message: 'ยังไม่มี hierarchy filtering - ทุกคนเห็นทุกโพย',
      details: 'ต้องเพิ่ม agent_id และ hierarchy filter'
    });

    // ===== F. ระบบผลหวย =====
    const processedResults = Array.isArray(lotteryResults) ? lotteryResults.filter((r: any) => r.is_processed) : [];
    auditResults.push({
      category: 'F. ผลหวย',
      name: 'ประกาศผล + คำนวณรางวัลจริง',
      status: processedResults.length > 0 ? 'pass' : 'warning',
      message: `${processedResults.length} งวดที่คำนวณแล้ว`,
      details: processedResults.slice(0, 2)
    });

    const totalWinners = processedResults.reduce((sum: number, r: any) => sum + (r.total_winners || 0), 0);
    auditResults.push({
      category: 'F. ผลหวย',
      name: 'เครดิตเข้าลูกค้าจริง',
      status: totalWinners > 0 ? 'pass' : 'warning',
      message: totalWinners > 0 ? `พบผู้ถูกรางวัล ${totalWinners} รายการ` : 'ยังไม่มีผู้ถูกรางวัล',
      details: 'entries.status = won, entries.payout_amount มีค่า'
    });

    auditResults.push({
      category: 'F. ผลหวย',
      name: 'Dashboard อัปเดทยอดจริง',
      status: dashboardData?.pendingPayouts > 0 ? 'pass' : 'warning',
      message: `รอจ่ายรางวัล: ${(dashboardData?.pendingPayouts || 0).toLocaleString()} บาท`,
      details: { pendingPayouts: dashboardData?.pendingPayouts }
    });

    // ===== G. ระบบความปลอดภัย =====
    auditResults.push({
      category: 'G. Security',
      name: '2FA System',
      status: 'warning',
      message: 'ไม่มี middleware.ts - 2FA อาจไม่ทำงาน',
      details: 'ต้องตรวจสอบ 2FA flow ใน UI'
    });

    auditResults.push({
      category: 'G. Security',
      name: 'Session Management',
      status: 'pass',
      message: 'ใช้ cookie-based session (admin_token, lottery_session)',
      details: 'ตรวจสอบจาก API routes'
    });

    setResults(auditResults);
    setIsRunning(false);
    toast.success('Audit completed');
  };

  useEffect(() => {
    if (betSummary && dashboard) {
      runAudit();
    }
  }, [betSummary, dashboard]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'fail': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'mock': return <Clock className="h-5 w-5 text-blue-500" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass': return <Badge className="bg-green-500/20 text-green-400">ใช้งานจริง</Badge>;
      case 'fail': return <Badge className="bg-red-500/20 text-red-400">ไม่ทำงาน</Badge>;
      case 'warning': return <Badge className="bg-yellow-500/20 text-yellow-400">ยังไม่สมบูรณ์</Badge>;
      case 'mock': return <Badge className="bg-blue-500/20 text-blue-400">เป็นแค่ UI/mock</Badge>;
      default: return null;
    }
  };

  const categories = [...new Set(results.map(r => r.category))];
  const summary = {
    pass: results.filter(r => r.status === 'pass').length,
    warning: results.filter(r => r.status === 'warning').length,
    fail: results.filter(r => r.status === 'fail').length,
    mock: results.filter(r => r.status === 'mock').length,
  };

  return (
    <div className="p-6 space-y-6 bg-black min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-500" />
            Production System Audit
          </h1>
          <p className="text-neutral-400">ตรวจสอบโครงสร้างระบบทั้งหมดแบบ Production จริง</p>
        </div>
        <Button onClick={runAudit} disabled={isRunning} className="bg-amber-500 text-black hover:bg-amber-600">
          <RefreshCw className={`h-4 w-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
          Run Audit
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-green-400">ใช้งานจริง</p>
              <p className="text-3xl font-bold text-green-500">{summary.pass}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/10 border-yellow-500/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-400">ยังไม่สมบูรณ์</p>
              <p className="text-3xl font-bold text-yellow-500">{summary.warning}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-400">เป็นแค่ UI/mock</p>
              <p className="text-3xl font-bold text-blue-500">{summary.mock}</p>
            </div>
            <Clock className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-red-400">ไม่ทำงาน</p>
              <p className="text-3xl font-bold text-red-500">{summary.fail}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-500" />
          </CardContent>
        </Card>
      </div>

      {/* Results by Category */}
      <Tabs defaultValue={categories[0] || 'all'} className="space-y-4">
        <TabsList className="bg-neutral-900 border border-neutral-800">
          {categories.map(cat => (
            <TabsTrigger key={cat} value={cat} className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
              {cat.split('.')[1] || cat}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map(cat => (
          <TabsContent key={cat} value={cat}>
            <div className="space-y-3">
              {results.filter(r => r.category === cat).map((result, i) => (
                <Card key={i} className={`border ${
                  result.status === 'pass' ? 'bg-green-500/5 border-green-500/20' :
                  result.status === 'fail' ? 'bg-red-500/5 border-red-500/20' :
                  result.status === 'warning' ? 'bg-yellow-500/5 border-yellow-500/20' :
                  'bg-blue-500/5 border-blue-500/20'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getStatusIcon(result.status)}
                        <div>
                          <h3 className="font-medium text-white">{result.name}</h3>
                          <p className="text-sm text-neutral-400 mt-1">{result.message}</p>
                          {result.details && (
                            <pre className="mt-2 text-xs bg-black/50 p-2 rounded overflow-auto max-h-32 text-neutral-500">
                              {typeof result.details === 'string' ? result.details : JSON.stringify(result.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(result.status)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Data Sources */}
      <Card className="bg-neutral-900 border-neutral-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Sources Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-neutral-800">
              <p className="text-xs text-neutral-400">Entries</p>
              <p className="text-xl font-bold text-white">{Array.isArray(entries) ? entries.length : 0}+</p>
            </div>
            <div className="p-3 rounded-lg bg-neutral-800">
              <p className="text-xs text-neutral-400">Bets</p>
              <p className="text-xl font-bold text-white">{Array.isArray(bets) ? bets.length : 0}+</p>
            </div>
            <div className="p-3 rounded-lg bg-neutral-800">
              <p className="text-xs text-neutral-400">Lottery Results</p>
              <p className="text-xl font-bold text-white">{Array.isArray(lotteryResults) ? lotteryResults.length : 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-neutral-800">
              <p className="text-xs text-neutral-400">Customers</p>
              <p className="text-xl font-bold text-white">{Array.isArray(customers) ? customers.length : 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-neutral-800">
              <p className="text-xs text-neutral-400">Agents</p>
              <p className="text-xl font-bold text-white">{agents?.agents?.length || 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-neutral-800">
              <p className="text-xs text-neutral-400">Sites</p>
              <p className="text-xl font-bold text-white">{sites?.totalSites || 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-neutral-800">
              <p className="text-xs text-neutral-400">Total Volume</p>
              <p className="text-xl font-bold text-amber-500">{(betSummary?.totalAmount || 0).toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-lg bg-neutral-800">
              <p className="text-xs text-neutral-400">Pending Payout</p>
              <p className="text-xl font-bold text-green-500">{(betSummary?.pendingPayoutAmount || 0).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
