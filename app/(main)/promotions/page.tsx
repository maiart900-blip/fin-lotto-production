'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Gift, Percent, DollarSign, Users, Calendar, Loader2 } from 'lucide-react';

interface Promotion {
  id: string;
  name: string;
  type: string;
  description: string;
  bonus_type: string;
  bonus_value: number;
  min_deposit: number;
  max_bonus: number;
  turnover_multiplier: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  once_per_user: boolean;
  image_url: string;
  created_at: string;
}

const PROMO_TYPES = [
  { value: 'signup_bonus', label: 'โบนัสสมัครใหม่', icon: Users, color: 'bg-green-500' },
  { value: 'deposit_bonus', label: 'โบนัสฝาก', icon: DollarSign, color: 'bg-blue-500' },
  { value: 'cashback', label: 'คืนยอดเสีย', icon: Percent, color: 'bg-orange-500' },
  { value: 'referral_bonus', label: 'โบนัสแนะนำเพื่อน', icon: Gift, color: 'bg-pink-500' },
  { value: 'special', label: 'โปรพิเศษ', icon: Calendar, color: 'bg-purple-500' },
];

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'signup_bonus',
    description: '',
    bonus_type: 'fixed',
    bonus_value: 0,
    min_deposit: 0,
    max_bonus: 0,
    turnover_multiplier: 1,
    start_date: '',
    end_date: '',
    is_active: true,
    once_per_user: true,
    image_url: '',
  });

  useEffect(() => {
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    try {
      const res = await fetch('/api/promotions');
      const data = await res.json();
      setPromotions(data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name) {
      toast.error('กรุณากรอกชื่อโปรโมชั่น');
      return;
    }

    setSaving(true);
    try {
      const method = editingPromo ? 'PUT' : 'POST';
      const body = editingPromo ? { ...form, id: editingPromo.id } : form;
      
      const res = await fetch('/api/promotions', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed');
      
      toast.success(editingPromo ? 'อัปเดตสำเร็จ' : 'สร้างสำเร็จ');
      setDialogOpen(false);
      resetForm();
      fetchPromotions();
    } catch (error) {
      console.error('Error:', error);
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (promo: Promotion) => {
    setEditingPromo(promo);
    setForm({
      name: promo.name,
      type: promo.type,
      description: promo.description || '',
      bonus_type: promo.bonus_type || 'fixed',
      bonus_value: promo.bonus_value || 0,
      min_deposit: promo.min_deposit || 0,
      max_bonus: promo.max_bonus || 0,
      turnover_multiplier: promo.turnover_multiplier || 1,
      start_date: promo.start_date?.split('T')[0] || '',
      end_date: promo.end_date?.split('T')[0] || '',
      is_active: promo.is_active,
      once_per_user: promo.once_per_user,
      image_url: promo.image_url || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ยืนยันการลบ?')) return;
    
    try {
      const res = await fetch(`/api/promotions?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success('ลบสำเร็จ');
      fetchPromotions();
    } catch (error) {
      console.error('Error:', error);
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const handleToggle = async (promo: Promotion) => {
    try {
      const res = await fetch('/api/promotions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: promo.id, is_active: !promo.is_active }),
      });
      if (!res.ok) throw new Error('Failed');
      fetchPromotions();
    } catch (error) {
      console.error('Error:', error);
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const resetForm = () => {
    setEditingPromo(null);
    setForm({
      name: '',
      type: 'signup_bonus',
      description: '',
      bonus_type: 'fixed',
      bonus_value: 0,
      min_deposit: 0,
      max_bonus: 0,
      turnover_multiplier: 1,
      start_date: '',
      end_date: '',
      is_active: true,
      once_per_user: true,
      image_url: '',
    });
  };

  const getPromoType = (type: string) => PROMO_TYPES.find(t => t.value === type);

  const formatMoney = (n: number) => new Intl.NumberFormat('th-TH').format(n);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">โปรโมชั่น</h1>
          <p className="text-muted-foreground">จัดการโปรโมชั่นและโบนัสต่างๆ</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-2" />
              เพิ่มโปรโมชั่น
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPromo ? 'แก้ไขโปรโมชั่น' : 'เพิ่มโปรโมชั่น'}</DialogTitle>
              <DialogDescription>กรอกรายละเอียดโปรโมชั่น</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>ชื่อโปรโมชั่น *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="สมัครใหม่รับ 50 บาท"
                  />
                </div>
                <div>
                  <Label>ประเภท</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROMO_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>รายละเอียด</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <Label>ประเภทโบนัส</Label>
                  <Select value={form.bonus_type} onValueChange={(v) => setForm({ ...form, bonus_type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">จำนวนเงิน (บาท)</SelectItem>
                      <SelectItem value="percent">เปอร์เซ็นต์ (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>มูลค่าโบนัส</Label>
                  <Input
                    type="number"
                    value={form.bonus_value}
                    onChange={(e) => setForm({ ...form, bonus_value: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>โบนัสสูงสุด (บาท)</Label>
                  <Input
                    type="number"
                    value={form.max_bonus}
                    onChange={(e) => setForm({ ...form, max_bonus: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <Label>ฝากขั้นต่ำ (บาท)</Label>
                  <Input
                    type="number"
                    value={form.min_deposit}
                    onChange={(e) => setForm({ ...form, min_deposit: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Turnover (เท่า)</Label>
                  <Input
                    type="number"
                    value={form.turnover_multiplier}
                    onChange={(e) => setForm({ ...form, turnover_multiplier: parseFloat(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <Label>URL รูปภาพ</Label>
                  <Input
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>วันเริ่มต้น</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>วันสิ้นสุด</Label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                  />
                  <Label>เปิดใช้งาน</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.once_per_user}
                    onCheckedChange={(v) => setForm({ ...form, once_per_user: v })}
                  />
                  <Label>จำกัด 1 ครั้งต่อยูส</Label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                ยกเลิก
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
                {editingPromo ? 'อัปเดต' : 'สร้าง'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-5 gap-4">
        {PROMO_TYPES.map(type => {
          const count = promotions.filter(p => p.type === type.value && p.is_active).length;
          const Icon = type.icon;
          return (
            <Card key={type.value}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${type.color}`}>
                    <Icon className="size-4 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{type.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Promotions Table */}
      <Card>
        <CardHeader>
          <CardTitle>รายการโปรโมชั่น</CardTitle>
          <CardDescription>ทั้งหมด {promotions.length} รายการ</CardDescription>
        </CardHeader>
        <CardContent>
          {promotions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Gift className="size-12 mx-auto mb-4 opacity-50" />
              <p>ยังไม่มีโปรโมชั่น</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead className="text-right">โบนัส</TableHead>
                  <TableHead className="text-right">ฝากขั้นต่ำ</TableHead>
                  <TableHead>ระยะเวลา</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                  <TableHead className="text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promotions.map((promo) => {
                  const type = getPromoType(promo.type);
                  return (
                    <TableRow key={promo.id}>
                      <TableCell className="font-medium">{promo.name}</TableCell>
                      <TableCell>
                        <Badge className={type?.color}>{type?.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {promo.bonus_type === 'percent' 
                          ? `${promo.bonus_value}%`
                          : `฿${formatMoney(promo.bonus_value)}`
                        }
                        {promo.max_bonus > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (สูงสุด ฿{formatMoney(promo.max_bonus)})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {promo.min_deposit > 0 ? `฿${formatMoney(promo.min_deposit)}` : '-'}
                      </TableCell>
                      <TableCell>
                        {promo.start_date && promo.end_date ? (
                          <span className="text-xs">
                            {new Date(promo.start_date).toLocaleDateString('th-TH')} - {new Date(promo.end_date).toLocaleDateString('th-TH')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">ไม่จำกัด</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={promo.is_active}
                          onCheckedChange={() => handleToggle(promo)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(promo)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(promo.id)}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
