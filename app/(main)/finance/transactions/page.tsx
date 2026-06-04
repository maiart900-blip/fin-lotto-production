'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Search,
  Download,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  TrendingUp,
  Receipt,
  ArrowRightLeft,
  Settings,
  AlertTriangle,
  Filter,
  Calendar,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetcher } from '@/lib/fetcher';

interface FinancialTransaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description?: string;
  reference_type?: string;
  reference_id?: string;
  customer_id?: string;
  bank_name?: string;
  account_number?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
}

interface Stats {
  totalDeposits: number;
  totalWithdrawals: number;
  pendingPayouts: number;
  settlementVolume: number;
  todayDeposits: number;
  todayWithdrawals: number;
  pendingCount: number;
  completedCount: number;
}

const typeLabels: Record<string, string> = {
  deposit: 'ฝากเงิน',
  withdrawal: 'ถอนเงิน',
  transfer: 'โอนเงิน',
  adjustment: 'ปรับยอด',
  settlement: 'ชำระบัญชี',
  revenue_share: 'ส่วนแบ่งรายได้',
  commission_payout: 'จ่ายคอมมิชชั่น',
  admin_balance_change: 'ปรับยอดโดยแอดมิน',
  provider_settlement: 'ชำระบัญชี Provider',
  fee: 'ค่าธรรมเนียม',
  refund: 'คืนเงิน',
  bonus: 'โบนัส',
  bet: 'คอมมิชชั่นจากโพย',
  bet_commission: 'คอมมิชชั่นจากโพย',
  commission: 'ส่วนแบ่งรายได้',
};

const typeIcons: Record<string, React.ReactNode> = {
  deposit: <ArrowDownLeft className="size-4 text-emerald-500" />,
  withdrawal: <ArrowUpRight className="size-4 text-red-500" />,
  transfer: <ArrowRightLeft className="size-4 text-blue-500" />,
  adjustment: <Settings className="size-4 text-amber-500" />,
  settlement: <Receipt className="size-4 text-purple-500" />,
  revenue_share: <TrendingUp className="size-4 text-cyan-500" />,
  commission_payout: <DollarSign className="size-4 text-green-500" />,
  admin_balance_change: <Settings className="size-4 text-orange-500" />,
  provider_settlement: <Building2 className="size-4 text-indigo-500" />,
  fee: <AlertTriangle className="size-4 text-yellow-500" />,
  refund: <ArrowDownLeft className="size-4 text-teal-500" />,
  bonus: <DollarSign className="size-4 text-pink-500" />,
};

export default function FinanceTransactionsPage() {
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [status, setStatus] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const queryParams = new URLSearchParams();
  if (filter !== 'all') queryParams.set('type', filter);
  if (status !== 'all') queryParams.set('status', status);
  if (dateFrom) queryParams.set('date_from', dateFrom);
  if (dateTo) queryParams.set('date_to', dateTo);

  const { data, mutate, isLoading } = useSWR(
    `/api/finance/transactions?${queryParams.toString()}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const transactions: FinancialTransaction[] = data?.transactions || [];
  const stats: Stats = data?.stats || {
    totalDeposits: 0,
    totalWithdrawals: 0,
    pendingPayouts: 0,
    settlementVolume: 0,
    todayDeposits: 0,
    todayWithdrawals: 0,
    pendingCount: 0,
    completedCount: 0,
  };

  const filteredTransactions = transactions.filter((t) => {
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        t.description?.toLowerCase().includes(searchLower) ||
        t.id?.toLowerCase().includes(searchLower) ||
        t.bank_name?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const getStatusBadge = (txStatus: string) => {
    switch (txStatus) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
            <Clock className="size-3 mr-1" />
            รอดำเนินการ
          </Badge>
        );
      case 'approved':
      case 'completed':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
            <CheckCircle className="size-3 mr-1" />
            สำเร็จ
          </Badge>
        );
      case 'rejected':
      case 'failed':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">
            <XCircle className="size-3 mr-1" />
            ไม่อนุมัติ
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
            <RefreshCw className="size-3 mr-1 animate-spin" />
            กำลังดำเนินการ
          </Badge>
        );
      default:
        return <Badge variant="outline">{txStatus}</Badge>;
    }
  };

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      const response = await fetch('/api/finance/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export', format, ...Object.fromEntries(queryParams) }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `financial-transactions-${new Date().toISOString().split('T')[0]}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <Wallet className="size-6 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">ธุรกรรมการเงิน</h1>
            <p className="text-muted-foreground">
              ประวัติการเคลื่อนไหวทางการเงิน - ฝาก, ถอน, โอน, ปรับยอด
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={cn('size-4 mr-2', isLoading && 'animate-spin')} />
            รีเฟรช
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
            <Download className="size-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <ArrowDownLeft className="size-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ยอดฝากทั้งหมด</p>
                <p className="text-2xl font-bold text-emerald-500">
                  ฿{stats.totalDeposits.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  วันนี้: ฿{stats.todayDeposits.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <ArrowUpRight className="size-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ยอดถอนทั้งหมด</p>
                <p className="text-2xl font-bold text-red-500">
                  ฿{stats.totalWithdrawals.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  วันนี้: ฿{stats.todayWithdrawals.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Clock className="size-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">รอจ่าย</p>
                <p className="text-2xl font-bold text-amber-500">
                  ฿{stats.pendingPayouts.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stats.pendingCount} รายการ
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Receipt className="size-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ยอด Settlement</p>
                <p className="text-2xl font-bold text-purple-500">
                  ฿{stats.settlementVolume.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stats.completedCount} รายการสำเร็จ
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Filter className="size-5 text-muted-foreground" />
              <CardTitle className="text-base">ตัวกรอง</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาธุรกรรม..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <Tabs value={filter} onValueChange={setFilter}>
              <TabsList>
                <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
                <TabsTrigger value="deposit">ฝากเงิน</TabsTrigger>
                <TabsTrigger value="withdrawal">ถอนเงิน</TabsTrigger>
                <TabsTrigger value="settlement">Settlement</TabsTrigger>
                <TabsTrigger value="adjustment">ปรับยอด</TabsTrigger>
              </TabsList>
            </Tabs>

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                <SelectItem value="pending">รอดำเนินการ</SelectItem>
                <SelectItem value="completed">สำเร็จ</SelectItem>
                <SelectItem value="rejected">ไม่อนุมัติ</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground" />
              <Input
                type="date"
                className="w-[150px]"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="จากวันที่"
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="date"
                className="w-[150px]"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="ถึงวันที่"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-5" />
            รายการธุรกรรมการเงิน
            <Badge variant="secondary" className="ml-2">
              {filteredTransactions.length} รายการ
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTransactions.length > 0 ? (
            <div className="space-y-2">
              {filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-full bg-background">
                      {typeIcons[transaction.type] || <Receipt className="size-4" />}
                    </div>
                    <div>
                      <p className="font-medium">
                        {typeLabels[transaction.type] || transaction.type}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {transaction.description || '-'}
                      </p>
                      {transaction.bank_name && (
                        <p className="text-xs text-muted-foreground">
                          {transaction.bank_name} {transaction.account_number && `- ${transaction.account_number}`}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(transaction.created_at).toLocaleString('th-TH')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p
                        className={cn(
                          'font-bold text-lg',
                          ['deposit', 'refund', 'bonus', 'revenue_share'].includes(transaction.type)
                            ? 'text-emerald-500'
                            : ['withdrawal', 'fee', 'commission_payout'].includes(transaction.type)
                            ? 'text-red-500'
                            : 'text-amber-500'
                        )}
                      >
                        {['deposit', 'refund', 'bonus', 'revenue_share'].includes(transaction.type)
                          ? '+'
                          : ['withdrawal', 'fee', 'commission_payout'].includes(transaction.type)
                          ? '-'
                          : ''}
                        ฿{Number(transaction.amount).toLocaleString()}
                      </p>
                    </div>
                    {getStatusBadge(transaction.status)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Wallet className="size-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">ไม่พบธุรกรรมการเงิน</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                ยังไม่มีรายการธุรกรรมการเงินที่ตรงกับเงื่อนไขที่เลือก
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
