'use client';

import { useState, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useLotteryStore } from '@/hooks/use-lottery-store';
import { useAuth } from '@/hooks/use-auth';
import { BET_TYPE_LABELS, BET_TYPE_COLORS, type BetType } from '@/types/lottery';
import { List, Search, Filter, Download, Printer, Trash2, ArrowUpDown, FileText, Receipt, Loader2 } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const betTypes: BetType[] = ['2top', '2bot', '3top', '3tod', '1top', '1bot'];

type SortField = 'created_at' | 'amount' | 'number';
type SortOrder = 'asc' | 'desc';

interface DBEntry {
  id: string;
  number: string;
  bet_type: BetType;
  amount: number;
  customer_id?: string;
  customer_name?: string;
  status: string;
  created_at: string;
  lottery?: { id: string; name: string };
  customer?: { name: string; phone?: string };
}

export default function EntriesPage() {
  const { settings } = useLotteryStore();
  const { isAdmin, isSuperAdmin } = useAuth();
  
  // Permission helper - admin and super_admin can do everything
  const canAccess = (permission: string) => isAdmin || isSuperAdmin;
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<BetType | 'all'>('all');
  const [filterDate, setFilterDate] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [groupByLottery, setGroupByLottery] = useState(true); // default group by lottery
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch entries from database
  const { data, isLoading, mutate } = useSWR<DBEntry[] | { entries: DBEntry[] }>(
    `/api/entries?limit=500`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const entries = Array.isArray(data) ? data : (data?.entries || []);

  const filteredEntries = useMemo(() => {
    let result = [...entries];

    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.number.includes(s) ||
          (e.customer_name || '').toLowerCase().includes(s) ||
          (e.customer?.name || '').toLowerCase().includes(s)
      );
    }

    if (filterType !== 'all') {
      result = result.filter((e) => e.bet_type === filterType);
    }

    if (filterDate) {
      result = result.filter((e) => e.created_at.startsWith(filterDate));
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'created_at') {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortField === 'amount') {
        cmp = a.amount - b.amount;
      } else if (sortField === 'number') {
        cmp = a.number.localeCompare(b.number);
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [entries, search, filterType, filterDate, sortField, sortOrder]);

  const totalAmount = useMemo(
    () => filteredEntries.reduce((sum, e) => sum + e.amount, 0),
    [filteredEntries]
  );

  // Group entries by lottery
  const groupedByLottery = useMemo(() => {
    if (!groupByLottery) return null;
    
    const groups: Record<string, { 
      lotteryId: string; 
      lotteryName: string; 
      entries: DBEntry[]; 
      totalAmount: number;
      entryCount: number;
    }> = {};
    
    filteredEntries.forEach((entry) => {
      const lotteryId = entry.lottery?.id || 'unknown';
      const lotteryName = entry.lottery?.name || 'ไม่ระบุหวย';
      
      if (!groups[lotteryId]) {
        groups[lotteryId] = {
          lotteryId,
          lotteryName,
          entries: [],
          totalAmount: 0,
          entryCount: 0,
        };
      }
      
      groups[lotteryId].entries.push(entry);
      groups[lotteryId].totalAmount += entry.amount;
      groups[lotteryId].entryCount += 1;
    });
    
    return Object.values(groups).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredEntries, groupByLottery]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleExportCSV = () => {
    const headers = ['เลข', 'ประเภท', 'ยอด', 'ชื่อลูกค้า', 'หวย', 'สถานะ', 'วันที่'];
    const rows = filteredEntries.map((e) => [
      e.number,
      BET_TYPE_LABELS[e.bet_type],
      e.amount.toString(),
      e.customer?.name || e.customer_name || '-',
      e.lottery?.name || '-',
      e.status,
      new Date(e.created_at).toLocaleString('th-TH'),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `salakplus-entries-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success('ส่งออก CSV สำเร็จ');
  };

  const handlePrintBill = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const groupedByType: Record<string, typeof filteredEntries> = {};
    filteredEntries.forEach((e) => {
      if (!groupedByType[e.bet_type]) {
        groupedByType[e.bet_type] = [];
      }
      groupedByType[e.bet_type].push(e);
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>บิลสลากพลัส</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Sarabun', sans-serif; 
              padding: 20px;
              max-width: 400px;
              margin: 0 auto;
              background: white;
              color: black;
            }
            .header { 
              text-align: center; 
              border-bottom: 2px dashed #333; 
              padding-bottom: 15px; 
              margin-bottom: 15px;
            }
            .logo { font-size: 24px; font-weight: 700; color: #c41e3a; }
            .sublogo { font-size: 10px; letter-spacing: 3px; color: #666; }
            .date { font-size: 12px; color: #666; margin-top: 8px; }
            .section { margin: 15px 0; }
            .section-title { 
              font-weight: 600; 
              font-size: 14px; 
              background: #333;
              color: white;
              padding: 5px 10px;
              margin-bottom: 8px;
            }
            .entry-row {
              display: flex;
              justify-content: space-between;
              padding: 4px 0;
              border-bottom: 1px dotted #ddd;
              font-size: 14px;
            }
            .entry-number { font-weight: 600; font-family: monospace; font-size: 16px; }
            .entry-amount { font-weight: 600; color: #c41e3a; }
            .total-section { 
              border-top: 2px dashed #333; 
              margin-top: 20px; 
              padding-top: 15px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              font-size: 14px;
              padding: 3px 0;
            }
            .grand-total {
              font-size: 20px;
              font-weight: 700;
              margin-top: 10px;
              padding-top: 10px;
              border-top: 1px solid #333;
            }
            .grand-total .amount { color: #c41e3a; }
            .footer { 
              text-align: center; 
              margin-top: 20px; 
              font-size: 10px; 
              color: #999;
              border-top: 1px dashed #ddd;
              padding-top: 15px;
            }
            @media print { 
              body { padding: 10px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">${settings.siteName}</div>
            <div class="sublogo">LOTTO PREMIUM</div>
            <div class="date">วันที่: ${new Date().toLocaleString('th-TH')}</div>
          </div>

          ${Object.entries(groupedByType).map(([type, items]) => `
            <div class="section">
              <div class="section-title">${BET_TYPE_LABELS[type as BetType]} (${items.length} รายการ)</div>
              ${items.map(e => `
                <div class="entry-row">
                  <span class="entry-number">${e.number}</span>
                  <span class="entry-amount">฿${e.amount.toLocaleString()}</span>
                </div>
              `).join('')}
            </div>
          `).join('')}

          <div class="total-section">
            ${Object.entries(groupedByType).map(([type, items]) => `
              <div class="total-row">
                <span>${BET_TYPE_LABELS[type as BetType]}</span>
                <span>฿${items.reduce((s, e) => s + e.amount, 0).toLocaleString()}</span>
              </div>
            `).join('')}
            <div class="grand-total">
              <span>ยอดรวมทั้งหมด</span>
              <span class="amount">฿${totalAmount.toLocaleString()}</span>
            </div>
          </div>

          <div class="footer">
            <p>จำนวน ${filteredEntries.length} รายการ</p>
            <p>ขอบคุณที่ใช้บริการ ${settings.siteName}</p>
          </div>

          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>รายการคีย์เลข - ${settings.siteName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
            body { font-family: 'Sarabun', sans-serif; padding: 20px; }
            h1 { color: #c41e3a; font-size: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #333; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #333; color: white; }
            .total { font-weight: bold; font-size: 16px; margin-top: 15px; }
            @media print { body { print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <h1>${settings.siteName} - รายการคีย์เลข</h1>
          <p style="font-size: 12px; color: #666;">วันที่พิมพ์: ${new Date().toLocaleString('th-TH')}</p>
          <table>
            <thead>
              <tr>
                <th>เลข</th>
                <th>ประเภท</th>
                <th>ยอด</th>
                <th>ลูกค้า</th>
                <th>วันที่</th>
              </tr>
            </thead>
            <tbody>
              ${filteredEntries.map(e => `
                <tr>
                  <td style="font-weight:bold; font-family:monospace;">${e.number}</td>
                  <td>${BET_TYPE_LABELS[e.bet_type]}</td>
                  <td style="color:#c41e3a; font-weight:bold;">฿${e.amount.toLocaleString()}</td>
                  <td>${e.customer?.name || e.customer_name || '-'}</td>
                  <td>${new Date(e.created_at).toLocaleString('th-TH')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p class="total">ยอดรวม: ฿${totalAmount.toLocaleString()} (${filteredEntries.length} รายการ)</p>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/entries/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('ลบรายการสำเร็จ');
        mutate();
      } else {
        toast.error('ไม่สามารถลบรายการได้');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <List className="size-6" />
            รายการทั้งหมด
          </h1>
          <p className="text-muted-foreground">
            {filteredEntries.length} รายการ | ยอดรวม <span className="text-primary font-bold">{totalAmount.toLocaleString()}</span> บาท
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="size-4 mr-1" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="size-4 mr-1" />
            พิมพ์
          </Button>
          <Button size="sm" onClick={handlePrintBill} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Receipt className="size-4 mr-1" />
            ออกบิล
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs">
                <Search className="size-3" />
                ค้นหา
              </Label>
              <Input
                placeholder="ค้นหาเลข ชื่อ เบอร์..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs">
                <Filter className="size-3" />
                ประเภท
              </Label>
              <Select value={filterType} onValueChange={(v) => setFilterType(v as BetType | 'all')}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {betTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {BET_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">วันที่</Label>
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">แสดงผล</Label>
              <Select value={groupByLottery ? 'grouped' : 'flat'} onValueChange={(v) => setGroupByLottery(v === 'grouped')}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grouped">จัดกลุ่มตามหวย</SelectItem>
                  <SelectItem value="flat">รายการทั้งหมด</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">เรียงตาม</Label>
              <Select value={`${sortField}-${sortOrder}`} onValueChange={(v) => {
                const [field, order] = v.split('-') as [SortField, SortOrder];
                setSortField(field);
                setSortOrder(order);
              }}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt-desc">วันที่ (ใหม่สุด)</SelectItem>
                  <SelectItem value="createdAt-asc">วันที่ (เก่าสุด)</SelectItem>
                  <SelectItem value="amount-desc">ยอด (สูงสุด)</SelectItem>
                  <SelectItem value="amount-asc">ยอด (ต่ำสุด)</SelectItem>
                  <SelectItem value="number-asc">เลข (น้อยไปมาก)</SelectItem>
                  <SelectItem value="number-desc">เลข (มากไปน้อย)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6" ref={printRef}>
          {filteredEntries.length > 0 ? (
            groupByLottery && groupedByLottery ? (
              // Grouped by lottery view
              <div className="space-y-4">
                {groupedByLottery.map((group) => (
                  <div key={group.lotteryId} className="border rounded-lg overflow-hidden">
                    {/* Lottery header */}
                    <div className="bg-muted/50 px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg">{group.lotteryName}</span>
                        <Badge variant="secondary">{group.entryCount} รายการ</Badge>
                      </div>
                      <span className="font-mono font-bold text-primary text-lg">
                        ฿{group.totalAmount.toLocaleString()}
                      </span>
                    </div>
                    {/* Entries table */}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>เลข</TableHead>
                          <TableHead>ประเภท</TableHead>
                          <TableHead>ยอด</TableHead>
                          <TableHead>ลูกค้า</TableHead>
                          <TableHead className="hidden sm:table-cell">วันที่</TableHead>
                          <TableHead className="text-right">จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.entries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>
                              <span className="font-mono font-bold text-lg">{entry.number}</span>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${BET_TYPE_COLORS[entry.bet_type]} text-white text-xs`}>
                                {BET_TYPE_LABELS[entry.bet_type]}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono font-bold text-primary">
                              {entry.amount.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <p className="font-medium text-sm">{entry.customer?.name || entry.customer_name || '-'}</p>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                              {new Date(entry.created_at).toLocaleString('th-TH', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </TableCell>
                            <TableCell className="text-right">
                              {canAccess('delete') && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive">
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        คุณต้องการลบรายการ {entry.number} ({BET_TYPE_LABELS[entry.bet_type]}) {entry.amount.toLocaleString()} บาท หรือไม่?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(entry.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        ลบ
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            ) : (
              // Flat list view
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('number')}>
                      <div className="flex items-center gap-1">
                        เลข
                        <ArrowUpDown className="size-3" />
                      </div>
                    </TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('amount')}>
                      <div className="flex items-center gap-1">
                        ยอด
                        <ArrowUpDown className="size-3" />
                      </div>
                    </TableHead>
                    <TableHead>ลูกค้า</TableHead>
                    <TableHead className="hidden md:table-cell">หวย</TableHead>
                    <TableHead className="cursor-pointer hidden sm:table-cell" onClick={() => handleSort('created_at')}>
                      <div className="flex items-center gap-1">
                        วันที่
                        <ArrowUpDown className="size-3" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <span className="font-mono font-bold text-lg">{entry.number}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${BET_TYPE_COLORS[entry.bet_type]} text-white text-xs`}>
                          {BET_TYPE_LABELS[entry.bet_type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono font-bold text-primary">
                        {entry.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{entry.customer?.name || entry.customer_name || '-'}</p>
                          {entry.customer?.phone && (
                            <p className="text-xs text-muted-foreground">{entry.customer.phone}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-xs max-w-[150px] truncate">
                        {entry.lottery?.name || '-'}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                        {new Date(entry.created_at).toLocaleString('th-TH', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {canAccess('delete') ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
                                <AlertDialogDescription>
                                  คุณต้องการลบรายการ {entry.number} ({BET_TYPE_LABELS[entry.bet_type]}) {entry.amount.toLocaleString()} บาท หรือไม่?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(entry.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  ลบ
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            )
          ) : (
            <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
              <List className="size-12 mb-4 opacity-30" />
              <p>ไม่พบรายการ</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
