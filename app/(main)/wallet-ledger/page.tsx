'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpDown, Search, Filter, Download, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function WalletLedgerPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ArrowUpDown className="size-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Wallet Ledger</h1>
            <p className="text-muted-foreground">บันทึกการเคลื่อนไหวของกระเป๋าเงินทั้งหมด</p>
          </div>
        </div>
        <Button variant="outline">
          <Download className="size-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="size-4 text-green-500" />
              ยอดเข้าวันนี้
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">0.00 บาท</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="size-4 text-red-500" />
              ยอดออกวันนี้
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">0.00 บาท</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="size-4 text-primary" />
              ยอดคงเหลือรวม
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">0.00 บาท</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="ค้นหารายการ..." className="pl-9" />
            </div>
            <Button variant="outline">
              <Filter className="size-4 mr-2" />
              กรอง
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <ArrowUpDown className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">ยังไม่มีรายการ</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              เมื่อมีการเคลื่อนไหวของกระเป๋าเงิน รายการจะแสดงที่นี่
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
