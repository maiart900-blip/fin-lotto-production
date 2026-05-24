'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Shield, 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Users,
  RefreshCw,
  Download,
  AlertTriangle,
  Calendar
} from 'lucide-react';

interface FinancialSnapshot {
  id: string;
  snapshot_date: string;
  total_credit_balance: number;
  total_deposits: number;
  total_withdrawals: number;
  total_bets: number;
  total_payouts: number;
  gross_profit: number;
  pending_withdrawals: number;
  pending_withdrawals_count: number;
  active_customers: number;
  new_customers: number;
}

interface ApprovalWorkflow {
  id: string;
  workflow_type: string;
  entity_type: string;
  entity_id: string;
  requested_by: string;
  requested_at: string;
  amount: number | null;
  reason: string | null;
  status: string;
}

export default function GovernancePage() {
  const [snapshots, setSnapshots] = useState<FinancialSnapshot[]>([]);
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [snapshotsRes, workflowsRes] = await Promise.all([
        fetch('/api/admin/governance/financial-snapshots?limit=30'),
        fetch('/api/admin/governance/approval-workflows?status=pending&limit=20')
      ]);

      const snapshotsData = await snapshotsRes.json();
      const workflowsData = await workflowsRes.json();

      if (snapshotsData.success) setSnapshots(snapshotsData.data || []);
      if (workflowsData.success) setWorkflows(workflowsData.data || []);
    } catch (error) {
      console.error('Error fetching governance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTodaySnapshot = async () => {
    try {
      const res = await fetch('/api/admin/governance/financial-snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Error creating snapshot:', error);
    }
  };

  const handleWorkflowAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      // ดึง admin ID จาก localStorage
      const adminId = typeof window !== 'undefined' 
        ? localStorage.getItem('admin_id') || localStorage.getItem('user_id') || 'admin' 
        : 'admin';
      
      const res = await fetch('/api/admin/governance/approval-workflows', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action,
          actor_id: adminId,
          rejection_reason: action === 'reject' ? 'Rejected by admin' : undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Error updating workflow:', error);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const latestSnapshot = snapshots[0];

  const getWorkflowTypeBadge = (type: string) => {
    const types: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      credit_adjustment: { label: 'ปรับเครดิต', variant: 'default' },
      large_withdrawal: { label: 'ถอนยอดใหญ่', variant: 'destructive' },
      credit_line: { label: 'หุ้นลม', variant: 'secondary' },
      refund: { label: 'คืนเงิน', variant: 'outline' }
    };
    const config = types[type] || { label: type, variant: 'default' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-amber-500" />
            Governance & Compliance
          </h1>
          <p className="text-zinc-400 mt-1">ระบบกำกับดูแลและตรวจสอบการเงิน</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
          <Button onClick={createTodaySnapshot} className="bg-amber-600 hover:bg-amber-700">
            <Calendar className="h-4 w-4 mr-2" />
            สร้าง Snapshot วันนี้
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {latestSnapshot && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardDescription className="text-zinc-400">เครดิตรวมในระบบ</CardDescription>
              <CardTitle className="text-2xl text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                {formatMoney(latestSnapshot.total_credit_balance)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-zinc-500">ณ วันที่ {latestSnapshot.snapshot_date}</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardDescription className="text-zinc-400">กำไรขั้นต้น</CardDescription>
              <CardTitle className={`text-2xl flex items-center gap-2 ${latestSnapshot.gross_profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {latestSnapshot.gross_profit >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                {formatMoney(latestSnapshot.gross_profit)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-zinc-500">แทง {formatMoney(latestSnapshot.total_bets)} / จ่าย {formatMoney(latestSnapshot.total_payouts)}</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardDescription className="text-zinc-400">รอถอน</CardDescription>
              <CardTitle className="text-2xl text-amber-500 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                {formatMoney(latestSnapshot.pending_withdrawals)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-zinc-500">{latestSnapshot.pending_withdrawals_count} รายการ</p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardDescription className="text-zinc-400">ลูกค้า Active</CardDescription>
              <CardTitle className="text-2xl text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                {latestSnapshot.active_customers.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-zinc-500">ใหม่วันนี้ +{latestSnapshot.new_customers}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-zinc-800">
          <TabsTrigger value="overview">ภาพรวม</TabsTrigger>
          <TabsTrigger value="approvals">
            รออนุมัติ
            {workflows.length > 0 && (
              <Badge variant="destructive" className="ml-2">{workflows.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">ประวัติ Snapshot</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Pending Approvals Summary */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                รายการรออนุมัติ ({workflows.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {workflows.length === 0 ? (
                <p className="text-zinc-500 text-center py-8">ไม่มีรายการรออนุมัติ</p>
              ) : (
                <div className="space-y-3">
                  {workflows.slice(0, 5).map((workflow) => (
                    <div key={workflow.id} className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        {getWorkflowTypeBadge(workflow.workflow_type)}
                        <div>
                          <p className="text-white text-sm">{workflow.entity_type} #{workflow.entity_id.slice(0, 8)}</p>
                          {workflow.amount && (
                            <p className="text-amber-500 text-sm font-medium">{formatMoney(workflow.amount)} บาท</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-500 border-green-500 hover:bg-green-500/10"
                          onClick={() => handleWorkflowAction(workflow.id, 'approve')}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          อนุมัติ
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-500 border-red-500 hover:bg-red-500/10"
                          onClick={() => handleWorkflowAction(workflow.id, 'reject')}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          ปฏิเสธ
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals" className="space-y-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white">รายการรออนุมัติทั้งหมด</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800">
                    <TableHead className="text-zinc-400">ประเภท</TableHead>
                    <TableHead className="text-zinc-400">Entity</TableHead>
                    <TableHead className="text-zinc-400">จำนวน</TableHead>
                    <TableHead className="text-zinc-400">เหตุผล</TableHead>
                    <TableHead className="text-zinc-400">วันที่ขอ</TableHead>
                    <TableHead className="text-zinc-400">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workflows.map((workflow) => (
                    <TableRow key={workflow.id} className="border-zinc-800">
                      <TableCell>{getWorkflowTypeBadge(workflow.workflow_type)}</TableCell>
                      <TableCell className="text-white">{workflow.entity_type}</TableCell>
                      <TableCell className="text-amber-500">
                        {workflow.amount ? formatMoney(workflow.amount) : '-'}
                      </TableCell>
                      <TableCell className="text-zinc-400 max-w-[200px] truncate">
                        {workflow.reason || '-'}
                      </TableCell>
                      <TableCell className="text-zinc-400">
                        {new Date(workflow.requested_at).toLocaleString('th-TH')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-green-500 hover:bg-green-500/10"
                            onClick={() => handleWorkflowAction(workflow.id, 'approve')}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:bg-red-500/10"
                            onClick={() => handleWorkflowAction(workflow.id, 'reject')}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-500" />
                ประวัติ Financial Snapshots
              </CardTitle>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800">
                    <TableHead className="text-zinc-400">วันที่</TableHead>
                    <TableHead className="text-zinc-400 text-right">เครดิตรวม</TableHead>
                    <TableHead className="text-zinc-400 text-right">ฝาก</TableHead>
                    <TableHead className="text-zinc-400 text-right">ถอน</TableHead>
                    <TableHead className="text-zinc-400 text-right">ยอดแทง</TableHead>
                    <TableHead className="text-zinc-400 text-right">จ่ายรางวัล</TableHead>
                    <TableHead className="text-zinc-400 text-right">กำไร</TableHead>
                    <TableHead className="text-zinc-400 text-right">ลูกค���า</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshots.map((snapshot) => (
                    <TableRow key={snapshot.id} className="border-zinc-800">
                      <TableCell className="text-white font-medium">{snapshot.snapshot_date}</TableCell>
                      <TableCell className="text-right text-white">{formatMoney(snapshot.total_credit_balance)}</TableCell>
                      <TableCell className="text-right text-green-500">{formatMoney(snapshot.total_deposits)}</TableCell>
                      <TableCell className="text-right text-red-500">{formatMoney(snapshot.total_withdrawals)}</TableCell>
                      <TableCell className="text-right text-white">{formatMoney(snapshot.total_bets)}</TableCell>
                      <TableCell className="text-right text-amber-500">{formatMoney(snapshot.total_payouts)}</TableCell>
                      <TableCell className={`text-right font-medium ${snapshot.gross_profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatMoney(snapshot.gross_profit)}
                      </TableCell>
                      <TableCell className="text-right text-zinc-400">{snapshot.active_customers}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
