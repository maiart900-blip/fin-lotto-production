'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  Search,
  Calendar,
  Wallet,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function TransactionsPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Fetch transactions from API
  const { data: transactionsData, isLoading, mutate } = useSWR(
    '/api/transactions?limit=50',
    fetcher,
    { refreshInterval: 10000 }
  );

  const transactions = transactionsData?.transactions || [];
  
  // Filter transactions based on active tab
  const filteredTransactions = transactions.filter((txn: any) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'deposit') return txn.type === 'deposit';
    if (activeTab === 'withdraw') return txn.type === 'withdraw';
    return true;
  }).filter((txn: any) => {
    if (!searchTerm) return true;
    return txn.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           txn.id?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Calculate summary
  const totalDeposits = transactions
    .filter((t: any) => t.type === 'deposit')
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);
  const totalWithdraws = transactions
    .filter((t: any) => t.type === 'withdraw')
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'approved':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <CheckCircle2 className="size-3 mr-1" />
            สำเร็จ
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <Clock className="size-3 mr-1" />
            รอดำเนินการ
          </Badge>
        );
      case 'rejected':
      case 'failed':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="size-3 mr-1" />
            ไม่สำเร็จ
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">
            {status}
          </Badge>
        );
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownToLine className="size-5 text-emerald-400" />;
      case 'withdraw':
        return <ArrowUpFromLine className="size-5 text-orange-400" />;
      case 'bet':
        return <TrendingDown className="size-5 text-blue-400" />;
      case 'win':
        return <TrendingUp className="size-5 text-amber-400" />;
      default:
        return <Wallet className="size-5 text-slate-400" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'deposit': return 'เติมเงิน';
      case 'withdraw': return 'ถอนเงิน';
      case 'bet': return 'แทงหวย';
      case 'win': return 'ถูกรางวัล';
      case 'bonus': return 'โบนัส';
      case 'refund': return 'คืนเงิน';
      default: return type;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-amber-900/20 to-transparent px-4 pt-6 pb-8">
        <h1 className="text-2xl font-bold text-white mb-2">รายการเติมเงิน</h1>
        <p className="text-slate-400 text-sm">ประวัติการเติมเงินและถอนเงินทั้งหมด</p>
      </div>

      {/* Summary Cards */}
      <div className="px-4 -mt-4 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-emerald-900/40 to-emerald-950/60 border-emerald-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownToLine className="size-4 text-emerald-400" />
                <span className="text-emerald-400 text-xs">เติมเงินทั้งหมด</span>
              </div>
              <p className="text-xl font-bold text-white">
                {formatCurrency(totalDeposits)}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-orange-900/40 to-orange-950/60 border-orange-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpFromLine className="size-4 text-orange-400" />
                <span className="text-orange-400 text-xs">ถอนเงินทั้งหมด</span>
              </div>
              <p className="text-xl font-bold text-white">
                {formatCurrency(totalWithdraws)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              placeholder="ค้นหารายการ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-black/30 border-amber-500/30 text-white"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => mutate()}
            className="border-amber-500/30 text-amber-400"
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full bg-black/30 border border-amber-500/20">
            <TabsTrigger value="all" className="flex-1 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
              ทั้งหมด
            </TabsTrigger>
            <TabsTrigger value="deposit" className="flex-1 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              เติมเงิน
            </TabsTrigger>
            <TabsTrigger value="withdraw" className="flex-1 data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
              ถอนเงิน
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Transaction List */}
      <div className="px-4 space-y-3">
        {isLoading ? (
          <div className="text-center py-12">
            <RefreshCw className="size-8 text-amber-400 animate-spin mx-auto mb-4" />
            <p className="text-slate-400">กำลังโหลด...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <Card className="bg-black/30 border-amber-500/20">
            <CardContent className="py-12 text-center">
              <Wallet className="size-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">ไม่พบรายการ</p>
            </CardContent>
          </Card>
        ) : (
          filteredTransactions.map((txn: any) => (
            <Card 
              key={txn.id} 
              className="bg-black/30 border-amber-500/20 hover:border-amber-500/40 transition-all"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "size-10 rounded-full flex items-center justify-center",
                      txn.type === 'deposit' ? "bg-emerald-500/20" :
                      txn.type === 'withdraw' ? "bg-orange-500/20" :
                      txn.type === 'win' ? "bg-amber-500/20" :
                      "bg-blue-500/20"
                    )}>
                      {getTypeIcon(txn.type)}
                    </div>
                    <div>
                      <p className="text-white font-medium">{getTypeLabel(txn.type)}</p>
                      <p className="text-xs text-slate-400">{formatDate(txn.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-lg font-bold",
                      (txn.type === 'deposit' || txn.type === 'win' || txn.type === 'bonus' || txn.type === 'refund')
                        ? "text-emerald-400" 
                        : "text-orange-400"
                    )}>
                      {(txn.type === 'deposit' || txn.type === 'win' || txn.type === 'bonus' || txn.type === 'refund') ? '+' : '-'}
                      {formatCurrency(txn.amount)}
                    </p>
                    {getStatusBadge(txn.status)}
                  </div>
                </div>
                {txn.description && (
                  <p className="text-xs text-slate-500 mt-2 pl-13">
                    {txn.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
