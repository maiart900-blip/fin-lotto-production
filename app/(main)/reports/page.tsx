'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Download, 
  FileSpreadsheet, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  Loader2,
  DollarSign,
  Users,
  Ticket,
  Wallet
} from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

type ReportPeriod = 'today' | 'week' | 'month' | 'year' | 'custom';
type ReportType = 'summary' | 'topup' | 'withdraw' | 'entries' | 'customers';

export default function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>('today');
  const [reportType, setReportType] = useState<ReportType>('summary');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Build date range params
  const getDateParams = () => {
    const now = new Date();
    let start = '';
    let end = now.toISOString().split('T')[0];
    
    switch (period) {
      case 'today':
        start = end;
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        start = weekAgo.toISOString().split('T')[0];
        break;
      case 'month':
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        start = monthAgo.toISOString().split('T')[0];
        break;
      case 'year':
        const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        start = yearAgo.toISOString().split('T')[0];
        break;
      case 'custom':
        start = startDate || end;
        end = endDate || end;
        break;
    }
    
    return { start, end };
  };

  const { start, end } = getDateParams();
  
  // Fetch report data
  const { data: summaryData, isLoading: summaryLoading } = useSWR(
    `/api/profit-loss?start=${start}&end=${end}`,
    fetcher
  );

  const { data: topupData, isLoading: topupLoading } = useSWR(
    reportType === 'topup' ? `/api/topup-requests?start=${start}&end=${end}` : null,
    fetcher
  );

  const { data: withdrawData, isLoading: withdrawLoading } = useSWR(
    reportType === 'withdraw' ? `/api/withdraw-requests?start=${start}&end=${end}` : null,
    fetcher
  );

  const { data: entriesData, isLoading: entriesLoading } = useSWR(
    reportType === 'entries' ? `/api/entries?start=${start}&end=${end}` : null,
    fetcher
  );

  const { data: customersData, isLoading: customersLoading } = useSWR(
    reportType === 'customers' ? '/api/customers' : null,
    fetcher
  );

  const summary = summaryData?.summary || {
    totalBets: 0,
    totalPayout: 0,
    netProfit: 0,
    totalTopup: 0,
    totalWithdraw: 0,
  };

  // Export to CSV
  const exportToCSV = async () => {
    setIsExporting(true);
    try {
      let data: any[] = [];
      let filename = '';
      let headers: string[] = [];

      switch (reportType) {
        case 'summary':
          data = [{
            'ช่วงเวลา': `${start} ถึง ${end}`,
            'ยอดแทงรวม': summary.totalBets,
            'ยอดจ่ายรางวัล': summary.totalPayout,
            'ยอดเติมเงิน': summary.totalTopup,
            'ยอดถอนเงิน': summary.totalWithdraw,
            'กำไร/ขาดทุน': summary.netProfit,
          }];
          headers = ['ช่วงเวลา', 'ยอดแทงรวม', 'ยอดจ่ายรางวัล', 'ยอดเติมเงิน', 'ยอดถอนเงิน', 'กำไร/ขาดทุน'];
          filename = `summary_${start}_${end}.csv`;
          break;

        case 'topup':
          const topups = Array.isArray(topupData) ? topupData : [];
          data = topups.map((t: any) => ({
            'วันที่': new Date(t.created_at).toLocaleString('th-TH'),
            'ลูกค้า': t.customers?.name || t.customer_id,
            'จำนวน': t.amount,
            'สถานะ': t.status === 'approved' ? 'อนุมัติ' : t.status === 'rejected' ? 'ปฏิเสธ' : 'รอดำเนินการ',
          }));
          headers = ['วันที่', 'ลูกค้า', 'จำนวน', 'สถานะ'];
          filename = `topup_${start}_${end}.csv`;
          break;

        case 'withdraw':
          const withdraws = Array.isArray(withdrawData) ? withdrawData : [];
          data = withdraws.map((w: any) => ({
            'วันที่': new Date(w.created_at).toLocaleString('th-TH'),
            'ลูกค้า': w.customers?.name || w.customer_id,
            'จำนวน': w.amount,
            'ธนาคาร': w.bank_name,
            'เลขบัญชี': w.account_number,
            'สถานะ': w.status === 'approved' ? 'อนุมัติ' : w.status === 'rejected' ? 'ปฏิเสธ' : 'รอดำเนินการ',
          }));
          headers = ['วันที่', 'ลูกค้า', 'จำนวน', 'ธนาคาร', 'เลขบัญชี', 'สถานะ'];
          filename = `withdraw_${start}_${end}.csv`;
          break;

        case 'entries':
          const entries = Array.isArray(entriesData) ? entriesData : [];
          data = entries.map((e: any) => ({
            'วันที่': new Date(e.created_at).toLocaleString('th-TH'),
            'ลูกค้า': e.customers?.name || e.customer_id,
            'หวย': e.lotteries?.name || e.lottery_id,
            'เลข': e.number,
            'ประเภท': e.bet_type,
            'จำนวน': e.amount,
          }));
          headers = ['วันที่', 'ลูกค้า', 'หวย', 'เลข', 'ประเภท', 'จำนวน'];
          filename = `entries_${start}_${end}.csv`;
          break;

        case 'customers':
          const customers = Array.isArray(customersData) ? customersData : [];
          data = customers.map((c: any) => ({
            'ชื่อ': c.name || c.username,
            'เบอร์โทร': c.phone,
            'เครดิต': c.credit_balance || 0,
            'สถานะ': c.is_active ? 'ใช้งาน' : 'ระงับ',
            'วันที่สมัคร': new Date(c.created_at).toLocaleString('th-TH'),
          }));
          headers = ['ชื่อ', 'เบอร์โทร', 'เครดิต', 'สถานะ', 'วันที่สมัคร'];
          filename = `customers.csv`;
          break;
      }

      if (data.length === 0) {
        toast.error('ไม่มีข้อมูลสำหรับ Export');
        return;
      }

      // Create CSV content with BOM for Thai characters
      const BOM = '\uFEFF';
      const csvContent = BOM + [
        headers.join(','),
        ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
      ].join('\n');

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('Export สำเร็จ');
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการ Export');
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = summaryLoading || topupLoading || withdrawLoading || entriesLoading || customersLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">รายงาน</h1>
          <p className="text-muted-foreground">ดูรายงานและ Export ข้อมูล</p>
        </div>
        <Button onClick={exportToCSV} disabled={isExporting || isLoading}>
          {isExporting ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Download className="size-4 mr-2" />}
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5" />
            ตัวกรอง
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label>ประเภทรายงาน</Label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">สรุปรวม</SelectItem>
                  <SelectItem value="topup">รายการเติมเงิน</SelectItem>
                  <SelectItem value="withdraw">รายการถอนเงิน</SelectItem>
                  <SelectItem value="entries">รายการแทงหวย</SelectItem>
                  <SelectItem value="customers">รายชื่อสมาชิก</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ช่วงเวลา</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">วันนี้</SelectItem>
                  <SelectItem value="week">7 วันล่าสุด</SelectItem>
                  <SelectItem value="month">30 วันล่าสุด</SelectItem>
                  <SelectItem value="year">1 ปีล่าสุด</SelectItem>
                  <SelectItem value="custom">กำหนดเอง</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {period === 'custom' && (
              <>
                <div>
                  <Label>วันเริ่มต้น</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <Label>วันสิ้นสุด</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ยอดแทงรวม</p>
                <p className="text-2xl font-bold">{summary.totalBets?.toLocaleString() || 0}</p>
              </div>
              <Ticket className="size-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ยอดจ่ายรางวัล</p>
                <p className="text-2xl font-bold text-red-500">{summary.totalPayout?.toLocaleString() || 0}</p>
              </div>
              <DollarSign className="size-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ยอดเติมเงิน</p>
                <p className="text-2xl font-bold text-green-500">{summary.totalTopup?.toLocaleString() || 0}</p>
              </div>
              <Wallet className="size-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ยอดถอนเงิน</p>
                <p className="text-2xl font-bold text-orange-500">{summary.totalWithdraw?.toLocaleString() || 0}</p>
              </div>
              <Wallet className="size-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">กำไร/ขาดทุน</p>
                <p className={`text-2xl font-bold ${summary.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {summary.netProfit >= 0 ? '+' : ''}{summary.netProfit?.toLocaleString() || 0}
                </p>
              </div>
              {summary.netProfit >= 0 ? (
                <TrendingUp className="size-8 text-green-500" />
              ) : (
                <TrendingDown className="size-8 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5" />
            ข้อมูล
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : reportType === 'summary' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รายการ</TableHead>
                  <TableHead className="text-right">จำนวน (บาท)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>ยอดแทงรวม</TableCell>
                  <TableCell className="text-right">{summary.totalBets?.toLocaleString() || 0}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>ยอดจ่ายรางวัล</TableCell>
                  <TableCell className="text-right text-red-500">-{summary.totalPayout?.toLocaleString() || 0}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>ยอดเติมเงิน</TableCell>
                  <TableCell className="text-right text-green-500">+{summary.totalTopup?.toLocaleString() || 0}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>ยอดถอนเงิน</TableCell>
                  <TableCell className="text-right text-orange-500">-{summary.totalWithdraw?.toLocaleString() || 0}</TableCell>
                </TableRow>
                <TableRow className="font-bold">
                  <TableCell>กำไร/ขาดทุนสุทธิ</TableCell>
                  <TableCell className={`text-right ${summary.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {summary.netProfit >= 0 ? '+' : ''}{summary.netProfit?.toLocaleString() || 0}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : reportType === 'topup' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>ลูกค้า</TableHead>
                  <TableHead className="text-right">จำนวน</TableHead>
                  <TableHead>สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(Array.isArray(topupData) ? topupData : []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      ไม่มีข้อมูล
                    </TableCell>
                  </TableRow>
                ) : (
                  (topupData as any[]).slice(0, 50).map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell>{new Date(t.created_at).toLocaleString('th-TH')}</TableCell>
                      <TableCell>{t.customers?.name || t.customer_id}</TableCell>
                      <TableCell className="text-right">{t.amount?.toLocaleString()}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          t.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                          t.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {t.status === 'approved' ? 'อนุมัติ' : t.status === 'rejected' ? 'ปฏิเสธ' : 'รอ'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : reportType === 'withdraw' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>ลูกค้า</TableHead>
                  <TableHead className="text-right">จำนวน</TableHead>
                  <TableHead>ธนาคาร</TableHead>
                  <TableHead>สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(Array.isArray(withdrawData) ? withdrawData : []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      ไม่มีข้อมูล
                    </TableCell>
                  </TableRow>
                ) : (
                  (withdrawData as any[]).slice(0, 50).map((w: any) => (
                    <TableRow key={w.id}>
                      <TableCell>{new Date(w.created_at).toLocaleString('th-TH')}</TableCell>
                      <TableCell>{w.customers?.name || w.customer_id}</TableCell>
                      <TableCell className="text-right">{w.amount?.toLocaleString()}</TableCell>
                      <TableCell>{w.bank_name}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          w.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                          w.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {w.status === 'approved' ? 'อนุมัติ' : w.status === 'rejected' ? 'ปฏิเสธ' : 'รอ'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : reportType === 'entries' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>ลูกค้า</TableHead>
                  <TableHead>หวย</TableHead>
                  <TableHead>เลข</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead className="text-right">จำนวน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(Array.isArray(entriesData) ? entriesData : []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      ไม่มีข้อมูล
                    </TableCell>
                  </TableRow>
                ) : (
                  (entriesData as any[]).slice(0, 50).map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell>{new Date(e.created_at).toLocaleString('th-TH')}</TableCell>
                      <TableCell>{e.customers?.name || e.customer_id}</TableCell>
                      <TableCell>{e.lotteries?.name || e.lottery_id}</TableCell>
                      <TableCell className="font-mono">{e.number}</TableCell>
                      <TableCell>{e.bet_type}</TableCell>
                      <TableCell className="text-right">{e.amount?.toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>เบอร์โทร</TableHead>
                  <TableHead className="text-right">เครดิต</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>วันที่สมัคร</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(Array.isArray(customersData) ? customersData : []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      ไม่มีข้อมูล
                    </TableCell>
                  </TableRow>
                ) : (
                  (customersData as any[]).slice(0, 50).map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name || c.username}</TableCell>
                      <TableCell>{c.phone}</TableCell>
                      <TableCell className="text-right">{(c.credit_balance || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          c.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {c.is_active ? 'ใช้งาน' : 'ระงับ'}
                        </span>
                      </TableCell>
                      <TableCell>{new Date(c.created_at).toLocaleString('th-TH')}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
