'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Link2, Copy, Users, Wallet, TrendingUp, Gift } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Referral {
  id: string;
  referrer_id: string;
  referred_customer_id: string;
  referral_code: string;
  commission_percent: number;
  created_at: string;
  referrer: {
    id: string;
    username: string;
    display_name: string;
    referral_code: string;
  };
  customer: {
    id: string;
    name: string;
    phone: string;
  };
}

interface Commission {
  id: string;
  amount: number;
  commission_amount: number;
  created_at: string;
  referral: {
    id: string;
    referrer: { display_name: string };
    customer: { name: string };
  };
  entry: {
    number: string;
    bet_type: string;
    amount: number;
  };
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

export default function ReferralsPage() {
  const { user, canAccess } = useAuth();
  const { data: referrals, mutate: mutateReferrals } = useSWR<Referral[]>('/api/referrals', fetcher, { refreshInterval: 10000 });
  const { data: commissions } = useSWR<Commission[]>('/api/commissions', fetcher, { refreshInterval: 10000 });
  const { data: customers } = useSWR<Customer[]>('/api/customers', fetcher);
  const { data: users } = useSWR('/api/users', fetcher);
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({
    customerId: '',
    referralCode: '',
    commissionPercent: '5',
  });

  // Stats
  const totalCommissions = commissions?.reduce((sum, c) => sum + Number(c.commission_amount), 0) || 0;
  const myReferrals = referrals?.filter(r => r.referrer_id === user?.id) || [];
  const myCode = users?.find((u: { id: string }) => u.id === user?.id)?.referral_code || '';

  // Get customers without referrers
  const availableCustomers = customers?.filter(
    c => !referrals?.some(r => r.referred_customer_id === c.id)
  ) || [];

  const handleAdd = async () => {
    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: form.customerId,
          referralCode: form.referralCode,
          commissionPercent: parseFloat(form.commissionPercent),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }

      toast.success('เพิ่มการแนะนำสำเร็จ');
      mutateReferrals();
      setIsAddOpen(false);
      setForm({ customerId: '', referralCode: '', commissionPercent: '5' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('คัดลอกรหัสแนะนำแล้ว');
  };

  const isAdmin = canAccess('admin');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ระบบแนะนำ</h1>
          <p className="text-sm text-muted-foreground">จัดการการแนะนำลูกค้าและค่าคอมมิชชั่น</p>
        </div>
        {isAdmin && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-red-700">
                <Plus className="mr-2 size-4" />
                เพิ่มการแนะนำ
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>เพิ่มการแนะนำใหม่</DialogTitle>
                <DialogDescription>เชื่อมโยงลูกค้ากับผู้แนะนำ</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>ลูกค้า</Label>
                  <Select
                    value={form.customerId}
                    onValueChange={(v) => setForm({ ...form, customerId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกลูกค้า" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCustomers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.phone && `(${c.phone})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>รหัสแนะนำ</Label>
                  <Input
                    value={form.referralCode}
                    onChange={(e) => setForm({ ...form, referralCode: e.target.value.toUpperCase() })}
                    placeholder="รหัสแนะนำ 8 หลัก"
                    maxLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ค่าคอมมิชชั่น (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    step="0.01"
                    value={form.commissionPercent}
                    onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">0-10% ต่อยอดเดิมพัน</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>ยกเลิก</Button>
                <Button onClick={handleAdd} disabled={!form.customerId || !form.referralCode}>บันทึก</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* My Referral Code */}
      {myCode && (
        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gift className="size-5 text-amber-500" />
              รหัสแนะนำของคุณ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="rounded-lg border border-amber-500/30 bg-background/50 px-6 py-3">
                <span className="font-mono text-2xl font-bold tracking-wider text-amber-500">
                  {myCode}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={() => copyCode(myCode)}>
                <Copy className="mr-2 size-4" />
                คัดลอก
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              แชร์รหัสนี้ให้ลูกค้าใหม่เพื่อรับค่าคอมมิชชั่น
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ลูกค้าที่แนะนำ</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myReferrals.length}</div>
            <p className="text-xs text-muted-foreground">คนที่คุณแนะนำ</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">การแนะนำทั้งหมด</CardTitle>
            <Link2 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{referrals?.length || 0}</div>
            <p className="text-xs text-muted-foreground">ในระบบ</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ค่าคอมมิชชั่นรวม</CardTitle>
            <Wallet className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {totalCommissions.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">บาท</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="referrals" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="referrals">การแนะนำ</TabsTrigger>
          <TabsTrigger value="commissions">ค่าคอมมิชชั่น</TabsTrigger>
        </TabsList>

        <TabsContent value="referrals">
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle>รายการแนะนำ</CardTitle>
              <CardDescription>รายการการแนะนำลูกค้าทั้งหมด</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ลูกค้า</TableHead>
                      <TableHead>ผู้แนะนำ</TableHead>
                      <TableHead>รหัส</TableHead>
                      <TableHead className="text-right">คอมมิชชั่น</TableHead>
                      <TableHead>วันที่</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrals?.map((ref) => (
                      <TableRow key={ref.id}>
                        <TableCell className="font-medium">{ref.customer?.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {ref.referrer?.display_name}
                            {ref.referrer_id === user?.id && (
                              <Badge variant="outline" className="text-xs">คุณ</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono">
                            {ref.referral_code}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-amber-500">
                          {Number(ref.commission_percent).toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(ref.created_at).toLocaleDateString('th-TH')}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!referrals || referrals.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          ยังไม่มีการแนะนำ
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commissions">
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle>ประวัติค่าคอมมิชชั่น</CardTitle>
              <CardDescription>รายการค่าคอมมิชชั่นที่ได้รับ</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ลูกค้า</TableHead>
                      <TableHead>เลข</TableHead>
                      <TableHead className="text-right">ยอดเดิมพัน</TableHead>
                      <TableHead className="text-right">ค่าคอมมิชชั่น</TableHead>
                      <TableHead>วันที่</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions?.map((com) => (
                      <TableRow key={com.id}>
                        <TableCell className="font-medium">
                          {com.referral?.customer?.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {com.entry?.number}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {com.amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-500">
                          +{Number(com.commission_amount).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(com.created_at).toLocaleDateString('th-TH')}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!commissions || commissions.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          ยังไม่มีค่าคอมมิชชั่น
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
