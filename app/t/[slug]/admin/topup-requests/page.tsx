'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CreditCard, Check, X, Clock, Search, Loader2, Eye, AlertTriangle, RefreshCw, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import useSWR from 'swr';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'รอตรวจสอบ', color: 'bg-yellow-500/20 text-yellow-400', icon: Clock },
  approved: { label: 'อนุมัติแล้ว', color: 'bg-green-500/20 text-green-400', icon: Check },
  rejected: { label: 'ปฏิเสธ', color: 'bg-red-500/20 text-red-400', icon: X },
};

export default function TopupRequestsPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const { data, mutate, isLoading } = useSWR(
    `/api/tenant/${slug}/admin/topup-requests?status=${status}&search=${search}`,
    fetcher
  );

  const requests = data?.requests || [];
  const stats = data?.stats || { pending: 0, approved: 0, rejected: 0, total_pending_amount: 0 };

  const handleApprove = async (id: string) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/tenant/${slug}/admin/topup-requests/${id}/approve`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error();
      toast.success('อนุมัติเติมเงินสำเร็จ');
      mutate();
      setShowDetailDialog(false);
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) {
      toast.error('กรุณาระบุเหตุผล');
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch(`/api/tenant/${slug}/admin/topup-requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) throw new Error();
      toast.success('ปฏิเสธคำขอแล้ว');
      mutate();
      setShowDetailDialog(false);
      setRejectReason('');
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">คำขอเติมเงิน</h1>
          <p className="text-gray-400">ตรวจสอบและอนุมัติคำขอเติมเงินจากลูกค้า</p>
        </div>
        <Button variant="outline" onClick={() => mutate()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          รีเฟรช
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#1a1a2e] border-white/10">
          <CardContent className="p-4">
            <p className="text-gray-400 text-sm">รอตรวจสอบ</p>
            <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1a1a2e] border-white/10">
          <CardContent className="p-4">
            <p className="text-gray-400 text-sm">ยอดรอตรวจสอบ</p>
            <p className="text-2xl font-bold text-amber-400">฿{stats.total_pending_amount?.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1a1a2e] border-white/10">
          <CardContent className="p-4">
            <p className="text-gray-400 text-sm">อนุมัติวันนี้</p>
            <p className="text-2xl font-bold text-green-400">{stats.approved}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1a1a2e] border-white/10">
          <CardContent className="p-4">
            <p className="text-gray-400 text-sm">ปฏิเสธวันนี้</p>
            <p className="text-2xl font-bold text-red-400">{stats.rejected}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <Tabs value={status} onValueChange={setStatus} className="flex-1">
          <TabsList className="bg-white/5">
            <TabsTrigger value="pending">รอตรวจสอบ ({stats.pending})</TabsTrigger>
            <TabsTrigger value="approved">อนุมัติแล้ว</TabsTrigger>
            <TabsTrigger value="rejected">ปฏิเสธ</TabsTrigger>
            <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="ค้นหาชื่อ, เบอร์โทร..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white/5 border-white/10"
          />
        </div>
      </div>

      {/* Request List */}
      <div className="space-y-3">
        {isLoading ? (
          <Card className="bg-[#1a1a2e] border-white/10 p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-400" />
          </Card>
        ) : requests.length === 0 ? (
          <Card className="bg-[#1a1a2e] border-white/10 p-8 text-center">
            <CreditCard className="h-12 w-12 mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400">ไม่มีคำขอเติมเงิน</p>
          </Card>
        ) : (
          requests.map((req: any) => {
            const statusInfo = STATUS_MAP[req.status] || STATUS_MAP.pending;
            const StatusIcon = statusInfo.icon;
            return (
              <Card key={req.id} className="bg-[#1a1a2e] border-white/10 hover:border-amber-500/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-amber-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-white">{req.customer?.name || req.customer?.username || 'ไม่ระบุชื่อ'}</p>
                          <Badge className={statusInfo.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-400">{req.customer?.phone}</p>
                        <p className="text-xs text-gray-500">
                          {req.created_at && format(new Date(req.created_at), 'dd MMM yyyy HH:mm', { locale: th })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-green-400">+฿{req.amount?.toLocaleString()}</p>
                      <div className="flex gap-2 mt-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => { setSelectedRequest(req); setShowDetailDialog(true); }}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          ดูรายละเอียด
                        </Button>
                        {req.status === 'pending' && (
                          <>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(req.id)}>
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => { setSelectedRequest(req); setShowDetailDialog(true); }}>
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>รายละเอียดคำขอเติมเงิน</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400">ลูกค้า</Label>
                  <p className="font-semibold">{selectedRequest.customer?.name || selectedRequest.customer?.username}</p>
                </div>
                <div>
                  <Label className="text-gray-400">เบอร์โทร</Label>
                  <p>{selectedRequest.customer?.phone}</p>
                </div>
                <div>
                  <Label className="text-gray-400">จำนวนเงิน</Label>
                  <p className="text-xl font-bold text-green-400">฿{selectedRequest.amount?.toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-gray-400">สถานะ</Label>
                  <Badge className={STATUS_MAP[selectedRequest.status]?.color}>
                    {STATUS_MAP[selectedRequest.status]?.label}
                  </Badge>
                </div>
              </div>

              {selectedRequest.slip_url && (
                <div>
                  <Label className="text-gray-400">สลิปโอนเงิน</Label>
                  <div className="mt-2 border border-white/10 rounded-lg overflow-hidden">
                    <img src={selectedRequest.slip_url} alt="Slip" className="w-full" />
                  </div>
                </div>
              )}

              {selectedRequest.status === 'pending' && (
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <div className="space-y-2">
                    <Label>เหตุผลในการปฏิเสธ (ถ้าปฏิเสธ)</Label>
                    <Textarea 
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="ระบุเหตุผล..."
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1 bg-green-600 hover:bg-green-700" 
                      onClick={() => handleApprove(selectedRequest.id)}
                      disabled={processing}
                    >
                      {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                      อนุมัติ
                    </Button>
                    <Button 
                      className="flex-1" 
                      variant="destructive"
                      onClick={() => handleReject(selectedRequest.id)}
                      disabled={processing}
                    >
                      {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
                      ปฏิเสธ
                    </Button>
                  </div>
                </div>
              )}

              {selectedRequest.status === 'rejected' && selectedRequest.reject_reason && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-400">เหตุผลที่ปฏิเสธ: {selectedRequest.reject_reason}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
