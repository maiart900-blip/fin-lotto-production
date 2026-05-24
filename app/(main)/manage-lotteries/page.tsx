'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Save, 
  Loader2,
  Ticket,
  GripVertical,
  Search,
  X,
} from 'lucide-react';
import { getFlagEmoji } from '@/lib/country-flags';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const COUNTRIES = [
  { code: 'TH', name: 'ไทย' },
  { code: 'LA', name: 'ลาว' },
  { code: 'VN', name: 'เวียดนาม' },
  { code: 'MY', name: 'มาเลเซีย' },
  { code: 'SG', name: 'สิงคโปร์' },
  { code: 'HK', name: 'ฮ่องกง' },
  { code: 'CN', name: 'จีน' },
  { code: 'TW', name: 'ไต้หวัน' },
  { code: 'JP', name: 'ญี่ปุ่น' },
  { code: 'KR', name: 'เกาหลี' },
  { code: 'US', name: 'อเมริกา' },
  { code: 'GB', name: 'อังกฤษ' },
  { code: 'DE', name: 'เยอรมัน' },
  { code: 'RU', name: 'รัสเซีย' },
  { code: 'IN', name: 'อินเดีย' },
];

const CATEGORIES = [
  { key: 'government', name: 'หวยรัฐบาล' },
  { key: 'stock', name: 'หวยหุ้น' },
  { key: 'foreign', name: 'หวยต่างประเทศ' },
  { key: 'yeekee', name: 'หวยยี่กี' },
  { key: 'other', name: 'อื่นๆ' },
];

interface Lottery {
  id: string;
  name: string;
  is_active: boolean;
  is_closed_temp: boolean;
  close_time: string;
  country_code: string;
  flag_url: string | null;
  icon_url: string | null;
  bg_color: string | null;
  text_color: string | null;
  category: string;
  sort_order: number;
}

const emptyLottery: Partial<Lottery> = {
  name: '',
  is_active: true,
  is_closed_temp: false,
  close_time: '14:30',
  country_code: 'TH',
  category: 'government',
  sort_order: 0,
};

export default function ManageLotteriesPage() {
  const { data: lotteries, error, mutate } = useSWR<Lottery[]>('/api/lotteries', fetcher);
  const [search, setSearch] = useState('');
  const [editingLottery, setEditingLottery] = useState<Partial<Lottery> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const filteredLotteries = (lotteries || []).filter(l => 
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    setEditingLottery({ ...emptyLottery });
    setIsDialogOpen(true);
  };

  const handleEdit = (lottery: Lottery) => {
    setEditingLottery({ ...lottery });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingLottery?.name) {
      toast.error('กรุณากรอกชื่อหวย');
      return;
    }

    setSaving(true);
    try {
      const isNew = !editingLottery.id;
      const response = await fetch('/api/lotteries', {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingLottery),
      });

      if (!response.ok) throw new Error('Failed to save');

      toast.success(isNew ? 'เพิ่มหวยสำเร็จ' : 'บันทึกสำเร็จ');
      mutate();
      setIsDialogOpen(false);
      setEditingLottery(null);
    } catch {
      toast.error('ไม่สามารถบันทึกได้');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ต้องการลบหวยนี้ใช่หรือไม่?')) return;

    try {
      const response = await fetch(`/api/lotteries/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      toast.success('ลบหวยสำเร็จ');
      mutate();
    } catch {
      toast.error('ไม่สามารถลบได้');
    }
  };

  const handleToggle = async (lottery: Lottery, field: 'is_active' | 'is_closed_temp') => {
    try {
      const response = await fetch('/api/lotteries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lottery.id,
          [field]: !lottery[field],
        }),
      });

      if (!response.ok) throw new Error('Failed to update');
      mutate();
    } catch {
      toast.error('ไม่สามารถอัปเดตได้');
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center text-destructive">
            เกิดข้อผิดพลาดในการโหลดข้อมูล
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!lotteries) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ticket className="size-6" />
            จัดการหวย
          </h1>
          <p className="text-muted-foreground">เพิ่ม แก้ไข และจัดการหวยทั้งหมด</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="size-4 mr-2" />
          เพิ่มหวยใหม่
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาหวย..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>ชื่อหวย</TableHead>
                <TableHead>ประเทศ</TableHead>
                <TableHead>หมวดหมู่</TableHead>
                <TableHead>เวลาปิด</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>ปิดชั่วคราว</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLotteries.map((lottery) => (
                <TableRow key={lottery.id}>
                  <TableCell>
                    <GripVertical className="size-4 text-muted-foreground cursor-grab" />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getFlagEmoji(lottery.name)}</span>
                      {lottery.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {COUNTRIES.find(c => c.code === lottery.country_code)?.name || lottery.country_code}
                  </TableCell>
                  <TableCell>
                    {CATEGORIES.find(c => c.key === lottery.category)?.name || lottery.category}
                  </TableCell>
                  <TableCell>{lottery.close_time}</TableCell>
                  <TableCell>
                    <Switch
                      checked={lottery.is_active}
                      onCheckedChange={() => handleToggle(lottery, 'is_active')}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={lottery.is_closed_temp}
                      onCheckedChange={() => handleToggle(lottery, 'is_closed_temp')}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(lottery)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(lottery.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredLotteries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    ไม่พบหวย
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingLottery?.id ? 'แก้ไขหวย' : 'เพิ่มหวยใหม่'}
            </DialogTitle>
          </DialogHeader>
          
          {editingLottery && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>ชื่อหวย *</Label>
                  <Input
                    value={editingLottery.name || ''}
                    onChange={(e) => setEditingLottery({ ...editingLottery, name: e.target.value })}
                    placeholder="เช่น หวยรัฐบาลไทย"
                  />
                </div>

                <div className="space-y-2">
                  <Label>ประเทศ</Label>
                  <Select
                    value={editingLottery.country_code || 'TH'}
                    onValueChange={(v) => setEditingLottery({ ...editingLottery, country_code: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map(c => (
                        <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>หมวดหมู่</Label>
                  <Select
                    value={editingLottery.category || 'government'}
                    onValueChange={(v) => setEditingLottery({ ...editingLottery, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c.key} value={c.key}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>เวลาปิดรับ</Label>
                  <Input
                    type="time"
                    value={editingLottery.close_time || '14:30'}
                    onChange={(e) => setEditingLottery({ ...editingLottery, close_time: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>สีพื้นหลัง</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={editingLottery.bg_color || '#1D9BF0'}
                      onChange={(e) => setEditingLottery({ ...editingLottery, bg_color: e.target.value })}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      type="text"
                      value={editingLottery.bg_color || ''}
                      onChange={(e) => setEditingLottery({ ...editingLottery, bg_color: e.target.value })}
                      placeholder="#1D9BF0"
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>สีตัวอักษร</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={editingLottery.text_color || '#FFFFFF'}
                      onChange={(e) => setEditingLottery({ ...editingLottery, text_color: e.target.value })}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      type="text"
                      value={editingLottery.text_color || ''}
                      onChange={(e) => setEditingLottery({ ...editingLottery, text_color: e.target.value })}
                      placeholder="#FFFFFF"
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>ลำดับการแสดง</Label>
                  <Input
                    type="number"
                    value={editingLottery.sort_order || 0}
                    onChange={(e) => setEditingLottery({ ...editingLottery, sort_order: parseInt(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>URL รูปธง (ถ้ามี)</Label>
                  <Input
                    value={editingLottery.flag_url || ''}
                    onChange={(e) => setEditingLottery({ ...editingLottery, flag_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>URL ไอคอน (ถ้ามี)</Label>
                  <Input
                    value={editingLottery.icon_url || ''}
                    onChange={(e) => setEditingLottery({ ...editingLottery, icon_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingLottery.is_active ?? true}
                    onCheckedChange={(v) => setEditingLottery({ ...editingLottery, is_active: v })}
                  />
                  <Label>เปิดใช้งาน</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingLottery.is_closed_temp ?? false}
                    onCheckedChange={(v) => setEditingLottery({ ...editingLottery, is_closed_temp: v })}
                  />
                  <Label>ปิดชั่วคราว</Label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  ยกเลิก
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
                  บันทึก
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
