'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Receipt,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  Download,
  Eye,
  TrendingUp,
  TrendingDown,
  Building2,
  Calendar,
  Loader2,
  FileText,
  DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Settlement {
  id: string;
  tenant_id: string;
  tenant: { id: string; name: string; slug: string } | null;
  period_start: string;
  period_end: string;
  total_bets: number;
  total_wins: number;
  net_profit: number;
  commission_amount: number;
  settlement_amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  submitted_at: string;
  approved_at: string | null;
  paid_at: string | null;
  notes: string | null;
}

interface SettlementStats {
  totalSettlements: number;
  pendingCount: number;
  approvedCount: number;
  paidCount: number;
  totalAmount: number;
  pendingAmount: number;
}

export default function SettlementsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [approveNotes, setApproveNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  // Fetch settlements
  const { data: settlementsData, error, isLoading, mutate } = useSWR(
    `/api/multi-tenant/settlements?status=${statusFilter}&search=${search}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const settlements: Settlement[] = settlementsData?.settlements || [];
  const stats: SettlementStats = settlementsData?.stats || {
    totalSettlements: 0,
    pendingCount: 0,
    approvedCount: 0,
    paidCount: 0,
    totalAmount: 0,
    pendingAmount: 0,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30"><Clock className="size-3 mr-1" />รอตรวจสอบ</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30"><CheckCircle className="size-3 mr-1" />อนุมัติแล้ว</Badge>;
      case 'paid':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30"><DollarSign className="size-3 mr-1" />จ่ายแล้ว</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30"><XCircle className="size-3 mr-1" />ปฏิเสธ</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleApprove = async () => {
    if (!selectedSettlement) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/multi-tenant/settlements/${selectedSettlement.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: approveNotes }),
      });
      if (!res.ok) throw new Error('Failed to approve');
      toast.success('อนุมัติยอดส่งสำเร็จ');
      mutate();
      setShowApproveDialog(false);
      setApproveNotes('');
    } catch (err) {
      toast.error('ไม่สามารถอนุมัติได้');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedSettlement || !rejectReason.trim()) {
      toast.error('กรุณาระบุเหตุผล');
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch(`/api/multi-tenant/settlements/${selectedSettlement.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) throw new Error('Failed to reject');
      toast.success('ปฏิเสธยอดส่งสำเร็จ');
      mutate();
      setShowRejectDialog(false);
      setRejectReason('');
    } catch (err) {
      toast.error('ไม่สามารถปฏิเสธได้');
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkPaid = async (settlement: Settlement) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/multi-tenant/settlements/${settlement.id}/paid`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to mark as paid');
      toast.success('บันทึกการจ่ายเงินสำเร็จ');
      mutate();
    } catch (err) {
      toast.error('ไม่สามารถบันทึกได้');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'd MMM yyyy', { locale: th });
    } catch {
      return dateString;
    }
  };

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
        <Button onClick={() => mutate()} className="mt-4">ลองใหม่</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="size-6 text-primary" />
            รายการส่งยอด
          </h1>
          <p className="text-muted-foreground">จัดการและตรวจสอบยอดส่งจากเว็บลูก</p>
        </div>
        <Button variant="outline" onClick={() => mutate()}>
          <Download className="size-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">รอตรวจสอบ</p>
                <p className="text-2xl font-bold text-amber-500">{stats.pendingCount}</p>
              </div>
              <Clock className="size-8 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">อนุมัติแล้ว</p>
                <p className="text-2xl font-bold text-blue-500">{stats.approvedCount}</p>
              </div>
              <CheckCircle className="size-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">จ่ายแล้ว</p>
                <p className="text-2xl font-bold text-green-500">{stats.paidCount}</p>
              </div>
              <DollarSign className="size-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ยอดรอจ่าย</p>
                <p className="text-2xl font-bold text-purple-500">{formatCurrency(stats.pendingAmount)}</p>
              </div>
              <TrendingUp className="size-8 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อเว็บ, รหัสยอดส่ง..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="size-4 mr-2" />
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="pending">รอตรวจสอบ</SelectItem>
                <SelectItem value="approved">อนุมัติแล้ว</SelectItem>
                <SelectItem value="paid">จ่ายแล้ว</SelectItem>
                <SelectItem value="rejected">ปฏิเสธ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Settlements Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            รายการส่งยอดทั้งหมด
          </CardTitle>
          <CardDescription>
            ทั้งหมด {stats.totalSettlements} รายการ
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          ) : settlements.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="size-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">ยังไม่มีรายการส่งยอด</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เว็บลูก</TableHead>
                  <TableHead>ช่วงเวลา</TableHead>
                  <TableHead className="text-right">ยอดแทง</TableHead>
                  <TableHead className="text-right">ยอดถูก</TableHead>
                  <TableHead className="text-right">กำไรสุทธิ</TableHead>
                  <TableHead className="text-right">ยอดส่ง</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settlements.map((settlement) => (
                  <TableRow key={settlement.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="size-4 text-muted-foreground" />
                        <span className="font-medium">{settlement.tenant?.name || 'ไม่ระบุ'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="size-3 text-muted-foreground" />
                        {formatDate(settlement.period_start)} - {formatDate(settlement.period_end)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(settlement.total_bets)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-500">
                      -{formatCurrency(settlement.total_wins)}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${settlement.net_profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {formatCurrency(settlement.net_profit)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {formatCurrency(settlement.settlement_amount)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(settlement.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedSettlement(settlement);
                            setShowDetailDialog(true);
                          }}
                        >
                          <Eye className="size-4" />
                        </Button>
                        {settlement.status === 'pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-500 hover:text-green-600"
                              onClick={() => {
                                setSelectedSettlement(settlement);
                                setShowApproveDialog(true);
                              }}
                            >
                              <CheckCircle className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600"
                              onClick={() => {
                                setSelectedSettlement(settlement);
                                setShowRejectDialog(true);
                              }}
                            >
                              <XCircle className="size-4" />
                            </Button>
                          </>
                        )}
                        {settlement.status === 'approved' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkPaid(settlement)}
                            disabled={processing}
                          >
                            <DollarSign className="size-4 mr-1" />
                            จ่ายเงิน
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>รายละเอียดยอดส่ง</DialogTitle>
          </DialogHeader>
          {selectedSettlement && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">เว็บลูก</Label>
                  <p className="font-medium">{selectedSettlement.tenant?.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">สถานะ</Label>
                  <div className="mt-1">{getStatusBadge(selectedSettlement.status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">ช่วงเวลา</Label>
                  <p>{formatDate(selectedSettlement.period_start)} - {formatDate(selectedSettlement.period_end)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">วันที่ส่ง</Label>
                  <p>{formatDate(selectedSettlement.submitted_at)}</p>
                </div>
              </div>
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ยอดแทงทั้งหมด</span>
                  <span className="font-mono">{formatCurrency(selectedSettlement.total_bets)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ยอดถูกรางวัล</span>
                  <span className="font-mono text-red-500">-{formatCurrency(selectedSettlement.total_wins)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">กำไรสุทธิ</span>
                  <span className={`font-mono ${selectedSettlement.net_profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {formatCurrency(selectedSettlement.net_profit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ค่าคอมมิชชั่น</span>
                  <span className="font-mono">-{formatCurrency(selectedSettlement.commission_amount)}</span>
                </div>
                <hr />
                <div className="flex justify-between font-bold">
                  <span>ยอดส่งสุทธิ</span>
                  <span className="font-mono text-lg">{formatCurrency(selectedSettlement.settlement_amount)}</span>
                </div>
              </div>
              {selectedSettlement.notes && (
                <div>
                  <Label className="text-muted-foreground">หมายเหตุ</Label>
                  <p className="text-sm mt-1">{selectedSettlement.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>อนุมัติยอดส่ง</DialogTitle>
            <DialogDescription>
              ยืนยันการอนุมัติยอดส่งจาก {selectedSettlement?.tenant?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">ยอดส่งสุทธิ</p>
              <p className="text-2xl font-bold text-green-500">
                {selectedSettlement && formatCurrency(selectedSettlement.settlement_amount)}
              </p>
            </div>
            <div className="space-y-2">
              <Label>หมายเหตุ (ไม่บังคับ)</Label>
              <Textarea
                placeholder="ระบุหมายเหตุ..."
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>ยกเลิก</Button>
            <Button onClick={handleApprove} disabled={processing} className="bg-green-600 hover:bg-green-700">
              {processing && <Loader2 className="size-4 mr-2 animate-spin" />}
              <CheckCircle className="size-4 mr-2" />
              อนุมัติ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ปฏิเสธยอดส่ง</DialogTitle>
            <DialogDescription>
              ยืนยันการปฏิเสธยอดส่งจาก {selectedSettlement?.tenant?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">ยอดส่งสุทธิ</p>
              <p className="text-2xl font-bold text-red-500">
                {selectedSettlement && formatCurrency(selectedSettlement.settlement_amount)}
              </p>
            </div>
            <div className="space-y-2">
              <Label>เหตุผลในการปฏิเสธ *</Label>
              <Textarea
                placeholder="ระบุเหตุผล..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>ยกเลิก</Button>
            <Button onClick={handleReject} disabled={processing} variant="destructive">
              {processing && <Loader2 className="size-4 mr-2 animate-spin" />}
              <XCircle className="size-4 mr-2" />
              ปฏิเสธ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
