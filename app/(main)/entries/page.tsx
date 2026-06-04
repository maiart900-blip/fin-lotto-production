'use client';

import { useState, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useLotteryStore } from '@/hooks/use-lottery-store';
import { useAuth } from '@/hooks/use-auth';
import { BET_TYPE_LABELS, BET_TYPE_COLORS, type BetType } from '@/types/lottery';
import { 
  List, Search, Filter, Download, Printer, Trash2, 
  Receipt, Loader2, ChevronDown, ChevronRight, Calendar 
} from 'lucide-react';

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

interface DateLotteryGroup {
  dateKey: string;
  dateLabel: string;
  lotteryId: string;
  lotteryName: string;
  entries: DBEntry[];
  totalAmount: number;
  entryCount: number;
  isToday: boolean;
}

// Helper to format date in Thai
function formatDateThai(dateStr: string): string {
  const date = new Date(dateStr);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

// Helper to get date key (YYYY-MM-DD)
function getDateKey(dateStr: string): string {
  return dateStr.split('T')[0];
}

// Helper to check if date is today
function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return getDateKey(dateStr) === today;
}

export default function EntriesPage() {
  const { settings } = useLotteryStore();
  const { isAdmin, isSuperAdmin } = useAuth();
  
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<BetType | 'all'>('all');
  const [filterDate, setFilterDate] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [groupByDate, setGroupByDate] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
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

  // Group entries by Date + Lottery Type
  const groupedByDateLottery = useMemo(() => {
    if (!groupByDate) return null;
    
    const groups: Record<string, DateLotteryGroup> = {};
    
    filteredEntries.forEach((entry) => {
      const dateKey = getDateKey(entry.created_at);
      const lotteryId = entry.lottery?.id || 'unknown';
      const lotteryName = entry.lottery?.name || 'ไม่ระบุหวย';
      const groupKey = `${dateKey}-${lotteryId}`;
      
      if (!groups[groupKey]) {
        groups[groupKey] = {
          dateKey,
          dateLabel: formatDateThai(entry.created_at),
          lotteryId,
          lotteryName,
          entries: [],
          totalAmount: 0,
          entryCount: 0,
          isToday: isToday(entry.created_at),
        };
      }
      
      groups[groupKey].entries.push(entry);
      groups[groupKey].totalAmount += entry.amount;
      groups[groupKey].entryCount += 1;
    });
    
    // Sort by date (newest first), then by lottery name
    return Object.values(groups).sort((a, b) => {
      const dateCompare = b.dateKey.localeCompare(a.dateKey);
      if (dateCompare !== 0) return dateCompare;
      return a.lotteryName.localeCompare(b.lotteryName);
    });
  }, [filteredEntries, groupByDate]);

  // Initialize expanded groups - today's entries are expanded by default
  useMemo(() => {
    if (groupedByDateLottery && expandedGroups.size === 0) {
      const todayGroups = groupedByDateLottery
        .filter(g => g.isToday)
        .map(g => `${g.dateKey}-${g.lotteryId}`);
      if (todayGroups.length > 0) {
        setExpandedGroups(new Set(todayGroups));
      }
    }
  }, [groupedByDateLottery]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    if (groupedByDateLottery) {
      setExpandedGroups(new Set(groupedByDateLottery.map(g => `${g.dateKey}-${g.lotteryId}`)));
    }
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
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
    link.download = `entries-${new Date().toISOString().split('T')[0]}.csv`;
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
          <title>บิล - ${settings.siteName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Sarabun', sans-serif; 
              padding: 20px;
              max-width: 400px;
              margin: 0 auto;
            }
            .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 15px; margin-bottom: 15px; }
            .logo { font-size: 24px; font-weight: 700; color: #c41e3a; }
            .date { font-size: 12px; color: #666; margin-top: 8px; }
            .section { margin: 15px 0; }
            .section-title { font-weight: 600; background: #333; color: white; padding: 5px 10px; margin-bottom: 8px; }
            .entry-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #ddd; }
            .entry-number { font-weight: 600; font-family: monospace; font-size: 16px; }
            .entry-amount { font-weight: 600; color: #c41e3a; }
            .total-section { border-top: 2px dashed #333; margin-top: 20px; padding-top: 15px; }
            .total-row { display: flex; justify-content: space-between; padding: 3px 0; }
            .grand-total { font-size: 20px; font-weight: 700; margin-top: 10px; border-top: 1px solid #333; padding-top: 10px; }
            .grand-total .amount { color: #c41e3a; }
            .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #999; }
            @media print { body { padding: 10px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">${settings.siteName}</div>
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
          </style>
        </head>
        <body>
          <h1>${settings.siteName} - รายการคีย์เลข</h1>
          <p style="font-size: 12px; color: #666;">วันที่พิมพ์: ${new Date().toLocaleString('th-TH')}</p>
          <table>
            <thead>
              <tr><th>เลข</th><th>ประเภท</th><th>ยอด</th><th>ลูกค้า</th><th>วันที่</th></tr>
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
      {/* Header */}
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
              <Select value={groupByDate ? 'grouped' : 'flat'} onValueChange={(v) => setGroupByDate(v === 'grouped')}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grouped">จัดกลุ่มตามวัน+หวย</SelectItem>
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
                  <SelectItem value="created_at-desc">วันที่ (ใหม่สุด)</SelectItem>
                  <SelectItem value="created_at-asc">วันที่ (เก่าสุด)</SelectItem>
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

      {/* Expand/Collapse All Buttons */}
      {groupByDate && groupedByDateLottery && groupedByDateLottery.length > 0 && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            กางทั้งหมด
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            พับทั้งหมด
          </Button>
        </div>
      )}

      {/* Entries Display */}
      <div ref={printRef}>
        {filteredEntries.length > 0 ? (
          groupByDate && groupedByDateLottery ? (
            // Grouped by Date + Lottery with Collapsible Accordion
            <div className="space-y-3">
              {groupedByDateLottery.map((group) => {
                const groupKey = `${group.dateKey}-${group.lotteryId}`;
                const isExpanded = expandedGroups.has(groupKey);
                
                return (
                  <Collapsible
                    key={groupKey}
                    open={isExpanded}
                    onOpenChange={() => toggleGroup(groupKey)}
                  >
                    <Card className="overflow-hidden">
                      {/* Accordion Header */}
                      <CollapsibleTrigger asChild>
                        <div 
                          className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                            group.isToday ? 'bg-primary/10 border-l-4 border-l-primary' : 'bg-muted/30'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            {isExpanded ? (
                              <ChevronDown className="size-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="size-5 text-muted-foreground" />
                            )}
                            
                            <div className="flex items-center gap-2">
                              <Calendar className="size-4 text-muted-foreground" />
                              <span className="font-semibold">
                                {group.dateLabel}
                                {group.isToday && (
                                  <Badge className="ml-2 bg-primary text-primary-foreground text-xs">
                                    วันนี้
                                  </Badge>
                                )}
                              </span>
                            </div>
                            
                            <Badge variant="outline" className="font-medium">
                              {group.lotteryName}
                            </Badge>
                            
                            <Badge variant="secondary">
                              {group.entryCount} รายการ
                            </Badge>
                          </div>
                          
                          <span className="font-mono font-bold text-primary text-lg">
                            ฿{group.totalAmount.toLocaleString()}
                          </span>
                        </div>
                      </CollapsibleTrigger>

                      {/* Accordion Content - Entries Table */}
                      <CollapsibleContent>
                        <div className="border-t">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/20">
                                <TableHead className="w-24">เลข</TableHead>
                                <TableHead className="w-28">ประเภท</TableHead>
                                <TableHead className="w-28">ยอด</TableHead>
                                <TableHead>ลูกค้า</TableHead>
                                <TableHead className="hidden sm:table-cell w-40">เวลา</TableHead>
                                <TableHead className="text-right w-20">จัดการ</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.entries.map((entry) => (
                                <TableRow key={entry.id} className="hover:bg-muted/10">
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
                                  <TableCell className="text-muted-foreground">
                                    {entry.customer?.name || entry.customer_name || '-'}
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                                    {new Date(entry.created_at).toLocaleTimeString('th-TH', { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </TableCell>
                                  <TableCell className="text-right">
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
                                            ต้องการลบรายการเลข {entry.number} ({BET_TYPE_LABELS[entry.bet_type]}) ยอด ฿{entry.amount.toLocaleString()} หรือไม่?
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
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          ) : (
            // Flat list view (no grouping)
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>เลข</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead>ยอด</TableHead>
                      <TableHead>ลูกค้า</TableHead>
                      <TableHead>หวย</TableHead>
                      <TableHead className="hidden sm:table-cell">วันที่</TableHead>
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
                        <TableCell className="text-muted-foreground">
                          {entry.customer?.name || entry.customer_name || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{entry.lottery?.name || '-'}</Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                          {new Date(entry.created_at).toLocaleString('th-TH')}
                        </TableCell>
                        <TableCell className="text-right">
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
                                  ต้องการลบรายการเลข {entry.number} ยอด ฿{entry.amount.toLocaleString()} หรือไม่?
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
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <List className="size-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">ไม่พบรายการ</p>
              <p className="text-sm text-muted-foreground/70">ลองเปลี่ยนเงื่อนไขการค้นหา</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
