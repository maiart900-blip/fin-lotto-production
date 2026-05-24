'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Zap, RefreshCw, Search, Filter, Wifi, WifiOff, 
  CheckCircle, Clock, XCircle, Eye, ChevronLeft, ChevronRight,
  Bot, TrendingUp, Receipt, Calendar, User, Trophy, Ban
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useBranchRealtime } from '@/hooks/use-branch-realtime';
import { createClient } from '@/lib/supabase/client';
import { formatDistanceToNow, format } from 'date-fns';
import { th } from 'date-fns/locale';
import useSWR from 'swr';

interface SlipItem {
  id: string;
  number: string;
  betType: string;
  amountTop: number;
  amountBottom: number;
  amountTod: number;
  totalAmount: number;
  status: string;
  winAmount: number;
  payoutRate: number;
}

interface AutoSlip {
  slipId: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  lotteryId: string | null;
  lotteryName: string;
  itemsCount: number;
  totalBetAmount: number;
  totalWinAmount: number;
  status: string;
  resultStatus: 'pending' | 'won' | 'lost' | 'partial';
  createdAt: string;
  items: SlipItem[];
}

interface Summary {
  totalSlips: number;
  totalBetsAmount: number;
  totalWinAmount: number;
  pendingCount: number;
  wonCount: number;
  lostCount: number;
  cancelledCount: number;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AutoSystemEntriesPage() {
  const { user, branchId, isMasterBranch } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [lotteryFilter, setLotteryFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedSlip, setSelectedSlip] = useState<AutoSlip | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Build API URL with filters
  const buildApiUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('limit', '50');
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (lotteryFilter !== 'all') params.set('lottery_id', lotteryFilter);
    if (searchTerm) params.set('search', searchTerm);
    return `/api/auto-system/slips?${params.toString()}`;
  }, [page, statusFilter, lotteryFilter, searchTerm]);

  // Fetch slips with SWR
  const { data, error, mutate, isLoading } = useSWR(
    buildApiUrl(),
    fetcher,
    { refreshInterval: autoRefresh ? 5000 : 0 }
  );

  const slips: AutoSlip[] = data?.slips || [];
  const pagination = data?.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 };
  const summary: Summary = data?.summary || {
    totalSlips: 0,
    totalBetsAmount: 0,
    totalWinAmount: 0,
    pendingCount: 0,
    wonCount: 0,
    lostCount: 0,
    cancelledCount: 0,
  };

  // Fetch lotteries for filter
  const { data: lotteriesData } = useSWR('/api/lotteries', fetcher);
  const lotteries = lotteriesData || [];

  // Realtime sync
  const { 
    isConnected, 
    connectionQuality, 
    pendingSync,
  } = useBranchRealtime({
    branchId: branchId || null,
    onSyncEvent: () => mutate(),
    onRealtimeEvent: () => mutate(),
  });

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    
    const channel = supabase
      .channel('auto-system-slips')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, () => mutate())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bet_items' }, () => mutate())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [mutate]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, lotteryFilter, searchTerm]);

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
      case 'confirmed':
        return <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="size-3 mr-1" />รอผล</Badge>;
      case 'won':
        return <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30"><Trophy className="size-3 mr-1" />ถูกรางวัล</Badge>;
      case 'lost':
        return <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="size-3 mr-1" />ไม่ถูก</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30"><Ban className="size-3 mr-1" />ยกเลิก</Badge>;
      case 'partial':
        return <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30"><CheckCircle className="size-3 mr-1" />ถูกบางส่วน</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get result status badge
  const getResultBadge = (resultStatus: string) => {
    switch (resultStatus) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">รอผล</Badge>;
      case 'won':
        return <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">ถูกรางวัล</Badge>;
      case 'lost':
        return <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">ไม่ถูก</Badge>;
      case 'partial':
        return <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">ถูกบางส่วน</Badge>;
      default:
        return <Badge variant="outline">{resultStatus}</Badge>;
    }
  };

  // Open detail modal
  const openDetailModal = (slip: AutoSlip) => {
    setSelectedSlip(slip);
    setShowDetailModal(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="size-6 text-green-400" />
            รายการออโต้
          </h1>
          <p className="text-white/60 mt-1">
            รายการแทงที่เข้ามาผ่านระบบออโต้ (LINE/API)
            {isMasterBranch && <span className="text-green-400 ml-2">(ดูได้ทุกสาขา)</span>}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                <Wifi className="size-3 mr-1" />
                Realtime {connectionQuality === 'good' ? 'OK' : connectionQuality}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
                <WifiOff className="size-3 mr-1" />
                Offline
              </Badge>
            )}
          </div>

          {/* Auto Refresh Toggle */}
          <Button 
            variant={autoRefresh ? "default" : "outline"} 
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? "bg-green-600 hover:bg-green-700" : ""}
          >
            <Zap className={`size-4 mr-2 ${autoRefresh ? 'text-yellow-300' : ''}`} />
            Auto {autoRefresh ? 'ON' : 'OFF'}
          </Button>

          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* Pending Sync Alert */}
      {pendingSync.length > 0 && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400">
              <Clock className="size-5" />
              <span>มี {pendingSync.length} รายการรอ Sync จากเว็บแม่</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => mutate()}>
              ดูรายการ
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tabs - Status Filter */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList className="bg-[#0D1321] border border-green-500/30">
          <TabsTrigger value="all" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
            ทั้งหมด ({summary.totalSlips})
          </TabsTrigger>
          <TabsTrigger value="pending" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-white">
            รอผล ({summary.pendingCount})
          </TabsTrigger>
          <TabsTrigger value="won" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">
            ถูกรางวัล ({summary.wonCount})
          </TabsTrigger>
          <TabsTrigger value="lost" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">
            ไม่ถูก ({summary.lostCount})
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="data-[state=active]:bg-gray-600 data-[state=active]:text-white">
            ยกเลิก ({summary.cancelledCount})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <Card className="bg-[#0D1321] border-green-500/30">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                <Input
                  placeholder="ค้นหาเลขที่โพย, ชื่อลูกค้า..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white/10 border-green-500/30 text-white placeholder:text-white/50 focus:border-green-400"
                />
              </div>
            </div>

            {/* Lottery Filter */}
            <Select value={lotteryFilter} onValueChange={setLotteryFilter}>
              <SelectTrigger className="w-[180px] bg-white/10 border-green-500/30 text-white">
                <SelectValue placeholder="เลือกหวย" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกหวย</SelectItem>
                {lotteries.map((lottery: any) => (
                  <SelectItem key={lottery.id} value={lottery.id}>
                    {lottery.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#0D1321] border-green-500/30">
          <CardContent className="p-4">
            <div className="text-white/60 text-sm">จำนวนโพย</div>
            <div className="text-2xl font-bold text-white">{summary.totalSlips.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0D1321] border-blue-500/30">
          <CardContent className="p-4">
            <div className="text-white/60 text-sm">ยอดรับรวม</div>
            <div className="text-2xl font-bold text-blue-400">
              {summary.totalBetsAmount.toLocaleString()} บ.
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0D1321] border-green-500/30">
          <CardContent className="p-4">
            <div className="text-white/60 text-sm">ยอดจ่ายรวม</div>
            <div className="text-2xl font-bold text-green-400">
              {summary.totalWinAmount.toLocaleString()} บ.
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0D1321] border-amber-500/30">
          <CardContent className="p-4">
            <div className="text-white/60 text-sm">กำไร/ขาดทุน</div>
            <div className={`text-2xl font-bold ${summary.totalBetsAmount - summary.totalWinAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(summary.totalBetsAmount - summary.totalWinAmount).toLocaleString()} บ.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Slips Table */}
      <Card className="bg-[#0D1321] border-green-500/30">
        <CardHeader className="border-b border-white/10">
          <CardTitle className="text-green-400 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Receipt className="size-5" />
              รายการโพย ({slips.length} จาก {pagination.total})
            </span>
            <span className="text-sm text-white/40 font-normal flex items-center gap-2">
              {autoRefresh && <span className="size-2 bg-green-400 rounded-full animate-pulse" />}
              หน้า {pagination.page} / {pagination.totalPages}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && slips.length === 0 ? (
            <div className="p-8 text-center text-white/60">
              <RefreshCw className="size-8 animate-spin mx-auto mb-2" />
              กำลังโหลด...
            </div>
          ) : slips.length === 0 ? (
            <div className="p-8 text-center text-white/60">
              <Bot className="size-12 mx-auto mb-2 opacity-30" />
              ไม่พบรายการโพย
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#1a1f2e]">
                  <tr className="text-left text-white/60 text-sm">
                    <th className="p-4">เลขที่โพย</th>
                    <th className="p-4">ลูกค้า</th>
                    <th className="p-4">หวย</th>
                    <th className="p-4 text-center">จำนวนเลข</th>
                    <th className="p-4 text-right">ยอดแทง</th>
                    <th className="p-4 text-center">สถานะโพย</th>
                    <th className="p-4 text-center">ผลรางวัล</th>
                    <th className="p-4 text-right">ยอดถูก</th>
                    <th className="p-4">เวลา</th>
                    <th className="p-4 text-center">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {slips.map((slip) => (
                    <tr key={slip.slipId} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <span className="font-mono text-sm text-green-400">
                          {slip.slipId.slice(0, 8)}...
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <User className="size-4 text-white/40" />
                          <span className="text-white">{slip.customerName}</span>
                        </div>
                      </td>
                      <td className="p-4 text-white/80">{slip.lotteryName}</td>
                      <td className="p-4 text-center">
                        <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                          {slip.itemsCount} เลข
                        </Badge>
                      </td>
                      <td className="p-4 text-right text-white font-medium">
                        {slip.totalBetAmount.toLocaleString()} บ.
                      </td>
                      <td className="p-4 text-center">{getStatusBadge(slip.status)}</td>
                      <td className="p-4 text-center">{getResultBadge(slip.resultStatus)}</td>
                      <td className="p-4 text-right">
                        {slip.totalWinAmount > 0 ? (
                          <span className="text-green-400 font-bold">{slip.totalWinAmount.toLocaleString()} บ.</span>
                        ) : (
                          <span className="text-white/40">-</span>
                        )}
                      </td>
                      <td className="p-4 text-white/60 text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {format(new Date(slip.createdAt), 'dd/MM HH:mm', { locale: th })}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openDetailModal(slip)}
                          className="border-green-500/30 text-green-400 hover:bg-green-500/20"
                        >
                          <Eye className="size-4 mr-1" />
                          ดู
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-white/10">
              <div className="text-white/60 text-sm">
                แสดง {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} จาก {pagination.total} รายการ
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={pagination.page === 1}
                  className="border-green-500/30"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-white px-3">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.page === pagination.totalPages}
                  className="border-green-500/30"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="size-5 text-green-400" />
              รายละเอียดโพย
            </DialogTitle>
            <DialogDescription>
              เลขที่โพย: {selectedSlip?.slipId}
            </DialogDescription>
          </DialogHeader>
          
          {selectedSlip && (
            <div className="space-y-4">
              {/* Slip Info */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-secondary/50 border">
                <div>
                  <p className="text-sm text-muted-foreground">ลูกค้า</p>
                  <p className="font-medium">{selectedSlip.customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">หวย</p>
                  <p className="font-medium">{selectedSlip.lotteryName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ยอดแทงรวม</p>
                  <p className="font-bold text-blue-400">{selectedSlip.totalBetAmount.toLocaleString()} บาท</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ยอดถูกรางวัล</p>
                  <p className="font-bold text-green-400">{selectedSlip.totalWinAmount.toLocaleString()} บาท</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">สถานะ</p>
                  {getStatusBadge(selectedSlip.status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ผลรางวัล</p>
                  {getResultBadge(selectedSlip.resultStatus)}
                </div>
              </div>
              
              {/* Items Table */}
              <div>
                <h4 className="font-medium mb-2">รายการเลข ({selectedSlip.items.length} เลข)</h4>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3 text-left">เลข</th>
                        <th className="p-3 text-left">ประเภท</th>
                        <th className="p-3 text-right">บน</th>
                        <th className="p-3 text-right">ล่าง</th>
                        <th className="p-3 text-right">โต๊ด</th>
                        <th className="p-3 text-right">รวม</th>
                        <th className="p-3 text-center">สถานะ</th>
                        <th className="p-3 text-right">ยอดถูก</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedSlip.items.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-muted/30">
                          <td className="p-3 font-mono font-bold text-green-500">{item.number}</td>
                          <td className="p-3">{item.betType}</td>
                          <td className="p-3 text-right">{item.amountTop > 0 ? item.amountTop.toLocaleString() : '-'}</td>
                          <td className="p-3 text-right">{item.amountBottom > 0 ? item.amountBottom.toLocaleString() : '-'}</td>
                          <td className="p-3 text-right">{item.amountTod > 0 ? item.amountTod.toLocaleString() : '-'}</td>
                          <td className="p-3 text-right font-medium">{item.totalAmount.toLocaleString()}</td>
                          <td className="p-3 text-center">
                            {item.status === 'won' ? (
                              <Badge className="bg-green-500/20 text-green-500">ถูก</Badge>
                            ) : item.status === 'lost' ? (
                              <Badge className="bg-red-500/20 text-red-500">ไม่ถูก</Badge>
                            ) : (
                              <Badge className="bg-yellow-500/20 text-yellow-500">รอผล</Badge>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {item.winAmount > 0 ? (
                              <span className="text-green-500 font-bold">{item.winAmount.toLocaleString()}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailModal(false)}>
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
