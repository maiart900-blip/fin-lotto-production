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
import { Building2, Search, Loader2, RefreshCw, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

const BANK_NAMES: Record<string, string> = {
  kbank: 'ธนาคารกสิกรไทย',
  scb: 'ธนาคารไทยพาณิชย์',
  bbl: 'ธนาคารกรุงเทพ',
  ktb: 'ธนาคารกรุงไทย',
  bay: 'ธนาคารกรุงศรี',
  tmb: 'ธนาคารทีเอ็มบีธนชาต',
  gsb: 'ธนาคารออมสิน',
  ttb: 'ธนาคารทหารไทยธนชาต',
};

function formatThaiDate(dateString: string) {
  const date = new Date(dateString);
  const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const day = date.getDate();
  const month = thaiMonths[date.getMonth()];
  const year = date.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

export default function CustomerBanksPage() {
  const { data: customers = [], mutate, isLoading, error } = useSWR('/api/customers', fetcher);
  const [search, setSearch] = useState('');

  // Filter customers who have bank info
  const customersWithBank = customers.filter((c: any) => c.bank_code || c.bank_account_number);

  const filteredCustomers = customersWithBank.filter((c: any) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(s) ||
      c.phone?.includes(s) ||
      c.bank_account_number?.includes(s) ||
      c.bank_account_name?.toLowerCase().includes(s)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-destructive">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
        <Button onClick={() => mutate()} variant="outline">
          <RefreshCw className="size-4 mr-2" />
          ลองใหม่
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="size-6" />
            ธนาคารลูกค้า
          </h1>
          <p className="text-muted-foreground">บัญชีธนาคารที่ลูกค้าเพิ่มไว้</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          <RefreshCw className="size-4 mr-2" />
          รีเฟรช
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{customersWithBank.length}</div>
            <p className="text-sm text-muted-foreground">ลูกค้าที่มีบัญชี</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-muted-foreground">
              {customers.length - customersWithBank.length}
            </div>
            <p className="text-sm text-muted-foreground">ยังไม่เพิ่มบัญชี</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-primary">{customers.length}</div>
            <p className="text-sm text-muted-foreground">สมาชิกทั้งหมด</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ค้นหา</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาด้วยชื่อ / เบอร์โทร / เลขบัญชี / ชื่อบัญชี..."
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
                <TableHead>ชื่อลูกค้า</TableHead>
                <TableHead>เบอร์โทร</TableHead>
                <TableHead>ธนาคาร</TableHead>
                <TableHead>ชื่อบัญชี</TableHead>
                <TableHead>เลขบัญชี</TableHead>
                <TableHead>วันที่เพิ่ม</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {search ? 'ไม่พบข้อมูลที่ค้นหา' : 'ยังไม่มีลูกค้าที่เพิ่มบัญชีธนาคาร'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer: any) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="font-medium">{customer.name || '-'}</div>
                    </TableCell>
                    <TableCell>{customer.phone || '-'}</TableCell>
                    <TableCell>{BANK_NAMES[customer.bank_code] || customer.bank_code || '-'}</TableCell>
                    <TableCell>{customer.bank_account_name || '-'}</TableCell>
                    <TableCell className="font-mono">{customer.bank_account_number || '-'}</TableCell>
                    <TableCell className="text-sm">
                      {customer.created_at ? formatThaiDate(customer.created_at) : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
