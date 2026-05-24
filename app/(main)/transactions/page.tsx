'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Receipt, Search, Filter, Download, ArrowDownLeft, ArrowUpRight, DollarSign, TrendingUp, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import useSWR from 'swr';
import { useState } from 'react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description?: string;
  customer_name?: string;
  created_at: string;
}

export default function TransactionsPage() {
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  
  const { data, mutate, isLoading } = useSWR('/api/transactions/all', fetcher, {
    refreshInterval: 30000
  });

  const transactions: Transaction[] = data?.transactions || [];
  const stats = data?.stats || { total: 0, deposits: 0, withdrawals: 0, entries: 0 };

  const filteredTransactions = transactions.filter((t: Transaction) => {
    if (filter !== 'all' && t.type !== filter) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        t.description?.toLowerCase().includes(searchLower) ||
        t.customer_name?.toLowerCase().includes(searchLower) ||
        t.id?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30"><Clock className="size-3 mr-1" />รอดำเนินการ</Badge>;
      case 'approved':
      case 'completed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30"><CheckCircle className="size-3 mr-1" />สำเร็จ</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30"><XCircle className="size-3 mr-1" />ไม่อนุมัติ</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownLeft className="size-4 text-green-500" />;
      case 'withdraw':
        return <ArrowUpRight className="size-4 text-red-500" />;
      case 'entry':
        return <DollarSign className="size-4 text-amber-500" />;
      case 'commission':
        return <TrendingUp className="size-4 text-blue-500" />;
      default:
        return <Receipt className="size-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'deposit': return 'ฝากเงิน';
      case 'withdraw': return 'ถอนเงิน';
      case 'entry': return 'แทงหวย';
      case 'commission': return 'คอมมิชชั่น';
      default: return type;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Receipt className="size-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">ประวัติธุรกรรม</h1>
            <p className="text-muted-foreground">รายการธุรกรรมทั้งหมดในระบบ</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
          <Button variant="outline">
            <Download className="size-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">ทั้งหมด</p>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">รายการ</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">ฝากเงิน</p>
            <p className="text-2xl font-bold text-green-500">{stats.deposits}</p>
            <p className="text-xs text-muted-foreground">รายการ</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">ถอนเงิน</p>
            <p className="text-2xl font-bold text-red-500">{stats.withdrawals}</p>
            <p className="text-xs text-muted-foreground">รายการ</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">แทงหวย</p>
            <p className="text-2xl font-bold text-amber-500">{stats.entries}</p>
            <p className="text-xs text-muted-foreground">รายการ</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
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
                <TabsTrigger value="withdraw">ถอนเงิน</TabsTrigger>
                <TabsTrigger value="entry">แทงหวย</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
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
                      {getTypeIcon(transaction.type)}
                    </div>
                    <div>
                      <p className="font-medium">{getTypeLabel(transaction.type)}</p>
                      <p className="text-sm text-muted-foreground">
                        {transaction.description || transaction.customer_name || '-'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(transaction.created_at).toLocaleString('th-TH')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`font-bold ${
                        transaction.type === 'deposit' ? 'text-green-500' : 
                        transaction.type === 'withdraw' ? 'text-red-500' : 
                        'text-amber-500'
                      }`}>
                        {transaction.type === 'deposit' ? '+' : transaction.type === 'withdraw' ? '-' : ''}
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
                <Receipt className="size-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">ยังไม่มีข้อมูลธุรกรรม</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                เมื่อมีการเติมเงิน ถอนเงิน หรือแทงหวย รายการจะแสดงที่นี่
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
