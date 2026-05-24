'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Input } from '@/components/ui/input';
import { useEntries, type Entry } from '@/hooks/use-lottery';
import { BET_TYPE_LABELS, BET_TYPE_COLORS, type BetType } from '@/types/lottery';
import { Ticket, Search, TrendingUp, Hash, Loader2, FileText } from 'lucide-react';

interface Lottery {
  id: string;
  name: string;
  is_active: boolean;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function LotterySummaryPage() {
  const { entries, isLoading: entriesLoading } = useEntries();
  const { data: lotteries = [], isLoading: lotteriesLoading } = useSWR<Lottery[]>('/api/lotteries', fetcher);
  
  const [selectedLotteryId, setSelectedLotteryId] = useState<string>('all');
  const [searchNumber, setSearchNumber] = useState('');
  const [selectedBetType, setSelectedBetType] = useState<string>('all');

  const isLoading = entriesLoading || lotteriesLoading;

  // Filter entries by lottery
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      if (selectedLotteryId !== 'all' && entry.lottery_id !== selectedLotteryId) return false;
      if (selectedBetType !== 'all' && entry.bet_type !== selectedBetType) return false;
      if (searchNumber && !entry.number.includes(searchNumber)) return false;
      return true;
    });
  }, [entries, selectedLotteryId, selectedBetType, searchNumber]);

  // Summary by lottery
  const summaryByLottery = useMemo(() => {
    const summary: Record<string, { name: string; total: number; count: number }> = {};
    
    entries.forEach(entry => {
      const lotteryId = entry.lottery_id || 'none';
      const lotteryName = entry.lottery?.name || 'ไม่ระบุ';
      
      if (!summary[lotteryId]) {
        summary[lotteryId] = { name: lotteryName, total: 0, count: 0 };
      }
      summary[lotteryId].total += entry.amount;
      summary[lotteryId].count += 1;
    });
    
    return Object.entries(summary)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([id, data]) => ({ id, ...data }));
  }, [entries]);

  // Summary by number (grouped)
  const summaryByNumber = useMemo(() => {
    const summary: Record<string, Record<string, number>> = {};
    
    filteredEntries.forEach(entry => {
      if (!summary[entry.number]) {
        summary[entry.number] = {};
      }
      if (!summary[entry.number][entry.bet_type]) {
        summary[entry.number][entry.bet_type] = 0;
      }
      summary[entry.number][entry.bet_type] += entry.amount;
    });
    
    return Object.entries(summary)
      .map(([number, betTypes]) => {
        const total = Object.values(betTypes).reduce((a, b) => a + b, 0);
        return { number, betTypes, total };
      })
      .sort((a, b) => b.total - a.total);
  }, [filteredEntries]);

  // Total for filtered entries
  const totalFiltered = useMemo(() => {
    return filteredEntries.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredEntries]);

  const handlePrint = () => {
    const lottery = lotteries.find(l => l.id === selectedLotteryId);
    const lotteryName = selectedLotteryId === 'all' ? 'ทุกหวย' : lottery?.name || 'ไม่ระบุ';
    
    const printContent = `
      <html>
        <head>
          <title>สรุปยอดตามหวย - ${lotteryName}</title>
          <style>
            body { font-family: 'Sarabun', sans-serif; padding: 20px; }
            h1 { text-align: center; margin-bottom: 5px; }
            h2 { text-align: center; color: #666; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f5f5f5; }
            .amount { text-align: right; font-family: monospace; }
            .total-row { font-weight: bold; background: #f0f0f0; }
          </style>
        </head>
        <body>
          <h1>สลากพลัส Lotto</h1>
          <h2>สรุปยอดตามหวย - ${lotteryName}</h2>
          <p>วันที่: ${new Date().toLocaleDateString('th-TH')}</p>
          <table>
            <thead>
              <tr>
                <th>เลข</th>
                <th>3 บน</th>
                <th>3 โต๊ด</th>
                <th>2 บน</th>
                <th>2 ล่าง</th>
                <th>วิ่งบน</th>
                <th>วิ่งล่าง</th>
                <th class="amount">รวม</th>
              </tr>
            </thead>
            <tbody>
              ${summaryByNumber.map(row => `
                <tr>
                  <td><strong>${row.number}</strong></td>
                  <td class="amount">${row.betTypes['3top']?.toLocaleString() || '-'}</td>
                  <td class="amount">${row.betTypes['3tod']?.toLocaleString() || '-'}</td>
                  <td class="amount">${row.betTypes['2top']?.toLocaleString() || '-'}</td>
                  <td class="amount">${row.betTypes['2bot']?.toLocaleString() || '-'}</td>
                  <td class="amount">${row.betTypes['1top']?.toLocaleString() || '-'}</td>
                  <td class="amount">${row.betTypes['1bot']?.toLocaleString() || '-'}</td>
                  <td class="amount"><strong>${row.total.toLocaleString()}</strong></td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="7">รวมทั้งหมด</td>
                <td class="amount">${totalFiltered.toLocaleString()} บาท</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="size-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Ticket className="size-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">สรุปยอดตามหวย</h1>
            <p className="text-sm text-muted-foreground">
              รวมยอดตามประเภทหวยและเลข
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handlePrint} className="gap-2">
          <FileText className="size-4" />
          พิมพ์รายงาน
        </Button>
      </div>

      {/* Summary by Lottery */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        {summaryByLottery.slice(0, 6).map((lottery) => (
          <Card 
            key={lottery.id} 
            className={`cursor-pointer transition-all ${selectedLotteryId === lottery.id ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
            onClick={() => setSelectedLotteryId(lottery.id === selectedLotteryId ? 'all' : lottery.id)}
          >
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground truncate">{lottery.name}</div>
              <div className="text-lg font-bold text-primary">{lottery.total.toLocaleString()}฿</div>
              <div className="text-xs text-muted-foreground">{lottery.count} รายการ</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Select value={selectedLotteryId} onValueChange={setSelectedLotteryId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกประเภทหวย" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกหวย</SelectItem>
                  <SelectItem value="none">ไม่ระบุ</SelectItem>
                  {lotteries.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Select value={selectedBetType} onValueChange={setSelectedBetType}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกประเภทเดิมพัน" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกประเภท</SelectItem>
                  <SelectItem value="3top">3 ตัวบน</SelectItem>
                  <SelectItem value="3tod">3 ตัวโต๊ด</SelectItem>
                  <SelectItem value="2top">2 ตัวบน</SelectItem>
                  <SelectItem value="2bot">2 ตัวล่าง</SelectItem>
                  <SelectItem value="1top">วิ่งบน</SelectItem>
                  <SelectItem value="1bot">วิ่งล่าง</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาเลข..."
                value={searchNumber}
                onChange={(e) => setSearchNumber(e.target.value.replace(/\D/g, ''))}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-3">
        <Card className="bg-gradient-to-br from-primary/20 to-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-5 text-primary" />
              <span className="text-sm text-muted-foreground">ยอดรวม</span>
            </div>
            <div className="text-2xl font-bold text-primary">
              {totalFiltered.toLocaleString()}฿
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Hash className="size-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">เลขทั้งหมด</span>
            </div>
            <div className="text-2xl font-bold">
              {summaryByNumber.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="size-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">รายการ</span>
            </div>
            <div className="text-2xl font-bold">
              {filteredEntries.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="size-5" />
            สรุปยอดตามเลข ({summaryByNumber.length} เลข)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">เลข</TableHead>
                  <TableHead className="text-right">3 บน</TableHead>
                  <TableHead className="text-right">3 โต๊ด</TableHead>
                  <TableHead className="text-right">2 บน</TableHead>
                  <TableHead className="text-right">2 ล่าง</TableHead>
                  <TableHead className="text-right">วิ่งบน</TableHead>
                  <TableHead className="text-right">วิ่งล่าง</TableHead>
                  <TableHead className="text-right">รวม</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryByNumber.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      ไม่พบข้อมูล
                    </TableCell>
                  </TableRow>
                ) : (
                  summaryByNumber.map((row, i) => (
                    <TableRow key={row.number} className={i < 3 ? 'bg-accent/5' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {i < 3 && (
                            <Badge variant="secondary" className={
                              i === 0 ? 'bg-yellow-500/20 text-yellow-600' :
                              i === 1 ? 'bg-gray-400/20 text-gray-600' :
                              'bg-orange-500/20 text-orange-600'
                            }>
                              #{i + 1}
                            </Badge>
                          )}
                          <span className="font-mono font-bold text-lg">{row.number}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.betTypes['3top']?.toLocaleString() || '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.betTypes['3tod']?.toLocaleString() || '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.betTypes['2top']?.toLocaleString() || '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.betTypes['2bot']?.toLocaleString() || '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.betTypes['1top']?.toLocaleString() || '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.betTypes['1bot']?.toLocaleString() || '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-primary">
                        {row.total.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
