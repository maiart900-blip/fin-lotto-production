'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Ban,
  Plus,
  Search,
  Trash2,
  Edit,
  AlertTriangle,
  Loader2,
  RefreshCw,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to fetch');
  }
  return res.json();
};

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

interface BlockedNumber {
  id: string;
  lottery_id: string;
  number: string;
  entry_type: string;
  limit_amount: number | null;
  current_amount: number;
  is_blocked: boolean;
  block_date: string | null;
  note: string | null;
  created_at: string;
  lottery?: {
    id: string;
    name: string;
    date: string;
  };
}

interface Lottery {
  id: string;
  name: string;
  date: string;
  status: string;
}

const entryTypes = [
  { value: '3top', label: '3 ตัวบน' },
  { value: '3tod', label: '3 ตัวโต๊ด' },
  { value: '2top', label: '2 ตัวบน' },
  { value: '2bot', label: '2 ตัวล่าง' },
  { value: 'run_top', label: 'วิ่งบน' },
  { value: 'run_bot', label: 'วิ่งล่าง' },
];

export default function BlockedNumbersPage() {
  const { user, isAdmin } = useAuth();
  const [lotteryFilter, setLotteryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<BlockedNumber | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    lottery_id: '',
    number: '',
    entry_type: '3top',
    limit_amount: '',
    is_blocked: false,
    note: '',
  });

  // Fetch blocked numbers with error handling
  const { 
    data: blockedNumbers, 
    error: blockedError, 
    isLoading: blockedLoading, 
    mutate 
  } = useSWR<BlockedNumber[]>(
    `/api/blocked-numbers${lotteryFilter !== 'all' ? `?lottery_id=${lotteryFilter}` : ''}`,
    fetcher,
    { 
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      fallbackData: [] // Empty array as fallback
    }
  );

  // Fetch lotteries with error handling
  const { 
    data: lotteries, 
    error: lotteriesError, 
    isLoading: lotteriesLoading 
  } = useSWR<Lottery[]>(
    '/api/lotteries?status=open',
    fetcher,
    { 
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      fallbackData: []
    }
  );

  const safeBlockedNumbers = Array.isArray(blockedNumbers) ? blockedNumbers : [];
  const safeLotteries = Array.isArray(lotteries) ? lotteries : [];

  const filteredNumbers = safeBlockedNumbers.filter(bn => {
    if (!searchTerm) return true;
    return bn.number?.includes(searchTerm);
  });

  // Validation function
  const validateNumber = (num: string, entryType: string): string | null => {
    const digits = num.replace(/\D/g, '');
    
    if (!digits) return 'กรุณากรอกตัวเลข';
    
    if (entryType === '3top' || entryType === '3tod') {
      if (digits.length !== 3) return 'เลข 3 ตัวต้องมี 3 หลัก';
    } else if (entryType === '2top' || entryType === '2bot') {
      if (digits.length !== 2) return 'เลข 2 ตัวต้องมี 2 หลัก';
    } else if (entryType === 'run_top' || entryType === 'run_bot') {
      if (digits.length !== 1) return 'เลขวิ่งต้องมี 1 หลัก';
    }
    
    return null;
  };

  const handleSubmit = async () => {
    if (!formData.lottery_id) {
      toast.error('กรุณาเลือกหวย');
      return;
    }
    
    if (!formData.number) {
      toast.error('กรุณากรอกเลข');
      return;
    }

    // Validate number format
    const validationError = validateNumber(formData.number, formData.entry_type);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    // Check for duplicate
    const cleanNumber = formData.number.replace(/\D/g, '');
    const duplicate = safeBlockedNumbers.find(
      bn => bn.number === cleanNumber && 
           bn.lottery_id === formData.lottery_id && 
           bn.entry_type === formData.entry_type &&
           (!selectedItem || bn.id !== selectedItem.id)
    );
    if (duplicate) {
      toast.error('เลขนี้มีในรายการอั้นของหวยนี้แล้ว');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = '/api/blocked-numbers';
      const method = selectedItem ? 'PUT' : 'POST';
      const body = selectedItem
        ? { 
            id: selectedItem.id, 
            lottery_id: formData.lottery_id,
            number: cleanNumber,
            entry_type: formData.entry_type,
            limit_amount: formData.limit_amount ? Number(formData.limit_amount) : null,
            is_blocked: formData.is_blocked,
            note: formData.note || null
          }
        : { 
            lottery_id: formData.lottery_id,
            number: cleanNumber,
            entry_type: formData.entry_type,
            limit_amount: formData.limit_amount ? Number(formData.limit_amount) : null,
            is_blocked: formData.is_blocked,
            note: formData.note || null,
            created_by: user?.id,
            current_amount: 0
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Failed');
      }

      toast.success(selectedItem ? 'บันทึกการแก้ไขสำเร็จ' : 'เพิ่มเลขอั้น/จำกัดสำเร็จ');
      mutate();
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/blocked-numbers?id=${selectedItem.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Failed');
      }

      toast.success('ลบสำเร็จ');
      mutate();
      setIsDeleteOpen(false);
      setSelectedItem(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      lottery_id: '',
      number: '',
      entry_type: '3top',
      limit_amount: '',
      is_blocked: false,
      note: '',
    });
    setSelectedItem(null);
    setIsDialogOpen(false);
  };

  const openEdit = (item: BlockedNumber) => {
    setSelectedItem(item);
    setFormData({
      lottery_id: item.lottery_id,
      number: item.number,
      entry_type: item.entry_type,
      limit_amount: item.limit_amount?.toString() || '',
      is_blocked: item.is_blocked,
      note: item.note || '',
    });
    setIsDialogOpen(true);
  };

  // Loading state
  if (blockedLoading || lotteriesLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ban className="h-6 w-6" />
            เลขอั้น / จำกัดยอด
          </h1>
          <p className="text-muted-foreground">จัดการเลขอั้นและจำกัดยอดรับต่อเลข</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => mutate()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            รีเฟรช
          </Button>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            เพิ่มเลขอั้น
          </Button>
        </div>
      </div>

      {/* Error State */}
      {blockedError && (
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="py-4">
            <p className="text-red-400 text-center">
              ไม่สามารถโหลดข้อมูลได้ กรุณากดรีเฟรชเพื่อลองใหม่
            </p>
          </CardContent>
        </Card>
      )}

      {/* No Lotteries Warning */}
      {safeLotteries.length === 0 && !lotteriesError && (
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="py-6 text-center">
            <AlertTriangle className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
            <p className="text-yellow-400 font-medium">ยังไม่มีหวยที่เปิดรับ</p>
            <p className="text-sm text-muted-foreground mt-1">กรุณาเพิ่มหวยก่อนจึงจะสามารถตั้งค่าเลขอั้นได้</p>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-red-500/10 border-red-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-400 flex items-center gap-2">
              <Ban className="h-4 w-4" />
              เลขอั้น (ปิดรับ)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">
              {safeBlockedNumbers.filter(bn => bn.is_blocked).length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              จำกัดยอด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400">
              {safeBlockedNumbers.filter(bn => bn.limit_amount && !bn.is_blocked).length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ทั้งหมด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safeBlockedNumbers.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาเลข..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={lotteryFilter} onValueChange={setLotteryFilter}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="เลือกหวย" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                {safeLotteries.map((lot) => (
                  <SelectItem key={lot.id} value={lot.id}>
                    {lot.name} ({lot.date})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>หวย</TableHead>
                <TableHead>เลข</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>จำกัดยอด</TableHead>
                <TableHead>ยอดรับปัจจุบัน</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>หมายเหตุ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNumbers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-green-500/50 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">ยังไม่มีเลขอั้น</p>
                    <p className="text-sm text-muted-foreground mt-1">กดปุ่ม "เพิ่มเลขอั้น" เพื่อเริ่มต้น</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredNumbers.map((bn) => (
                  <TableRow key={bn.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{bn.lottery?.name || '-'}</div>
                        <div className="text-xs text-muted-foreground">{bn.lottery?.date || ''}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono font-bold text-lg">{bn.number}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {entryTypes.find(t => t.value === bn.entry_type)?.label || bn.entry_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {bn.limit_amount ? (
                        <span className="text-yellow-400">{formatMoney(bn.limit_amount)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {bn.limit_amount ? (
                        <div>
                          <span className={(bn.current_amount || 0) >= (bn.limit_amount || 0) ? 'text-red-400' : ''}>
                            {formatMoney(bn.current_amount || 0)}
                          </span>
                          <span className="text-muted-foreground">/{formatMoney(bn.limit_amount)}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {bn.is_blocked ? (
                        <Badge className="bg-red-500/20 text-red-400">
                          <Ban className="h-3 w-3 mr-1" />
                          อั้น
                        </Badge>
                      ) : (
                        <Badge className="bg-green-500/20 text-green-400">เปิดรับ</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{bn.note || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(bn)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300"
                          onClick={() => {
                            setSelectedItem(bn);
                            setIsDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Ban className="h-5 w-5" />
              {selectedItem ? 'แก้ไขเลขอั้น' : 'เพิ่มเลขอั้น / จำกัดยอด'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">หวย *</Label>
              <Select
                value={formData.lottery_id}
                onValueChange={(v) => setFormData({ ...formData, lottery_id: v })}
              >
                <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600">
                  <SelectValue placeholder="เลือกหวย" />
                </SelectTrigger>
                <SelectContent>
                  {safeLotteries.length === 0 ? (
                    <SelectItem value="none" disabled>ไม่มีหวยที่เปิดรับ</SelectItem>
                  ) : (
                    safeLotteries.map((lot) => (
                      <SelectItem key={lot.id} value={lot.id}>
                        {lot.name} ({lot.date})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">เลข *</Label>
                <Input
                  placeholder="เช่น 123, 45, 6"
                  value={formData.number}
                  onChange={(e) => {
                    // Only allow digits
                    const value = e.target.value.replace(/\D/g, '');
                    setFormData({ ...formData, number: value });
                  }}
                  maxLength={3}
                  className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formData.entry_type.includes('3') ? '3 หลัก' : 
                   formData.entry_type.includes('2') ? '2 หลัก' : '1 หลัก'}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 dark:text-slate-300">ประเภท *</Label>
                <Select
                  value={formData.entry_type}
                  onValueChange={(v) => setFormData({ ...formData, entry_type: v, number: '' })}
                >
                  <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {entryTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">จำกัดยอด (บาท)</Label>
              <Input
                type="number"
                placeholder="ว่างไว้ = ไม่จำกัด"
                value={formData.limit_amount}
                onChange={(e) => setFormData({ ...formData, limit_amount: e.target.value })}
                className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">ถ้าไม่กรอก จะไม่มีการจำกัดยอด</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div>
                <Label className="text-red-700 dark:text-red-400">อั้น (ปิดรับเลย)</Label>
                <p className="text-xs text-red-600 dark:text-red-400/70">เปิดใช้จะปิดรับเลขนี้ทันที</p>
              </div>
              <Switch
                checked={formData.is_blocked}
                onCheckedChange={(checked) => setFormData({ ...formData, is_blocked: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700 dark:text-slate-300">หมายเหตุ</Label>
              <Textarea
                placeholder="หมายเหตุ..."
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm} className="border-slate-300 dark:border-slate-600">
              ยกเลิก
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || safeLotteries.length === 0}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                'บันทึก'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Trash2 className="h-5 w-5" />
              ยืนยันการลบ
            </DialogTitle>
          </DialogHeader>
          <p className="text-slate-700 dark:text-slate-300">คุณต้องการลบเลข <strong>{selectedItem?.number}</strong> ออกจากรายการอั้น/จำกัดยอดหรือไม่?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="border-slate-300 dark:border-slate-600">
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  กำลังลบ...
                </>
              ) : (
                'ลบ'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
