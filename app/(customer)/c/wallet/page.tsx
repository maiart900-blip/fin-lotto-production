'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Wallet, 
  Plus, 
  Minus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Gift, 
  RotateCcw,
  Loader2,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import useSWR from 'swr';
import Link from 'next/link';

interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'bet' | 'win' | 'refund' | 'bonus';
  amount: number;
  balance_after: number;
  note: string | null;
  created_at: string;
}

interface CustomerData {
  id: string;
  name: string;
  credit_balance: number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (res.status === 401) return null;
  if (!res.ok) return null;
  return res.json();
};

const TYPE_INFO: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  deposit: { label: 'เติมเงิน', color: 'bg-green-500', icon: <Plus className="size-3" /> },
  withdraw: { label: 'ถอนเงิน', color: 'bg-red-500', icon: <Minus className="size-3" /> },
  bet: { label: 'ซื้อเลข', color: 'bg-blue-500', icon: <ArrowUpRight className="size-3" /> },
  win: { label: 'ถูกรางวัล', color: 'bg-yellow-500', icon: <ArrowDownLeft className="size-3" /> },
  refund: { label: 'คืนเงิน', color: 'bg-purple-500', icon: <RotateCcw className="size-3" /> },
  bonus: { label: 'โบนัส', color: 'bg-pink-500', icon: <Gift className="size-3" /> },
};

export default function CustomerWalletPage() {
  // Fetch customer data from API
  const { data: customer, isLoading: loadingCustomer, mutate: mutateCustomer } = useSWR<CustomerData | null>(
    '/api/customer/me',
    fetcher,
    { revalidateOnFocus: true }
  );

  // Fetch transactions
  const { data: transactions = [], isLoading: loadingTx, mutate: mutateTx } = useSWR<Transaction[]>(
    customer?.id ? `/api/credits?customer_id=${customer.id}&limit=50` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const isLoading = loadingCustomer || loadingTx;
  const safeTransactions = Array.isArray(transactions) ? transactions : [];

  const handleRefresh = () => {
    mutateCustomer();
    mutateTx();
    toast.success('รีเฟรชข้อมูลแล้ว');
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2 text-white">
          <Wallet className="size-5 text-amber-400" />
          กระเป๋าเงิน
        </h1>
        <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`size-4 text-amber-400 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Balance Card */}
      <Card className="bg-gradient-to-br from-amber-600 to-amber-700 border-amber-500/50">
        <CardContent className="pt-6">
          <p className="text-sm text-amber-100">ยอดเครดิตคงเหลือ</p>
          {loadingCustomer ? (
            <Loader2 className="size-8 animate-spin text-white mt-2" />
          ) : (
            <p className="text-4xl font-bold font-mono mt-2 text-white">
              {(customer?.credit_balance || 0).toLocaleString()}
            </p>
          )}
          <p className="text-sm text-amber-100 mt-1">บาท</p>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/c/topup">
          <Card className="bg-green-500/10 border-green-500/30 hover:bg-green-500/20 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Plus className="size-5 text-green-400" />
              </div>
              <div>
                <p className="font-medium text-white">เติมเงิน</p>
                <p className="text-xs text-[#64748B]">แจ้งเติมเงิน</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/c/withdraw">
          <Card className="bg-red-500/10 border-red-500/30 hover:bg-red-500/20 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <Minus className="size-5 text-red-400" />
              </div>
              <div>
                <p className="font-medium text-white">ถอนเงิน</p>
                <p className="text-xs text-[#64748B]">แจ้งถอนเงิน</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Transaction History */}
      <Card className="bg-[#0D1321] border-amber-500/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-white flex items-center justify-between">
            <span>ประวัติการเงิน</span>
            {safeTransactions.length > 0 && (
              <span className="text-xs text-[#64748B] font-normal">{safeTransactions.length} รายการ</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-amber-400" />
            </div>
          ) : safeTransactions.length === 0 ? (
            <div className="text-center py-8">
              <Wallet className="size-12 text-amber-500/30 mx-auto mb-3" />
              <p className="text-[#64748B]">ยังไม่มีประวัติการเงิน</p>
              <Link href="/c/topup" className="inline-flex items-center gap-1 text-amber-400 text-sm mt-2">
                เริ่มเติมเงิน <ArrowRight className="size-3" />
              </Link>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {safeTransactions.map((tx) => {
                  const info = TYPE_INFO[tx.type] || TYPE_INFO.bonus;
                  const isDebit = tx.type === 'withdraw' || tx.type === 'bet';
                  return (
                    <div 
                      key={tx.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`size-8 rounded-full ${info.color} flex items-center justify-center text-white`}>
                          {info.icon}
                        </div>
                        <div>
                          <p className="font-medium text-white">{info.label}</p>
                          <p className="text-xs text-[#64748B]">
                            {new Date(tx.created_at).toLocaleString('th-TH', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-mono font-bold ${isDebit ? 'text-red-400' : 'text-green-400'}`}>
                          {isDebit ? '-' : '+'}{tx.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-[#64748B]">
                          คงเหลือ {(tx.balance_after || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
