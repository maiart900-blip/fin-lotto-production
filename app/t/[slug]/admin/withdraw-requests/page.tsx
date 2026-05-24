'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowDownToLine, 
  Search, 
  CheckCircle, 
  XCircle, 
  Clock,
  Banknote,
  User
} from 'lucide-react';
import { toast } from 'sonner';

interface WithdrawRequest {
  id: string;
  amount: number;
  status: string;
  bank_code: string;
  account_number: string;
  account_name: string;
  reject_reason?: string;
  created_at: string;
  customer?: {
    id: string;
    name: string;
    username: string;
    phone: string;
  };
}

export default function WithdrawRequestsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [requests, setRequests] = useState<WithdrawRequest[]>([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total_pending_amount: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');

  const fetchRequests = async () => {
    try {
      const res = await fetch(`/api/tenant/${slug}/admin/withdraw-requests?status=${filter}&search=${search}`);
      const data = await res.json();
      setRequests(data.requests || []);
      setStats(data.stats || { pending: 0, approved: 0, rejected: 0, total_pending_amount: 0 });
    } catch (error) {
      console.error('Error fetching withdraw requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [filter, search, slug]);

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/tenant/${slug}/admin/withdraw-requests/${id}/approve`, {
        method: 'POST',
      });
      if (res.ok) {
        toast.success('อนุมัติถอนเงินสำเร็จ');
        fetchRequests();
      } else {
        const data = await res.json();
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('ระบุเหตุผลที่ปฏิเสธ:');
    if (!reason) return;

    try {
      const res = await fetch(`/api/tenant/${slug}/admin/withdraw-requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        toast.success('ปฏิเสธคำขอถอนเงินแล้ว');
        fetchRequests();
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" /> รอดำเนินการ</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" /> อนุมัติแล้ว</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" /> ปฏิเสธ</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ArrowDownToLine className="h-6 w-6 text-amber-400" />
          คำขอถอนเงิน
        </h1>
        <p className="text-gray-400">จัดการคำขอถอนเงินของลูกค้า</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
            <div className="text-sm text-gray-400">รอดำเนินการ</div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-400">{stats.approved}</div>
            <div className="text-sm text-gray-400">อนุมัติวันนี้</div>
          </CardContent>
        </Card>
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-400">{stats.rejected}</div>
            <div className="text-sm text-gray-400">ปฏิเสธวันนี้</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-400">฿{stats.total_pending_amount.toLocaleString()}</div>
            <div className="text-sm text-gray-400">ยอดรอถอน</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex gap-2">
              {['pending', 'approved', 'rejected', 'all'].map((status) => (
                <Button
                  key={status}
                  variant={filter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(status)}
                  className={filter === status ? 'bg-amber-500 hover:bg-amber-600' : ''}
                >
                  {status === 'pending' && 'รอดำเนินการ'}
                  {status === 'approved' && 'อนุมัติแล้ว'}
                  {status === 'rejected' && 'ปฏิเสธ'}
                  {status === 'all' && 'ทั้งหมด'}
                </Button>
              ))}
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="ค้นหาชื่อ, เบอร์โทร..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-gray-900 border-gray-700"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests List */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">รายการคำขอถอนเงิน</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-400">กำลังโหลด...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-gray-400">ไม่มีคำขอถอนเงิน</div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div key={req.id} className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-white">
                          {req.customer?.name || req.customer?.username || 'ไม่ระบุ'}
                        </span>
                        <span className="text-gray-500">({req.customer?.phone})</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <Banknote className="h-4 w-4" />
                          {req.bank_code} - {req.account_number}
                        </span>
                        <span>ชื่อบัญชี: {req.account_name}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{formatDate(req.created_at)}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xl font-bold text-white">฿{req.amount.toLocaleString()}</div>
                        {getStatusBadge(req.status)}
                      </div>
                      {req.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleApprove(req.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            อนุมัติ
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(req.id)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            ปฏิเสธ
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  {req.reject_reason && (
                    <div className="mt-2 text-sm text-red-400 bg-red-500/10 p-2 rounded">
                      เหตุผล: {req.reject_reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
