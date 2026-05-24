'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { useEntries, type Entry } from '@/hooks/use-lottery';
import { BET_TYPE_LABELS, BET_TYPE_COLORS, type BetType } from '@/types/lottery';
import { Calculator, Search, TrendingUp, Loader2, RefreshCw, FileText } from 'lucide-react';

const betTypes: BetType[] = ['3top', '3tod', '2top', '2bot', '1top', '1bot'];

interface NumberSummary {
  number: string;
  betType: BetType;
  totalAmount: number;
  count: number;
}

export default function SummaryPage() {
  const { entries, isLoading, mutate } = useEntries();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<BetType | 'all'>('all');
  const [highlightThreshold, setHighlightThreshold] = useState(1000);

  // Generate summaries from API entries
  const summaries = useMemo<NumberSummary[]>(() => {
    const safeEntries = Array.isArray(entries) ? entries : [];
    const summaryMap: Record<string, NumberSummary> = {};
    
    safeEntries.forEach((entry) => {
      const key = `${entry.number}-${entry.bet_type}`;
      if (!summaryMap[key]) {
        summaryMap[key] = {
          number: entry.number,
          betType: entry.bet_type as BetType,
          totalAmount: 0,
          count: 0,
        };
      }
      summaryMap[key].totalAmount += Number(entry.amount) || 0;
      summaryMap[key].count += 1;
    });
    
    return Object.values(summaryMap).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [entries]);

  const filteredSummaries = useMemo(() => {
    let result = summaries;

    if (search.trim()) {
      result = result.filter((s) => s.number.includes(search));
    }

    if (filterType !== 'all') {
      result = result.filter((s) => s.betType === filterType);
    }

    return result;
  }, [summaries, search, filterType]);

  const totalAmount = useMemo(
    () => filteredSummaries.reduce((sum, s) => sum + s.totalAmount, 0),
    [filteredSummaries]
  );

  const totalCount = useMemo(
    () => filteredSummaries.reduce((sum, s) => sum + s.count, 0),
    [filteredSummaries]
  );

  const handlePrint = () => {
    const printContent = `
      <html>
        <head>
          <title>สรุปยอดตามเลข</title>
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
          <h2>สรุปยอดตามเลข</h2>
          <p>วันที่: ${new Date().toLocaleDateString('th-TH')}</p>
          <table>
            <thead>
              <tr>
                <th>อันดับ</th>
                <th>เลข</th>
                <th>ประเภท</th>
                <th>จำนวนครั้ง</th>
                <th class="amount">ยอดรวม</th>
              </tr>
            </thead>
            <tbody>
              ${filteredSummaries.map((s, i) => `
                <tr>
                  <td>#${i + 1}</td>
                  <td><strong>${s.number}</strong></td>
                  <td>${BET_TYPE_LABELS[s.betType] || s.betType}</td>
                  <td>${s.count} ครั้ง</td>
                  <td class="amount">${s.totalAmount.toLocaleString()} บาท</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="4">รวมทั้งหมด (${filteredSummaries.length} เลข, ${totalCount} รายการ)</td>
                <td class="amount">${totalAmount.toLocaleString()} บาท</td>
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
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calculator className="size-6" />
            สรุปยอดตามเลข
          </h1>
          <p className="text-muted-foreground">
            รวมเลขซ้ำอัตโนมัติ แสดงยอดรวมของแต่ละเลข (ข้อมูลจาก Database)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            <RefreshCw className="size-4 mr-1" />
            รีเฟรช
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <FileText className="size-4 mr-1" />
            พิมพ์
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-muted-foreground text-sm">เลขทั้งหมด</p>
              <p className="text-3xl font-bold text-primary">{filteredSummaries.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-muted-foreground text-sm">รายการทั้งหมด</p>
              <p className="text-3xl font-bold">{totalCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-muted-foreground text-sm">ยอดรวม</p>
              <p className="text-3xl font-bold text-accent">{totalAmount.toLocaleString()}฿</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-muted-foreground text-sm">เลขยอดสูงสุด</p>
              <p className="text-3xl font-bold font-mono">{filteredSummaries[0]?.number || '-'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Search className="size-4" />
                ค้นหาเลข
              </Label>
              <Input
                placeholder="ค้นหาเลข..."
                value={search}
                onChange={(e) => setSearch(e.target.value.replace(/\D/g, ''))}
                maxLength={3}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>ประเภท</Label>
              <Select value={filterType} onValueChange={(v) => setFilterType(v as BetType | 'all')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {betTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {BET_TYPE_LABELS[type] || type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <TrendingUp className="size-4" />
                ไฮไลต์ยอดสูงกว่า
              </Label>
              <Input
                type="number"
                value={highlightThreshold}
                onChange={(e) => setHighlightThreshold(parseInt(e.target.value) || 0)}
                className="font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>รายการเลขทั้งหมด</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSummaries.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">อันดับ</TableHead>
                    <TableHead>เลข</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead className="text-center">จำนวนครั้ง</TableHead>
                    <TableHead className="text-right">ยอดรวม</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSummaries.map((summary, index) => {
                    const isHighlighted = summary.totalAmount >= highlightThreshold;
                    const colorClass = BET_TYPE_COLORS[summary.betType] || 'bg-gray-500';
                    return (
                      <TableRow
                        key={`${summary.number}-${summary.betType}`}
                        className={isHighlighted ? 'bg-accent/10' : ''}
                      >
                        <TableCell className="font-mono text-muted-foreground">
                          #{index + 1}
                        </TableCell>
                        <TableCell>
                          <span className={`font-mono font-bold text-2xl ${isHighlighted ? 'text-accent' : ''}`}>
                            {summary.number}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${colorClass} text-white`}>
                            {BET_TYPE_LABELS[summary.betType] || summary.betType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{summary.count} ครั้ง</Badge>
                        </TableCell>
                        <TableCell className={`text-right font-mono font-bold text-lg ${isHighlighted ? 'text-accent' : 'text-primary'}`}>
                          {summary.totalAmount.toLocaleString()}฿
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
              <Calculator className="size-12 mb-4 opacity-50" />
              <p>ไม่พบข้อมูล</p>
              <p className="text-sm">ยังไม่มีรายการแทงในระบบ</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
