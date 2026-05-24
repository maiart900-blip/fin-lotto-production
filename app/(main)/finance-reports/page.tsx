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
} from 'lucide-react';

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
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    description: string;
    created_at: string;
  }>;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function FinanceReportsPage() {
  const [period, setPeriod] = useState('today');
  
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate summary
  const summary = useMemo(() => {
    if (!data) {
      return {
        totalDeposit: 0,
        totalWithdraw: 0,
        totalBets: 0,
        totalPayouts: 0,
        netProfit: 0,
        depositCount: 0,
        withdrawCount: 0,
        betCount: 0,
        payoutCount: 0,
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
    if (!stats) return;
    
    const periodLabel = getPeriodLabel();
    const csvContent = [
      ['รายงานการเงิน - ' + periodLabel],
      [''],
      ['รายการ', 'จำนวนรายการ', 'ยอดเงิน (บาท)'],
      ['ยอดฝาก', stats.depositCount, stats.totalDeposits],
      ['ยอดถอน', stats.withdrawCount, stats.totalWithdrawals],
      ['ยอดแทง', stats.betCount, stats.totalBets],
      ['ยอดจ่ายรางวัล', stats.payoutCount, stats.totalPayouts],
      [''],
      ['กำไรสุทธิ', '', stats.netProfit],
      [''],
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

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen -m-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileBarChart className="size-7 text-blue-600" />
            รายงานการเงิน
          </h1>
          <p className="text-gray-600 mt-1">สรุปยอดรายรับ-รายจ่ายและกำไร</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px] bg-white">
              <Calendar className="size-4 mr-2 text-gray-500" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">วันนี้</SelectItem>
              <SelectItem value="yesterday">เมื่อวาน</SelectItem>
              <SelectItem value="week">7 วันที่ผ่านมา</SelectItem>
              <SelectItem value="month">เดือนนี้</SelectItem>
              <SelectItem value="lastMonth">เดือนที่แล้ว</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="size-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Period Badge */}
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        <Calendar className="size-3 mr-1" />
        แสดงข้อมูล: {getPeriodLabel()}
      </Badge>

      {/* Main Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Net Profit */}
        <Card className={`border-2 ${summary.netProfit >= 0 ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">กำไรสุทธิ</p>
                <p className={`text-2xl font-bold ${summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.netProfit >= 0 ? '+' : ''}{formatMoney(summary.netProfit)}
                </p>
              </div>
              {summary.netProfit >= 0 ? (
                <TrendingUp className="size-10 text-green-500/50" />
              ) : (
                <TrendingDown className="size-10 text-red-500/50" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Deposits */}
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">ยอดฝากรวม</p>
                <p className="text-2xl font-bold text-emerald-600">+{formatMoney(summary.totalDeposit)}</p>
                <p className="text-xs text-gray-400 mt-1">{summary.depositCount} รายการ</p>
              </div>
              <ArrowDownToLine className="size-10 text-emerald-500/30" />
            </div>
          </CardContent>
        </Card>

        {/* Withdrawals */}
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">ยอดถอนรวม</p>
                <p className="text-2xl font-bold text-orange-600">-{formatMoney(summary.totalWithdraw)}</p>
                <p className="text-xs text-gray-400 mt-1">{summary.withdrawCount} รายการ</p>
              </div>
              <ArrowUpFromLine className="size-10 text-orange-500/30" />
            </div>
          </CardContent>
        </Card>

        {/* Bets */}
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">ยอดแทงรวม</p>
                <p className="text-2xl font-bold text-blue-600">{formatMoney(summary.totalBets)}</p>
                <p className="text-xs text-gray-400 mt-1">{summary.betCount} โพย</p>
              </div>
              <Ticket className="size-10 text-blue-500/30" />
            </div>
          </CardContent>
        </Card>

        {/* Payouts */}
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">จ่ายรางวัลรวม</p>
                <p className="text-2xl font-bold text-purple-600">-{formatMoney(summary.totalPayouts)}</p>
                <p className="text-xs text-gray-400 mt-1">{summary.payoutCount} รางวัล</p>
              </div>
              <Trophy className="size-10 text-purple-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Summary */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-green-700 flex items-center gap-2">
              <TrendingUp className="size-5" />
              รายรับ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <ArrowDownToLine className="size-5 text-emerald-500" />
                <span>ยอดฝาก</span>
              </div>
              <span className="font-bold text-emerald-600">+{formatMoney(summary.totalDeposit)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Ticket className="size-5 text-blue-500" />
                <span>ยอดแทง</span>
              </div>
              <span className="font-bold text-blue-600">+{formatMoney(summary.totalBets)}</span>
            </div>
            <div className="border-t pt-3 flex justify-between items-center">
              <span className="font-medium">รายรับรวม</span>
              <span className="text-xl font-bold text-green-600">
                +{formatMoney(summary.totalDeposit + summary.totalBets)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Expense Summary */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <TrendingDown className="size-5" />
              รายจ่าย
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <ArrowUpFromLine className="size-5 text-orange-500" />
                <span>ยอดถอน</span>
              </div>
              <span className="font-bold text-orange-600">-{formatMoney(summary.totalWithdraw)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Trophy className="size-5 text-purple-500" />
                <span>จ่ายรางวัล</span>
              </div>
              <span className="font-bold text-purple-600">-{formatMoney(summary.totalPayouts)}</span>
            </div>
            <div className="border-t pt-3 flex justify-between items-center">
              <span className="font-medium">รายจ่ายรวม</span>
              <span className="text-xl font-bold text-red-600">
                -{formatMoney(summary.totalWithdraw + summary.totalPayouts)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Wallet Balance */}
      <Card className="bg-gradient-to-r from-[#1E3A5F] to-[#2A4A6F] text-white border-0">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80">ยอดเงินคงเหลือในระบบ</p>
              <p className="text-3xl font-bold mt-2">
                {formatMoney(summary.totalDeposit - summary.totalWithdraw + summary.totalBets - summary.totalPayouts)} บาท
              </p>
              <p className="text-sm text-white/60 mt-1">
                ฝาก - ถอน + แทง - จ่ายรางวัล
              </p>
            </div>
            <Wallet className="size-16 text-white/30" />
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-gray-900 flex items-center gap-2">
            <DollarSign className="size-5" />
            ธุรกรรมล่าสุด
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.transactions || data.transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileBarChart className="size-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">ยังไม่มีธุรกรรมในช่วงเวลานี้</p>
              <p className="text-sm mt-1">เลือกช่วงเวลาอื่นเพื่อดูข้อมูล</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>ประเภท</TableHead>
                  <TableHead>รายละเอียด</TableHead>
                  <TableHead>จำนวน</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>วันที่</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.transactions.slice(0, 10).map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {tx.type === 'deposit' ? 'ฝาก' :
                         tx.type === 'withdraw' ? 'ถอน' :
                         tx.type === 'bet' ? 'แทง' :
                         tx.type === 'payout' ? 'รางวัล' : tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-700">{tx.description}</TableCell>
                    <TableCell>
                      <span className={tx.type === 'deposit' || tx.type === 'bet' ? 'text-green-600' : 'text-red-600'}>
                        {tx.type === 'deposit' || tx.type === 'bet' ? '+' : '-'}{formatMoney(tx.amount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        tx.status === 'completed' ? 'bg-green-500/20 text-green-600' :
                        tx.status === 'pending' ? 'bg-yellow-500/20 text-yellow-600' :
                        'bg-red-500/20 text-red-600'
                      }>
                        {tx.status === 'completed' ? 'สำเร็จ' :
                         tx.status === 'pending' ? 'รอดำเนินการ' : tx.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatDate(tx.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
