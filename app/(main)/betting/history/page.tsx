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
  Ticket,
  Search,
  Download,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  Filter,
  Calendar,
  Gamepad2,
  Dices,
  Trophy,
  Percent,
  AlertTriangle,
  Target,
  Undo2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetcher } from '@/lib/fetcher';

interface BettingTransaction {
  id: string;
  type: string;
  game_type: string;
  amount: number;
  potential_win?: number;
  actual_win?: number;
  status: string;
  description?: string;
  bet_details?: string;
  lottery_type?: string;
  number?: string;
  bet_type?: string;
  provider_name?: string;
  customer_id?: string;
  created_at: string;
  settled_at?: string;
}

interface Stats {
  totalBets: number;
  activeBets: number;
  totalTurnover: number;
  totalWins: number;
  totalLoss: number;
  payoutRatio: string | number;
  todayBets: number;
  todayTurnover: number;
  todayWins: number;
  currentExposure: number;
  byGameType: {
    lottery: number;
    casino: number;
    slots: number;
    sports: number;
  };
}

const gameTypeLabels: Record<string, string> = {
  lottery: 'หวย',
  casino: 'คาสิโน',
  slots: 'สล็อต',
  sports: 'กีฬา',
};

const gameTypeIcons: Record<string, React.ReactNode> = {
  lottery: <Ticket className="size-4 text-amber-500" />,
  casino: <Dices className="size-4 text-purple-500" />,
  slots: <Gamepad2 className="size-4 text-pink-500" />,
  sports: <Trophy className="size-4 text-cyan-500" />,
};

const typeLabels: Record<string, string> = {
  lottery_bet: 'แทงหวย',
  casino_bet: 'เดิมพันคาสิโน',
  slot_bet: 'เล่นสล็อต',
  sports_bet: 'เดิมพันกีฬา',
  cancelled_bet: 'ยกเลิก',
  rollback_bet: 'ย้อนกลับ',
  win_payout: 'ชนะ/จ่ายรางวัล',
};

export default function BettingHistoryPage() {
  const [gameFilter, setGameFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [status, setStatus] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const queryParams = new URLSearchParams();
  if (gameFilter !== 'all') queryParams.set('game_type', gameFilter);
  if (status !== 'all') queryParams.set('status', status);
  if (dateFrom) queryParams.set('date_from', dateFrom);
  if (dateTo) queryParams.set('date_to', dateTo);

  const { data, mutate, isLoading } = useSWR(
    `/api/betting/history?${queryParams.toString()}`,
    fetcher,
    { refreshInterval: 15000 }
  );

  const transactions: BettingTransaction[] = data?.transactions || [];
  const stats: Stats = data?.stats || {
    totalBets: 0,
    activeBets: 0,
    totalTurnover: 0,
    totalWins: 0,
    totalLoss: 0,
    payoutRatio: 0,
    todayBets: 0,
    todayTurnover: 0,
    todayWins: 0,
    currentExposure: 0,
    byGameType: { lottery: 0, casino: 0, slots: 0, sports: 0 },
  };

  const filteredTransactions = transactions.filter((t) => {
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        t.description?.toLowerCase().includes(searchLower) ||
        t.number?.toLowerCase().includes(searchLower) ||
        t.bet_type?.toLowerCase().includes(searchLower) ||
        t.provider_name?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const getStatusBadge = (txStatus: string, type: string) => {
    if (type === 'win_payout') {
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
          <Trophy className="size-3 mr-1" />
          ชนะ
        </Badge>
      );
    }
    if (type === 'cancelled_bet') {
      return (
        <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/30">
          <XCircle className="size-3 mr-1" />
          ยกเลิก
        </Badge>
      );
    }
    if (type === 'rollback_bet') {
      return (
        <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30">
          <Undo2 className="size-3 mr-1" />
          ย้อนกลับ
        </Badge>
      );
    }

    switch (txStatus) {
      case 'pending':
      case 'active':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
            <Clock className="size-3 mr-1" />
            รอผล
          </Badge>
        );
      case 'won':
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
            <CheckCircle className="size-3 mr-1" />
            ชนะ
          </Badge>
        );
      case 'lost':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">
            <XCircle className="size-3 mr-1" />
            แพ้
          </Badge>
        );
      case 'settled':
        return (
          <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/30">
            <CheckCircle className="size-3 mr-1" />
            ออกผลแล้ว
          </Badge>
        );
      default:
        return <Badge variant="outline">{txStatus}</Badge>;
    }
  };

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      const response = await fetch('/api/betting/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export', format, ...Object.fromEntries(queryParams) }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `betting-transactions-${new Date().toISOString().split('T')[0]}.${format}`;
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
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Ticket className="size-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">ประวัติการเดิมพัน</h1>
            <p className="text-muted-foreground">
              ประวัติการแทงหวย, คาสิโน, สล็อต, กีฬา
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
      <div className="grid grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Activity className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">รายการทั้งหมด</p>
                <p className="text-2xl font-bold text-blue-500">
                  {stats.totalBets.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  วันนี้: {stats.todayBets.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Target className="size-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Turnover</p>
                <p className="text-2xl font-bold text-amber-500">
                  ฿{stats.totalTurnover.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  วันนี้: ฿{stats.todayTurnover.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <TrendingUp className="size-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ยอดชนะ</p>
                <p className="text-2xl font-bold text-emerald-500">
                  ฿{stats.totalWins.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  วันนี้: ฿{stats.todayWins.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <TrendingDown className="size-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">กำไร/ขาดทุน</p>
                <p className={cn(
                  'text-2xl font-bold',
                  stats.totalLoss >= 0 ? 'text-emerald-500' : 'text-red-500'
                )}>
                  {stats.totalLoss >= 0 ? '+' : ''}฿{stats.totalLoss.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Percent className="size-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payout Ratio</p>
                <p className="text-2xl font-bold text-purple-500">
                  {stats.payoutRatio}%
                </p>
                <p className="text-xs text-muted-foreground">
                  Exposure: ฿{stats.currentExposure.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Game Type Stats */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(gameTypeLabels).map(([key, label]) => (
          <Card key={key} className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {gameTypeIcons[key]}
                  <span className="font-medium">{label}</span>
                </div>
                <Badge variant="secondary">
                  {stats.byGameType[key as keyof typeof stats.byGameType].toLocaleString()} รายการ
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Filter className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">ตัวกรอง</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหา เลข, ประเภท, ผู้ให้บริการ..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Tabs value={gameFilter} onValueChange={setGameFilter}>
              <TabsList>
                <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
                <TabsTrigger value="lottery">หวย</TabsTrigger>
                <TabsTrigger value="casino">คาสิโน</TabsTrigger>
                <TabsTrigger value="slots">สล็อต</TabsTrigger>
                <TabsTrigger value="sports">กีฬา</TabsTrigger>
              </TabsList>
            </Tabs>

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                <SelectItem value="pending">รอผล</SelectItem>
                <SelectItem value="won">ชนะ</SelectItem>
                <SelectItem value="lost">แพ้</SelectItem>
                <SelectItem value="cancelled">ยกเลิก</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground" />
              <Input
                type="date"
                className="w-[150px]"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="date"
                className="w-[150px]"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Betting Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="size-5" />
            รายการเดิมพัน
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
                      {gameTypeIcons[transaction.game_type] || <Ticket className="size-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {typeLabels[transaction.type] || transaction.type}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {gameTypeLabels[transaction.game_type] || transaction.game_type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {transaction.description || transaction.bet_details || '-'}
                      </p>
                      {transaction.provider_name && (
                        <p className="text-xs text-muted-foreground">
                          Provider: {transaction.provider_name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(transaction.created_at).toLocaleString('th-TH')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-amber-500">
                        ฿{Number(transaction.amount).toLocaleString()}
                      </p>
                      {transaction.actual_win !== undefined && transaction.actual_win > 0 && (
                        <p className="text-sm text-emerald-500">
                          +฿{Number(transaction.actual_win).toLocaleString()}
                        </p>
                      )}
                      {transaction.potential_win !== undefined && transaction.status === 'pending' && (
                        <p className="text-xs text-muted-foreground">
                          อาจชนะ: ฿{Number(transaction.potential_win).toLocaleString()}
                        </p>
                      )}
                    </div>
                    {getStatusBadge(transaction.status, transaction.type)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Ticket className="size-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">ไม่พบประวัติการเดิมพัน</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                ยังไม่มีรายการเดิมพันที่ตรงกับเงื่อนไขที่เลือก
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
