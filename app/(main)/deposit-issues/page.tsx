'use client';

import { useState, useRef } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileQuestion,
  Search,
  XCircle,
  MessageSquare,
  CreditCard,
  RefreshCw,
  ExternalLink,
  Plus,
  Upload,
  Image as ImageIcon,
  Loader2,
  User,
  Phone,
  Building2,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

interface DepositIssue {
  id: string;
  customer_id: string;
  topup_request_id: string | null;
  amount: number;
  slip_image_url: string | null;
  slip_hash: string | null;
  issue_detail: string | null;
  status: 'pending' | 'reviewing' | 'need_info' | 'approved' | 'rejected';
  admin_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  credit_transaction_id: string | null;
  created_at: string;
  updated_at: string;
  // New fields
  customer_phone: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_bank_account: string | null;
  customer_bank_name: string | null;
  transfer_datetime: string | null;
  customer: {
    id: string;
    name: string;
    phone: string;
    credit_balance: number;
  };
  resolved_by_user: {
    id: string;
    name: string;
  } | null;
}

interface Summary {
  total: number;
  pending: number;
  reviewing: number;
  need_info: number;
  approved: number;
  rejected: number;
}

const statusConfig = {
  pending: { label: 'รอตรวจสอบ', color: 'bg-yellow-500', icon: Clock },
  reviewing: { label: 'กำลังตรวจสอบ', color: 'bg-blue-500', icon: Eye },
  need_info: { label: 'ต้องการข้อมูลเพิ่ม', color: 'bg-orange-500', icon: FileQuestion },
  approved: { label: 'อนุมัติแล้ว', color: 'bg-green-500', icon: CheckCircle2 },
  rejected: { label: 'ปฏิเสธ', color: 'bg-red-500', icon: XCircle },
};

export default function DepositIssuesPage() {
  const { user, canAccess } = useAuth();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIssue, setSelectedIssue] = useState<DepositIssue | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [resolveAction, setResolveAction] = useState<'approved' | 'rejected' | 'need_info'>('approved');
  const [adminNote, setAdminNote] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // New states for report form
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportForm, setReportForm] = useState({
    customerPhone: '',
    firstName: '',
    lastName: '',
    bankAccount: '',
    bankName: '',
    amount: '',
    transferDate: '',
    transferTime: '',
    note: '',
  });
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bank options
  const banks = [
    { value: 'kbank', label: 'ธนาคารกสิกรไทย' },
    { value: 'scb', label: 'ธนาคารไทยพาณิชย์' },
    { value: 'bbl', label: 'ธนาคารกรุงเทพ' },
    { value: 'ktb', label: 'ธนาคารกรุงไทย' },
    { value: 'bay', label: 'ธนาคารกรุงศรี' },
    { value: 'ttb', label: 'ธนาคารทหารไทยธนชาต' },
    { value: 'gsb', label: 'ธนาคารออมสิน' },
    { value: 'baac', label: 'ธ.ก.ส.' },
    { value: 'other', label: 'อื่นๆ' },
  ];

  const { data, mutate } = useSWR<{ issues: DepositIssue[]; summary: Summary }>(
    `/api/deposit-issues?status=${filterStatus}`,
    fetcher,
    { refreshInterval: 10000 }
  );

  const issues = data?.issues || [];
  const summary = data?.summary || { total: 0, pending: 0, reviewing: 0, need_info: 0, approved: 0, rejected: 0 };

  const filteredIssues = issues.filter((issue) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      issue.customer?.name?.toLowerCase().includes(search) ||
      issue.customer?.phone?.includes(search) ||
      issue.customer_phone?.includes(search) ||
      issue.id.toLowerCase().includes(search)
    );
  });

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 5MB)');
        return;
      }
      setSlipFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSlipPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Reset report form
  const resetReportForm = () => {
    setReportForm({
      customerPhone: '',
      firstName: '',
      lastName: '',
      bankAccount: '',
      bankName: '',
      amount: '',
      transferDate: '',
      transferTime: '',
      note: '',
    });
    setSlipFile(null);
    setSlipPreview(null);
  };

  // Submit report
  const handleSubmitReport = async () => {
    // Validate required fields
    if (!reportForm.customerPhone) {
      toast.error('กรุณากรอกเบอร์โทรลูกค้า');
      return;
    }
    if (!reportForm.firstName) {
      toast.error('กรุณากรอกชื่อ');
      return;
    }
    if (!reportForm.amount || Number(reportForm.amount) <= 0) {
      toast.error('กรุณากรอกจำนวนเงินที่โอน');
      return;
    }
    if (!reportForm.transferDate) {
      toast.error('กรุณาเลือกวันที่โอน');
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload slip if exists
      let slipUrl = null;
      if (slipFile) {
        const formData = new FormData();
        formData.append('file', slipFile);
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          slipUrl = uploadData.url;
        }
      }

      // Submit the report
      const res = await fetch('/api/deposit-issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_phone: reportForm.customerPhone,
          customer_first_name: reportForm.firstName,
          customer_last_name: reportForm.lastName,
          customer_bank_account: reportForm.bankAccount,
          customer_bank_name: reportForm.bankName,
          amount: Number(reportForm.amount),
          transfer_datetime: reportForm.transferDate + (reportForm.transferTime ? `T${reportForm.transferTime}:00` : 'T00:00:00'),
          slip_image_url: slipUrl,
          issue_detail: reportForm.note || 'ฝากเงินไม่เข้า',
        }),
      });

      if (!res.ok) throw new Error('Failed to submit');

      toast.success('แจ้งปัญหาสำเร็จ รอการตรวจสอบจากแอดมิน');
      setIsReportOpen(false);
      resetReportForm();
      mutate();
    } catch {
      toast.error('เกิดข้อผิดพลาดในการส่งข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewDetail = (issue: DepositIssue) => {
    setSelectedIssue(issue);
    setIsDetailOpen(true);
  };

  const handleOpenResolve = (issue: DepositIssue, action: 'approved' | 'rejected' | 'need_info') => {
    setSelectedIssue(issue);
    setResolveAction(action);
    setAdminNote('');
    setCreditAmount(issue.amount.toString());
    setIsResolveOpen(true);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedIssue) return;
    setIsLoading(true);

    try {
      const res = await fetch('/api/deposit-issues', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedIssue.id,
          status: newStatus,
          admin_note: adminNote,
          resolved_by: user?.id,
          credit_amount: newStatus === 'approved' ? Number(creditAmount) : undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to update');

      toast.success(
        newStatus === 'approved'
          ? 'อนุมัติและเพิ่มเครดิตเรียบร้อย'
          : newStatus === 'rejected'
            ? 'ปฏิเสธเรียบร้อย'
            : 'อัปเดตสถานะเรียบร้อย'
      );
      mutate();
      setIsResolveOpen(false);
      setIsDetailOpen(false);
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsLoading(false);
    }
  };

  if (!canAccess('admin')) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">แจ้งปัญหาฝากเงินไม่เข้า</h1>
          <p className="text-muted-foreground">จัดการคำร้องแจ้งปัญหาฝากเงินไม่เข้าจากลูกค้า</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setIsReportOpen(true)} 
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            แจ้งปัญหาฝากเงิน
          </Button>
          <Button onClick={() => mutate()} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">ทั้งหมด</CardTitle>
            <AlertTriangle className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-yellow-400 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">รอตรวจสอบ</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary.pending}</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-blue-400 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">กำลังตรวจสอบ</CardTitle>
            <Eye className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary.reviewing}</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-orange-400 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">ต้องการข้อมูล</CardTitle>
            <FileQuestion className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{summary.need_info}</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-green-400 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">อนุมัติ</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.approved}</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-red-400 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">ปฏิเสธ</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>รายการแจ้งปัญหา</CardTitle>
          <CardDescription>จัดการและตรวจสอบคำร้องทั้งหมด</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร, หมายเลขอ้างอิง..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs value={filterStatus} onValueChange={setFilterStatus} className="w-full sm:w-auto">
              <TabsList>
                <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
                <TabsTrigger value="pending">รอตรวจสอบ</TabsTrigger>
                <TabsTrigger value="reviewing">กำลังตรวจสอบ</TabsTrigger>
                <TabsTrigger value="approved">อนุมัติ</TabsTrigger>
                <TabsTrigger value="rejected">ปฏิเสธ</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่แจ้ง</TableHead>
                  <TableHead>เบอร์ลูกค้า</TableHead>
                  <TableHead>ชื่อ-นามสกุล</TableHead>
                  <TableHead className="text-right">จำนวนเงิน</TableHead>
                  <TableHead>ธนาคาร</TableHead>
                  <TableHead>เลขบัญชี</TableHead>
                  <TableHead>สลิป</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIssues.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      ไม่พบรายการ
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredIssues.map((issue) => {
                    const statusInfo = statusConfig[issue.status];
                    const StatusIcon = statusInfo.icon;
                    return (
                      <TableRow key={issue.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDate(issue.created_at)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {issue.customer_phone || issue.customer?.phone || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">
                            {issue.customer_first_name || issue.customer?.name || '-'} {issue.customer_last_name || ''}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium font-mono text-amber-600">
                          {formatMoney(issue.amount)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {issue.customer_bank_name || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {issue.customer_bank_account || '-'}
                        </TableCell>
                        <TableCell>
                          {issue.slip_image_url ? (
                            <a
                              href={issue.slip_image_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                            >
                              <ImageIcon className="size-3" />
                              ดูสลิป
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`${statusInfo.color} text-white text-xs`}>
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetail(issue)}
                              title="ดูรายละเอียด"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {(issue.status === 'pending' || issue.status === 'reviewing') && (
                              <>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => handleOpenResolve(issue, 'approved')}
                                  title="อนุมัติ"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleOpenResolve(issue, 'rejected')}
                                  title="ปฏิเสธ"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>รายละเอียดคำร้อง</DialogTitle>
            <DialogDescription>
              หมายเลขอ้างอิง: {selectedIssue?.id.slice(0, 8)}
            </DialogDescription>
          </DialogHeader>
          {selectedIssue && (
            <div className="space-y-4">
              {/* Customer Info Section */}
              <div className="p-4 rounded-lg bg-muted/50 border">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <User className="size-4" />
                  ข้อมูลลูกค้า
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">ชื่อ-นามสกุล</Label>
                    <p className="font-medium">
                      {selectedIssue.customer_first_name || selectedIssue.customer?.name || '-'} {selectedIssue.customer_last_name || ''}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">เบอร์โทร</Label>
                    <p className="font-medium">{selectedIssue.customer_phone || selectedIssue.customer?.phone || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">ธนาคาร</Label>
                    <p className="font-medium">{selectedIssue.customer_bank_name || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">เลขบัญชี</Label>
                    <p className="font-medium font-mono">{selectedIssue.customer_bank_account || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">เครดิตคงเหลือ</Label>
                    <p className="font-medium text-green-600">
                      {formatMoney(selectedIssue.customer?.credit_balance || 0)} บาท
                    </p>
                  </div>
                </div>
              </div>

              {/* Transaction Info Section */}
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <h4 className="font-medium mb-3 flex items-center gap-2 text-amber-700">
                  <DollarSign className="size-4" />
                  ข้อมูลการโอนเงิน
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">จำนวนเงินที่โอน</Label>
                    <p className="text-2xl font-bold text-amber-600">
                      {formatMoney(selectedIssue.amount)} บาท
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">วันที่/เวลาโอน</Label>
                    <p className="font-medium">
                      {selectedIssue.transfer_datetime 
                        ? formatDate(selectedIssue.transfer_datetime) 
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Section */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">สถานะ</Label>
                  <Badge
                    variant="secondary"
                    className={`${statusConfig[selectedIssue.status].color} text-white mt-1`}
                  >
                    {statusConfig[selectedIssue.status].label}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">วันที่แจ้ง</Label>
                  <p>{formatDate(selectedIssue.created_at)}</p>
                </div>
                {selectedIssue.resolved_at && (
                  <>
                    <div>
                      <Label className="text-muted-foreground text-xs">วันที่ดำเนินการ</Label>
                      <p>{formatDate(selectedIssue.resolved_at)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">ดำเนินการโดย</Label>
                      <p>{selectedIssue.resolved_by_user?.name || '-'}</p>
                    </div>
                  </>
                )}
              </div>

              {selectedIssue.issue_detail && (
                <div>
                  <Label className="text-muted-foreground text-xs">หมายเหตุจากลูกค้า</Label>
                  <p className="mt-1 rounded-md bg-muted p-3">{selectedIssue.issue_detail}</p>
                </div>
              )}

              {/* Slip Image */}
              {selectedIssue.slip_image_url && (
                <div>
                  <Label className="text-muted-foreground text-xs">สลิปโอนเงิน</Label>
                  <div className="mt-2 border rounded-lg p-2">
                    <img 
                      src={selectedIssue.slip_image_url} 
                      alt="สลิปโอนเงิน" 
                      className="max-h-64 mx-auto rounded-lg"
                    />
                    <div className="text-center mt-2">
                      <a
                        href={selectedIssue.slip_image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
                      >
                        <ExternalLink className="h-4 w-4" />
                        ดูรูปขนาดเต็ม
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {selectedIssue.admin_note && (
                <div>
                  <Label className="text-muted-foreground text-xs">หมายเหตุจากแอดมิน</Label>
                  <p className="mt-1 rounded-md bg-muted p-3">{selectedIssue.admin_note}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedIssue &&
              (selectedIssue.status === 'pending' || selectedIssue.status === 'reviewing') && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleOpenResolve(selectedIssue, 'need_info')}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    ขอข้อมูลเพิ่ม
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleOpenResolve(selectedIssue, 'approved')}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    อนุมัติ
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleOpenResolve(selectedIssue, 'rejected')}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    ปฏิเสธ
                  </Button>
                </div>
              )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={isResolveOpen} onOpenChange={setIsResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resolveAction === 'approved'
                ? 'อนุมัติคำร้อง'
                : resolveAction === 'rejected'
                  ? 'ปฏิเสธคำร้อง'
                  : 'ขอข้อมูลเพิ่มเติม'}
            </DialogTitle>
            <DialogDescription>
              {resolveAction === 'approved'
                ? 'ยืนยันการอนุมัติและเพิ่มเครดิตให้ลูกค้า'
                : resolveAction === 'rejected'
                  ? 'ยืนยันการปฏิเสธคำร้อง'
                  : 'ระบุข้อมูลที่ต้องการเพิ่มเติม'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {resolveAction === 'approved' && (
              <div className="space-y-2">
                <Label>จำนวนเครดิตที่จะเพิ่ม</Label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="number"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    className="pl-10"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  จำนวนเงินที่ลูกค้าแจ้ง: {formatMoney(selectedIssue?.amount || 0)} บาท
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>หมายเหตุ</Label>
              <Textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder={
                  resolveAction === 'approved'
                    ? 'หมายเหตุการอนุมัติ (ถ้ามี)'
                    : resolveAction === 'rejected'
                      ? 'เหตุผลในการปฏิเสธ'
                      : 'ข้อมูลที่ต้องการเพิ่มเติม'
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResolveOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={() => handleUpdateStatus(resolveAction)}
              disabled={isLoading}
              className={
                resolveAction === 'approved'
                  ? 'bg-green-600 hover:bg-green-700'
                  : resolveAction === 'rejected'
                    ? 'bg-red-600 hover:bg-red-700'
                    : ''
              }
            >
              {isLoading ? 'กำลังดำเนินการ...' : 'ยืนยัน'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Dialog - ฟอร์มแจ้งปัญหาฝากเงิน */}
      <Dialog open={isReportOpen} onOpenChange={(open) => {
        setIsReportOpen(open);
        if (!open) resetReportForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="size-5" />
              แจ้งปัญหาฝากเงิน
            </DialogTitle>
            <DialogDescription>
              กรอกข้อมูลและแนบสลิปเพื่อแจ้งปัญหาฝากเงินไม่เข้า
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* ข้อมูลลูกค้า */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Phone className="size-3" />
                  เบอร์โทรลูกค้า <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="tel"
                  placeholder="0812345678"
                  value={reportForm.customerPhone}
                  onChange={(e) => setReportForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <User className="size-3" />
                  ชื่อ <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="ชื่อ"
                  value={reportForm.firstName}
                  onChange={(e) => setReportForm(prev => ({ ...prev, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>นามสกุล</Label>
                <Input
                  placeholder="นามสกุล"
                  value={reportForm.lastName}
                  onChange={(e) => setReportForm(prev => ({ ...prev, lastName: e.target.value }))}
                />
              </div>
            </div>

            {/* ข้อมูลบัญชี */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Building2 className="size-3" />
                  ธนาคาร
                </Label>
                <Select 
                  value={reportForm.bankName} 
                  onValueChange={(val) => setReportForm(prev => ({ ...prev, bankName: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกธนาคาร" />
                  </SelectTrigger>
                  <SelectContent>
                    {banks.map((bank) => (
                      <SelectItem key={bank.value} value={bank.value}>
                        {bank.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>เลขบัญชี</Label>
                <Input
                  placeholder="เลขบัญชีธนาคาร"
                  value={reportForm.bankAccount}
                  onChange={(e) => setReportForm(prev => ({ ...prev, bankAccount: e.target.value }))}
                />
              </div>
            </div>

            {/* จำนวนเงินและวันที่ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <DollarSign className="size-3" />
                  จำนวนเงินที่โอน <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={reportForm.amount}
                  onChange={(e) => setReportForm(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  วันที่โอน <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={reportForm.transferDate}
                  onChange={(e) => setReportForm(prev => ({ ...prev, transferDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>เวลาที่โอน</Label>
                <Input
                  type="time"
                  value={reportForm.transferTime}
                  onChange={(e) => setReportForm(prev => ({ ...prev, transferTime: e.target.value }))}
                />
              </div>
            </div>

            {/* อัปโหลดสลิป */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <ImageIcon className="size-3" />
                สลิปโอนเงิน
              </Label>
              <div 
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-amber-500 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {slipPreview ? (
                  <div className="space-y-2">
                    <img 
                      src={slipPreview} 
                      alt="สลิปโอนเงิน" 
                      className="max-h-48 mx-auto rounded-lg"
                    />
                    <p className="text-sm text-muted-foreground">{slipFile?.name}</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSlipFile(null);
                        setSlipPreview(null);
                      }}
                    >
                      ลบรูป
                    </Button>
                  </div>
                ) : (
                  <div className="py-8">
                    <Upload className="size-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">คลิกเพื่ออัปโหลดสลิป</p>
                    <p className="text-xs text-muted-foreground mt-1">รองรับไฟล์ JPG, PNG (สูงสุด 5MB)</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* หมายเหตุ */}
            <div className="space-y-2">
              <Label>หมายเหตุ</Label>
              <Textarea
                placeholder="เช่น ฝากไม่เข้า / ยอดไม่เข้า / โอนแล้วระบบไม่เติม"
                value={reportForm.note}
                onChange={(e) => setReportForm(prev => ({ ...prev, note: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReportOpen(false)}>
              ยกเลิก
            </Button>
            <Button 
              onClick={handleSubmitReport}
              disabled={isSubmitting}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังส่ง...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  ส่งข้อมูล
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
