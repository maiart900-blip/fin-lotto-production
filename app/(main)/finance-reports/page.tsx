'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  FileBarChart, 
  TrendingUp,
  TrendingDown,
  ArrowDownToLine,
  ArrowUpFromLine,
  Ticket,
  Trophy,
  Wallet,
  Download,
  RefreshCw,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Percent,
} from 'lucide-react';

interface FinanceTransaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string;
  created_at: string;
}

interface FinanceData {
  deposits: {
    total: number;
    count: number;
    pending: number;
  };
  withdrawals: {
    total: number;
    count: number;
    pending: number;
  };
  bets: {
    total: number;
    count: number;
  };
  payouts: {
    total: number;
    count: number;
  };
  profit: number;
  transactions: FinanceTransaction[];
}

const transactionTypeLabels: Record<string, string> = {
  deposit: 'ฝากเงิน',
  withdraw: 'ถอนเงิน',
  bet: 'คอมมิชชั่นจากโพย',
  bet_commission: 'คอมมิชชั่นจากโพย',
  commission: 'ส่วนแบ่งรายได้',
  payout: 'จ่ายรางวัล',
  refund: 'คืนเงิน',
  bonus: 'โบนัส',
  adjustment: 'ปรับยอด',
};

const fetcher = (url: string) => fetch(url).then(res => res.json());

const formatDateKey = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toISOString().split('T')[0];
};

const formatDateDisplay = (dateKey: string) => {
  const date = new Date(dateKey);
  return date.toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const isToday = (dateKey: string) => {
  const today = new Date().toISOString().split('T')[0];
  return dateKey === today;
};

export default function FinanceReportsPage() {
  const [period, setPeriod] = useState('today');
  const [viewMode, setViewMode] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const { data, mutate, isLoading } = useSWR<FinanceData>(
    `/api/finance-reports?period=${period}`,
    fetcher
  );

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const monthOptions = [
    { value: '01', label: 'มกราคม' },
    { value: '02', label: 'กุมภาพันธ์' },
    { value: '03', label: 'มีนาคม' },
    { value: '04', label: 'เมษายน' },
    { value: '05', label: 'พฤษภาคม' },
    { value: '06', label: 'มิถุนายน' },
    { value: '07', label: 'กรกฎาคม' },
    { value: '08', label: 'สิงหาคม' },
    { value: '09', label: 'กันยายน' },
    { value: '10', label: 'ตุลาคม' },
    { value: '11', label: 'พฤศจิกายน' },
    { value: '12', label: 'ธันวาคม' },
  ];

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const year = currentYear - i;
    return { value: year.toString(), label: `${year + 543}` };
  });

  const groupedTransactions = useMemo(() => {
    if (!data?.transactions) return new Map<string, {
      transactions: FinanceTransaction[];
      totalDeposit: number;
      totalWithdraw: number;
      totalCommission: number;
      totalPayout: number;
    }>();

    const grouped = new Map<string, {
      transactions: FinanceTransaction[];
      totalDeposit: number;
      totalWithdraw: number;
      totalCommission: number;
      totalPayout: number;
    }>();

    data.transactions.forEach((tx) => {
      const dateKey = formatDateKey(tx.created_at);

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, {
          transactions: [],
          totalDeposit: 0,
          totalWithdraw: 0,
          totalCommission: 0,
          totalPayout: 0,
        });
      }

      const group = grouped.get(dateKey)!;
      group.transactions.push(tx);

      if (tx.type === 'deposit') {
        group.totalDeposit += tx.amount;
      } else if (tx.type === 'withdraw') {
        group.totalWithdraw += tx.amount;
      } else if (tx.type === 'bet' || tx.type === 'bet_commission' || tx.type === 'commission') {
        group.totalCommission += tx.amount;
      } else if (tx.type === 'payout') {
        group.totalPayout += tx.amount;
      }
    });

    return new Map([...grouped.entries()].sort((a, b) => b[0].localeCompare(a[0])));
  }, [data?.transactions]);

  useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    if (groupedTransactions.has(today) && !expandedDates.has(today)) {
      setExpandedDates(new Set([today]));
    }
  }, [groupedTransactions]);

  const toggleDate = (dateKey: string) => {
    setExpandedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dateKey)) newSet.delete(dateKey);
      else newSet.add(dateKey);
      return newSet;
    });
  };

  const expandAll = () => setExpandedDates(new Set(groupedTransactions.keys()));
  const collapseAll = () => setExpandedDates(new Set());

  const summary = useMemo(() => {
    if (!data) {
      return {
        totalDeposit: 0, totalWithdraw: 0, totalBets: 0, totalPayouts: 0,
        netProfit: 0, depositCount: 0, withdrawCount: 0, betCount: 0, payoutCount: 0,
      };
    }
    return {
      totalDeposit: data.deposits?.total || 0,
      totalWithdraw: data.withdrawals?.total || 0,
      totalBets: data.bets?.total || 0,
      totalPayouts: data.payouts?.total || 0,
      netProfit: data.profit || 0,
      depositCount: data.deposits?.count || 0,
      withdrawCount: data.withdrawals?.count || 0,
      betCount: data.bets?.count || 0,
      payoutCount: data.payouts?.count || 0,
    };
  }, [data]);

  const handleExport = () => {
    const periodLabel = getPeriodLabel();
    const csvContent = [
      ['รายงานการเงิน - ' + periodLabel], [''],
      ['รายการ', 'จำนวนรายการ', 'ยอดเงิน (บาท)'],
      ['ยอดฝาก', summary.depositCount, summary.totalDeposit],
      ['ยอดถอน', summary.withdrawCount, summary.totalWithdraw],
      ['คอมมิชชั่นจากโพย', summary.betCount, summary.totalBets],
      ['ยอดจ่ายรางวัล', summary.payoutCount, summary.totalPayouts],
      [''], ['กำไรสุทธิ', '', summary.netProfit], [''],
      ['สร้างเมื่อ', new Date().toLocaleString('th-TH')],
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finance-report-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'today': return 'วันนี้';
      case 'yesterday': return 'เมื่อวาน';
      case 'week': return '7 วันที่ผ่านมา';
      case 'month': return 'เดือนนี้';
      case 'lastMonth': return 'เดือนที่แล้ว';
      default: return '';
    }
  };

  const getTransactionTypeLabel = (type: string) => transactionTypeLabels[type] || type;

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit': return <ArrowDownToLine className="size-4 text-emerald-500" />;
      case 'withdraw': return <ArrowUpFromLine className="size-4 text-orange-500" />;
      case 'bet':
      case 'bet_commission':
      case 'commission': return <Percent className="size-4 text-blue-500" />;
      case 'payout': return <Trophy className="size-4 text-purple-500" />;
      default: return <DollarSign className="size-4 text-gray-500" />;
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen -m-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileBarChart className="size-7 text-blue-600" />รายงานการเงิน
          </h1>
          <p className="text-gray-600 mt-1">สรุปยอดรายรับ-รายจ่ายและกำไร</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px] bg-white"><Calendar className="size-4 mr-2 text-gray-500" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">วันนี้</SelectItem><SelectItem value="yesterday">เมื่อวาน</SelectItem>
              <SelectItem value="week">7 วันที่ผ่านมา</SelectItem><SelectItem value="month">เดือนนี้</SelectItem>
              <SelectItem value="lastMonth">เดือนที่แล้ว</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />รีเฟรช
          </Button>
          <Button variant="outline" onClick={handleExport}><Download className="size-4 mr-2" />Export</Button>
        </div>
      </div>

      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        <Calendar className="size-3 mr-1" />แสดงข้อมูล: {getPeriodLabel()}
      </Badge>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className={`border-2 ${summary.netProfit >= 0 ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
          <CardContent className="pt-6"><div className="flex items-center justify-between"><div>
            <p className="text-sm text-gray-600">กำไรสุทธิ</p>
            <p className={`text-2xl font-bold ${summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.netProfit >= 0 ? '+' : ''}{formatMoney(summary.netProfit)}
            </p></div>
            {summary.netProfit >= 0 ? <TrendingUp className="size-10 text-green-500/50" /> : <TrendingDown className="size-10 text-red-500/50" />}
          </div></CardContent>
        </Card>
        <Card className="bg-white border-gray-200"><CardContent className="pt-6"><div className="flex items-center justify-between"><div>
          <p className="text-sm text-gray-500">ยอดฝากรวม</p><p className="text-2xl font-bold text-emerald-600">+{formatMoney(summary.totalDeposit)}</p>
          <p className="text-xs text-gray-400 mt-1">{summary.depositCount} รายการ</p></div><ArrowDownToLine className="size-10 text-emerald-500/30" />
        </div></CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="pt-6"><div className="flex items-center justify-between"><div>
          <p className="text-sm text-gray-500">ยอดถอนรวม</p><p className="text-2xl font-bold text-orange-600">-{formatMoney(summary.totalWithdraw)}</p>
          <p className="text-xs text-gray-400 mt-1">{summary.withdrawCount} รายการ</p></div><ArrowUpFromLine className="size-10 text-orange-500/30" />
        </div></CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="pt-6"><div className="flex items-center justify-between"><div>
          <p className="text-sm text-gray-500">คอมมิชชั่นจากโพย</p><p className="text-2xl font-bold text-blue-600">+{formatMoney(summary.totalBets)}</p>
          <p className="text-xs text-gray-400 mt-1">{summary.betCount} โพย</p></div><Percent className="size-10 text-blue-500/30" />
        </div></CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="pt-6"><div className="flex items-center justify-between"><div>
          <p className="text-sm text-gray-500">จ่ายรางวัลรวม</p><p className="text-2xl font-bold text-purple-600">-{formatMoney(summary.totalPayouts)}</p>
          <p className="text-xs text-gray-400 mt-1">{summary.payoutCount} รางวัล</p></div><Trophy className="size-10 text-purple-500/30" />
        </div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white border-gray-200"><CardHeader><CardTitle className="text-green-700 flex items-center gap-2"><TrendingUp className="size-5" />รายรับ</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"><div className="flex items-center gap-3"><ArrowDownToLine className="size-5 text-emerald-500" /><span>ยอดฝาก</span></div><span className="font-bold text-emerald-600">+{formatMoney(summary.totalDeposit)}</span></div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"><div className="flex items-center gap-3"><Percent className="size-5 text-blue-500" /><span>คอมมิชชั่นจากโพย</span></div><span className="font-bold text-blue-600">+{formatMoney(summary.totalBets)}</span></div>
            <div className="border-t pt-3 flex justify-between items-center"><span className="font-medium">รายรับรวม</span><span className="text-xl font-bold text-green-600">+{formatMoney(summary.totalDeposit + summary.totalBets)}</span></div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200"><CardHeader><CardTitle className="text-red-700 flex items-center gap-2"><TrendingDown className="size-5" />รายจ่าย</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"><div className="flex items-center gap-3"><ArrowUpFromLine className="size-5 text-orange-500" /><span>ยอดถอน</span></div><span className="font-bold text-orange-600">-{formatMoney(summary.totalWithdraw)}</span></div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"><div className="flex items-center gap-3"><Trophy className="size-5 text-purple-500" /><span>จ่ายรางวัล</span></div><span className="font-bold text-purple-600">-{formatMoney(summary.totalPayouts)}</span></div>
            <div className="border-t pt-3 flex justify-between items-center"><span className="font-medium">รายจ่ายรวม</span><span className="text-xl font-bold text-red-600">-{formatMoney(summary.totalWithdraw + summary.totalPayouts)}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-r from-[#1E3A5F] to-[#2A4A6F] text-white border-0"><CardContent className="pt-6"><div className="flex items-center justify-between"><div>
        <p className="text-white/80">ยอดเงินคงเหลือในระบบ</p><p className="text-3xl font-bold mt-2">{formatMoney(summary.totalDeposit - summary.totalWithdraw + summary.totalBets - summary.totalPayouts)} บาท</p>
        <p className="text-sm text-white/60 mt-1">ฝาก - ถอน + คอมมิชชั่น - จ่ายรางวัล</p></div><Wallet className="size-16 text-white/30" />
      </div></CardContent></Card>

      <Card className="bg-white border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-gray-900 flex items-center gap-2"><DollarSign className="size-5" />ประวัติธุรกรรม</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'daily' | 'monthly' | 'yearly')}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="daily">รายวัน</SelectItem><SelectItem value="monthly">รายเดือน</SelectItem><SelectItem value="yearly">รายปี</SelectItem></SelectContent>
            </Select>
            {viewMode === 'monthly' && (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}><SelectTrigger className="w-[140px]"><SelectValue placeholder="เลือกเดือน" /></SelectTrigger>
                <SelectContent>{monthOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {(viewMode === 'monthly' || viewMode === 'yearly') && (
              <Select value={selectedYear} onValueChange={setSelectedYear}><SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                <SelectContent>{yearOptions.map(y => <SelectItem key={y.value} value={y.value}>พ.ศ. {y.label}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={expandAll}><ChevronsUpDown className="size-4 mr-1" />กางทั้งหมด</Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>พับทั้งหมด</Button>
          </div>
        </CardHeader>
        <CardContent>
          {!data?.transactions || data.transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500"><FileBarChart className="size-16 mx-auto mb-4 text-gray-300" /><p className="text-lg font-medium">ยังไม่มีธุรกรรมในช่วงเวลานี้</p><p className="text-sm mt-1">เลือกช่วงเวลาอื่นเพื่อดูข้อมูล</p></div>
          ) : (
            <div className="space-y-3">
              {Array.from(groupedTransactions.entries()).map(([dateKey, group]) => {
                const isExpanded = expandedDates.has(dateKey);
                const isTodayDate = isToday(dateKey);
                return (
                  <Collapsible key={dateKey} open={isExpanded} onOpenChange={() => toggleDate(dateKey)}>
                    <CollapsibleTrigger asChild>
                      <div className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors ${isTodayDate ? 'bg-blue-50 hover:bg-blue-100 border border-blue-200' : 'bg-gray-100 hover:bg-gray-200'}`}>
                        <div className="flex items-center gap-3">
                          {isExpanded ? <ChevronDown className="size-5 text-gray-500" /> : <ChevronRight className="size-5 text-gray-500" />}
                          <div><div className="flex items-center gap-2"><span className="font-semibold text-gray-900">{formatDateDisplay(dateKey)}</span>{isTodayDate && <Badge className="bg-blue-500 text-white">วันนี้</Badge>}</div>
                            <span className="text-sm text-gray-500">{group.transactions.length} รายการ</span></div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right"><p className="text-xs text-gray-500">ฝากรวม</p><p className="font-semibold text-emerald-600">+{formatMoney(group.totalDeposit)}</p></div>
                          <div className="text-right"><p className="text-xs text-gray-500">ถอนรวม</p><p className="font-semibold text-orange-600">-{formatMoney(group.totalWithdraw)}</p></div>
                          <div className="text-right"><p className="text-xs text-gray-500">คอมมิชชั่น</p><p className="font-semibold text-blue-600">+{formatMoney(group.totalCommission)}</p></div>
                          <div className="text-right"><p className="text-xs text-gray-500">จ่ายรางวัล</p><p className="font-semibold text-purple-600">-{formatMoney(group.totalPayout)}</p></div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 ml-8 border-l-2 border-gray-200 pl-4">
                        <Table>
                          <TableHeader><TableRow className="bg-gray-50"><TableHead className="w-[100px]">เวลา</TableHead><TableHead>ประเภท</TableHead><TableHead>รายละเอียด</TableHead><TableHead className="text-right">จำนวน</TableHead><TableHead>สถานะ</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {group.transactions.map((tx: FinanceTransaction) => (
                              <TableRow key={tx.id}>
                                <TableCell className="text-sm text-gray-500">{formatTime(tx.created_at)}</TableCell>
                                <TableCell><div className="flex items-center gap-2">{getTransactionIcon(tx.type)}<Badge variant="outline" className="font-normal">{getTransactionTypeLabel(tx.type)}</Badge></div></TableCell>
                                <TableCell className="text-gray-700 max-w-[200px] truncate">{tx.description || '-'}</TableCell>
                                <TableCell className="text-right"><span className={tx.type === 'deposit' || tx.type === 'bet' || tx.type === 'bet_commission' || tx.type === 'commission' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                                  {tx.type === 'deposit' || tx.type === 'bet' || tx.type === 'bet_commission' || tx.type === 'commission' ? '+' : '-'}{formatMoney(tx.amount)}
                                </span></TableCell>
                                <TableCell><Badge className={tx.status === 'completed' ? 'bg-green-500/20 text-green-600' : tx.status === 'pending' ? 'bg-yellow-500/20 text-yellow-600' : 'bg-red-500/20 text-red-600'}>
                                  {tx.status === 'completed' ? 'สำเร็จ' : tx.status === 'pending' ? 'รอดำเนินการ' : tx.status}
                                </Badge></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}