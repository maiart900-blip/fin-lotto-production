'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  User,
  Phone,
  CreditCard,
  Calendar,
  Clock,
  Wallet,
  History,
  Gift,
  Ban,
  CheckCircle,
  Loader2,
  RefreshCw,
  Landmark,
  TrendingUp,
  TrendingDown,
  PenLine,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { EditUserModal } from '@/components/admin/edit-user-modal';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

// Format Thai date full
function formatThaiDateFull(dateString: string) {
  const date = new Date(dateString);
  const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const day = date.getDate();
  const month = thaiMonths[date.getMonth()];
  const year = date.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

// Calculate days since
function daysSince(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

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

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [isSuspending, setIsSuspending] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const { data: customer, mutate, isLoading, error } = useSWR(
    `/api/customers/${id}`,
    fetcher
  );

  const { data: topups = [] } = useSWR(`/api/customers/${id}/topups`, fetcher);
  const { data: withdraws = [] } = useSWR(`/api/customers/${id}/withdraws`, fetcher);
  const { data: entries = [] } = useSWR(`/api/customers/${id}/entries`, fetcher);
  const { data: creditLogs = [] } = useSWR(`/api/customers/${id}/credit-logs`, fetcher);

  const handleToggleStatus = async () => {
    setIsSuspending(true);
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !customer.is_active }),
      });
      if (!res.ok) throw new Error('Failed to update');
      mutate();
      toast.success(customer.is_active ? 'ระงับบัญชีสำเร็จ' : 'เปิดใช้งานบัญชีสำเร็จ');
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsSuspending(false);
      setShowSuspendDialog(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-destructive">ไม่พบข้อมูลสมาชิก</p>
        <Button onClick={() => router.push('/customers')} variant="outline">
          <ArrowLeft className="size-4 mr-2" />
          กลับไปหน้าสมาชิก
        </Button>
      </div>
    );
  }

  const totalTopup = Array.isArray(topups) ? topups.filter((t: any) => t.status === 'approved').reduce((sum: number, t: any) => sum + (t.amount || 0), 0) : 0;
  const totalWithdraw = Array.isArray(withdraws) ? withdraws.filter((w: any) => w.status === 'approved').reduce((sum: number, w: any) => sum + (w.amount || 0), 0) : 0;
  const totalBet = Array.isArray(entries) ? entries.reduce((sum: number, e: any) => sum + (e.amount || 0), 0) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.push('/customers')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">รายละเอียดสมาชิก</h1>
          <p className="text-muted-foreground">ID: {customer.id}</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowEditModal(true)}
            className="border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10"
          >
            <PenLine className="size-4 mr-2" />
            แก้ไขข้อมูล
          </Button>
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            <RefreshCw className="size-4 mr-2" />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* Customer Info Card */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="size-5" />
              ข้อมูลสมาชิก
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <User className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">ชื่อ</p>
                  <p className="font-medium">{customer.name || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">เบอร์โทร</p>
                  <p className="font-medium">{customer.phone || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CreditCard className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Username</p>
                  <p className="font-medium">{customer.username ? `@${customer.username}` : '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">วันที่สมัคร</p>
                  <p className="font-medium">
                    {customer.created_at ? formatThaiDateFull(customer.created_at) : '-'}
                    {customer.created_at && (
                      <span className="text-xs text-muted-foreground ml-2">
                        (สมัครมาแล้ว {daysSince(customer.created_at)} วัน)
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">เข้าสู่ระบบล่าสุด</p>
                  <p className="font-medium">
                    {customer.last_login_at ? formatThaiDateFull(customer.last_login_at) : 'ยังไม่เคยเข้าสู่ระบบ'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Gift className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">รหัสแนะนำ</p>
                  <p className="font-medium">{customer.referral_code || '-'}</p>
                </div>
              </div>
            </div>

            {/* Bank Info */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Building2 className="size-4" />
                บัญชีธนาคาร
              </h4>
              {customer.bank_code ? (
                <div className="grid sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">ธนาคาร</p>
                    <p className="font-medium">{BANK_NAMES[customer.bank_code] || customer.bank_code}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">เลขบัญชี</p>
                    <p className="font-medium">{customer.bank_account_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">ชื่อบัญชี</p>
                    <p className="font-medium">{customer.bank_account_name || '-'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">ยังไม่ได้เพิ่มบัญชีธนาคาร</p>
              )}
            </div>

            {/* Status & Actions */}
            <div className="border-t pt-4 mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">สถานะ:</span>
                <Badge variant={customer.is_active ? 'default' : 'destructive'} className="text-sm">
                  {customer.is_active ? 'ใช้งานปกติ' : 'ถูกระงับ'}
                </Badge>
              </div>
              <Button
                variant={customer.is_active ? 'destructive' : 'default'}
                onClick={() => setShowSuspendDialog(true)}
              >
                {customer.is_active ? (
                  <>
                    <Ban className="size-4 mr-2" />
                    ระงับบัญชี
                  </>
                ) : (
                  <>
                    <CheckCircle className="size-4 mr-2" />
                    เปิดใช้งาน
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Credit Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="size-5" />
              เครดิต
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">เครดิตคงเหลือ</p>
              <p className="text-4xl font-bold text-primary">
                {(customer.credit_balance || 0).toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">บาท</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="size-3 text-green-500" />
                  เติมเงินรวม
                </span>
                <span className="font-medium text-green-500">{totalTopup.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingDown className="size-3 text-red-500" />
                  ถอนเงินรวม
                </span>
                <span className="font-medium text-red-500">{totalWithdraw.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <PenLine className="size-3 text-blue-500" />
                  ยอดแทงรวม
                </span>
                <span className="font-medium text-blue-500">{totalBet.toLocaleString()}</span>
              </div>
            </div>
            
            {/* Turnover Status */}
            {customer.required_turnover > 0 && (
              <div className="border-t pt-4 space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <History className="size-4 text-amber-500" />
                  สถานะเทิร์นโอเวอร์
                </h4>
                {(() => {
                  const current = customer.current_turnover || 0;
                  const required = customer.required_turnover || 0;
                  const progress = required > 0 ? Math.min(100, (current / required) * 100) : 100;
                  const isComplete = current >= required;
                  const remaining = Math.max(0, required - current);
                  
                  return (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <Badge variant={isComplete ? 'default' : 'secondary'} className={isComplete ? 'bg-green-500' : 'bg-amber-500'}>
                          {isComplete ? 'ครบแล้ว' : 'ยังไม่ครบ'}
                        </Badge>
                        <span className="font-mono font-medium">{progress.toFixed(0)}%</span>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${isComplete ? 'bg-green-500' : 'bg-amber-500'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">เดิมพันแล้ว</p>
                          <p className="font-medium font-mono">{current.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">เป้าหมาย</p>
                          <p className="font-medium font-mono">{required.toLocaleString()}</p>
                        </div>
                      </div>
                      
                      {!isComplete && (
                        <p className="text-xs text-amber-500">
                          ต้องเดิมพันอีก {remaining.toLocaleString()} บาท
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History Tabs */}
      <Card>
        <Tabs defaultValue="topups">
          <CardHeader>
            <TabsList className="grid grid-cols-4 w-full max-w-xl">
              <TabsTrigger value="topups">ประวัติเติมเงิน</TabsTrigger>
              <TabsTrigger value="withdraws">ประวัติถอนเงิน</TabsTrigger>
              <TabsTrigger value="entries">ประวัติแทงหวย</TabsTrigger>
              <TabsTrigger value="credit-logs">แก้ไขเครดิต</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent>
            <TabsContent value="topups">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead className="text-right">จำนวนเงิน</TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!Array.isArray(topups) || topups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        ยังไม่มีประวัติเติมเงิน
                      </TableCell>
                    </TableRow>
                  ) : (
                    topups.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell>{t.created_at ? formatThaiDateFull(t.created_at) : '-'}</TableCell>
                        <TableCell className="text-right font-mono">{(t.amount || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={t.status === 'approved' ? 'default' : t.status === 'rejected' ? 'destructive' : 'secondary'}>
                            {t.status === 'approved' ? 'อนุมัติ' : t.status === 'rejected' ? 'ปฏิเสธ' : 'รอดำเ���ินการ'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="withdraws">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead className="text-right">จำนวนเงิน</TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!Array.isArray(withdraws) || withdraws.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        ยังไม่มีประวัติถอนเงิน
                      </TableCell>
                    </TableRow>
                  ) : (
                    withdraws.map((w: any) => (
                      <TableRow key={w.id}>
                        <TableCell>{w.created_at ? formatThaiDateFull(w.created_at) : '-'}</TableCell>
                        <TableCell className="text-right font-mono">{(w.amount || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={w.status === 'approved' ? 'default' : w.status === 'rejected' ? 'destructive' : 'secondary'}>
                            {w.status === 'approved' ? 'อนุมัติ' : w.status === 'rejected' ? 'ปฏิเสธ' : 'รอดำเนินการ'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="entries">
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
                        <TableCell>{e.lottery_name || e.lottery_id || '-'}</TableCell>
                        <TableCell className="font-mono">{e.number}</TableCell>
                        <TableCell>{e.bet_type}</TableCell>
                        <TableCell className="text-right font-mono">{(e.amount || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="credit-logs">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead className="text-right">จำนวน</TableHead>
                    <TableHead>หมายเหตุ</TableHead>
                    <TableHead>ผู้ดำเนินการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!Array.isArray(creditLogs) || creditLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        ยังไม่มีประวัติแก้ไขเครดิต
                      </TableCell>
                    </TableRow>
                  ) : (
                    creditLogs.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell>{log.created_at ? formatThaiDateFull(log.created_at) : '-'}</TableCell>
                        <TableCell>
                          <Badge variant={log.type === 'add' ? 'default' : 'destructive'}>
                            {log.type === 'add' ? 'เพิ่ม' : 'ลด'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {log.type === 'add' ? '+' : '-'}{Math.abs(log.amount || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>{log.note || '-'}</TableCell>
                        <TableCell>{log.admin_name || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Suspend Dialog */}
      <AlertDialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {customer.is_active ? 'ระงับบัญชีสมาชิก?' : 'เปิดใช้งานบัญชี?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {customer.is_active
                ? 'สมาชิกจะไม่สามารถเข้าสู่ระบบหรือทำรายการใดๆ ได้'
                : 'สมาชิกจะสามารถเข้าสู่ระบบและทำรายการได้ตามปกติ'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleStatus} disabled={isSuspending}>
              {isSuspending && <Loader2 className="size-4 mr-2 animate-spin" />}
              ยืนยัน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit User Modal */}
      <EditUserModal
        user={customer as any}
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={() => mutate()}
      />
    </div>
  );
}
