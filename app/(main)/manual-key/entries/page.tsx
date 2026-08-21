'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  List, RefreshCw, Search, Filter, Wifi, WifiOff, 
  CheckCircle, Clock, XCircle, Eye, User, Receipt,
  Banknote, AlertCircle, Calendar
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { formatDistanceToNow, format } from 'date-fns';
import { th } from 'date-fns/locale';

interface BetItem {
  id: string;
  number: string;
  betType: string;
  amountTop: number;
  amountBottom: number;
  amountTod: number;
  payoutRate: number;
  winAmount: number;
  status: string;
}

interface Slip {
  slipId: string;
  slipSource: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  keyBy: string;
  keyByName: string | null;
  agentId: string | null;
  agentName: string | null;
  ownerId: string | null;
  lotteryId: string;
  lotteryName: string;
  roundDate: string | null;
  drawTime: string | null;
  itemsCount: number;
  totalAmount: number;
  status: string;
  resultStatus: string;
  winAmount: number;
  payoutStatus: string;
  createdAt: string;
  updatedAt: string;
  cancelDeadline: string;
  betItems: BetItem[];
}

interface Summary {
  totalSlips: number;
  totalBetsAmount: number;
  totalWinAmount: number;
  pendingCount: number;
  wonCount: number;
  lostCount: number;
  pendingPayoutCount: number;
}

export default function ManualKeyEntriesPage() {
  const { user } = useAuth();
  const [slips, setSlips] = useState<Slip[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedSlip, setSelectedSlip] = useState<Slip | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Determine user role for visibility
  const getUserRole = (): 'guest' | 'super_admin' | 'agent_key' | 'key_staff' => {
    if (!user) return 'guest';

    // Convert to string first so this page can safely handle legacy/custom roles
    // without conflicting with the narrower UserType union from useAuth().
    const role = String(user.role ?? '');

    if (role === 'super_admin' || role === 'admin' || role === 'master') {
      return 'super_admin';
    }

    if (role === 'agent_key') {
      return 'agent_key';
    }

    if (role === 'key_staff') {
      return 'key_staff';
    }

    return 'key_staff'; // default to most restrictive
  };

  // Fetch slips from API
  const fetchSlips = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const userRole = getUserRole();
      const params = new URLSearchParams();
      
      // Add user context for permission filtering
      if (user?.id) params.set('user_id', user.id);
      params.set('user_role', userRole);
      
      // For agent_key, add parent_agent_id
      if (userRole === 'agent_key' && user?.id) {
        params.set('parent_agent_id', user.id);
      }
      
      // Add filters
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (resultFilter !== 'all') params.set('result_status', resultFilter);
      if (searchTerm) params.set('search', searchTerm);
      
      const response = await fetch(`/api/manual-key/slips?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setSlips(data.slips || []);
        setSummary(data.summary || null);
      } else {
        console.error('Failed to fetch slips:', data.error);
      }
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Fetch slips error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, statusFilter, resultFilter, searchTerm]);

  // Initial fetch
  useEffect(() => {
    fetchSlips();
  }, [fetchSlips]);

  // Auto refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchSlips, 30000);
    return () => clearInterval(interval);
  }, [fetchSlips]);

  // Open detail modal
  const handleViewDetail = (slip: Slip) => {
    setSelectedSlip(slip);
    setIsDetailOpen(true);
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">ยืนยันแล้ว</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">รอยืนยัน</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">ยกเลิก</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get result status badge
  const getResultBadge = (resultStatus: string) => {
    switch (resultStatus) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="size-3 mr-1" />รอผล</Badge>;
      case 'won':
        return <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="size-3 mr-1" />ถูกรางวัล</Badge>;
      case 'lost':
        return <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="size-3 mr-1" />ไม่ถูก</Badge>;
      default:
        return <Badge variant="outline">{resultStatus}</Badge>;
    }
  };

  // Get payout status badge
  const getPayoutBadge = (payoutStatus: string) => {
    switch (payoutStatus) {
      case 'pending':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30"><Banknote className="size-3 mr-1" />รอจ่าย</Badge>;
      case 'paid':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="size-3 mr-1" />จ่ายแล้ว</Badge>;
      case 'none':
        return <Badge variant="outline" className="text-white/40">-</Badge>;
      default:
        return null;
    }
  };

  // Get bet type display name
  const getBetTypeLabel = (betType: string) => {
    const labels: Record<string, string> = {
      '2top': '2 ตัวบน',
      '2bot': '2 ตัวล่าง',
      '2tod': '2 ตัวโต๊ด',
      '3top': '3 ตัวบน',
      '3tod': '3 ตัวโต๊ด',
      '3front': '3 ตัวหน้า',
      '3back': '3 ตัวหลัง',
      '1top': 'วิ่งบน',
      '1bot': 'วิ่งล่าง',
    };
    return labels[betType] || betType;
  };

  const userRole = getUserRole();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Receipt className="size-6 text-amber-400" />
            รายการคีย์หวย
          </h1>
          <p className="text-white/60 mt-1">
            {userRole === 'key_staff' && 'รายการโพยที่คุณคีย์'}
            {userRole === 'agent_key' && 'รายการโพยของทีมทั้งหมด'}
            {userRole === 'super_admin' && 'รายการโพยคีย์หวยทั้งหมด'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchSlips} disabled={isLoading}>
            <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-[#0D1321] border-amber-500/30">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
                <Input
                  placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร, รหัสโพย..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white/10 border-amber-500/30 text-white placeholder:text-white/50 focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="size-4 text-white/40" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white/10 border border-amber-500/30 rounded-md px-3 py-2 text-white text-sm focus:border-amber-400"
              >
                <option value="all">ทุกสถานะโพย</option>
                <option value="confirmed">ยืนยันแล้ว</option>
                <option value="pending">รอยืนยัน</option>
                <option value="cancelled">ยกเลิก</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={resultFilter}
                onChange={(e) => setResultFilter(e.target.value)}
                className="bg-white/10 border border-amber-500/30 rounded-md px-3 py-2 text-white text-sm focus:border-amber-400"
              >
                <option value="all">ทุกผลรางวัล</option>
                <option value="pending">รอผล</option>
                <option value="won">ถูกรางวัล</option>
                <option value="lost">ไม่ถูก</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card className="bg-[#0D1321] border-amber-500/30">
            <CardContent className="p-4">
              <div className="text-white/60 text-sm">โพยทั้งหมด</div>
              <div className="text-2xl font-bold text-white">{summary.totalSlips}</div>
            </CardContent>
          </Card>
          <Card className="bg-[#0D1321] border-blue-500/30">
            <CardContent className="p-4">
              <div className="text-white/60 text-sm">ยอดแทงรวม</div>
              <div className="text-2xl font-bold text-blue-400">{summary.totalBetsAmount.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="bg-[#0D1321] border-yellow-500/30">
            <CardContent className="p-4">
              <div className="text-white/60 text-sm">รอผล</div>
              <div className="text-2xl font-bold text-yellow-400">{summary.pendingCount}</div>
            </CardContent>
          </Card>
          <Card className="bg-[#0D1321] border-green-500/30">
            <CardContent className="p-4">
              <div className="text-white/60 text-sm">ถูกรางวัล</div>
              <div className="text-2xl font-bold text-green-400">{summary.wonCount}</div>
            </CardContent>
          </Card>
          <Card className="bg-[#0D1321] border-red-500/30">
            <CardContent className="p-4">
              <div className="text-white/60 text-sm">ไม่ถูก</div>
              <div className="text-2xl font-bold text-red-400">{summary.lostCount}</div>
            </CardContent>
          </Card>
          <Card className="bg-[#0D1321] border-emerald-500/30">
            <CardContent className="p-4">
              <div className="text-white/60 text-sm">ยอดถูกรางวัล</div>
              <div className="text-2xl font-bold text-emerald-400">{summary.totalWinAmount.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="bg-[#0D1321] border-amber-500/30">
            <CardContent className="p-4">
              <div className="text-white/60 text-sm">รอจ่ายรางวัล</div>
              <div className="text-2xl font-bold text-amber-400">{summary.pendingPayoutCount}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Slips Table */}
      <Card className="bg-[#0D1321] border-amber-500/30">
        <CardHeader className="border-b border-white/10">
          <CardTitle className="text-amber-400 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <List className="size-5" />
              รายการโพย ({slips.length} โพย)
            </span>
            <span className="text-sm text-white/40 font-normal">
              อัพเดทล่าสุด: {formatDistanceToNow(lastUpdate, { addSuffix: true, locale: th })}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-white/60">
              <RefreshCw className="size-8 animate-spin mx-auto mb-2" />
              กำลังโหลด...
            </div>
          ) : slips.length === 0 ? (
            <div className="p-8 text-center text-white/60">
              <AlertCircle className="size-8 mx-auto mb-2 text-white/40" />
              ไม่พบรายการโพย
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr className="text-left text-white/60 text-sm">
                    <th className="p-4">วันที่/เวลา</th>
                    <th className="p-4">ลูกค้า</th>
                    <th className="p-4">หวย</th>
                    <th className="p-4 text-center">จำนวนเลข</th>
                    <th className="p-4 text-right">ยอดแทง</th>
                    <th className="p-4 text-center">สถานะโพย</th>
                    <th className="p-4 text-center">ผลรางวัล</th>
                    <th className="p-4 text-right">ยอดถูก</th>
                    <th className="p-4 text-center">จ่ายรางวัล</th>
                    <th className="p-4 text-center">ดู</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {slips.map((slip) => (
                    <tr key={slip.slipId} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="text-white text-sm">
                          {format(new Date(slip.createdAt), 'dd/MM/yy')}
                        </div>
                        <div className="text-white/50 text-xs">
                          {format(new Date(slip.createdAt), 'HH:mm')} น.
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <User className="size-4 text-white/40" />
                          <div>
                            <div className="text-white text-sm">{slip.customerName}</div>
                            <div className="text-white/50 text-xs">{slip.customerPhone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-amber-400 text-sm">{slip.lotteryName}</div>
                      </td>
                      <td className="p-4 text-center">
                        <Badge variant="outline" className="text-white">
                          {slip.itemsCount} รายการ
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <div className="text-white font-medium">
                          {slip.totalAmount.toLocaleString()} บ.
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        {getStatusBadge(slip.status)}
                      </td>
                      <td className="p-4 text-center">
                        {getResultBadge(slip.resultStatus)}
                      </td>
                      <td className="p-4 text-right">
                        {slip.winAmount > 0 ? (
                          <span className="text-green-400 font-medium">
                            {slip.winAmount.toLocaleString()} บ.
                          </span>
                        ) : (
                          <span className="text-white/40">-</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {getPayoutBadge(slip.payoutStatus)}
                      </td>
                      <td className="p-4 text-center">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleViewDetail(slip)}
                          className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                        >
                          <Eye className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="bg-[#0D1321] border-amber-500/30 max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-amber-400 flex items-center gap-2">
              <Receipt className="size-5" />
              รายละเอียดโพย
            </DialogTitle>
          </DialogHeader>
          
          {selectedSlip && (
            <div className="space-y-6">
              {/* Slip Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-lg">
                <div>
                  <p className="text-white/50 text-sm">รหัสโพย</p>
                  <p className="text-white font-mono text-sm">{selectedSlip.slipId.slice(0, 8)}...</p>
                </div>
                <div>
                  <p className="text-white/50 text-sm">วันที่/เวลา</p>
                  <p className="text-white">{format(new Date(selectedSlip.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                </div>
                <div>
                  <p className="text-white/50 text-sm">ลูกค้า</p>
                  <p className="text-white">{selectedSlip.customerName}</p>
                  <p className="text-white/50 text-sm">{selectedSlip.customerPhone}</p>
                </div>
                <div>
                  <p className="text-white/50 text-sm">หวย</p>
                  <p className="text-amber-400">{selectedSlip.lotteryName}</p>
                </div>
                <div>
                  <p className="text-white/50 text-sm">สถานะโพย</p>
                  {getStatusBadge(selectedSlip.status)}
                </div>
                <div>
                  <p className="text-white/50 text-sm">ผลรางวัล</p>
                  {getResultBadge(selectedSlip.resultStatus)}
                </div>
              </div>

              {/* Bet Items */}
              <div>
                <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                  <List className="size-4 text-amber-400" />
                  รายการเลขที่แทง ({selectedSlip.betItems.length} รายการ)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/5">
                      <tr className="text-left text-white/60 text-sm">
                        <th className="p-3">เลข</th>
                        <th className="p-3">ประเภท</th>
                        <th className="p-3 text-right">ยอดบน</th>
                        <th className="p-3 text-right">ยอดล่าง</th>
                        <th className="p-3 text-right">ยอดโต๊ด</th>
                        <th className="p-3 text-right">เรทจ่าย</th>
                        <th className="p-3 text-center">สถานะ</th>
                        <th className="p-3 text-right">ยอดถูก</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {selectedSlip.betItems.map((item) => (
                        <tr key={item.id} className={`
                          ${item.status === 'won' ? 'bg-green-500/10' : ''}
                          ${item.status === 'lost' ? 'bg-red-500/5' : ''}
                        `}>
                          <td className="p-3">
                            <span className={`font-mono font-bold text-lg ${
                              item.status === 'won' ? 'text-green-400' : 
                              item.status === 'lost' ? 'text-red-400' : 'text-white'
                            }`}>
                              {item.number}
                            </span>
                          </td>
                          <td className="p-3 text-white/70">{getBetTypeLabel(item.betType)}</td>
                          <td className="p-3 text-right text-white">
                            {item.amountTop > 0 ? item.amountTop.toLocaleString() : '-'}
                          </td>
                          <td className="p-3 text-right text-white">
                            {item.amountBottom > 0 ? item.amountBottom.toLocaleString() : '-'}
                          </td>
                          <td className="p-3 text-right text-white">
                            {item.amountTod > 0 ? item.amountTod.toLocaleString() : '-'}
                          </td>
                          <td className="p-3 text-right text-amber-400">{item.payoutRate}</td>
                          <td className="p-3 text-center">
                            {item.status === 'won' && (
                              <Badge className="bg-green-500/20 text-green-400">ถูก</Badge>
                            )}
                            {item.status === 'lost' && (
                              <Badge className="bg-red-500/20 text-red-400">ไม่ถูก</Badge>
                            )}
                            {item.status === 'pending' && (
                              <Badge className="bg-yellow-500/20 text-yellow-400">รอผล</Badge>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {item.winAmount > 0 ? (
                              <span className="text-green-400 font-medium">
                                {item.winAmount.toLocaleString()}
                              </span>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-white/5 border-t border-white/20">
                      <tr>
                        <td colSpan={2} className="p-3 text-white font-medium">รวม</td>
                        <td className="p-3 text-right text-white font-medium">
                          {selectedSlip.betItems.reduce((sum, i) => sum + i.amountTop, 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-right text-white font-medium">
                          {selectedSlip.betItems.reduce((sum, i) => sum + i.amountBottom, 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-right text-white font-medium">
                          {selectedSlip.betItems.reduce((sum, i) => sum + i.amountTod, 0).toLocaleString()}
                        </td>
                        <td className="p-3"></td>
                        <td className="p-3"></td>
                        <td className="p-3 text-right text-green-400 font-bold">
                          {selectedSlip.winAmount.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
                <div className="text-center">
                  <p className="text-white/50 text-sm">ยอดแทงรวม</p>
                  <p className="text-2xl font-bold text-white">{selectedSlip.totalAmount.toLocaleString()} บ.</p>
                </div>
                <div className="text-center">
                  <p className="text-white/50 text-sm">ยอดถูกรางวัล</p>
                  <p className="text-2xl font-bold text-green-400">{selectedSlip.winAmount.toLocaleString()} บ.</p>
                </div>
                <div className="text-center">
                  <p className="text-white/50 text-sm">สถานะจ่าย</p>
                  <div className="mt-1">{getPayoutBadge(selectedSlip.payoutStatus)}</div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}