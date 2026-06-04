'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Search,
  Loader2,
  User,
  Phone,
  Banknote,
  Calendar,
  Image as ImageIcon,
  AlertTriangle,
  Activity,
  RefreshCw,
  Volume2,
  VolumeX,
  Bell,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface TopupRequest {
  id: string;
  customer_id: string;
  amount: number;
  bank_name: string;
  slip_url: string | null;
  slip_hash?: string | null; // For duplicate detection
  status: 'pending' | 'approved' | 'rejected';
  reject_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  is_duplicate_slip?: boolean; // Flag for duplicate slip warning
  customer: {
    id: string;
    name: string;
    phone: string;
  } | null;
  approver: {
    id: string;
    display_name: string;
  } | null;
}

const statusConfig = {
  pending: { label: 'รอดำเนินการ', color: 'bg-yellow-500/20 text-yellow-600', icon: Clock },
  approved: { label: 'อนุมัติแล้ว', color: 'bg-green-500/20 text-green-600', icon: CheckCircle },
  rejected: { label: 'ปฏิเสธ', color: 'bg-red-500/20 text-red-600', icon: XCircle },
};

export default function TopupRequestsPage() {
  const { user } = useAuth();
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<TopupRequest | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hasNewRequest, setHasNewRequest] = useState(false);
  const [slipVerificationChecks, setSlipVerificationChecks] = useState({
    amountMatch: false,      // จำนวนเงินตรงกัน
    dateTimeValid: false,    // วันเวลาถูกต้อง
    slipNotDuplicate: false, // สลิปไม่ซ้ำ
  });
  const prevCountRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Real-time data fetching - refresh every 3 seconds
  const { data: rawRequests, mutate, isValidating, error } = useSWR<TopupRequest[]>(
    `/api/topup-requests?status=${filterStatus}`,
    fetcher,
    { 
      refreshInterval: 3000,
      revalidateOnFocus: true,
      dedupingInterval: 1000,
    }
  );
  
  // Safe array check - ป้องกัน error จาก API
  const requests = Array.isArray(rawRequests) ? rawRequests : [];
  
  // Fetch all requests for stats (separate call)
  const { data: rawAllRequests } = useSWR<TopupRequest[]>(
    '/api/topup-requests?status=all',
    fetcher,
    { 
      refreshInterval: 5000,
      revalidateOnFocus: true,
    }
  );
  
  // Safe array check
  const allRequests = Array.isArray(rawAllRequests) ? rawAllRequests : [];

  // Sound notification when new pending request arrives
  useEffect(() => {
    const pendingCount = requests.filter(r => r.status === 'pending').length;
    
    if (prevCountRef.current > 0 && pendingCount > prevCountRef.current && soundEnabled) {
      // New request arrived - play sound and show indicator
      setHasNewRequest(true);
      
      // Play notification sound
      if (!audioRef.current) {
        audioRef.current = new Audio('/sounds/notification.mp3');
      }
      audioRef.current.play().catch(() => {
        // Audio play failed - browser may block autoplay
      });
      
      // Show toast
      toast.info(`มีคำขอเติมเงินใหม่ ${pendingCount - prevCountRef.current} รายการ`, {
        icon: <Bell className="size-4 text-amber-500" />,
      });
      
      // Clear indicator after 5 seconds
      setTimeout(() => setHasNewRequest(false), 5000);
    }
    
    prevCountRef.current = pendingCount;
  }, [requests, soundEnabled]);
  
  const filteredRequests = requests.filter(req => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      req.customer?.name?.toLowerCase().includes(search) ||
      req.customer?.phone?.includes(search) ||
      req.bank_name.toLowerCase().includes(search)
    );
  });
  
  const pendingCount = allRequests.filter(r => r.status === 'pending').length;
  const totalPendingAmount = allRequests
    .filter(r => r.status === 'pending')
    .reduce((sum, r) => sum + Number(r.amount), 0);
  
  // Today's stats from all requests
  const today = new Date().toDateString();
  const approvedToday = allRequests.filter(r => 
    r.status === 'approved' && 
    (r.approved_at ? new Date(r.approved_at).toDateString() === today : new Date(r.created_at).toDateString() === today)
  ).length;
  const rejectedToday = allRequests.filter(r => 
    r.status === 'rejected' && 
    (r.approved_at ? new Date(r.approved_at).toDateString() === today : false)
  ).length;
  
  // Verification check helpers
  const allSlipVerificationsPassed = Object.values(slipVerificationChecks).every(v => v);
  const verificationCount = Object.values(slipVerificationChecks).filter(v => v).length;
  
  const resetSlipVerification = () => {
    setSlipVerificationChecks({
      amountMatch: false,
      dateTimeValid: false,
      slipNotDuplicate: false,
    });
  };
  
  const handleApprove = async (request: TopupRequest) => {
    if (processing) return;
    
    // Check if all verifications passed
    if (!allSlipVerificationsPassed) {
      toast.error(`ต้องยืนยันการตรวจสอบสลิปครบ 3 ข้อก่อนอนุมัติ (ผ่านแล้ว ${verificationCount}/3)`);
      return;
    }
    
    setProcessing(true);
    
    try {
      const res = await fetch('/api/topup-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: request.id,
          status: 'approved',
          approved_by: user?.id,
          verification_audit: slipVerificationChecks, // Include verification audit
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }
      
      toast.success('อนุมัติคำขอเติมเงินเรียบร้อย');
      mutate();
      setShowDetailDialog(false);
      resetSlipVerification();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    } finally {
      setProcessing(false);
    }
  };
  
  const handleReject = async () => {
    if (!selectedRequest || processing) return;
    setProcessing(true);
    
    try {
      const res = await fetch('/api/topup-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRequest.id,
          status: 'rejected',
          reject_reason: rejectReason,
          approved_by: user?.id,
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }
      
      toast.success('ปฏิเสธคำขอเติมเงินเรียบร้อย');
      mutate();
      setShowRejectDialog(false);
      setShowDetailDialog(false);
      setRejectReason('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    } finally {
      setProcessing(false);
    }
  };
  
  const openRejectDialog = (request: TopupRequest) => {
    setSelectedRequest(request);
    setShowRejectDialog(true);
  };
  
  const openDetailDialog = (request: TopupRequest) => {
    setSelectedRequest(request);
    setShowDetailDialog(true);
  };

  return (
    <div className="space-y-6 bg-[#F8FAFC] min-h-screen p-6 -m-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
            <CreditCard className="size-6 text-[#EAB308]" />
            คำขอเติมเงิน
            {hasNewRequest && (
              <span className="size-3 rounded-full bg-[#EAB308] animate-pulse" />
            )}
          </h1>
          <p className="text-[#64748B]">จัดการคำขอเติมเงินจากลูกค้า - Real-time</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Live Indicator */}
          <Badge variant="outline" className="border-[#EAB308] text-[#EAB308]">
            <Activity className="size-3 mr-1 animate-pulse" />
            Live
          </Badge>
          
          {/* Sound Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={soundEnabled ? 'text-[#EAB308]' : 'text-[#94A3B8]'}
          >
            {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </Button>
          
          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            disabled={isValidating}
            className="border-[#EAB308] text-[#B8860B] hover:bg-[rgba(234,179,8,0.1)]"
          >
            <RefreshCw className={`size-4 mr-1 ${isValidating ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>
      </div>
      
      {/* Summary Cards - Premium Gold Theme */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white border-[rgba(234,179,8,0.3)] hover:border-[#EAB308] transition-all">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] shadow-lg shadow-[rgba(234,179,8,0.3)]">
                <Clock className="size-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-[#64748B]">รอดำเนินการ</p>
                <p className="text-2xl font-bold text-[#0F172A]">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white border-[rgba(234,179,8,0.2)]">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-[#EAB308]/20">
                <Banknote className="size-5 text-[#B8860B]" />
              </div>
              <div>
                <p className="text-sm text-[#64748B]">ยอดรอดำเนินการ</p>
                <p className="text-2xl font-bold text-[#B8860B]">{totalPendingAmount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white border-[rgba(34,197,94,0.2)]">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-[#22C55E]/20">
                <CheckCircle className="size-5 text-[#16A34A]" />
              </div>
              <div>
                <p className="text-sm text-[#64748B]">อนุมัติแล้ววันนี้</p>
                <p className="text-2xl font-bold text-[#16A34A]">
                  {approvedToday}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white border-[rgba(239,68,68,0.2)]">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-[#EF4444]/20">
                <XCircle className="size-5 text-[#DC2626]" />
              </div>
              <div>
                <p className="text-sm text-[#64748B]">ปฏิเสธวันนี้</p>
                <p className="text-2xl font-bold text-[#DC2626]">
                  {rejectedToday}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="size-5" />
            รายการคำขอเติมเงิน
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร, ธนาคาร..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="pending">รอดำเนินการ</SelectItem>
                <SelectItem value="approved">อนุมัติแล้ว</SelectItem>
                <SelectItem value="rejected">ปฏิเสธ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ลูกค้า</TableHead>
                  <TableHead>จำนวนเงิน</TableHead>
                  <TableHead>ธนาคาร</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>วันที่ขอ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      ไม่มีคำขอเติมเงิน
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequests.map((request) => {
                    const config = statusConfig[request.status];
                    const StatusIcon = config.icon;
                    
                    return (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="size-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{request.customer?.name || 'ไม่ระบุ'}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="size-3" />
                                {request.customer?.phone || '-'}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-lg text-green-600">
                            +{request.amount.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>{request.bank_name}</TableCell>
                        <TableCell>
                          <Badge className={config.color}>
                            <StatusIcon className="size-3 mr-1" />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(request.created_at).toLocaleDateString('th-TH')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(request.created_at), { addSuffix: true, locale: th })}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDetailDialog(request)}
                            >
                              <Eye className="size-4" />
                            </Button>
                            {request.status === 'pending' && (
                              <>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => handleApprove(request)}
                                  disabled={processing}
                                >
                                  {processing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle className="size-4" />}
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => openRejectDialog(request)}
                                  disabled={processing}
                                >
                                  <XCircle className="size-4" />
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
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>รายละเอียดคำขอเติมเงิน</DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-6">
              {/* Customer Info */}
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="size-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{selectedRequest.customer?.name || 'ไม่ระบุ'}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="size-3" />
                    {selectedRequest.customer?.phone || '-'}
                  </p>
                </div>
              </div>
              
              {/* Amount */}
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-1">จำนวนเงินที่ขอเติม</p>
                <p className="text-4xl font-bold text-green-600">
                  +{selectedRequest.amount.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">บาท</p>
              </div>
              
              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">ธนาคาร</p>
                  <p className="font-medium">{selectedRequest.bank_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">สถานะ</p>
                  <Badge className={statusConfig[selectedRequest.status].color}>
                    {statusConfig[selectedRequest.status].label}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">วันที่ขอ</p>
                  <p className="font-medium">
                    {new Date(selectedRequest.created_at).toLocaleString('th-TH')}
                  </p>
                </div>
                {selectedRequest.approved_at && (
                  <div>
                    <p className="text-muted-foreground">วันที่ดำเนินการ</p>
                    <p className="font-medium">
                      {new Date(selectedRequest.approved_at).toLocaleString('th-TH')}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Slip Image */}
              {selectedRequest.slip_url && (
                <div>
                  <Label className="text-muted-foreground mb-2 block">สลิปโอนเงิน</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <img
                      src={selectedRequest.slip_url}
                      alt="สลิปโอนเงิน"
                      className="w-full max-h-[300px] object-contain bg-muted"
                    />
                  </div>
                  {selectedRequest.is_duplicate_slip && (
                    <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded flex items-center gap-2 text-red-700">
                      <AlertTriangle className="size-4" />
                      <span className="text-sm font-medium">คำเตือน: พบสลิปซ้ำในระบบ</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Slip Verification Checklist - Only for pending requests */}
              {selectedRequest.status === 'pending' && (
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="size-4" />
                    ตรวจสอบสลิปก่อนอนุมัติ ({verificationCount}/3)
                  </h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer hover:bg-blue-100 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={slipVerificationChecks.amountMatch}
                        onChange={(e) => setSlipVerificationChecks(prev => ({ ...prev, amountMatch: e.target.checked }))}
                        className="size-4 rounded border-blue-300 text-blue-600"
                      />
                      <span className="text-sm">
                        <strong>1. จำนวนเงินตรงกัน</strong> - ยอดในสลิปตรงกับที่ขอเติม
                      </span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer hover:bg-blue-100 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={slipVerificationChecks.dateTimeValid}
                        onChange={(e) => setSlipVerificationChecks(prev => ({ ...prev, dateTimeValid: e.target.checked }))}
                        className="size-4 rounded border-blue-300 text-blue-600"
                      />
                      <span className="text-sm">
                        <strong>2. วัน-เวลาถูกต้อง</strong> - สลิปไม่ล่าช้าเกินกำหนด
                      </span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer hover:bg-blue-100 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={slipVerificationChecks.slipNotDuplicate}
                        onChange={(e) => setSlipVerificationChecks(prev => ({ ...prev, slipNotDuplicate: e.target.checked }))}
                        className="size-4 rounded border-blue-300 text-blue-600"
                      />
                      <span className="text-sm">
                        <strong>3. สลิปไม่ซ้ำ</strong> - ยืนยันว่าไม่เคยใช้สลิปนี้
                      </span>
                    </label>
                  </div>
                  {!allSlipVerificationsPassed && (
                    <p className="text-sm text-amber-600 mt-3 flex items-center gap-1">
                      <AlertTriangle className="size-3" />
                      ต้องตรวจสอบครบทุกข้อก่อนกดอนุมัติ
                    </p>
                  )}
                </div>
              )}
              
              {/* Reject Reason */}
              {selectedRequest.status === 'rejected' && selectedRequest.reject_reason && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm font-medium text-red-600 mb-1">เหตุผลที่ปฏิเสธ</p>
                  <p className="text-sm">{selectedRequest.reject_reason}</p>
                </div>
              )}
              
              {/* Approver */}
              {selectedRequest.approver && (
                <div className="text-sm text-muted-foreground">
                  ดำเนินการโดย: {selectedRequest.approver.display_name}
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            {selectedRequest?.status === 'pending' && (
              <div className="flex gap-2 w-full">
                <Button
                  variant="destructive"
                  onClick={() => openRejectDialog(selectedRequest)}
                  disabled={processing}
                  className="flex-1"
                >
                  <XCircle className="size-4 mr-2" />
                  ปฏิเสธ
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => handleApprove(selectedRequest)}
                  disabled={processing || !allSlipVerificationsPassed}
                >
                  {processing ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="size-4 mr-2" />
                  )}
                  อนุมัติ ({verificationCount}/3)
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Reject Confirmation Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              ยืนยันการปฏิเสธ
            </AlertDialogTitle>
            <AlertDialogDescription>
              คุณกำลังจะปฏิเสธคำขอเติมเงินจำนวน {selectedRequest?.amount.toLocaleString()} บาท
              จากลูกค้า {selectedRequest?.customer?.name}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4">
            <Label htmlFor="rejectReason">เหตุผลที่ปฏิเสธ (ไม่บังคับ)</Label>
            <Textarea
              id="rejectReason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="ระบุเหตุผล เช่น สลิปไม่ชัด, ยอดไม่ตรง..."
              className="mt-2"
            />
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-red-600 hover:bg-red-700"
              disabled={processing}
            >
              {processing ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : null}
              ยืนยันปฏิเสธ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
