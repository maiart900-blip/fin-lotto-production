'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Wallet, ArrowUpRight, ArrowDownLeft, DollarSign, 
  RefreshCw, Download, TrendingUp, Clock, CheckCircle, XCircle
} from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'commission' | 'bonus' | 'adjustment';
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  description: string;
  created_at: string;
}

export default function MemberFinancePage() {
  const { data, mutate, isLoading } = useSWR('/api/member/finance', fetcher);

  const finance = data || {
    balance: 0,
    totalDeposit: 0,
    totalWithdraw: 0,
    totalCommission: 0,
    pendingWithdraw: 0,
    transactions: []
  };

  const transactions: Transaction[] = finance.transactions || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30"><Clock className="size-3 mr-1" />รอดำเนินการ</Badge>;
      case 'approved':
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
      case 'commission':
        return <TrendingUp className="size-4 text-blue-500" />;
      case 'bonus':
        return <DollarSign className="size-4 text-yellow-500" />;
      default:
        return <Wallet className="size-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'deposit': return 'ฝากเงิน';
      case 'withdraw': return 'ถอนเงิน';
      case 'commission': return 'คอมมิชชั่น';
      case 'bonus': return 'โบนัส';
      case 'adjustment': return 'ปรับยอด';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#D4AF37]">การเงิน</h1>
          <p className="text-[#A0A0A0]">จัดการยอดเงินและดูประวัติธุรกรรม</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
          <Button variant="outline" size="sm">
            <Download className="size-4 mr-2" />
            ส่งออก
          </Button>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-[#D4AF37]/20 to-[#1A1A1A] border-[#D4AF37]/30 col-span-2 md:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[#D4AF37] text-sm">
              <Wallet className="size-4" />
              ยอดคงเหลือ
            </div>
            <div className="text-3xl font-bold text-white mt-2">{finance.balance.toLocaleString()}</div>
            <div className="text-xs text-[#A0A0A0]">บาท</div>
          </CardContent>
        </Card>

        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[#A0A0A0] text-sm">
              <ArrowDownLeft className="size-4 text-green-500" />
              ฝากเงินรวม
            </div>
            <div className="text-2xl font-bold text-green-500">{finance.totalDeposit.toLocaleString()}</div>
            <div className="text-xs text-[#666]">บาท</div>
          </CardContent>
        </Card>

        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[#A0A0A0] text-sm">
              <ArrowUpRight className="size-4 text-red-500" />
              ถอนเงินรวม
            </div>
            <div className="text-2xl font-bold text-red-500">{finance.totalWithdraw.toLocaleString()}</div>
            <div className="text-xs text-[#666]">บาท</div>
          </CardContent>
        </Card>

        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[#A0A0A0] text-sm">
              <TrendingUp className="size-4 text-blue-500" />
              คอมมิชชั่นรวม
            </div>
            <div className="text-2xl font-bold text-blue-500">{finance.totalCommission.toLocaleString()}</div>
            <div className="text-xs text-[#666]">บาท</div>
          </CardContent>
        </Card>

        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[#A0A0A0] text-sm">
              <Clock className="size-4 text-yellow-500" />
              รอถอน
            </div>
            <div className="text-2xl font-bold text-yellow-500">{finance.pendingWithdraw.toLocaleString()}</div>
            <div className="text-xs text-[#666]">บาท</div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="text-[#D4AF37]">ประวัติธุรกรรม</CardTitle>
          <CardDescription>รายการเคลื่อนไหวทางการเงินทั้งหมด</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList className="bg-[#0D0D0D]">
              <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
              <TabsTrigger value="deposit">ฝากเงิน</TabsTrigger>
              <TabsTrigger value="withdraw">ถอนเงิน</TabsTrigger>
              <TabsTrigger value="commission">คอมมิชชั่น</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              {transactions.length === 0 ? (
                <div className="text-center py-12 text-[#A0A0A0]">
                  <Wallet className="size-12 mx-auto mb-2 opacity-50" />
                  <p>ยังไม่มีประวัติธุรกรรม</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-4 bg-[#0D0D0D] rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#1A1A1A] rounded-lg">
                          {getTypeIcon(tx.type)}
                        </div>
                        <div>
                          <div className="text-white font-medium">{getTypeLabel(tx.type)}</div>
                          <div className="text-xs text-[#666]">{tx.description}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${tx.type === 'withdraw' ? 'text-red-500' : 'text-green-500'}`}>
                          {tx.type === 'withdraw' ? '-' : '+'}{tx.amount.toLocaleString()} บาท
                        </div>
                        <div className="text-xs text-[#666]">{new Date(tx.created_at).toLocaleDateString('th-TH')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="deposit">
              <div className="text-center py-12 text-[#A0A0A0]">
                <ArrowDownLeft className="size-12 mx-auto mb-2 opacity-50" />
                <p>ดูรายการฝากเงินทั้งหมด</p>
              </div>
            </TabsContent>

            <TabsContent value="withdraw">
              <div className="text-center py-12 text-[#A0A0A0]">
                <ArrowUpRight className="size-12 mx-auto mb-2 opacity-50" />
                <p>ดูรายการถอนเงินทั้งหมด</p>
              </div>
            </TabsContent>

            <TabsContent value="commission">
              <div className="text-center py-12 text-[#A0A0A0]">
                <TrendingUp className="size-12 mx-auto mb-2 opacity-50" />
                <p>ดูรายการคอมมิชชั่นทั้งหมด</p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
