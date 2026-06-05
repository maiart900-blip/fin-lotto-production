'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { RouteGuard } from '@/components/security/route-guard';
import { Card, CardContent } from '@/components/ui/card';
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
} from '@/components/ui/dialog';
import {
  History,
  Search,
  Eye,
  User,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Shield,
  AlertTriangle,
  Activity,
  DollarSign,
  Settings,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

interface AuditLog {
  id: string;
  user_id: string | null;
  customer_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  description: string | null;
  created_at: string;
  user: {
    id: string;
    username: string;
    display_name: string;
  } | null;
  customer: {
    id: string;
    name: string;
    phone: string;
  } | null;
}

const actionColors: Record<string, string> = {
  // Authentication
  login: 'bg-purple-500/20 text-purple-400',
  logout: 'bg-gray-500/20 text-gray-400',
  login_failed: 'bg-red-500/20 text-red-400',
  password_change: 'bg-orange-500/20 text-orange-400',
  // CRUD
  create: 'bg-green-500/20 text-green-400',
  update: 'bg-blue-500/20 text-blue-400',
  delete: 'bg-red-500/20 text-red-400',
  // Financial
  wallet_deposit: 'bg-green-500/20 text-green-400',
  wallet_withdraw: 'bg-amber-500/20 text-amber-400',
  wallet_adjustment: 'bg-orange-500/20 text-orange-400',
  credit_adjust: 'bg-orange-500/20 text-orange-400',
  // Admin actions
  approve: 'bg-green-500/20 text-green-400',
  reject: 'bg-red-500/20 text-red-400',
  config_change: 'bg-purple-500/20 text-purple-400',
  role_change: 'bg-pink-500/20 text-pink-400',
  permission_change: 'bg-pink-500/20 text-pink-400',
  // Security
  access_denied: 'bg-red-500/20 text-red-400',
  suspicious_activity: 'bg-red-500/20 text-red-400',
  rate_limited: 'bg-orange-500/20 text-orange-400',
  // Lottery
  round_open: 'bg-cyan-500/20 text-cyan-400',
  round_close: 'bg-slate-500/20 text-slate-400',
  result_input: 'bg-blue-500/20 text-blue-400',
};

const categoryIcons: Record<string, typeof Activity> = {
  auth: Lock,
  financial: DollarSign,
  admin: Settings,
  security: Shield,
  data: Activity,
  system: Settings,
};

export default function AuditLogsPage() {
  const { canAccess, isSuperAdmin } = useAuth();
  const [actionFilter, setActionFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [page, setPage] = useState(0);
  const limit = 50;

  const { data, mutate } = useSWR(
    `/api/audit-logs?action=${actionFilter}&category=${categoryFilter}&limit=${limit}&offset=${page * limit}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const actions = data?.actions || [];
  const totalPages = Math.ceil(total / limit);

  const filteredLogs = logs.filter((log: AuditLog) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.action?.toLowerCase().includes(search) ||
      log.table_name?.toLowerCase().includes(search) ||
      log.description?.toLowerCase().includes(search) ||
      log.user?.username?.toLowerCase().includes(search) ||
      log.customer?.name?.toLowerCase().includes(search)
    );
  });

  if (!canAccess('audit_logs') && !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-slate-500">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    );
  }

  return (
    <RouteGuard requireSuperAdmin>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-amber-500" />
            ประวัติการใช้งานระบบ
          </h1>
          <p className="text-slate-500">ติดตามการเปลี่ยนแปลงและตรวจสอบความโปร่งใสของทีมงาน</p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => mutate()}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          รีเฟรช
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-400 mb-1">
              <Activity className="h-4 w-4" />
              <span className="text-xs">กิจกรรมทั้งหมด</span>
            </div>
            <p className="text-2xl font-bold text-green-300">{total.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-400 mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs">การเงิน</span>
            </div>
            <p className="text-2xl font-bold text-amber-300">
              {logs.filter((l: AuditLog) => l.action?.includes('wallet') || l.action?.includes('credit')).length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-400 mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs">ความเสี่ยงสูง</span>
            </div>
            <p className="text-2xl font-bold text-red-300">
              {logs.filter((l: AuditLog) => l.new_data?.risk_level === 'high' || l.new_data?.risk_level === 'critical').length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-purple-400 mb-1">
              <Lock className="h-4 w-4" />
              <span className="text-xs">ความปลอดภัย</span>
            </div>
            <p className="text-2xl font-bold text-purple-300">
              {logs.filter((l: AuditLog) => l.action?.includes('login') || l.action?.includes('access')).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-black/90 border-slate-800">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="ค้นหาตามชื่อผู้ใช้ หรือรายละเอียด..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-black/80 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-40 bg-black/80 border-slate-700 text-white">
                <SelectValue placeholder="หมวดหมู่" />
              </SelectTrigger>
              <SelectContent className="bg-black border-slate-700">
                <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
                <SelectItem value="auth">การเข้าสู่ระบบ</SelectItem>
                <SelectItem value="financial">การเงิน</SelectItem>
                <SelectItem value="admin">ผู้ดูแลระบบ</SelectItem>
                <SelectItem value="security">ความปลอดภัย</SelectItem>
                <SelectItem value="data">ข้อมูล</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full md:w-48 bg-black/80 border-slate-700 text-white">
                <SelectValue placeholder="เลือก Action" />
              </SelectTrigger>
              <SelectContent className="bg-black border-slate-700">
                <SelectItem value="all">ทั้งหมด</SelectItem>
                {actions.map((action: string) => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-black/90 border-slate-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead className="text-white font-semibold">เวลา</TableHead>
                <TableHead className="text-white font-semibold">Action</TableHead>
                <TableHead className="text-white font-semibold">ตาราง</TableHead>
                <TableHead className="text-white font-semibold">ผู้ใช้</TableHead>
                <TableHead className="text-white font-semibold">IP Address</TableHead>
                <TableHead className="text-white font-semibold">รายละเอียด</TableHead>
                <TableHead className="text-right text-white font-semibold">ดู</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    ไม่พบรายการ
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log: AuditLog) => (
                  <TableRow key={log.id} className="border-slate-800 hover:bg-slate-900/50">
                    <TableCell className="text-sm text-white whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        {formatDate(log.created_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={actionColors[log.action] || 'bg-gray-500/20 text-gray-400'}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-white">{log.table_name || '-'}</TableCell>
                    <TableCell>
                      {log.user ? (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-400" />
                          <span className="text-white">{log.user.display_name || log.user.username}</span>
                        </div>
                      ) : log.customer ? (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-400" />
                          <span className="text-white">{log.customer.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-white">
                      {log.ip_address || '-'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-white">
                      {log.description || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="hover:bg-slate-800 text-white"
                        onClick={() => {
                          setSelectedLog(log);
                          setIsDetailOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          แสดง {page * limit + 1} - {Math.min((page + 1) * limit, total)} จาก {total} รายการ
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              รายละเอียด Log
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Action</p>
                  <Badge className={actionColors[selectedLog.action] || 'bg-gray-500/20 text-gray-400'}>
                    {selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-500">ตาราง</p>
                  <p className="font-mono">{selectedLog.table_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">เว��า</p>
                  <p>{formatDate(selectedLog.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">ผู้ใช้</p>
                  <p>{selectedLog.user?.display_name || selectedLog.user?.username || selectedLog.customer?.name || '-'}</p>
                </div>
              </div>

              {selectedLog.description && (
                <div>
                  <p className="text-sm text-slate-500">รายละเอียด</p>
                  <p>{selectedLog.description}</p>
                </div>
              )}

              {selectedLog.ip_address && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">IP Address</p>
                    <p className="font-mono">{selectedLog.ip_address}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Record ID</p>
                    <p className="font-mono text-xs">{selectedLog.record_id || '-'}</p>
                  </div>
                </div>
              )}

              {selectedLog.old_data && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">ข้อมูลเดิม</p>
                  <pre className="p-3 bg-red-500/10 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.old_data, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_data && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">ข้อมูลใหม่</p>
                  <pre className="p-3 bg-green-500/10 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.new_data, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.user_agent && (
                <div>
                  <p className="text-sm text-slate-500">User Agent</p>
                  <p className="text-xs font-mono break-all">{selectedLog.user_agent}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </RouteGuard>
  );
}
