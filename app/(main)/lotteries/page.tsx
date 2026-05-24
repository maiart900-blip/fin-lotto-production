'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Clock, Calendar, Ticket, PauseCircle, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { LotteryStatusBadge, LotteryStatusList } from '@/components/lottery/lottery-status';
import { Lottery } from '@/lib/lottery-utils';

const DRAW_TYPE_LABELS: Record<string, string> = {
  daily: 'ทุกวัน',
  weekdays: 'วันจันทร์-ศุกร์',
  weekend: 'เสาร์-อาทิตย์',
  specific: 'วันที่กำหนด',
};

const DAY_LABELS: Record<string, string> = {
  mon: 'จ.',
  tue: 'อ.',
  wed: 'พ.',
  thu: 'พฤ.',
  fri: 'ศ.',
  sat: 'ส.',
  sun: 'อา.',
};

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function LotteriesPage() {
  const { canAccess } = useAuth();
  const { data: lotteries = [], mutate, isLoading } = useSWR<Lottery[]>('/api/lotteries', fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds
  });
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLottery, setEditingLottery] = useState<Lottery | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    is_active: true,
    is_closed_temp: false,
    draw_type: 'daily' as Lottery['draw_type'],
    draw_days: [] as string[],
    open_time: '06:00',
    close_time: '14:00',
    note: '',
    sort_order: 0,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      is_active: true,
      is_closed_temp: false,
      draw_type: 'daily',
      draw_days: [],
      open_time: '06:00',
      close_time: '14:00',
      note: '',
      sort_order: 0,
    });
    setEditingLottery(null);
  };

  const openAddDialog = () => {
    resetForm();
    setFormData(f => ({ ...f, sort_order: lotteries.length + 1 }));
    setIsDialogOpen(true);
  };

  const openEditDialog = (lottery: Lottery) => {
    setEditingLottery(lottery);
    setFormData({
      name: lottery.name,
      is_active: lottery.is_active,
      is_closed_temp: lottery.is_closed_temp || false,
      draw_type: lottery.draw_type,
      draw_days: lottery.draw_days || [],
      open_time: lottery.open_time?.slice(0, 5) || '06:00',
      close_time: lottery.close_time?.slice(0, 5) || '14:00',
      note: lottery.note || '',
      sort_order: lottery.sort_order,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('กรุณาระบุชื่อหวย');
      return;
    }

    try {
      const url = editingLottery 
        ? `/api/lotteries/${editingLottery.id}` 
        : '/api/lotteries';
      
      const res = await fetch(url, {
        method: editingLottery ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast.success(editingLottery ? 'แก้ไขหวยสำเร็จ' : 'เพิ่มหวยสำเร็จ');
      mutate();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/lotteries/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('ลบไม่สำเร็จ');
      toast.success('ลบหวยสำเร็จ');
      mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    }
  };

  const toggleActive = async (lottery: Lottery) => {
    try {
      const res = await fetch(`/api/lotteries/${lottery.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lottery, is_active: !lottery.is_active }),
      });
      if (!res.ok) throw new Error('อัพเดทไม่สำเร็จ');
      toast.success(lottery.is_active ? 'ปิดใช้งานหวยแล้ว' : 'เปิดใช้งานหวยแล้ว');
      mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    }
  };

  const toggleTempClose = async (lottery: Lottery) => {
    try {
      const res = await fetch(`/api/lotteries/${lottery.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lottery, is_closed_temp: !lottery.is_closed_temp }),
      });
      if (!res.ok) throw new Error('อัพเดทไม่สำเร็จ');
      toast.success(lottery.is_closed_temp ? 'เปิดรับหวยแล้ว' : 'ปิดรับหวยชั่วคราว');
      mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    }
  };

  const formatDrawDays = (lottery: Lottery) => {
    if (lottery.draw_type === 'specific') {
      return lottery.draw_days?.map(d => `วันที่ ${d}`).join(', ') || '-';
    }
    return lottery.draw_days?.map(d => DAY_LABELS[d] || d).join(' ') || DRAW_TYPE_LABELS[lottery.draw_type];
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  const activeLotteries = lotteries.filter(l => l.is_active);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Ticket className="size-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">จัดการประเภทหวย</h1>
            <p className="text-sm text-muted-foreground">
              {activeLotteries.length} หวยที่เปิดใช้งาน
            </p>
          </div>
        </div>
        {canAccess('admin') && (
          <Button onClick={openAddDialog} className="gap-2">
            <Plus className="size-4" />
            <span className="hidden sm:inline">เพิ่มหวย</span>
          </Button>
        )}
      </div>

      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">สถานะหวยวันนี้</CardTitle>
        </CardHeader>
        <CardContent>
          <LotteryStatusList lotteries={lotteries} />
        </CardContent>
      </Card>

      {/* Lotteries Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">รายการหวยทั้งหมด ({lotteries.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>ชื่อหวย</TableHead>
                  <TableHead className="hidden md:table-cell">วันออก</TableHead>
                  <TableHead className="hidden sm:table-cell">เวลา</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                  <TableHead className="text-center">เปิด/ปิด</TableHead>
                  {canAccess('admin') && <TableHead className="w-28">จัดการ</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotteries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      ยังไม่มีรายการหวย
                    </TableCell>
                  </TableRow>
                ) : (
                  lotteries.map((lottery) => (
                    <TableRow key={lottery.id} className={!lottery.is_active ? 'opacity-50' : ''}>
                      <TableCell className="font-mono text-muted-foreground">
                        {lottery.sort_order}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{lottery.name}</div>
                        {lottery.note && (
                          <div className="text-xs text-muted-foreground">{lottery.note}</div>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <Calendar className="size-3.5 text-muted-foreground" />
                          <span className="text-sm">{formatDrawDays(lottery)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <Clock className="size-3.5 text-muted-foreground" />
                          <span className="text-sm font-mono">
                            {lottery.open_time?.slice(0, 5)} - {lottery.close_time?.slice(0, 5)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <LotteryStatusBadge lottery={lottery} showCountdown={false} size="sm" />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Switch
                            checked={lottery.is_active}
                            onCheckedChange={() => toggleActive(lottery)}
                            disabled={!canAccess('admin')}
                          />
                          {lottery.is_active && canAccess('admin') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`size-8 ${lottery.is_closed_temp ? 'text-amber-500' : 'text-muted-foreground'}`}
                              onClick={() => toggleTempClose(lottery)}
                              title={lottery.is_closed_temp ? 'เปิดรับหวย' : 'ปิดรับชั่วคราว'}
                            >
                              {lottery.is_closed_temp ? (
                                <PlayCircle className="size-4" />
                              ) : (
                                <PauseCircle className="size-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      {canAccess('admin') && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => openEditDialog(lottery)}
                            >
                              <Pencil className="size-4" />
                            </Button>
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
                                    คุณต้องการลบหวย &quot;{lottery.name}&quot; หรือไม่?
                                    รายการที่เกี่ยวข้องจะถูกลบไปด้วย
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(lottery.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    ลบ
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLottery ? 'แก้ไขหวย' : 'เพิ่มหวยใหม่'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>ชื่อหวย *</Label>
              <Input
                placeholder="เช่น รัฐบาลไทย, ลาวพัฒนา"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ประเภทวันออก</Label>
                <Select
                  value={formData.draw_type}
                  onValueChange={(v) => setFormData({ ...formData, draw_type: v as Lottery['draw_type'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">ทุกวัน</SelectItem>
                    <SelectItem value="weekdays">จันทร์-ศุกร์</SelectItem>
                    <SelectItem value="weekend">เสาร์-อาทิตย์</SelectItem>
                    <SelectItem value="specific">วันที่กำหนด</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>ลำดับ</Label>
                <Input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            {formData.draw_type === 'specific' && (
              <div className="space-y-2">
                <Label>วันที่ออก (คั่นด้วย ,)</Label>
                <Input
                  placeholder="เช่น 1,16"
                  value={formData.draw_days.join(',')}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    draw_days: e.target.value.split(',').map(d => d.trim()).filter(Boolean)
                  })}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>เวลาเปิดรับ</Label>
                <Input
                  type="time"
                  value={formData.open_time}
                  onChange={(e) => setFormData({ ...formData, open_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>เวลาปิดรับ</Label>
                <Input
                  type="time"
                  value={formData.close_time}
                  onChange={(e) => setFormData({ ...formData, close_time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>หมายเหตุ</Label>
              <Textarea
                placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              />
            </div>

            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <Label>เปิดใช้งาน</Label>
                  <p className="text-xs text-muted-foreground">แสดงหวยนี้ในระบบ</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
              
              {formData.is_active && (
                <div className="flex items-center justify-between">
                  <div>
                    <Label>ปิดรับชั่วคราว</Label>
                    <p className="text-xs text-muted-foreground">หยุดรับเลขชั่วคราว</p>
                  </div>
                  <Switch
                    checked={formData.is_closed_temp}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_closed_temp: checked })}
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSubmit}>
              {editingLottery ? 'บันทึก' : 'เพิ่ม'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
