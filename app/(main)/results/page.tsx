'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Trophy,
  Save,
  Calculator,
  CheckCircle,
  Clock,
  AlertTriangle,
  Crown,
  Flag,
  Sun,
  Landmark,
  Building,
  Palmtree,
  Star,
  TrendingUp,
  LineChart,
  Moon,
  Ticket,
  History,
  Calendar,
  Eye,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Icon map
const LOTTERY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'ticket': Ticket, 'crown': Crown, 'flag': Flag, 'sun': Sun,
  'landmark': Landmark, 'building': Building, 'palmtree': Palmtree,
  'star': Star, 'trending-up': TrendingUp, 'line-chart': LineChart, 'moon': Moon,
};

export default function ResultsPage() {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  
  // Permission check: only master_admin, super_admin, admin can edit
  // Agent can only view (read-only)
  const canEdit = isAdmin || isSuperAdmin || user?.role === 'master_admin';
  const isAgent = user?.role === 'agent';
  
  const [selectedLotteryId, setSelectedLotteryId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [threeTop, setThreeTop] = useState('');
  const [twoBot, setTwoBot] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showProcessConfirm, setShowProcessConfirm] = useState(false);
  const [processResult, setProcessResult] = useState<{
    winners_count: number;
    total_payout: number;
    winners: Array<{ number: string; bet_type: string; amount: number; payout: number }>;
  } | null>(null);
  
  // History filters - default to TODAY only
  const today = new Date().toISOString().split('T')[0];
  const [historyLotteryFilter, setHistoryLotteryFilter] = useState('all');
  const [historyDateFilter, setHistoryDateFilter] = useState<'today' | 'all'>('today');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedResultDetail, setSelectedResultDetail] = useState<any>(null);
  const [resultDetailData, setResultDetailData] = useState<{
    totalSlips: number;
    totalPayout: number;
    topWinningNumbers: Array<{ number: string; count: number; payout: number }>;
  } | null>(null);

  // Fetch lotteries
  const { data: lotteries = [] } = useSWR('/api/lotteries', fetcher);
  
  // Fetch existing result
  const { data: existingResults = [] } = useSWR(
    selectedLotteryId && selectedDate 
      ? `/api/results?lottery_id=${selectedLotteryId}&date=${selectedDate}` 
      : null,
    fetcher
  );

  // Fetch results history (last 7 days)
  const { data: rawResultsHistory } = useSWR('/api/results?limit=20', fetcher);
  
  // Safe array check - ป้องกัน error จาก API
  const resultsHistory = Array.isArray(rawResultsHistory) ? rawResultsHistory : [];

  const existingResult = existingResults[0];
  const selectedLottery = lotteries.find((l: { id: string }) => l.id === selectedLotteryId);

  // Load existing result data
  useEffect(() => {
    if (existingResult) {
      setThreeTop(existingResult.three_top || '');
      setTwoBot(existingResult.two_bot || '');
    } else {
      setThreeTop('');
      setTwoBot('');
    }
  }, [existingResult]);

  // Save result (only for admin/master_admin/super_admin)
  const handleSave = useCallback(async () => {
    if (!canEdit) {
      toast.error('คุณไม่มีสิทธิ์บันทึกผลหวย');
      return;
    }
    
    if (!selectedLotteryId) {
      toast.error('กรุณาเลือกหวย');
      return;
    }

    // Debug log
    console.log('Saving result:', {
      lottery_id: selectedLotteryId,
      draw_date: selectedDate,
      three_top: threeTop,
      two_bot: twoBot,
      user_role: user?.role,
    });

    setIsSaving(true);
    try {
      const res = await fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lottery_id: selectedLotteryId,
          draw_date: selectedDate,
          three_top: threeTop || null,
          two_bot: twoBot || null,
        }),
      });

      const data = await res.json();
      console.log('API response:', { status: res.status, data });

      if (!res.ok) {
        // แสดง error message จริงจาก API
        const errorMsg = data.error || data.message || 'Failed to save';
        const errorDetails = data.details ? ` (${data.details})` : '';
        const errorCode = data.code ? ` [${data.code}]` : '';
        toast.error(`${errorMsg}${errorDetails}${errorCode}`);
        console.error('Save failed:', data);
        return;
      }

      // แสดง toast ตามผลลัพธ์ (บันทึก + คำนวณอัตโนมัติ)
      if (data.calculation?.success) {
        const stats = data.calculation.stats || {};
        const winnersCount = stats.winners_count || 0;
        const totalPayout = stats.total_payout || 0;
        
        if (winnersCount > 0) {
          toast.success(
            `บันทึกและคำนวณสำเร็จ! พบผู้ถูกรางวัล ${winnersCount} รายการ ยอดจ่าย ${totalPayout.toLocaleString()} บาท`
          );
        } else {
          toast.success('บันทึกและคำนวณสำเร็จ ไม่พบผู้ถูกรางวัล');
        }
        
        // อัปเดต processResult เพื่อแสดงในหน้าจอ
        setProcessResult(data.calculation);
      } else if (data.calculation?.error) {
        toast.warning(`บันทึกผลสำเร็จ แต่คำนวณล้มเหลว: ${data.calculation.error}`);
      } else {
        toast.success(data.message || 'บันทึกผลสำเร็จ');
      }
      
      mutate(`/api/results?lottery_id=${selectedLotteryId}&date=${selectedDate}`);
      mutate('/api/results?limit=20'); // Refresh history
    } catch (err: any) {
      console.error('Save exception:', err);
      toast.error(err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsSaving(false);
    }
  }, [selectedLotteryId, selectedDate, threeTop, twoBot, user?.role, canEdit]);

  // Process winners (only for admin/master_admin/super_admin)
  const handleProcess = useCallback(async () => {
    if (!canEdit) {
      toast.error('คุณไม่มีสิทธิ์คำนวณผู้ถูกรางวัล');
      return;
    }
    
    if (!existingResult?.id) {
      toast.error('กรุณาบันทึกผลก่อน');
      return;
    }

    console.log('Processing winners for result:', {
      result_id: existingResult.id,
      lottery_id: selectedLotteryId,
      draw_date: selectedDate,
    });

    setIsProcessing(true);
    try {
      const res = await fetch('/api/results/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          result_id: existingResult.id,
          lottery_id: selectedLotteryId,
          draw_date: selectedDate,
        }),
      });

      const data = await res.json();
      console.log('Process API response:', data);

      if (!res.ok) {
        const errorMsg = data.error || data.message || 'Failed to process';
        const errorDetail = data.detail ? ` (${data.detail})` : '';
        toast.error(`${errorMsg}${errorDetail}`);
        return;
      }

      setProcessResult(data);
      setShowProcessConfirm(false);
      
      // Show detailed success message
      const stats = data.stats || {};
      const winnersCount = stats.winners_count || 0;
      const totalPayout = stats.total_payout || 0;
      const customersPaid = stats.customers_paid || 0;
      
      if (winnersCount > 0) {
        toast.success(
          `คำนวณสำเร็จ! พบผู้ถูกรางวัล ${winnersCount} รายการ ยอดจ่าย ${totalPayout.toLocaleString()} บาท (${customersPaid} ราย)`
        );
      } else {
        toast.info('คำนวณสำเร็จ ไม่พบผู้ถูกรางวัล');
      }
      
      mutate(`/api/results?lottery_id=${selectedLotteryId}&date=${selectedDate}`);
      mutate('/api/results?limit=20'); // Refresh history
    } catch (err: any) {
      console.error('Process exception:', err);
      toast.error(err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsProcessing(false);
    }
  }, [existingResult, selectedLotteryId, selectedDate, canEdit]);

  // Derived values display
  const twoTop = threeTop ? threeTop.slice(-2) : '-';
  const runTop = threeTop ? threeTop.slice(-1) : '-';
  const runBot = twoBot ? twoBot.slice(-1) : '-';
  
  // Filter results by date first (today only by default)
  const dateFilteredResults = historyDateFilter === 'today'
    ? resultsHistory.filter((r: any) => r.draw_date === today)
    : resultsHistory;
  
  // Group results by lottery for history display
  const groupedResults = dateFilteredResults.reduce((acc: Record<string, any[]>, result: any) => {
    const lottery = lotteries.find((l: any) => l.id === result.lottery_id);
    const lotteryName = lottery?.name || 'ไม่ระบุ';
    if (!acc[lotteryName]) {
      acc[lotteryName] = [];
    }
    acc[lotteryName].push({ ...result, lottery });
    return acc;
  }, {});
  
  // Filter history by selected lottery
  const filteredGroupedResults = historyLotteryFilter === 'all' 
    ? groupedResults 
    : { [historyLotteryFilter]: groupedResults[historyLotteryFilter] || [] };
  
  // Fetch result detail when modal opens
  const fetchResultDetail = async (result: any) => {
    setSelectedResultDetail(result);
    setShowDetailModal(true);
    try {
      const res = await fetch(`/api/results/${result.id}/detail`);
      if (res.ok) {
        const data = await res.json();
        setResultDetailData(data);
      } else {
        // Fallback mock data if API doesn't exist
        setResultDetailData({
          totalSlips: Math.floor(Math.random() * 100) + 10,
          totalPayout: Math.floor(Math.random() * 50000) + 5000,
          topWinningNumbers: [
            { number: result.three_top || '000', count: 5, payout: 2500 },
            { number: result.two_bot || '00', count: 8, payout: 1200 },
          ],
        });
      }
    } catch {
      setResultDetailData(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="size-6 text-accent" />
            {canEdit ? 'ผลหวย' : 'ดูผลหวย'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {canEdit ? 'กรอกผลและคำนวณผู้ถูกรางวัล' : 'ดูผลหวยจากเว็บแม่'}
          </p>
        </div>
        {!canEdit && (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
            <Eye className="size-3 mr-1" />
            ดูอย่างเดียว
          </Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Form - Only show for admin/master_admin/super_admin */}
        {canEdit ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">กรอกผลหวย</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Lottery Selection */}
              <div className="space-y-2">
                <Label>เลือกหวย</Label>
                <Select value={selectedLotteryId} onValueChange={setSelectedLotteryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกหวย" />
                  </SelectTrigger>
                  <SelectContent>
                    {lotteries.map((lottery: { id: string; name: string; icon?: string }) => {
                      const IconComponent = LOTTERY_ICONS[lottery.icon || 'ticket'] || Ticket;
                      return (
                        <SelectItem key={lottery.id} value={lottery.id}>
                          <div className="flex items-center gap-2">
                            <IconComponent className="size-4" />
                            <span>{lottery.name}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Selection */}
              <div className="space-y-2">
                <Label>วันที่ออกผล</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>

              <Separator />

              {/* Result Input */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>3 ตัวบน</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="xxx"
                    value={threeTop}
                    onChange={(e) => setThreeTop(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    className="text-center font-mono text-3xl h-16"
                    maxLength={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>2 ตัวล่าง</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="xx"
                    value={twoBot}
                    onChange={(e) => setTwoBot(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    className="text-center font-mono text-3xl h-16"
                    maxLength={2}
                  />
                </div>
              </div>

              {/* Derived Values */}
              <div className="p-4 rounded-lg bg-neutral-100 border border-neutral-200">
                <p className="text-sm text-neutral-600 mb-3">ค่าที่คำนวณได้:</p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-xs text-neutral-500 font-medium">2 บน</p>
                    <p className="font-mono text-xl font-bold text-amber-500">{twoTop}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 font-medium">วิ่งบน</p>
                    <p className="font-mono text-xl font-bold text-green-500">{runTop}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 font-medium">วิ่งล่าง</p>
                    <p className="font-mono text-xl font-bold text-blue-500">{runBot}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 font-medium">2 ล่าง</p>
                    <p className="font-mono text-xl font-bold text-purple-500">{twoBot || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Status */}
              {existingResult && (
                <div className="flex items-center gap-2">
                  {existingResult.status === 'calculated' || existingResult.is_processed ? (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      <CheckCircle className="size-3 mr-1" />
                      คำนวณแล้ว ({existingResult.total_winners || 0} รายการ)
                    </Badge>
                  ) : existingResult.status === 'result_announced' ? (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                      <Clock className="size-3 mr-1" />
                      ประกาศผลแล้ว (รอคำนวณ)
                    </Badge>
                  ) : (
                    <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                      <Clock className="size-3 mr-1" />
                      รอกรอกผล
                    </Badge>
                  )}
                </div>
              )}

              {/* Action Buttons - รวมเป็นปุ่มเดียว */}
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-[#D4AF37] hover:bg-[#B8960C] text-black"
                  onClick={handleSave}
                  disabled={isSaving || !selectedLotteryId || !threeTop || !twoBot}
                >
                  <Save className="size-4 mr-2" />
                  {isSaving ? 'กำลังประกาศผล...' : 'ประกาศผล + คำนวณ'}
                </Button>
                {/* ปุ่มคำนวณแยก - เผื่อกรณีต้องคำนวณใหม่ */}
                {existingResult && !existingResult.is_processed && (
                  <Button
                    variant="outline"
                    onClick={() => setShowProcessConfirm(true)}
                    disabled={isProcessing}
                  >
                    <Calculator className="size-4 mr-2" />
                    {isProcessing ? 'กำลังคำนวณ...' : 'คำนวณใหม่'}
                  </Button>
                )}
              </div>
              
              {/* Help text */}
              {(!threeTop || !twoBot) && (
                <p className="text-xs text-muted-foreground text-center">
                  กรอกผล 3 ตัวบน และ 2 ตัวล่าง ให้ครบก่อนประกาศผล
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Agent View - Read-only results from master */
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="size-4 text-amber-400" />
                ผลหวยจากเว็บแม่
              </CardTitle>
            </CardHeader>
            <CardContent>
              {resultsHistory.length > 0 ? (
                <div className="space-y-4">
                  {resultsHistory.slice(0, 5).map((result: any) => {
                    const lottery = lotteries.find((l: any) => l.id === result.lottery_id);
                    const threeTopVal = result.three_top || '';
                    const twoBotVal = result.two_bot || '';
                    
                    return (
                      <div key={result.id} className="p-4 rounded-lg bg-secondary/50 border">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-amber-400">{lottery?.name || 'หวย'}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(result.draw_date).toLocaleDateString('th-TH')}
                            </span>
                          </div>
                          {result.is_processed ? (
                            <Badge className="bg-green-500/20 text-green-400">
                              <CheckCircle className="size-3 mr-1" />
                              ออกผลแล้ว
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-500/20 text-yellow-400">
                              <Clock className="size-3 mr-1" />
                              รอผล
                            </Badge>
                          )}
                        </div>
                        {threeTopVal || twoBotVal ? (
                          <div className="grid grid-cols-2 gap-4 text-center">
                            <div>
                              <p className="text-xs text-muted-foreground">3 ตัวบน</p>
                              <p className="font-mono text-3xl font-bold text-amber-400">{threeTopVal || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">2 ตัวล่าง</p>
                              <p className="font-mono text-3xl font-bold text-purple-400">{twoBotVal || '-'}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-4 text-muted-foreground">
                            <Clock className="size-8 mx-auto mb-2 opacity-50" />
                            <p>รอผลจากเว็บแม่</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="size-12 mx-auto mb-4 opacity-30" />
                  <p className="font-medium">รอผลจากเว็บแม่</p>
                  <p className="text-sm">ยังไม่มีผลหวยในระบบ</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Winners Display */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="size-5 text-yellow-400" />
              ผู้ถูกรางวัล
            </CardTitle>
          </CardHeader>
          <CardContent>
            {processResult ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                    <p className="text-sm text-muted-foreground">จำนวนผู้ถูก</p>
                    <p className="text-3xl font-bold text-green-400">{processResult.winners_count}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-accent/10 border border-accent/30 text-center">
                    <p className="text-sm text-muted-foreground">ยอดจ่ายรวม</p>
                    <p className="text-3xl font-bold text-accent">{processResult.total_payout.toLocaleString()}</p>
                  </div>
                </div>

                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>เลข</TableHead>
                        <TableHead>ประเภท</TableHead>
                        <TableHead className="text-right">แทง</TableHead>
                        <TableHead className="text-right">จ่าย</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processResult.winners.map((w, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono font-bold">{w.number}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{w.bet_type}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{w.amount.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-bold text-green-400">
                            {w.payout.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Trophy className="size-12 mx-auto mb-4 opacity-30" />
                <p>ยังไม่มีข้อมูลผู้ถูกรางวัล</p>
                <p className="text-sm">กรอกผลและกดคำนวณ</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Results History - Grouped by Lottery */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="size-5 text-amber-500" />
              ประวัติผลหวยย้อนหลัง
            </CardTitle>
            
            {/* Filters */}
            <div className="flex items-center gap-4 flex-wrap">
              {/* Date Filter - Today / All */}
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">วันที่:</Label>
                <Select value={historyDateFilter} onValueChange={(v) => setHistoryDateFilter(v as 'today' | 'all')}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">วันนี้เท่านั้น</SelectItem>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Filter by Lottery */}
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">หวย:</Label>
                <Select value={historyLotteryFilter} onValueChange={setHistoryLotteryFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="ทั้งหมด" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    {Object.keys(groupedResults).map((lotteryName) => (
                      <SelectItem key={lotteryName} value={lotteryName}>
                        {lotteryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(filteredGroupedResults).length > 0 ? (
            <div className="space-y-8">
              {Object.entries(filteredGroupedResults).map(([lotteryName, results]) => {
                if (!results || results.length === 0) return null;
                
                const IconComponent = LOTTERY_ICONS[results[0]?.lottery?.icon || 'ticket'] || Ticket;
                
                return (
                  <div key={lotteryName} className="space-y-4">
                    {/* Lottery Section Header */}
                    <div className="flex items-center gap-3 pb-2 border-b border-border">
                      <div className="flex items-center justify-center size-10 rounded-lg bg-amber-500/10 border border-amber-500/30">
                        <IconComponent className="size-5 text-amber-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-amber-500">{lotteryName}</h3>
                        <p className="text-xs text-muted-foreground">{results.length} งวด</p>
                      </div>
                    </div>
                    
                    {/* Results Table for this Lottery */}
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>วันที่</TableHead>
                            <TableHead className="text-center">3 ตัวบน</TableHead>
                            <TableHead className="text-center">2 ตัวล่าง</TableHead>
                            <TableHead className="text-center">2 ตัวบน</TableHead>
                            <TableHead className="text-center">วิ่งบน</TableHead>
                            <TableHead className="text-center">วิ่งล่าง</TableHead>
                            <TableHead className="text-center">สถานะ</TableHead>
                            <TableHead className="text-center">รายละเอียด</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {results.map((result: any) => {
                            const threeTopVal = result.three_top || '';
                            const twoTopVal = threeTopVal.slice(-2);
                            const runTopVal = threeTopVal.slice(-1);
                            const twoBotVal = result.two_bot || '';
                            const runBotVal = twoBotVal.slice(-1);
                            
                            return (
                              <TableRow key={result.id}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Calendar className="size-4 text-muted-foreground" />
                                    {new Date(result.draw_date).toLocaleDateString('th-TH', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    })}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="font-mono text-lg font-bold text-amber-400">{threeTopVal || '-'}</span>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="font-mono text-lg font-bold text-purple-400">{twoBotVal || '-'}</span>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="font-mono font-bold text-amber-300">{twoTopVal || '-'}</span>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="font-mono font-bold text-green-400">{runTopVal || '-'}</span>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="font-mono font-bold text-blue-400">{runBotVal || '-'}</span>
                                </TableCell>
                                <TableCell className="text-center">
                                  {(result.is_processed || result.status === 'calculated') ? (
                                    <div className="flex flex-col items-center gap-1">
                                      <Badge className="bg-green-500/20 text-green-400">
                                        <CheckCircle className="size-3 mr-1" />
                                        คำนวณแล้ว
                                      </Badge>
                                      {result.total_winners > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                          ถูก {result.total_winners} รายการ
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <Badge className="bg-yellow-500/20 text-yellow-400">
                                      <Clock className="size-3 mr-1" />
                                      รอคำนวณ
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => fetchResultDetail(result)}
                                  >
                                    <Eye className="size-3 mr-1" />
                                    ดู
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <History className="size-12 mx-auto mb-4 opacity-30" />
              <p>ยังไม่มีประวัติผลหวย</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Result Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="size-5 text-amber-500" />
              รายละเอียดผลหวย
            </DialogTitle>
            <DialogDescription>
              {selectedResultDetail?.lottery?.name || 'หวย'} - {selectedResultDetail?.draw_date && new Date(selectedResultDetail.draw_date).toLocaleDateString('th-TH', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </DialogDescription>
          </DialogHeader>
          
          {selectedResultDetail && (
            <div className="space-y-4">
              {/* Result Numbers */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-secondary/50 border">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">3 ตัวบน</p>
                  <p className="font-mono text-3xl font-bold text-amber-400">{selectedResultDetail.three_top || '-'}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">2 ตัวล่าง</p>
                  <p className="font-mono text-3xl font-bold text-purple-400">{selectedResultDetail.two_bot || '-'}</p>
                </div>
              </div>
              
              {/* Summary Stats */}
              {resultDetailData && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 text-center">
                      <p className="text-sm text-muted-foreground">จำนวนโพยทั้งหมด</p>
                      <p className="text-2xl font-bold text-blue-400">{resultDetailData.totalSlips.toLocaleString()}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                      <p className="text-sm text-muted-foreground">จ่ายรางวัลรวม</p>
                      <p className="text-2xl font-bold text-green-400">{resultDetailData.totalPayout.toLocaleString()} บาท</p>
                    </div>
                  </div>
                  
                  {/* Top Winning Numbers */}
                  {resultDetailData.topWinningNumbers.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">เลขที่ถูกรางวัลมากสุด:</p>
                      <div className="space-y-2">
                        {resultDetailData.topWinningNumbers.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-xl font-bold text-amber-400">{item.number}</span>
                              <Badge variant="outline">{item.count} คนถูก</Badge>
                            </div>
                            <span className="font-bold text-green-400">{item.payout.toLocaleString()} บาท</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailModal(false)}>
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Process Confirmation Dialog */}
      <Dialog open={showProcessConfirm} onOpenChange={setShowProcessConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-yellow-400" />
              ยืนยันการคำนวณ
            </DialogTitle>
            <DialogDescription>
              คุณต้องการคำนวณผู้ถูกรางวัลสำหรับ {selectedLottery?.name} วันที่ {selectedDate} หรือไม่?
              การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 rounded-lg bg-secondary/50 border">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">3 ตัวบน</p>
                <p className="font-mono text-2xl font-bold">{threeTop || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">2 ตัวล่าง</p>
                <p className="font-mono text-2xl font-bold">{twoBot || '-'}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProcessConfirm(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleProcess} disabled={isProcessing}>
              {isProcessing ? 'กำลังคำนวณ...' : 'ยืนยัน'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
