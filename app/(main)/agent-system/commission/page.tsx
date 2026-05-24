'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { DollarSign, TrendingUp, Clock, CheckCircle, Calendar, Download, RefreshCw, Loader2, Wallet, PiggyBank, Banknote, Zap } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Commission {
  id: string; agent_id: string; agent_name: string; agent_username: string;
  period_type: string; period_start: string; period_end: string;
  total_sales: number; commission_rate: number; commission_amount: number;
  status: 'pending' | 'approved' | 'paid'; paid_at?: string;
}

export default function AutoCommissionPage() {
  const [periodType, setPeriodType] = useState<string>('daily');
  const [status, setStatus] = useState<string>('all');
  const [isProcessing, setIsProcessing] = useState(false);

  const { data, mutate } = useSWR<{ commissions: Commission[], stats: any }>(`/api/auto-agents/commission?period=${periodType}&status=${status}`, fetcher);
  const commissions = data?.commissions || [];
  const stats = data?.stats || { totalEarned: 0, pendingAmount: 0, paidAmount: 0, totalAgents: 0, avgCommission: 0 };

  const formatNumber = (num: number) => new Intl.NumberFormat('th-TH').format(num);
  const formatDate = (date: string) => new Date(date).toLocaleDateString('th-TH');

  const handleApprove = async (id: string) => {
    if (!confirm('ต้องการอนุมัติคอมมิชชั่นนี้?')) return;
    try {
      const res = await fetch('/api/auto-agents/commission', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve', id }) });
      const result = await res.json();
      if (result.success) { toast.success('อนุมัติคอมมิชชั่นสำเร็จ'); mutate(); }
      else { toast.error(result.error || 'เกิดข้อผิดพลาด'); }
    } catch { toast.error('เกิดข้อผิดพลาด'); }
  };

  const handlePay = async (id: string) => {
    if (!confirm('ต้องการจ่ายคอมมิชชั่นนี้?')) return;
    try {
      const res = await fetch('/api/auto-agents/commission', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pay', id }) });
      const result = await res.json();
      if (result.success) { toast.success('จ่ายคอมมิชชั่นสำเร็จ'); mutate(); }
      else { toast.error(result.error || 'เกิดข้อผิดพลาด'); }
    } catch { toast.error('เกิดข้อผิดพลาด'); }
  };

  const handleCalculate = async () => {
    if (!confirm('ต้องการคำนวณคอมมิชชั่นใหม่?')) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/auto-agents/commission', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'calculate', periodType }) });
      const result = await res.json();
      if (result.success) { toast.success(`คำนวณคอมมิชชั่นสำเร็จ: ${result.count} รายการ`); mutate(); }
      else { toast.error(result.error || 'เกิดข้อผิดพลาด'); }
    } catch { toast.error('เกิดข้อผิดพลาด'); }
    setIsProcessing(false);
  };

  const handleExport = () => {
    const csvContent = [['เอเย่น', 'Username', 'ช่วงเวลา', 'ยอดขาย', 'อัตรา %', 'คอมมิชชั่น', 'สถานะ'].join(','),
      ...commissions.map(c => [c.agent_name, c.agent_username, `${formatDate(c.period_start)} - ${formatDate(c.period_end)}`, c.total_sales, c.commission_rate, c.commission_amount, c.status === 'paid' ? 'จ่ายแล้ว' : c.status === 'approved' ? 'อนุมัติแล้ว' : 'รอดำเนินการ'].join(','))
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `auto_commission_${periodType}_${new Date().toISOString().split('T')[0]}.csv`; link.click();
    toast.success('ส่งออกข้อมูลสำเร็จ');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-accent flex items-center gap-2"><Zap className="size-6" />คอมมิชชั่น (ออโต้)</h1>
          <p className="text-muted-foreground">จัดการและดูคอมมิชชั่นเอเย่นออโต้</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}><Download className="size-4 mr-2" />ส่งออก</Button>
          <Button onClick={handleCalculate} disabled={isProcessing}>{isProcessing ? <Loader2 className="size-4 mr-2 animate-spin" /> : <RefreshCw className="size-4 mr-2" />}คำนวณใหม่</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-card/50 border-accent/20"><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-accent/20"><Wallet className="size-5 text-accent" /></div><div><p className="text-xs text-muted-foreground">รวมทั้งหมด</p><p className="text-xl font-bold">{formatNumber(stats.totalEarned)}</p></div></div></CardContent></Card>
        <Card className="bg-card/50 border-orange-500/20"><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-orange-500/20"><Clock className="size-5 text-orange-500" /></div><div><p className="text-xs text-muted-foreground">รอดำเนินการ</p><p className="text-xl font-bold text-orange-500">{formatNumber(stats.pendingAmount)}</p></div></div></CardContent></Card>
        <Card className="bg-card/50 border-green-500/20"><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-green-500/20"><CheckCircle className="size-5 text-green-500" /></div><div><p className="text-xs text-muted-foreground">จ่ายแล้ว</p><p className="text-xl font-bold text-green-500">{formatNumber(stats.paidAmount)}</p></div></div></CardContent></Card>
        <Card className="bg-card/50 border-blue-500/20"><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-blue-500/20"><TrendingUp className="size-5 text-blue-500" /></div><div><p className="text-xs text-muted-foreground">เอเย่นรับคอม</p><p className="text-xl font-bold">{stats.totalAgents}</p></div></div></CardContent></Card>
        <Card className="bg-card/50 border-purple-500/20"><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-purple-500/20"><PiggyBank className="size-5 text-purple-500" /></div><div><p className="text-xs text-muted-foreground">เฉลี่ย/คน</p><p className="text-xl font-bold">{formatNumber(stats.avgCommission)}</p></div></div></CardContent></Card>
      </div>

      <Tabs value={periodType} onValueChange={setPeriodType}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="daily">รายวัน</TabsTrigger><TabsTrigger value="weekly">รายสัปดาห์</TabsTrigger><TabsTrigger value="monthly">รายเดือน</TabsTrigger><TabsTrigger value="yearly">รายปี</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card><CardContent className="pt-4"><div className="flex gap-4">
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-[200px]"><SelectValue placeholder="สถานะ" /></SelectTrigger><SelectContent><SelectItem value="all">ทั้งหมด</SelectItem><SelectItem value="pending">รอดำเนินการ</SelectItem><SelectItem value="approved">อนุมัติแล้ว</SelectItem><SelectItem value="paid">จ่ายแล้ว</SelectItem></SelectContent></Select>
        <Button variant="outline" onClick={() => mutate()}><RefreshCw className="size-4 mr-2" />รีเฟรช</Button>
      </div></CardContent></Card>

      <Card><CardContent className="p-0"><Table>
        <TableHeader><TableRow>
          <TableHead>เอเย่น</TableHead><TableHead>ช่วงเวลา</TableHead><TableHead className="text-right">ยอดขาย</TableHead>
          <TableHead className="text-right">อัตรา</TableHead><TableHead className="text-right">คอมมิชชั่น</TableHead><TableHead className="text-center">สถานะ</TableHead><TableHead></TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {commissions.length === 0 ? (<TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">ไม่พบข้อมูลคอมมิชชั่น</TableCell></TableRow>) :
            commissions.map((comm) => (
              <TableRow key={comm.id}>
                <TableCell><div><p className="font-medium">{comm.agent_name}</p><p className="text-xs text-muted-foreground">@{comm.agent_username}</p></div></TableCell>
                <TableCell><div className="flex items-center gap-2"><Calendar className="size-4 text-muted-foreground" /><span className="text-sm">{formatDate(comm.period_start)} - {formatDate(comm.period_end)}</span></div></TableCell>
                <TableCell className="text-right font-medium">{formatNumber(comm.total_sales)}</TableCell>
                <TableCell className="text-right">{comm.commission_rate}%</TableCell>
                <TableCell className="text-right font-bold text-accent">{formatNumber(comm.commission_amount)}</TableCell>
                <TableCell className="text-center"><Badge variant={comm.status === 'paid' ? 'default' : comm.status === 'approved' ? 'secondary' : 'outline'}>{comm.status === 'paid' ? 'จ่ายแล้ว' : comm.status === 'approved' ? 'อนุมัติแล้ว' : 'รอดำเนินการ'}</Badge></TableCell>
                <TableCell><div className="flex gap-2">
                  {comm.status === 'pending' && <Button size="sm" variant="outline" onClick={() => handleApprove(comm.id)}>อนุมัติ</Button>}
                  {comm.status === 'approved' && <Button size="sm" onClick={() => handlePay(comm.id)}><Banknote className="size-4 mr-1" />จ่าย</Button>}
                </div></TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table></CardContent></Card>
    </div>
  );
}
