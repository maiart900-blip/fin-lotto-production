'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getSlipUrl } from '@/lib/utils';
import {
  ArrowDownToLine,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Eye,
  Check,
  X,
  Banknote,
  AlertCircle,
  Upload,
  Image as ImageIcon,
  RefreshCw,
  Zap,
  Hand,
  Building2,
} from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

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

interface WithdrawRequest {
  id: string;
  customer_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: string;
  process_type: 'auto' | 'manual'; // ออโต้ หรือ คีย์
  slip_url: string | null; // URL สลิปโอนเงิน
  slip_verified: boolean; // สลิปถูกตรวจสอบแล้ว
  reject_reason: string | null;
  admin_note: string | null;
  approved_by: string | null;
  approved_at: string | null;
  transferred_at: string | null; // เวลาโอนจริง
  transfer_account_id: string | null; // บัญชีที่ใช้โอน
  credit_before: number;
  credit_after: number | null;
  created_at: string;
  // Source breakdown fields
  source_breakdown?: {
    lottery_winnings: number;    // เงินรางวัลหวย
    lottery_refund: number;      // คืนยอดหวย
    game_winnings: number;       // เงินรางวัลเกมส์
    bonus: number;               // โบนัส
    admin_add: number;           // Admin เพิ่ม
    deposit: number;             // เงินฝาก
    turnover_required: number;   // Turnover ที่ต้องการ
    turnover_current: number;    // Turnover ปัจจุบัน
    turnover_completed: boolean; // ครบ Turnover หรือยัง
  };
  customer: {
    id: string;
    name: string;
    phone: string;
    credit: number;
  };
  approved_by_user: {
    id: string;
    username: string;
    display_name: string;
  } | null;
  transfer_account?: {
    id: string;
    bank_name: string;
    account_number: string;
    account_name: string;
  } | null;
}

interface WithdrawResponse {
  requests: WithdrawRequest[];
  summary: {
    total: number;
    pending: number;
    reviewing: number;
    approved: number;
    rejected: number;
    totalAmount: number;
    pendingAmount: number;
  };
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'รอดำเนินการ', color: 'bg-yellow-500/20 text-yellow-400', icon: Clock },
  reviewing: { label: 'กำลังตรวจสอบ', color: 'bg-blue-500/20 text-blue-400', icon: Eye },
  approved: { label: 'อนุมัติแล้ว', color: 'bg-green-500/20 text-green-400', icon: CheckCircle2 },
  rejected: { label: 'ปฏิเสธ', color: 'bg-red-500/20 text-red-400', icon: XCircle },
};

export default function WithdrawRequestsPage() {
  const { user, canAccess } = useAuth();
  const [statusFilter, setStatusFilter] = useState('pending'); // Default เป็น pending
  const [processTypeFilter, setProcessTypeFilter] = useState<'all' | 'auto' | 'manual'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<WithdrawRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [isSlipUploadOpen, setIsSlipUploadOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [rejectReason, setRejectReason] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { data, mutate } = useSWR<WithdrawResponse>(
    `/api/withdraw-requests?status=${statusFilter}`,
    fetcher,
    { refreshInterval: 10000 }
  );

  const requests = data?.requests || [];
  const summary = data?.summary;

  const filteredRequests = requests.filter(req => {
    // Filter by process type
    if (processTypeFilter !== 'all' && req.process_type !== processTypeFilter) {
      return false;
    }
    // Filter by search term
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      req.customer?.name?.toLowerCase().includes(search) ||
      req.customer?.phone?.includes(search) ||
      req.account_number?.includes(search) ||
      req.account_name?.toLowerCase().includes(search)
    );
  });
  
  // Handle slip upload
  const handleSlipUpload = async () => {
    if (!selectedRequest || !slipFile) return;
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', slipFile);
      formData.append('withdraw_id', selectedRequest.id);
      formData.append('type', 'withdraw');
      
      const uploadRes = await fetch('/api/upload-slip', {
        method: 'POST',
        body: formData,
      });
      
      const uploadData = await uploadRes.json();
      
      if (!uploadRes.ok) {
        throw new Error(uploadData.error || 'Upload failed');
      }
      const { url } = uploadData;
      
      // Update withdraw request with slip URL and status
      const updateRes = await fetch('/api/withdraw-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: selectedRequest.id,
          slip_url: url,
          status: 'completed',
          transferred_at: new Date().toISOString(),
        }),
      });
      
      if (!updateRes.ok) throw new Error('Update failed');
      
      toast.success('อัพโหลดสลิปสำเร็จ - รอระบบแม่ตรวจสอบ');
      setIsSlipUploadOpen(false);
      setSlipFile(null);
      setSlipPreview(null);
      mutate();
    } catch (err) {
      console.error('Upload slip error:', err);
      toast.error('เกิดข้อผิดพลาดในการอัพโหลด');
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSlipFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setSlipPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAction = async () => {
    if (!selectedRequest || !user) return;
    
    if (actionType === 'reject' && !rejectReason.trim()) {
      toast.error('กรุณาระบุเหตุผลในการปฏิเสธ');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/withdraw-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRequest.id,
          status: actionType === 'approve' ? 'approved' : 'rejected',
          reject_reason: actionType === 'reject' ? rejectReason : null,
          admin_note: adminNote || null,
          approved_by: user.id,
        }),
      });

      if (!res.ok) throw new Error('Failed to update');

      toast.success(actionType === 'approve' ? 'อนุมัติการถอนเงินสำเร็จ' : 'ปฏิเสธการถอนเงินสำเร็จ');
      mutate();
      setIsActionOpen(false);
      setSelectedRequest(null);
      setRejectReason('');
      setAdminNote('');
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canAccess('withdraw')) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">คำขอถอนเงิน</h1>
        <p className="text-muted-foreground">จัดการคำขอถอนเงินจากลูกค้า</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">ทั้งหมด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{summary?.total || 0}</div>
            <p className="text-xs text-gray-500">{formatMoney(summary?.totalAmount || 0)} บาท</p>
          </CardContent>
        </Card>

        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-400 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              รอดำเนินการ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400">{summary?.pending || 0}</div>
            <p className="text-xs text-yellow-400/70">{formatMoney(summary?.pendingAmount || 0)} บาท</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-400 flex items-center gap-2">
              <Eye className="h-4 w-4" />
              กำลังตรวจสอบ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">{summary?.reviewing || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-green-500/10 border-green-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              อนุมัติแล้ว
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{summary?.approved || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-red-500/10 border-red-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-400 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              ปฏิเสธ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">{summary?.rejected || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            {/* Status Filter */}
            <div className="flex flex-col md:flex-row gap-4 justify-between">
              <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                <TabsList className="bg-gray-100">
                  <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
                  <TabsTrigger value="pending">รอดำเนินการ</TabsTrigger>
                  <TabsTrigger value="reviewing">กำลังตรวจสอบ</TabsTrigger>
                  <TabsTrigger value="approved">อนุมัติแล้ว</TabsTrigger>
                  <TabsTrigger value="rejected">ปฏิเสธ</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="ค้นหาชื่อ, เบอร์โทร, เลขบัญชี..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white text-black border-gray-300"
                />
              </div>
            </div>
            
            {/* Process Type Filter - แยกออโต้/คีย์ */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">ประเภทการถอน:</span>
              <div className="flex gap-2">
                <Button
                  variant={processTypeFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setProcessTypeFilter('all')}
                  className={processTypeFilter === 'all' ? 'bg-[#1E3A5F] text-white' : 'border-gray-300 text-gray-700'}
                >
                  ทั้งหมด
                </Button>
                <Button
                  variant={processTypeFilter === 'auto' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setProcessTypeFilter('auto')}
                  className={processTypeFilter === 'auto' ? 'bg-emerald-600 text-white' : 'border-emerald-300 text-emerald-700'}
                >
                  <Zap className="h-3 w-3 mr-1" />
                  ระบบออโต้
                </Button>
                <Button
                  variant={processTypeFilter === 'manual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setProcessTypeFilter('manual')}
                  className={processTypeFilter === 'manual' ? 'bg-amber-600 text-white' : 'border-amber-300 text-amber-700'}
                >
                  <Hand className="h-3 w-3 mr-1" />
                  ระบบคีย์
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-gray-700">ประเภท</TableHead>
                <TableHead className="text-gray-700">ลูกค้า</TableHead>
                <TableHead className="text-gray-700">จำนวนเงิน</TableHead>
                <TableHead className="text-gray-700">ธนาคาร</TableHead>
                <TableHead className="text-gray-700">เลขบัญชี</TableHead>
                <TableHead className="text-gray-700">สถานะ</TableHead>
                <TableHead className="text-gray-700">สลิป</TableHead>
                <TableHead className="text-gray-700">วันที่</TableHead>
                <TableHead className="text-right text-gray-700">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    ไม่พบรายการ
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((req) => {
                  const status = statusConfig[req.status] || statusConfig.pending;
                  const StatusIcon = status.icon;
                  return (
                    <TableRow key={req.id} className="hover:bg-gray-50">
                      {/* ประเภท - ออโต้/คีย์ */}
                      <TableCell>
                        {req.process_type === 'auto' ? (
                          <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
                            <Zap className="h-3 w-3 mr-1" />
                            ออโต้
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">
                            <Hand className="h-3 w-3 mr-1" />
                            คีย์
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-gray-900">{req.customer?.name || '-'}</div>
                          <div className="text-xs text-gray-500">{req.customer?.phone}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-red-600">-{formatMoney(req.amount)}</span>
                      </TableCell>
                      <TableCell className="text-gray-700">{req.bank_name}</TableCell>
                      <TableCell className="font-mono text-gray-700">{req.account_number}</TableCell>
                      <TableCell>
                        <Badge className={status.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      {/* สลิป */}
                      <TableCell>
                        {req.slip_url ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => window.open(getSlipUrl(req.slip_url)!, '_blank')}
                            >
                              <ImageIcon className="h-4 w-4 text-blue-500" />
                            </Button>
                            {req.slip_verified ? (
                              <Badge className="bg-green-500/20 text-green-600 text-xs">ตรวจแล้ว</Badge>
                            ) : (
                              <Badge className="bg-yellow-500/20 text-yellow-600 text-xs">รอตรวจ</Badge>
                            )}
                          </div>
                        ) : req.status === 'approved' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs border-blue-300 text-blue-600"
                            onClick={() => {
                              setSelectedRequest(req);
                              setIsSlipUploadOpen(true);
                            }}
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            อัพสลิป
                          </Button>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(req.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(req);
                              setIsDetailOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {req.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-400 hover:text-green-300"
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setActionType('approve');
                                  setIsActionOpen(true);
                                }}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300"
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setActionType('reject');
                                  setIsActionOpen(true);
                                }}
                              >
                                <X className="h-4 w-4" />
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
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5" />
              รายละเอียดการถอนเงิน
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">ลูกค้า</Label>
                  <p className="font-medium">{selectedRequest.customer?.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedRequest.customer?.phone}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">จำนวนเงิน</Label>
                  <p className="text-xl font-bold text-red-400">-{formatMoney(selectedRequest.amount)} บาท</p>
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ธนาคาร</span>
                  <span className="font-medium">{selectedRequest.bank_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">เลขบัญชี</span>
                  <span className="font-mono">{selectedRequest.account_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ชื่อบัญชี</span>
                  <span>{selectedRequest.account_name}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">เครดิตก่อนถอน</Label>
                  <p className="font-medium">{formatMoney(selectedRequest.credit_before)} บาท</p>
                </div>
                {selectedRequest.credit_after !== null && (
                  <div>
                    <Label className="text-muted-foreground">เครดิตหลังถอน</Label>
                    <p className="font-medium">{formatMoney(selectedRequest.credit_after)} บาท</p>
                  </div>
                )}
              </div>

              {/* Source Breakdown - แหล่งที่มาของเงิน */}
              {selectedRequest.source_breakdown && (
                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <Label className="text-blue-400 font-semibold flex items-center gap-2 mb-3">
                    <Building2 className="size-4" />
                    แหล่งที่มาของเครดิต
                  </Label>
                  <div className="space-y-2 text-sm">
                    {selectedRequest.source_breakdown.lottery_winnings > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">รางวัลหวย</span>
                        <span className="font-mono text-green-400">+{formatMoney(selectedRequest.source_breakdown.lottery_winnings)}</span>
                      </div>
                    )}
                    {selectedRequest.source_breakdown.lottery_refund > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">คืนยอดหวย</span>
                        <span className="font-mono text-green-400">+{formatMoney(selectedRequest.source_breakdown.lottery_refund)}</span>
                      </div>
                    )}
                    {selectedRequest.source_breakdown.game_winnings > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">รางวัลเกมส์</span>
                        <span className="font-mono text-purple-400">+{formatMoney(selectedRequest.source_breakdown.game_winnings)}</span>
                      </div>
                    )}
                    {selectedRequest.source_breakdown.bonus > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">โบนัส/โปรโมชั่น</span>
                        <span className="font-mono text-amber-400">+{formatMoney(selectedRequest.source_breakdown.bonus)}</span>
                      </div>
                    )}
                    {selectedRequest.source_breakdown.admin_add > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Admin เพิ่มให้</span>
                        <span className="font-mono text-cyan-400">+{formatMoney(selectedRequest.source_breakdown.admin_add)}</span>
                      </div>
                    )}
                    {selectedRequest.source_breakdown.deposit > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">เงินฝาก</span>
                        <span className="font-mono text-white">+{formatMoney(selectedRequest.source_breakdown.deposit)}</span>
                      </div>
                    )}
                    <div className="border-t border-blue-500/30 pt-2 mt-2">
                      <div className="flex justify-between font-semibold">
                        <span>รวมทั้งหมด</span>
                        <span className="font-mono text-green-400">
                          {formatMoney(
                            (selectedRequest.source_breakdown.lottery_winnings || 0) +
                            (selectedRequest.source_breakdown.lottery_refund || 0) +
                            (selectedRequest.source_breakdown.game_winnings || 0) +
                            (selectedRequest.source_breakdown.bonus || 0) +
                            (selectedRequest.source_breakdown.admin_add || 0) +
                            (selectedRequest.source_breakdown.deposit || 0)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Turnover Status - สถานะ Turnover */}
              {selectedRequest.source_breakdown && selectedRequest.source_breakdown.turnover_required > 0 && (
                <div className={`p-4 rounded-lg border ${
                  selectedRequest.source_breakdown.turnover_completed 
                    ? 'bg-green-500/10 border-green-500/30' 
                    : 'bg-amber-500/10 border-amber-500/30'
                }`}>
                  <Label className={`font-semibold flex items-center gap-2 mb-2 ${
                    selectedRequest.source_breakdown.turnover_completed ? 'text-green-400' : 'text-amber-400'
                  }`}>
                    {selectedRequest.source_breakdown.turnover_completed ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <AlertCircle className="size-4" />
                    )}
                    Turnover Status
                  </Label>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Turnover ที่ต้องการ</span>
                      <span className="font-mono">{formatMoney(selectedRequest.source_breakdown.turnover_required)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Turnover ปัจจุบัน</span>
                      <span className="font-mono">{formatMoney(selectedRequest.source_breakdown.turnover_current)}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 mt-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          selectedRequest.source_breakdown.turnover_completed ? 'bg-green-500' : 'bg-amber-500'
                        }`}
                        style={{ 
                          width: `${Math.min(100, (selectedRequest.source_breakdown.turnover_current / selectedRequest.source_breakdown.turnover_required) * 100)}%` 
                        }}
                      />
                    </div>
                    <p className={`text-xs mt-1 ${
                      selectedRequest.source_breakdown.turnover_completed ? 'text-green-400' : 'text-amber-400'
                    }`}>
                      {selectedRequest.source_breakdown.turnover_completed 
                        ? 'ครบ Turnover แล้ว - สามารถถอนได้' 
                        : `ยังไม่ครบ Turnover (${Math.round((selectedRequest.source_breakdown.turnover_current / selectedRequest.source_breakdown.turnover_required) * 100)}%)`
                      }
                    </p>
                  </div>
                </div>
              )}

              {selectedRequest.reject_reason && (
                <div className="p-3 bg-red-500/10 rounded-lg">
                  <Label className="text-red-400">เหตุผลที่ปฏิเสธ</Label>
                  <p>{selectedRequest.reject_reason}</p>
                </div>
              )}

              {selectedRequest.admin_note && (
                <div>
                  <Label className="text-muted-foreground">หมายเหตุ</Label>
                  <p>{selectedRequest.admin_note}</p>
                </div>
              )}

              {selectedRequest.approved_by_user && (
                <div className="text-sm text-muted-foreground">
                  ดำเนินการโดย: {selectedRequest.approved_by_user.display_name || selectedRequest.approved_by_user.username}
                  {selectedRequest.approved_at && ` เมื่อ ${formatDate(selectedRequest.approved_at)}`}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={isActionOpen} onOpenChange={setIsActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === 'approve' ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                  ยืนยันการอนุมัติ
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-400" />
                  ยืนยันการปฏิเสธ
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Banknote className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{selectedRequest.customer?.name}</span>
                </div>
                <div className="text-2xl font-bold text-red-400">-{formatMoney(selectedRequest.amount)} บาท</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {selectedRequest.bank_name} {selectedRequest.account_number}
                </div>
              </div>

              {actionType === 'approve' && (
                <div className="p-3 bg-yellow-500/10 rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-yellow-400 font-medium">หมายเหตุ</p>
                    <p className="text-muted-foreground">เครดิตจะถูกหักจากบัญชีลูกค้าทันทีหลังอนุมัติ</p>
                  </div>
                </div>
              )}

              {actionType === 'reject' && (
                <div className="space-y-2">
                  <Label>เหตุผลในการปฏิเสธ *</Label>
                  <Textarea
                    placeholder="ระบุเหตุผล..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>หมายเหตุเพิ่มเติม (ไม่บังคับ)</Label>
                <Textarea
                  placeholder="หมายเหตุ..."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActionOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleAction}
              disabled={isSubmitting}
              className={actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {isSubmitting ? 'กำลังดำเนินการ...' : actionType === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Slip Upload Dialog */}
      <Dialog open={isSlipUploadOpen} onOpenChange={(open) => {
        setIsSlipUploadOpen(open);
        if (!open) {
          setSlipFile(null);
          setSlipPreview(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-500" />
              อัพโหลดสลิปโอนเงิน
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">ลูกค้า</span>
                  <span className="font-medium">{selectedRequest.customer?.name}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-muted-foreground">จำนวนเงิน</span>
                  <span className="font-bold text-red-500">-{formatMoney(selectedRequest.amount)} บาท</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-muted-foreground">บัญชีปลายทาง</span>
                  <span className="font-mono text-sm">{selectedRequest.bank_name} {selectedRequest.account_number}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>เลือกไฟล์สลิป</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  {slipPreview ? (
                    <div className="space-y-2">
                      <Image
                        src={slipPreview}
                        alt="Slip preview"
                        width={200}
                        height={300}
                        className="mx-auto rounded-lg object-contain max-h-[200px]"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSlipFile(null);
                          setSlipPreview(null);
                        }}
                      >
                        เปลี่ยนรูป
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block py-4">
                      <ImageIcon className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">คลิกเพื่อเลือกรูปสลิป</p>
                      <p className="text-xs text-gray-400 mt-1">รองรับ JPG, PNG ขนาดไม่เกิน 5MB</p>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="p-3 bg-blue-500/10 rounded-lg">
                <p className="text-sm text-blue-600">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  หลังอัพโหลด ระบบแม่จะตรวจสอบสลิปและอัพเดทยอดแพ้ชนะอัตโนมัติ
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSlipUploadOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleSlipUpload}
              disabled={!slipFile || isUploading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  กำลังอัพโหลด...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  อัพโหลดสลิป
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
