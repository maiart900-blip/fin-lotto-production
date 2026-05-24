'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileImage, Clock, CheckCircle, XCircle, RefreshCw, Send, Wallet, Building2, CreditCard, ArrowDownCircle, CheckCircle2, User } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface SlipUpload {
  id: string;
  type: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  slip_url: string;
  note: string;
  created_at: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: 'pending' | 'processing' | 'approved' | 'rejected';
  note: string;
  created_at: string;
}

interface CustomerWithdrawRequest {
  id: string;
  customer_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: string;
  created_at: string;
  customer?: {
    id: string;
    name: string;
    phone: string;
  };
}

const BANKS = [
  { code: 'SCB', name: 'ธนาคารไทยพาณิชย์' },
  { code: 'KBANK', name: 'ธนาคารกสิกรไทย' },
  { code: 'KTB', name: 'ธนาคารกรุงไทย' },
  { code: 'BBL', name: 'ธนาคารกรุงเทพ' },
  { code: 'BAY', name: 'ธนาคารกรุงศรีอยุธยา' },
  { code: 'TTB', name: 'ธนาคารทีเอ็มบีธนชาต' },
  { code: 'GSB', name: 'ธนาคารออมสิน' },
  { code: 'BAAC', name: 'ธ.ก.ส.' },
];

export default function FinanceCenterPage() {
  // Slip Upload State
  const { data: uploads = [], mutate: mutateUploads, isLoading: isLoadingUploads } = useSWR<SlipUpload[]>('/api/member/slip-uploads', fetcher);
  const [isSubmittingSlip, setIsSubmittingSlip] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [slipFormData, setSlipFormData] = useState({
    type: '',
    amount: '',
    note: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Withdraw State
  const { data: withdrawals = [], mutate: mutateWithdrawals, isLoading: isLoadingWithdrawals } = useSWR<Withdrawal[]>('/api/member/admin-withdraw', fetcher);
  
  // Customer Withdraw Requests (from customers waiting for approval)
  const { data: customerWithdrawData, mutate: mutateCustomerWithdraws } = useSWR<{ requests: CustomerWithdrawRequest[] }>(
    '/api/withdraw-requests?status=pending',
    fetcher,
    { refreshInterval: 5000 }
  );
  const customerWithdrawRequests = customerWithdrawData?.requests || [];
  
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [isProcessingRequest, setIsProcessingRequest] = useState<string | null>(null);
  const [withdrawFormData, setWithdrawFormData] = useState({
    amount: '',
    bank_code: '',
    account_number: '',
    account_name: '',
    note: ''
  });

  // Slip Upload Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSubmitSlip = async () => {
    if (!selectedFile || !slipFormData.type || !slipFormData.amount) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setIsSubmittingSlip(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', selectedFile);
      
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData
      });
      
      let slipUrl = '';
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        slipUrl = uploadData.url || '';
      }

      const res = await fetch('/api/member/slip-uploads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: slipFormData.type,
          amount: parseFloat(slipFormData.amount),
          note: slipFormData.note,
          slip_url: slipUrl
        })
      });

      if (res.ok) {
        alert('ส่งสลิปสำเร็จ');
        setSlipFormData({ type: '', amount: '', note: '' });
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        mutateUploads();
      } else {
        alert('เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Submit error:', error);
      alert('เกิดข้อผิดพลาด');
    } finally {
      setIsSubmittingSlip(false);
    }
  };

  // Withdraw Handlers
  const handleSubmitWithdraw = async () => {
    if (!withdrawFormData.amount || !withdrawFormData.bank_code || !withdrawFormData.account_number || !withdrawFormData.account_name) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setIsSubmittingWithdraw(true);
    try {
      const bank = BANKS.find(b => b.code === withdrawFormData.bank_code);
      const res = await fetch('/api/member/admin-withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(withdrawFormData.amount),
          bank_name: bank?.name || withdrawFormData.bank_code,
          account_number: withdrawFormData.account_number,
          account_name: withdrawFormData.account_name,
          note: withdrawFormData.note
        })
      });

      if (res.ok) {
        alert('ส่งคำขอถอนเงินสำเร็จ');
        setWithdrawFormData({ amount: '', bank_code: '', account_number: '', account_name: '', note: '' });
        mutateWithdrawals();
      } else {
        const err = await res.json();
        alert(err.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Submit error:', error);
      alert('เกิดข้อผิดพลาด');
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  // Handle approve/reject customer withdraw request
  const handleApproveCustomerWithdraw = async (requestId: string) => {
    setIsProcessingRequest(requestId);
    try {
      const res = await fetch(`/api/withdraw-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' })
      });
      if (res.ok) {
        alert('อนุมัติคำขอถอนเงินสำเร็จ');
        mutateCustomerWithdraws();
      } else {
        const err = await res.json();
        alert(err.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Approve error:', error);
      alert('เกิดข้อผิดพลาด');
    } finally {
      setIsProcessingRequest(null);
    }
  };

  const handleRejectCustomerWithdraw = async (requestId: string) => {
    const reason = prompt('กรุณาระบุเหตุผลที่ปฏิเสธ:');
    if (!reason) return;
    
    setIsProcessingRequest(requestId);
    try {
      const res = await fetch(`/api/withdraw-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', admin_note: reason })
      });
      if (res.ok) {
        alert('ปฏิเสธคำขอถอนเงินแล้ว');
        mutateCustomerWithdraws();
      } else {
        const err = await res.json();
        alert(err.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Reject error:', error);
      alert('เกิดข้อผิดพลาด');
    } finally {
      setIsProcessingRequest(null);
    }
  };

  // Status Badges
  const getSlipStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30"><Clock className="size-3 mr-1" />รอตรวจสอบ</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30"><CheckCircle className="size-3 mr-1" />อนุมัติ</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30"><XCircle className="size-3 mr-1" />ไม่อนุมัติ</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getWithdrawStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30"><Clock className="size-3 mr-1" />รอดำเนินการ</Badge>;
      case 'processing':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30"><RefreshCw className="size-3 mr-1" />กำลังดำเนินการ</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30"><CheckCircle className="size-3 mr-1" />สำเร็จ</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30"><XCircle className="size-3 mr-1" />ไม่อนุมัติ</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'deposit': return 'แจ้งฝากเงิน';
      case 'payment': return 'ชำระเงิน';
      case 'bonus': return 'รับโบนัส';
      case 'other': return 'อื่นๆ';
      default: return type;
    }
  };

  // Summaries
  const slipSummary = {
    total: uploads.length,
    pending: uploads.filter(u => u.status === 'pending').length,
    approved: uploads.filter(u => u.status === 'approved').length,
  };

  const withdrawSummary = {
    total: withdrawals.length,
    pending: withdrawals.filter(w => w.status === 'pending').length,
    approved: withdrawals.filter(w => w.status === 'approved').length,
    totalAmount: withdrawals.filter(w => w.status === 'approved').reduce((sum, w) => sum + w.amount, 0),
    customerPending: customerWithdrawRequests.length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#D4AF37]">ศูนย์การเงิน</h1>
        <p className="text-[#A0A0A0]">อัปโหลดสลิปและถอนเงินในที่เดียว</p>
      </div>

      {/* Quick Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[#A0A0A0] text-sm">
              <Upload className="size-4" />
              สลิปรอตรวจสอบ
            </div>
            <div className="text-2xl font-bold text-yellow-500">{slipSummary.pending}</div>
          </CardContent>
        </Card>
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[#A0A0A0] text-sm">
              <CheckCircle className="size-4" />
              สลิปอนุมัติแล้ว
            </div>
            <div className="text-2xl font-bold text-green-500">{slipSummary.approved}</div>
          </CardContent>
        </Card>
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[#A0A0A0] text-sm">
              <ArrowDownCircle className="size-4" />
              ถอนรอดำเนินการ
            </div>
            <div className="text-2xl font-bold text-yellow-500">{withdrawSummary.pending}</div>
          </CardContent>
        </Card>
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[#A0A0A0] text-sm">
              <Wallet className="size-4" />
              ยอดถอนสำเร็จ
            </div>
            <div className="text-2xl font-bold text-[#D4AF37]">{withdrawSummary.totalAmount.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="slip" className="space-y-4">
        <TabsList className="bg-[#1A1A1A] border border-[#2A2A2A]">
          <TabsTrigger value="slip" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
            <Upload className="size-4 mr-2" />
            อัปโหลดสลิป
          </TabsTrigger>
          <TabsTrigger value="withdraw" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
            <Wallet className="size-4 mr-2" />
            ถอนเงิน
          </TabsTrigger>
        </TabsList>

        {/* Slip Upload Tab */}
        <TabsContent value="slip" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
              <CardHeader>
                <CardTitle className="text-[#D4AF37] flex items-center gap-2">
                  <Upload className="size-5" />
                  ส่งสลิปใหม่
                </CardTitle>
                <CardDescription>อัปโหลดหลักฐานการโอนเงิน</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>ประเภท</Label>
                  <Select value={slipFormData.type} onValueChange={(v) => setSlipFormData(prev => ({ ...prev, type: v }))}>
                    <SelectTrigger className="bg-[#0D0D0D] border-[#2A2A2A]">
                      <SelectValue placeholder="เลือกประเภท" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deposit">แจ้งฝากเงิน</SelectItem>
                      <SelectItem value="payment">ชำระเงิน</SelectItem>
                      <SelectItem value="bonus">รับโบนัส</SelectItem>
                      <SelectItem value="other">อื่นๆ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>จำนวนเงิน (บาท)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={slipFormData.amount}
                    onChange={(e) => setSlipFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className="bg-[#0D0D0D] border-[#2A2A2A]"
                  />
                </div>

                <div className="space-y-2">
                  <Label>หมายเหตุ (ถ้ามี)</Label>
                  <Textarea
                    placeholder="รายละเอียดเพิ่มเติม..."
                    value={slipFormData.note}
                    onChange={(e) => setSlipFormData(prev => ({ ...prev, note: e.target.value }))}
                    className="bg-[#0D0D0D] border-[#2A2A2A]"
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>อัปโหลดสลิป</Label>
                  <div 
                    className="border-2 border-dashed border-[#2A2A2A] rounded-lg p-4 text-center cursor-pointer hover:border-[#D4AF37]/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {previewUrl ? (
                      <div className="space-y-2">
                        <img src={previewUrl} alt="Preview" className="max-h-32 mx-auto rounded-lg" />
                        <p className="text-sm text-[#A0A0A0]">{selectedFile?.name}</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <FileImage className="size-8 mx-auto text-[#A0A0A0]" />
                        <p className="text-[#A0A0A0] text-sm">คลิกเพื่อเลือกไฟล์</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                <Button 
                  className="w-full bg-[#D4AF37] hover:bg-[#C4A030] text-black"
                  onClick={handleSubmitSlip}
                  disabled={isSubmittingSlip || !selectedFile || !slipFormData.type || !slipFormData.amount}
                >
                  {isSubmittingSlip ? <RefreshCw className="size-4 mr-2 animate-spin" /> : <Send className="size-4 mr-2" />}
                  {isSubmittingSlip ? 'กำลังส่ง...' : 'ส่งสลิป'}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-[#D4AF37]">ประวัติการส่ง</CardTitle>
                  <CardDescription>รายการสลิปที่ส่งแล้ว</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => mutateUploads()} disabled={isLoadingUploads}>
                  <RefreshCw className={`size-4 ${isLoadingUploads ? 'animate-spin' : ''}`} />
                </Button>
              </CardHeader>
              <CardContent>
                {uploads.length === 0 ? (
                  <div className="text-center py-8 text-[#A0A0A0]">
                    <FileImage className="size-12 mx-auto mb-2 opacity-50" />
                    <p>ยังไม่มีประวัติการส่งสลิป</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {uploads.map((upload) => (
                      <div key={upload.id} className="bg-[#0D0D0D] rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium">{getTypeLabel(upload.type)}</span>
                          {getSlipStatusBadge(upload.status)}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[#D4AF37] font-bold">{upload.amount.toLocaleString()} บาท</span>
                          <span className="text-[#666]">{new Date(upload.created_at).toLocaleDateString('th-TH')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Withdraw Tab */}
        <TabsContent value="withdraw" className="space-y-4">
          {/* Customer Withdraw Requests - Pending Approval */}
          {customerWithdrawRequests.length > 0 && (
            <Card className="bg-[#1A1A1A] border-[#D4AF37]/50">
              <CardHeader>
                <CardTitle className="text-[#D4AF37] flex items-center gap-2">
                  <User className="size-5" />
                  คำขอถอนเงินจากลูกค้า ({customerWithdrawRequests.length} รายการรอดำเนินการ)
                </CardTitle>
                <CardDescription>รายการคำขอถอนเงินที่รอการอนุมัติ - แสดงข้อมูลบัญชีธนาคารของลูกค้า</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {customerWithdrawRequests.map((request) => (
                    <div key={request.id} className="bg-[#0D0D0D] rounded-lg p-4 border border-yellow-500/30">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <User className="size-4 text-[#D4AF37]" />
                            <span className="text-white font-medium">{request.customer?.name || 'ลูกค้า'}</span>
                            <span className="text-[#666] text-sm">({request.customer?.phone || '-'})</span>
                          </div>
                          <div className="text-2xl font-bold text-[#D4AF37]">
                            {request.amount.toLocaleString()} บาท
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                          <Clock className="size-3 mr-1" />
                          รอดำเนินการ
                        </Badge>
                      </div>
                      
                      {/* Bank Details - Important for Admin */}
                      <div className="bg-[#1A1A1A] rounded-lg p-3 mb-3 border border-[#333]">
                        <div className="text-xs text-[#888] mb-2">ข้อมูลบัญชีสำหรับโอนเงิน:</div>
                        <div className="grid gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Building2 className="size-4 text-[#D4AF37]" />
                            <span className="text-[#888]">ธนาคาร:</span>
                            <span className="text-white font-medium">{request.bank_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CreditCard className="size-4 text-[#D4AF37]" />
                            <span className="text-[#888]">เลขบัญชี:</span>
                            <span className="text-white font-medium font-mono">{request.account_number}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="size-4 text-[#D4AF37]" />
                            <span className="text-[#888]">ชื่อบัญชี:</span>
                            <span className="text-green-400 font-medium">{request.account_name}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#666]">
                          {new Date(request.created_at).toLocaleString('th-TH')}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                            onClick={() => handleRejectCustomerWithdraw(request.id)}
                            disabled={isProcessingRequest === request.id}
                          >
                            {isProcessingRequest === request.id ? (
                              <RefreshCw className="size-4 animate-spin" />
                            ) : (
                              <>
                                <XCircle className="size-4 mr-1" />
                                ปฏิเสธ
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleApproveCustomerWithdraw(request.id)}
                            disabled={isProcessingRequest === request.id}
                          >
                            {isProcessingRequest === request.id ? (
                              <RefreshCw className="size-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle2 className="size-4 mr-1" />
                                อนุมัติ
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
              <CardHeader>
                <CardTitle className="text-[#D4AF37] flex items-center gap-2">
                  <Wallet className="size-5" />
                  แจ้งถอนเงิน
                </CardTitle>
                <CardDescription>กรอกข้อมูลบัญชีที่ต้องการรับเงิน</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[#D4AF37]">จำนวนเงินที่ต้องการถอน (บาท)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={withdrawFormData.amount}
                    onChange={(e) => setWithdrawFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className="bg-[#0D0D0D] border-[#D4AF37] text-white text-lg placeholder:text-gray-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[#D4AF37]">ธนาคาร</Label>
                  <Select value={withdrawFormData.bank_code} onValueChange={(v) => setWithdrawFormData(prev => ({ ...prev, bank_code: v }))}>
                    <SelectTrigger className="bg-[#0D0D0D] border-[#D4AF37] text-white">
                      <SelectValue placeholder="เลือกธนาคาร" />
                    </SelectTrigger>
                    <SelectContent>
                      {BANKS.map(bank => (
                        <SelectItem key={bank.code} value={bank.code}>
                          <div className="flex items-center gap-2">
                            <Building2 className="size-4" />
                            {bank.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[#D4AF37]">เลขบัญชี</Label>
                  <Input
                    placeholder="xxx-x-xxxxx-x"
                    value={withdrawFormData.account_number}
                    onChange={(e) => setWithdrawFormData(prev => ({ ...prev, account_number: e.target.value }))}
                    className="bg-[#0D0D0D] border-[#D4AF37] text-white placeholder:text-gray-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[#D4AF37]">ชื่อบัญชี</Label>
                  <Input
                    placeholder="ชื่อ-นามสกุล"
                    value={withdrawFormData.account_name}
                    onChange={(e) => setWithdrawFormData(prev => ({ ...prev, account_name: e.target.value }))}
                    className="bg-[#0D0D0D] border-[#D4AF37] text-white placeholder:text-gray-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[#D4AF37]">หมายเหตุ (ถ้ามี)</Label>
                  <Textarea
                    placeholder="รายละเอียดเพิ่มเติม..."
                    value={withdrawFormData.note}
                    onChange={(e) => setWithdrawFormData(prev => ({ ...prev, note: e.target.value }))}
                    className="bg-[#0D0D0D] border-[#D4AF37] text-white placeholder:text-gray-500"
                    rows={2}
                  />
                </div>

                <Button 
                  className="w-full bg-[#D4AF37] hover:bg-[#C4A030] text-black"
                  onClick={handleSubmitWithdraw}
                  disabled={isSubmittingWithdraw || !withdrawFormData.amount || !withdrawFormData.bank_code || !withdrawFormData.account_number || !withdrawFormData.account_name}
                >
                  {isSubmittingWithdraw ? <RefreshCw className="size-4 mr-2 animate-spin" /> : <Send className="size-4 mr-2" />}
                  {isSubmittingWithdraw ? 'กำลังส่ง...' : 'ส่งคำขอถอนเงิน'}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-[#D4AF37]">ประวัติการถอน</CardTitle>
                  <CardDescription>รายการคำขอถอนเงินทั้งหมด</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => mutateWithdrawals()} disabled={isLoadingWithdrawals}>
                  <RefreshCw className={`size-4 ${isLoadingWithdrawals ? 'animate-spin' : ''}`} />
                </Button>
              </CardHeader>
              <CardContent>
                {withdrawals.length === 0 ? (
                  <div className="text-center py-8 text-[#A0A0A0]">
                    <CreditCard className="size-12 mx-auto mb-2 opacity-50" />
                    <p>ยังไม่มีประวัติการถอนเงิน</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {withdrawals.map((withdrawal) => (
                      <div key={withdrawal.id} className="bg-[#0D0D0D] rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[#D4AF37] font-bold text-lg">{withdrawal.amount.toLocaleString()} บาท</span>
                          {getWithdrawStatusBadge(withdrawal.status)}
                        </div>
                        <div className="text-sm text-[#A0A0A0]">
                          <div className="flex items-center gap-2">
                            <Building2 className="size-4" />
                            {withdrawal.bank_name}
                          </div>
                          <div className="flex items-center gap-2">
                            <CreditCard className="size-4" />
                            {withdrawal.account_number}
                          </div>
                        </div>
                        <div className="text-xs text-[#666]">
                          {new Date(withdrawal.created_at).toLocaleString('th-TH')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
