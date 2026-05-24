'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  ScrollArea,
} from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  List, RefreshCw, Search, Filter, Trophy, Clock, XCircle, Eye,
  User, UserCog, Ban, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatDistanceToNow, format } from 'date-fns';
import { th } from 'date-fns/locale';

interface BetItem {
  id: string;
  number: string;
  bet_type: string;
  amount_top: number;
  amount_bottom: number;
  amount_tod: number;
  status: string;
  win_amount: number;
}

interface Bet {
  id: string;
  lottery_id: string;
  customer_id: string;
  customer_name: string | null;
  created_by: string | null;
  total_amount: number;
  total_win_amount: number;
  status: string;
  is_checked: boolean;
  cancel_deadline: string;
  created_at: string;
  lottery?: { id: string; name: string };
  customer?: { id: string; name: string; phone: string };
  creator?: { id: string; name: string; username: string };
  bet_items?: BetItem[];
}

export default function BetsListPage() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [adminFilter, setAdminFilter] = useState<string>('all');
  const [admins, setAdmins] = useState<{ id: string; name: string }[]>([]);
  const [selectedBet, setSelectedBet] = useState<Bet | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancellingBetId, setCancellingBetId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Fetch bets
  const fetchBets = useCallback(async () => {
    try {
      setIsLoading(true);
      const supabase = createClient();
      
      let query = supabase
        .from('bets')
        .select(`
          id,
          lottery_id,
          customer_id,
          customer_name,
          created_by,
          total_amount,
          total_win_amount,
          status,
          is_checked,
          cancel_deadline,
          created_at,
          lottery:lotteries(id, name),
          customer:customers!bets_customer_id_fkey(id, name, phone),
          creator:customers!bets_created_by_fkey(id, name, username),
          bet_items(id, number, bet_type, amount_top, amount_bottom, amount_tod, status, win_amount)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      // Filter by status
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Filter by admin
      if (adminFilter !== 'all') {
        query = query.eq('created_by', adminFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching bets:', error);
        return;
      }

      setBets(data || []);

      // Get unique admins
      const uniqueAdmins = new Map<string, { id: string; name: string }>();
      (data || []).forEach((bet: any) => {
        if (bet.creator?.id) {
          uniqueAdmins.set(bet.creator.id, { 
            id: bet.creator.id, 
            name: bet.creator.name || bet.creator.username 
          });
        }
      });
      setAdmins(Array.from(uniqueAdmins.values()));

    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, adminFilter]);

  useEffect(() => {
    fetchBets();
  }, [fetchBets]);

  // Check if can cancel
  const canCancelBet = (bet: Bet) => {
    const now = new Date();
    const deadline = new Date(bet.cancel_deadline);
    return now <= deadline && (bet.status === 'confirmed' || bet.status === 'pending');
  };

  // Get time remaining
  const getTimeRemaining = (deadline: string) => {
    const now = new Date();
    const end = new Date(deadline);
    const diff = end.getTime() - now.getTime();
    if (diff <= 0) return null;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Cancel bet
  const handleCancelBet = async () => {
    if (!selectedBet) return;
    
    setCancellingBetId(selectedBet.id);
    setCancelError(null);

    try {
      const res = await fetch(`/api/bets/${selectedBet.id}/cancel`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        setCancelError(data.error || 'ไม่สามารถยกเลิกโพยได้');
        return;
      }

      // Refresh list
      await fetchBets();
      setShowCancelDialog(false);
      setSelectedBet(null);

    } catch (error) {
      setCancelError('เกิดข้อผิดพลาด');
    } finally {
      setCancellingBetId(null);
    }
  };

  // Filter bets by search
  const filteredBets = bets.filter(bet => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      bet.customer_name?.toLowerCase().includes(search) ||
      bet.customer?.name?.toLowerCase().includes(search) ||
      bet.id.toLowerCase().includes(search) ||
      bet.bet_items?.some(item => item.number.includes(searchTerm))
    );
  });

  // Status badge
  const getStatusBadge = (status: string, isChecked: boolean, winAmount: number) => {
    if (status === 'cancelled') {
      return <Badge variant="outline" className="bg-gray-500/20 text-gray-400">ยกเลิก</Badge>;
    }
    if (status === 'won') {
      return <Badge className="bg-green-500 text-white">ถูกรางวัล +฿{winAmount.toLocaleString()}</Badge>;
    }
    if (status === 'lost') {
      return <Badge variant="outline" className="bg-red-500/20 text-red-400">ไม่ถูก</Badge>;
    }
    if (isChecked) {
      return <Badge variant="outline" className="bg-blue-500/20 text-blue-400">ตรวจแล้ว</Badge>;
    }
    return <Badge variant="outline" className="bg-amber-500/20 text-amber-400">รอผล</Badge>;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <List className="h-6 w-6 text-amber-400" />
              รายการโพยทั้งหมด
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              ดูโพย, ยกเลิกโพย, และตรวจสอบผลรางวัล
            </p>
          </div>
          <Button onClick={fetchBets} variant="outline" className="border-amber-500/50 text-amber-400">
            <RefreshCw className="h-4 w-4 mr-2" />
            รีเฟรช
          </Button>
        </div>

        {/* Filters */}
        <Card className="bg-[#111] border-gray-800">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="ค้นหาชื่อลูกค้า, เลข, หรือ ID โพย..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-[#0a0a0a] border-gray-700"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px] bg-[#0a0a0a] border-gray-700">
                  <SelectValue placeholder="สถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  <SelectItem value="confirmed">รอผล</SelectItem>
                  <SelectItem value="won">ถูกรางวัล</SelectItem>
                  <SelectItem value="lost">ไม่ถูก</SelectItem>
                  <SelectItem value="cancelled">ยกเลิก</SelectItem>
                </SelectContent>
              </Select>
              <Select value={adminFilter} onValueChange={setAdminFilter}>
                <SelectTrigger className="w-[180px] bg-[#0a0a0a] border-gray-700">
                  <SelectValue placeholder="แอดมินผู้รับโพย" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกแอดมิน</SelectItem>
                  {admins.map(admin => (
                    <SelectItem key={admin.id} value={admin.id}>{admin.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-[#111] border-gray-800">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-white">{bets.length}</p>
              <p className="text-gray-400 text-sm">โพยทั้งหมด</p>
            </CardContent>
          </Card>
          <Card className="bg-[#111] border-gray-800">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">
                ฿{bets.reduce((sum, b) => sum + (b.total_amount || 0), 0).toLocaleString()}
              </p>
              <p className="text-gray-400 text-sm">ยอดรวม</p>
            </CardContent>
          </Card>
          <Card className="bg-[#111] border-gray-800">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-400">
                {bets.filter(b => b.status === 'won').length}
              </p>
              <p className="text-gray-400 text-sm">ถูกรางวัล</p>
            </CardContent>
          </Card>
          <Card className="bg-[#111] border-gray-800">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-400">
                ฿{bets.reduce((sum, b) => sum + (b.total_win_amount || 0), 0).toLocaleString()}
              </p>
              <p className="text-gray-400 text-sm">ยอดจ่ายรางวัล</p>
            </CardContent>
          </Card>
        </div>

        {/* Bets List */}
        <Card className="bg-[#111] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <List className="h-5 w-5 text-amber-400" />
              รายการโพย ({filteredBets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">
                <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
                กำลังโหลด...
              </div>
            ) : filteredBets.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <List className="h-12 w-12 mx-auto mb-2 opacity-50" />
                ไม่พบรายการโพย
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {filteredBets.map((bet) => {
                    const timeRemaining = canCancelBet(bet) ? getTimeRemaining(bet.cancel_deadline) : null;
                    
                    return (
                      <div 
                        key={bet.id}
                        className="p-4 rounded-lg bg-[#0a0a0a] border border-gray-800 hover:border-amber-500/30 transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-amber-400 font-mono text-sm">#{bet.id.slice(0, 8)}</span>
                              {getStatusBadge(bet.status, bet.is_checked, bet.total_win_amount)}
                            </div>
                            <p className="text-white font-medium flex items-center gap-2">
                              <User className="h-4 w-4 text-gray-500" />
                              {bet.customer_name || bet.customer?.name || 'ไม่ระบุชื่อ'}
                            </p>
                            <p className="text-gray-500 text-sm flex items-center gap-2">
                              <UserCog className="h-3 w-3" />
                              รับโพยโดย: {bet.creator?.name || bet.creator?.username || 'ระบบ'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-amber-400">฿{bet.total_amount.toLocaleString()}</p>
                            {bet.total_win_amount > 0 && (
                              <p className="text-green-400 text-sm flex items-center justify-end gap-1">
                                <Trophy className="h-3 w-3" />
                                +฿{bet.total_win_amount.toLocaleString()}
                              </p>
                            )}
                            <p className="text-gray-500 text-xs">
                              {bet.lottery?.name} • {format(new Date(bet.created_at), 'dd/MM/yy HH:mm', { locale: th })}
                            </p>
                          </div>
                        </div>

                        {/* Bet Items */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {bet.bet_items?.slice(0, 10).map((item, idx) => (
                            <Badge 
                              key={idx} 
                              variant="outline" 
                              className={`font-mono ${
                                item.status === 'won' ? 'bg-green-500/20 text-green-400 border-green-500/50' :
                                item.status === 'lost' ? 'bg-gray-500/20 text-gray-400' :
                                'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              }`}
                            >
                              {item.number}
                              {item.win_amount > 0 && ` +${item.win_amount}`}
                            </Badge>
                          ))}
                          {(bet.bet_items?.length || 0) > 10 && (
                            <Badge variant="outline" className="text-gray-500">
                              +{(bet.bet_items?.length || 0) - 10} เลข
                            </Badge>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between">
                          <div>
                            {timeRemaining && (
                              <span className="text-orange-400 text-sm flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                ยกเลิกได้อีก {timeRemaining}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-400 hover:text-white"
                              onClick={() => setSelectedBet(bet)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              ดูรายละเอียด
                            </Button>
                            {canCancelBet(bet) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                onClick={() => {
                                  setSelectedBet(bet);
                                  setShowCancelDialog(true);
                                }}
                              >
                                <Ban className="h-4 w-4 mr-1" />
                                ยกเลิกโพย
                              </Button>
                            )}
                          </div>
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

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="bg-[#111] border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-400" />
              ยืนยันยกเลิกโพย
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              ต้องการยกเลิกโพยนี้หรือไม่? เงินจะถูกคืนให้ลูกค้า
            </DialogDescription>
          </DialogHeader>
          
          {selectedBet && (
            <div className="py-4 space-y-2">
              <p className="text-white">
                <span className="text-gray-500">ลูกค้า:</span> {selectedBet.customer_name || selectedBet.customer?.name}
              </p>
              <p className="text-white">
                <span className="text-gray-500">ยอด:</span> ฿{selectedBet.total_amount.toLocaleString()}
              </p>
              <p className="text-white">
                <span className="text-gray-500">จำนวนเลข:</span> {selectedBet.bet_items?.length || 0} เลข
              </p>
              {cancelError && (
                <p className="text-red-400 text-sm">{cancelError}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              className="border-gray-700"
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelBet}
              disabled={cancellingBetId === selectedBet?.id}
            >
              {cancellingBetId === selectedBet?.id ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> กำลังยกเลิก...</>
              ) : (
                <>ยืนยันยกเลิกโพย</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selectedBet && !showCancelDialog} onOpenChange={() => setSelectedBet(null)}>
        <DialogContent className="bg-[#111] border-gray-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">รายละเอียดโพย</DialogTitle>
          </DialogHeader>
          
          {selectedBet && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 text-sm">ID โพย</p>
                  <p className="text-white font-mono">{selectedBet.id}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">สถานะ</p>
                  {getStatusBadge(selectedBet.status, selectedBet.is_checked, selectedBet.total_win_amount)}
                </div>
                <div>
                  <p className="text-gray-500 text-sm">ลูกค้า</p>
                  <p className="text-white">{selectedBet.customer_name || selectedBet.customer?.name}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">แอดมินผู้รับโพย</p>
                  <p className="text-white">{selectedBet.creator?.name || selectedBet.creator?.username || 'ระบบ'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">หวย</p>
                  <p className="text-white">{selectedBet.lottery?.name}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">ยอดแทง</p>
                  <p className="text-amber-400 font-bold">฿{selectedBet.total_amount.toLocaleString()}</p>
                </div>
                {selectedBet.total_win_amount > 0 && (
                  <div>
                    <p className="text-gray-500 text-sm">ยอดถูกรางวัล</p>
                    <p className="text-green-400 font-bold">฿{selectedBet.total_win_amount.toLocaleString()}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-500 text-sm">เวลาแทง</p>
                  <p className="text-white">{format(new Date(selectedBet.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: th })}</p>
                </div>
              </div>

              <div>
                <p className="text-gray-500 text-sm mb-2">รายการเลข ({selectedBet.bet_items?.length || 0})</p>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {selectedBet.bet_items?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-[#0a0a0a] rounded">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-lg text-white">{item.number}</span>
                          <Badge variant="outline" className="text-xs">{item.bet_type}</Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-400 text-sm">
                            {item.amount_top > 0 && `บน ${item.amount_top}`}
                            {item.amount_bottom > 0 && ` ล่าง ${item.amount_bottom}`}
                            {item.amount_tod > 0 && ` โต๊ด ${item.amount_tod}`}
                          </p>
                          {item.win_amount > 0 && (
                            <p className="text-green-400 font-bold">+฿{item.win_amount.toLocaleString()}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
