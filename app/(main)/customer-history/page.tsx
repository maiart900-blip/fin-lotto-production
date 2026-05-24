'use client';

import { useState } from 'react';
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
import {
  History,
  Loader2,
  RefreshCw,
  User,
  Calendar,
  TrendingUp,
  TrendingDown,
  PenLine,
  Wallet,
} from 'lucide-react';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

function formatThaiDateFull(dateString: string) {
  const date = new Date(dateString);
  const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const day = date.getDate();
  const month = thaiMonths[date.getMonth()];
  const year = date.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

export default function CustomerHistoryPage() {
  const { data: customers = [], isLoading: isLoadingCustomers } = useSWR('/api/customers', fetcher);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  const { data: topups = [], isLoading: isLoadingTopups } = useSWR(
    selectedCustomerId ? `/api/customers/${selectedCustomerId}/topups` : null,
    fetcher
  );
  const { data: withdraws = [], isLoading: isLoadingWithdraws } = useSWR(
    selectedCustomerId ? `/api/customers/${selectedCustomerId}/withdraws` : null,
    fetcher
  );
  const { data: entries = [], isLoading: isLoadingEntries } = useSWR(
    selectedCustomerId ? `/api/customers/${selectedCustomerId}/entries` : null,
    fetcher
  );

  const selectedCustomer = customers.find((c: any) => c.id === selectedCustomerId);

  const isLoading = isLoadingTopups || isLoadingWithdraws || isLoadingEntries;

  // Calculate stats
  const approvedTopups = Array.isArray(topups) ? topups.filter((t: any) => t.status === 'approved') : [];
  const approvedWithdraws = Array.isArray(withdraws) ? withdraws.filter((w: any) => w.status === 'approved') : [];
  const totalTopup = approvedTopups.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
  const totalWithdraw = approvedWithdraws.reduce((sum: number, w: any) => sum + (w.amount || 0), 0);
  const totalBet = Array.isArray(entries) ? entries.reduce((sum: number, e: any) => sum + (e.amount || 0), 0) : 0;
  const profitLoss = totalTopup - totalWithdraw;

  if (isLoadingCustomers) {
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
            <History className="size-6" />
            ประวัติลูกค้า
          </h1>
          <p className="text-muted-foreground">ดูประวัติย้อนหลังของลูกค้าแต่ละคน</p>
        </div>
      </div>

      {/* Customer Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="size-5" />
            เลือกลูกค้า
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="เลือกลูกค้าที่ต้องการดูประวัติ..." />
            </SelectTrigger>
            <SelectContent>
              {customers.map((customer: any) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name || 'ไม่มีชื่อ'} - {customer.phone || 'ไม่มีเบอร์'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {!selectedCustomerId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            กรุณาเลือกลูกค้าที่ต้องการดูประวัติ
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Customer Info */}
          {selectedCustomer && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">ข้อมูลสมาชิก</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-3">
                    <User className="size-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">ชื่อ</p>
                      <p className="font-medium">{selectedCustomer.name || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="size-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">วันที่สมัคร</p>
                      <p className="font-medium">
                        {selectedCustomer.created_at ? formatThaiDateFull(selectedCustomer.created_at) : '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Wallet className="size-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">เครดิตคงเหลือ</p>
                      <p className="font-medium">{(selectedCustomer.credit_balance || 0).toLocaleString()} บาท</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">สถานะ</p>
                    <Badge variant={selectedCustomer.is_active ? 'default' : 'destructive'}>
                      {selectedCustomer.is_active ? 'ใช้งานปกติ' : 'ถูกระงับ'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-green-500">
                  <TrendingUp className="size-4" />
                  <span className="text-sm">เติมเงินรวม</span>
                </div>
                <div className="text-2xl font-bold mt-1">{totalTopup.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">{approvedTopups.length} ครั้ง</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-red-500">
                  <TrendingDown className="size-4" />
                  <span className="text-sm">ถอนเงินรวม</span>
                </div>
                <div className="text-2xl font-bold mt-1">{totalWithdraw.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">{approvedWithdraws.length} ครั้ง</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-blue-500">
                  <PenLine className="size-4" />
                  <span className="text-sm">ยอดแทงรวม</span>
                </div>
                <div className="text-2xl font-bold mt-1">{totalBet.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">{Array.isArray(entries) ? entries.length : 0} รายการ</p>
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Wallet className="size-4" />
                  <span className="text-sm">กำไร/ขาดทุน (ฝั่งเว็บ)</span>
                </div>
                <div className={`text-2xl font-bold mt-1 ${profitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {profitLoss >= 0 ? '+' : ''}{profitLoss.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {profitLoss >= 0 ? 'เว็บได้กำไร' : 'เว็บขาดทุน'}จากลูกค้าคนนี้
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Entries Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">ประวัติแทงหวย (50 รายการล่าสุด)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>หวย</TableHead>
                    <TableHead>เลข</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead className="text-right">ยอดแทง</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!Array.isArray(entries) || entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        ยังไม่มีประวัติแทงหวย
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.slice(0, 50).map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell>{e.created_at ? formatThaiDateFull(e.created_at) : '-'}</TableCell>
                        <TableCell>{e.lottery_name || '-'}</TableCell>
                        <TableCell className="font-mono">{e.number}</TableCell>
                        <TableCell>{e.bet_type}</TableCell>
                        <TableCell className="text-right font-mono">{(e.amount || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
