'use client';

import { useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart3,
  Search,
  RefreshCw,
  Download,
  Printer,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Hash,
  Banknote,
  Target,
  Crown,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Lottery } from '@/lib/lottery-utils';
import { BET_TYPE_LABELS } from '@/types/lottery';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface NumberData {
  number: string;
  count: number;
  totalAmount: number;
  potentialPayout: number;
  profitLoss: number;
  byBetType: Record<string, { count: number; amount: number }>;
}

interface AnalysisData {
  numbers: NumberData[];
  summary: {
    grandTotal: number;
    totalEntries: number;
    numbersWithEntries: number;
    numbersWithoutEntries: number;
    topNumber: { number: string; amount: number } | null;
    highestRisk: { number: string; payout: number } | null;
    worstProfitLoss: { number: string; profitLoss: number } | null;
  };
  rates: Record<string, number>;
}

const BET_TYPE_OPTIONS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: '2top', label: '2 ตัวบน' },
  { value: '2bot', label: '2 ตัวล่าง' },
  { value: '2flip', label: '2 ตัวกลับ' },
  { value: '3top', label: '3 ตัวตรง' },
  { value: '3tod', label: '3 ตัวโต๊ด' },
  { value: '3flip', label: '3 ตัวกลับ' },
];

export default function AnalysisPage() {
  const [selectedLotteryId, setSelectedLotteryId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [digitType, setDigitType] = useState<'2' | '3'>('2');
  const [betTypeFilter, setBetTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'amount' | 'payout' | 'profit'>('amount');
  const [page3Digit, setPage3Digit] = useState(1);
  const itemsPerPage = 100;

  // Fetch lotteries
  const { data: lotteries = [] } = useSWR<Lottery[]>('/api/lotteries', fetcher);

  // Build analysis URL
  const analysisUrl = useMemo(() => {
    if (!selectedLotteryId) return null;
    const params = new URLSearchParams({
      lottery_id: selectedLotteryId,
      date: selectedDate,
      digit_type: digitType,
    });
    if (betTypeFilter !== 'all') {
      params.set('bet_type', betTypeFilter);
    }
    return `/api/analysis?${params.toString()}`;
  }, [selectedLotteryId, selectedDate, digitType, betTypeFilter]);

  // Fetch analysis data
  const { data: analysisData, isLoading, mutate } = useSWR<AnalysisData>(
    analysisUrl,
    fetcher,
    { refreshInterval: 30000 }
  );

  // Generate all numbers for display (including zeros)
  const allNumbers = useMemo(() => {
    const total = digitType === '2' ? 100 : 1000;
    const dataMap = new Map(
      (analysisData?.numbers || []).map(n => [n.number, n])
    );

    const result: NumberData[] = [];
    for (let i = 0; i < total; i++) {
      const numStr = i.toString().padStart(digitType === '2' ? 2 : 3, '0');
      const existing = dataMap.get(numStr);
      if (existing) {
        result.push(existing);
      } else {
        result.push({
          number: numStr,
          count: 0,
          totalAmount: 0,
          potentialPayout: 0,
          profitLoss: analysisData?.summary?.grandTotal || 0,
          byBetType: {},
        });
      }
    }
    return result;
  }, [analysisData, digitType]);

  // Filter and sort numbers
  const filteredNumbers = useMemo(() => {
    let filtered = allNumbers;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(n => n.number.includes(searchQuery));
    }

    // Apply sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          return b.totalAmount - a.totalAmount;
        case 'payout':
          return b.potentialPayout - a.potentialPayout;
        case 'profit':
          return a.profitLoss - b.profitLoss; // Lower profit = higher risk
        default:
          return 0;
      }
    });

    return filtered;
  }, [allNumbers, searchQuery, sortBy]);

  // Pagination for 3-digit numbers
  const paginatedNumbers = useMemo(() => {
    if (digitType === '2') return filteredNumbers;
    const start = (page3Digit - 1) * itemsPerPage;
    return filteredNumbers.slice(start, start + itemsPerPage);
  }, [filteredNumbers, digitType, page3Digit]);

  const totalPages = Math.ceil(filteredNumbers.length / itemsPerPage);

  // Get top 10 numbers
  const top10Numbers = useMemo(() => {
    return [...(analysisData?.numbers || [])]
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);
  }, [analysisData]);

  // Export CSV
  const exportCSV = useCallback(() => {
    const headers = ['เลข', 'จำนวนรายการ', 'ยอดรวม', 'ยอดจ่ายประมาณ', 'กำไร/ขาดทุน'];
    const rows = filteredNumbers.map(n => [
      n.number,
      n.count,
      n.totalAmount,
      n.potentialPayout.toFixed(2),
      n.profitLoss.toFixed(2),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analysis_${digitType}digit_${selectedDate}.csv`;
    link.click();
  }, [filteredNumbers, digitType, selectedDate]);

  // Print
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const selectedLottery = lotteries.find(l => l.id === selectedLotteryId);
  const summary = analysisData?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="size-6 text-accent" />
            วิเคราะห์ยอดเลข
          </h1>
          <p className="text-muted-foreground">
            ดูยอดรวมและความเสี่ยงของแต่ละเลข
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            <RefreshCw className="size-4 mr-1" />
            รีเฟรช
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="size-4 mr-1" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="size-4 mr-1" />
            พิมพ์
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Lottery Select */}
            <div className="col-span-2 md:col-span-1">
              <label className="text-sm text-muted-foreground mb-1 block">หวย</label>
              <Select value={selectedLotteryId} onValueChange={setSelectedLotteryId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกหวย" />
                </SelectTrigger>
                <SelectContent>
                  {lotteries.map(lottery => (
                    <SelectItem key={lottery.id} value={lottery.id}>
                      {lottery.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">วันที่</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>

            {/* Bet Type Filter */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">ประเภท</label>
              <Select value={betTypeFilter} onValueChange={setBetTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BET_TYPE_OPTIONS.filter(opt => 
                    digitType === '2' 
                      ? ['all', '2top', '2bot', '2flip'].includes(opt.value)
                      : ['all', '3top', '3tod', '3flip'].includes(opt.value)
                  ).map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">เรียงตาม</label>
              <Select value={sortBy} onValueChange={(v: 'amount' | 'payout' | 'profit') => setSortBy(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amount">ยอดแทงสูงสุด</SelectItem>
                  <SelectItem value="payout">ยอดจ่ายสูงสุด</SelectItem>
                  <SelectItem value="profit">ขาดทุนมากสุด</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">ค้นหาเลข</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหา..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedLotteryId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="size-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">กรุณาเลือกหวยเพื่อดูการวิเคราะห์</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/30">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Banknote className="size-4" />
                  ยอดรวมทั้งหมด
                </div>
                <p className="text-2xl font-bold text-accent">
                  {(summary?.grandTotal || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Crown className="size-4 text-yellow-500" />
                  เลขยอดสูงสุด
                </div>
                <p className="text-2xl font-bold font-mono">
                  {summary?.topNumber?.number || '-'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(summary?.topNumber?.amount || 0).toLocaleString()} บาท
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/30">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <AlertTriangle className="size-4 text-red-500" />
                  ยอดจ่ายเสี่ยงสูงสุด
                </div>
                <p className="text-2xl font-bold font-mono text-red-500">
                  {summary?.highestRisk?.number || '-'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(summary?.highestRisk?.payout || 0).toLocaleString()} บาท
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/30">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <TrendingDown className="size-4 text-red-500" />
                  ขาดทุนแย่สุด
                </div>
                <p className="text-2xl font-bold font-mono text-red-500">
                  {summary?.worstProfitLoss?.number || '-'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(summary?.worstProfitLoss?.profitLoss || 0).toLocaleString()} บาท
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/30">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Hash className="size-4 text-green-500" />
                  เลขมียอด
                </div>
                <p className="text-2xl font-bold text-green-500">
                  {summary?.numbersWithEntries || 0}
                </p>
                <p className="text-xs text-muted-foreground">รายการ</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Target className="size-4" />
                  เลขไม่มียอด
                </div>
                <p className="text-2xl font-bold text-muted-foreground">
                  {summary?.numbersWithoutEntries || 0}
                </p>
                <p className="text-xs text-muted-foreground">เลข</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs for 2-digit and 3-digit */}
          <Tabs value={digitType} onValueChange={(v) => { setDigitType(v as '2' | '3'); setPage3Digit(1); setBetTypeFilter('all'); }}>
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="2">เลข 2 ตัว (00-99)</TabsTrigger>
              <TabsTrigger value="3">เลข 3 ตัว (000-999)</TabsTrigger>
            </TabsList>

            <TabsContent value="2" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    ตารางเลข 2 ตัว ({filteredNumbers.length} เลข)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                    {filteredNumbers.map((item, index) => {
                      const isTop10 = top10Numbers.some(t => t.number === item.number) && item.totalAmount > 0;
                      const isHighRisk = item.profitLoss < 0 && item.totalAmount > 0;
                      const isEmpty = item.totalAmount === 0;

                      return (
                        <div
                          key={item.number}
                          className={cn(
                            "p-2 rounded-lg border text-center transition-all hover:scale-105 cursor-pointer",
                            isEmpty && "bg-muted/30 border-muted text-muted-foreground",
                            isTop10 && !isEmpty && "bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border-yellow-500/50",
                            isHighRisk && !isTop10 && "bg-gradient-to-br from-red-500/20 to-red-500/10 border-red-500/50",
                            !isEmpty && !isTop10 && !isHighRisk && "bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/30"
                          )}
                        >
                          <p className={cn(
                            "font-mono font-bold text-lg",
                            isTop10 && "text-yellow-500",
                            isHighRisk && !isTop10 && "text-red-500"
                          )}>
                            {item.number}
                          </p>
                          <p className="text-xs truncate">
                            {item.totalAmount > 0 ? item.totalAmount.toLocaleString() : '-'}
                          </p>
                          {item.count > 0 && (
                            <p className="text-[10px] text-muted-foreground">{item.count} รายการ</p>
                          )}
                          {isTop10 && item.totalAmount > 0 && (
                            <Badge className="text-[9px] px-1 py-0 bg-yellow-500/20 text-yellow-500 border-yellow-500/30 mt-1">
                              TOP
                            </Badge>
                          )}
                          {isHighRisk && !isTop10 && (
                            <Badge variant="destructive" className="text-[9px] px-1 py-0 mt-1">
                              เสี่ยง
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="3" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      ตารางเลข 3 ตัว ({filteredNumbers.length} เลข)
                    </CardTitle>
                    {/* Pagination */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage3Digit(p => Math.max(1, p - 1))}
                        disabled={page3Digit === 1}
                      >
                        <ChevronLeft className="size-4" />
                      </Button>
                      <span className="text-sm">
                        หน้า {page3Digit} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage3Digit(p => Math.min(totalPages, p + 1))}
                        disabled={page3Digit === totalPages}
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">เลข</TableHead>
                          <TableHead className="text-right">รายการ</TableHead>
                          <TableHead className="text-right">ยอดรวม</TableHead>
                          <TableHead className="text-right">ยอดจ่ายประมาณ</TableHead>
                          <TableHead className="text-right">กำไร/ขาดทุน</TableHead>
                          <TableHead className="w-24">สถานะ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedNumbers.map((item, index) => {
                          const isTop10 = top10Numbers.some(t => t.number === item.number) && item.totalAmount > 0;
                          const isHighRisk = item.profitLoss < 0 && item.totalAmount > 0;
                          const isEmpty = item.totalAmount === 0;

                          return (
                            <TableRow 
                              key={item.number}
                              className={cn(
                                isEmpty && "text-muted-foreground",
                                isTop10 && "bg-yellow-500/10",
                                isHighRisk && !isTop10 && "bg-red-500/10"
                              )}
                            >
                              <TableCell className="font-mono font-bold text-lg">
                                {item.number}
                              </TableCell>
                              <TableCell className="text-right">
                                {item.count || '-'}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {item.totalAmount > 0 ? item.totalAmount.toLocaleString() : '-'}
                              </TableCell>
                              <TableCell className="text-right font-mono text-red-500">
                                {item.potentialPayout > 0 ? item.potentialPayout.toLocaleString() : '-'}
                              </TableCell>
                              <TableCell className={cn(
                                "text-right font-mono",
                                item.profitLoss >= 0 ? "text-green-500" : "text-red-500"
                              )}>
                                {item.totalAmount > 0 ? item.profitLoss.toLocaleString() : '-'}
                              </TableCell>
                              <TableCell>
                                {isTop10 && (
                                  <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                                    TOP 10
                                  </Badge>
                                )}
                                {isHighRisk && !isTop10 && (
                                  <Badge variant="destructive">เสี่ยงสูง</Badge>
                                )}
                                {isEmpty && (
                                  <Badge variant="outline" className="text-muted-foreground">
                                    ไม่มียอด
                                  </Badge>
                                )}
                                {!isEmpty && !isTop10 && !isHighRisk && (
                                  <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                                    ปกติ
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Top 10 Summary */}
          {top10Numbers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Crown className="size-5 text-yellow-500" />
                  Top 10 เลขยอดสูงสุด
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {top10Numbers.map((item, index) => (
                    <div
                      key={item.number}
                      className={cn(
                        "p-4 rounded-xl border text-center",
                        index === 0 && "bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border-yellow-500/50",
                        index === 1 && "bg-gradient-to-br from-slate-400/20 to-slate-400/10 border-slate-400/50",
                        index === 2 && "bg-gradient-to-br from-amber-700/20 to-amber-700/10 border-amber-700/50",
                        index > 2 && "bg-secondary/50"
                      )}
                    >
                      <div className="text-xs text-muted-foreground mb-1">
                        อันดับ {index + 1}
                      </div>
                      <p className={cn(
                        "font-mono font-bold text-2xl",
                        index === 0 && "text-yellow-500",
                        index === 1 && "text-slate-400",
                        index === 2 && "text-amber-700"
                      )}>
                        {item.number}
                      </p>
                      <p className="text-lg font-bold text-accent mt-1">
                        {item.totalAmount.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.count} รายการ
                      </p>
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <p className="text-xs text-red-400">
                          ยอดจ่าย: {item.potentialPayout.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
