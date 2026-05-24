'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Users, Percent, TrendingUp, History, Calculator } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Partner {
  id: string;
  name: string;
  phone: string | null;
  share_percent: number;
  is_active: boolean;
  created_at: string;
}

interface PartnerShare {
  id: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  share_percent: number;
  share_amount: number;
  created_at: string;
}

interface PartnersResponse {
  partners: Partner[];
  summary: {
    totalPartners: number;
    activePartners: number;
    totalSharePercent: number;
    totalBets: number;
    totalShareAmount: number;
  };
}

export default function PartnersPage() {
  const { canAccess } = useAuth();
  const { data: partnersData, mutate } = useSWR<PartnersResponse>('/api/partners', fetcher, { refreshInterval: 10000 });
  const { data: entriesData } = useSWR('/api/bets', fetcher);
  const partners = partnersData?.partners || [];
  const summary = partnersData?.summary;
  const entries = entriesData?.bets || [];
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editPartner, setEditPartner] = useState<Partner | null>(null);
  const [sharesPartner, setSharesPartner] = useState<Partner | null>(null);
  const [calcPartner, setCalcPartner] = useState<Partner | null>(null);
  const [partnerShares, setPartnerShares] = useState<PartnerShare[]>([]);
  
  const [form, setForm] = useState({
    name: '',
    phone: '',
    sharePercent: '0',
    isActive: true,
  });

  const [calcForm, setCalcForm] = useState({
    periodStart: new Date().toISOString().split('T')[0],
    periodEnd: new Date().toISOString().split('T')[0],
  });

  // Calculate totals from summary or partners array
  const totalSharePercent = summary?.totalSharePercent || partners.filter(p => p.is_active).reduce((sum, p) => sum + Number(p.share_percent), 0);
  const activePartners = summary?.activePartners || partners.filter(p => p.is_active).length;

  const resetForm = () => {
    setForm({ name: '', phone: '', sharePercent: '0', isActive: true });
  };

  const handleAdd = async () => {
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          sharePercent: parseFloat(form.sharePercent),
          isActive: form.isActive,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }

      toast.success('เพิ่มหุ้นส่วนสำเร็จ');
      mutate();
      setIsAddOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    }
  };

  const handleEdit = async () => {
    if (!editPartner) return;

    try {
      const res = await fetch(`/api/partners/${editPartner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          sharePercent: parseFloat(form.sharePercent),
          isActive: form.isActive,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }

      toast.success('แก้ไขหุ้นส่วนสำเร็จ');
      mutate();
      setEditPartner(null);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/partners/${id}`, { method: 'DELETE' });
      toast.success('ลบหุ้นส่วนสำเร็จ');
      mutate();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const openEdit = (partner: Partner) => {
    setForm({
      name: partner.name,
      phone: partner.phone || '',
      sharePercent: String(partner.share_percent),
      isActive: partner.is_active,
    });
    setEditPartner(partner);
  };

  const loadShares = async (partner: Partner) => {
    setSharesPartner(partner);
    const res = await fetch(`/api/partners/${partner.id}/shares`);
    const data = await res.json();
    setPartnerShares(data);
  };

  const handleCalculateShare = async () => {
    if (!calcPartner || !entries) return;

    // Filter entries by date range
    const filteredEntries = entries.filter((e: { created_at: string }) => {
      const date = new Date(e.created_at).toISOString().split('T')[0];
      return date >= calcForm.periodStart && date <= calcForm.periodEnd;
    });

    const totalAmount = filteredEntries.reduce((sum: number, e: { amount: number }) => sum + e.amount, 0);

    try {
      const res = await fetch(`/api/partners/${calcPartner.id}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodStart: calcForm.periodStart,
          periodEnd: calcForm.periodEnd,
          totalAmount,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }

      const data = await res.json();
      toast.success(`คำนวณส่วนแบ่งสำเร็จ: ${data.share_amount.toLocaleString()} บาท`);
      setCalcPartner(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    }
  };

  const isAdmin = canAccess('admin');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">จัดการหุ้นส่วน</h1>
          <p className="text-sm text-muted-foreground">จัดการข้อมูลหุ้นส่วนและส่วนแบ่ง</p>
        </div>
        {isAdmin && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-red-700">
                <Plus className="mr-2 size-4" />
                เพิ่มหุ้นส่วน
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>เพิ่มหุ้นส่วนใหม่</DialogTitle>
                <DialogDescription>กรอกข้อมูลหุ้นส่วน</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>ชื่อหุ้นส่วน</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="ชื่อหุ้นส่วน"
                  />
                </div>
                <div className="space-y-2">
                  <Label>เบอร์โทร</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="เบอร์โทรศัพท์"
                  />
                </div>
                <div className="space-y-2">
                  <Label>เปอร์เซ็นต์ส่วนแบ่ง (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.sharePercent}
                    onChange={(e) => setForm({ ...form, sharePercent: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                  />
                  <Label>เปิดใช้งาน</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>ยกเลิก</Button>
                <Button onClick={handleAdd} disabled={!form.name}>บันทึก</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">หุ้นส่วนทั้งหมด</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{partners.length}</div>
            <p className="text-xs text-muted-foreground">เปิดใช้งาน {activePartners} คน</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">รวมส่วนแบ่ง</CardTitle>
            <Percent className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSharePercent.toFixed(2)}%</div>
            <p className="text-xs text-muted-foreground">จากหุ้นส่วนที่เปิดใช้งาน</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ส่วนที่เหลือ</CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{(100 - totalSharePercent).toFixed(2)}%</div>
            <p className="text-xs text-muted-foreground">ส่วนแบ่งของเจ้าของ</p>
          </CardContent>
        </Card>
      </div>

      {/* Partners Table */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>รายชื่อหุ้นส่วน</CardTitle>
          <CardDescription>รายชื่อหุ้นส่วนทั้งหมดในระบบ</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>เบอร์โทร</TableHead>
                  <TableHead className="text-right">ส่วนแบ่ง (%)</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((partner) => (
                  <TableRow key={partner.id}>
                    <TableCell className="font-medium">{partner.name}</TableCell>
                    <TableCell>{partner.phone || '-'}</TableCell>
                    <TableCell className="text-right font-mono">
                      <span className="text-amber-500">{Number(partner.share_percent).toFixed(2)}%</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={partner.is_active ? 'default' : 'secondary'}>
                        {partner.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => loadShares(partner)}
                          title="ดูประวัติส่วนแบ่ง"
                        >
                          <History className="size-4" />
                        </Button>
                        {isAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => setCalcPartner(partner)}
                              title="คำนวณส่วนแบ่ง"
                            >
                              <Calculator className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => openEdit(partner)}
                            >
                              <Edit2 className="size-4" />
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
                                    คุณต้องการลบหุ้นส่วน {partner.name} หรือไม่?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(partner.id)}
                                    className="bg-destructive text-destructive-foreground"
                                  >
                                    ลบ
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!partners || partners.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      ยังไม่มีหุ้นส่วน
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editPartner} onOpenChange={(open) => !open && setEditPartner(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขหุ้นส่วน</DialogTitle>
            <DialogDescription>แก้ไขข้อมูลหุ้นส่วน {editPartner?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>ชื่อหุ้นส่วน</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>เบอร์โทร</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>เปอร์เซ็นต์ส่วนแบ่ง (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.sharePercent}
                onChange={(e) => setForm({ ...form, sharePercent: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
              />
              <Label>เปิดใช้งาน</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPartner(null)}>ยกเลิก</Button>
            <Button onClick={handleEdit}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shares History Dialog */}
      <Dialog open={!!sharesPartner} onOpenChange={(open) => !open && setSharesPartner(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>ประวัติส่วนแบ่ง - {sharesPartner?.name}</DialogTitle>
            <DialogDescription>ประวัติการคำนวณส่วนแบ่งทั้งหมด</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ช่วงเวลา</TableHead>
                  <TableHead className="text-right">ยอดรวม</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">ส่วนแบ่ง</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partnerShares.map((share) => (
                  <TableRow key={share.id}>
                    <TableCell>
                      {new Date(share.period_start).toLocaleDateString('th-TH')} - {new Date(share.period_end).toLocaleDateString('th-TH')}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {share.total_amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-amber-500">
                      {Number(share.share_percent).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right font-mono text-green-500">
                      {Number(share.share_amount).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                {partnerShares.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      ยังไม่มีประวัติส่วนแบ่ง
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Calculate Share Dialog */}
      <Dialog open={!!calcPartner} onOpenChange={(open) => !open && setCalcPartner(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>คำนวณส่วนแบ่ง - {calcPartner?.name}</DialogTitle>
            <DialogDescription>เลือกช่วงเวลาที่ต้องการคำนวณ (ส่วนแบ่ง {calcPartner?.share_percent}%)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>วันที่เริ่มต้น</Label>
                <Input
                  type="date"
                  value={calcForm.periodStart}
                  onChange={(e) => setCalcForm({ ...calcForm, periodStart: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>วันที่สิ้นสุด</Label>
                <Input
                  type="date"
                  value={calcForm.periodEnd}
                  onChange={(e) => setCalcForm({ ...calcForm, periodEnd: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCalcPartner(null)}>ยกเลิก</Button>
            <Button onClick={handleCalculateShare}>คำนวณ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
