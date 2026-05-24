'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  History,
  Search,
  RefreshCw,
  User,
  DollarSign,
  Settings,
  Shield,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download,
  Clock,
  Activity,
} from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: any;
  performed_by: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

const ACTION_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  'login': { label: 'เข้าสู่ระบบ', icon: User, color: 'bg-blue-500' },
  'logout': { label: 'ออกจากระบบ', icon: User, color: 'bg-gray-500' },
  'create_entry': { label: 'สร้างรายการ', icon: DollarSign, color: 'bg-green-500' },
  'update_entry': { label: 'แก้ไขรายการ', icon: DollarSign, color: 'bg-yellow-500' },
  'delete_entry': { label: 'ลบรายการ', icon: DollarSign, color: 'bg-red-500' },
  'approve_topup': { label: 'อนุมัติฝาก', icon: DollarSign, color: 'bg-green-500' },
  'reject_topup': { label: 'ปฏิเสธฝาก', icon: DollarSign, color: 'bg-red-500' },
  'approve_withdraw': { label: 'อนุมัติถอน', icon: DollarSign, color: 'bg-green-500' },
  'reject_withdraw': { label: 'ปฏิเสธถอน', icon: DollarSign, color: 'bg-red-500' },
  'update_settings': { label: 'แก้ไขตั้งค่า', icon: Settings, color: 'bg-purple-500' },
  'instant_settlement': { label: 'จ่ายรางวัล', icon: DollarSign, color: 'bg-[#EAB308]' },
  'block_number': { label: 'บล็อคเลข', icon: Shield, color: 'bg-red-500' },
  'unblock_number': { label: 'ปลดบล็อคเลข', icon: Shield, color: 'bg-green-500' },
  'view_report': { label: 'ดูรายงาน', icon: Eye, color: 'bg-blue-500' },
};

export default function ActivityLogsPage() {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterEntity, setFilterEntity] = useState<string>('all');

  const { data, error, mutate, isValidating } = useSWR<{
    logs: ActivityLog[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>(
    `/api/activity-logs?page=${page}&limit=20${filterAction !== 'all' ? `&action=${filterAction}` : ''}${filterEntity !== 'all' ? `&entity_type=${filterEntity}` : ''}`,
    fetcher,
    { refreshInterval: 10000 }
  );

  const logs = data?.logs || [];
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const getActionInfo = (action: string) => {
    return ACTION_LABELS[action] || { label: action, icon: Activity, color: 'bg-gray-500' };
  };

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd MMM yyyy HH:mm:ss', { locale: th });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-[#1E293B] p-6 -m-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] shadow-lg shadow-[rgba(234,179,8,0.4)]">
              <History className="size-6 text-white" />
            </div>
            <span className="text-gold-gradient">Activity Logs</span>
          </h1>
          <p className="text-[#94A3B8] mt-1">ประวัติการทำงานทั้งหมด - ตรวจสอบได้ 100%</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-[#EAB308] text-[#0F172A]">
            {pagination.total.toLocaleString()} รายการ
          </Badge>
          <Button
            onClick={() => mutate()}
            variant="outline"
            size="sm"
            disabled={isValidating}
            className="border-[#EAB308]/50 text-[#EAB308] hover:bg-[#EAB308]/10"
          >
            <RefreshCw className={`size-4 mr-1 ${isValidating ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-[#EAB308]/50 text-[#EAB308] hover:bg-[#EAB308]/10"
          >
            <Download className="size-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-[#1E293B]/80 border-[#334155]">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#94A3B8]" />
                <Input
                  placeholder="ค้นหา..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-[#0F172A] border-[#334155] text-white"
                />
              </div>
            </div>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-[180px] bg-[#0F172A] border-[#334155] text-white">
                <SelectValue placeholder="ประเภทการกระทำ" />
              </SelectTrigger>
              <SelectContent className="bg-[#1E293B] border-[#334155]">
                <SelectItem value="all" className="text-white">ทั้งหมด</SelectItem>
                {Object.entries(ACTION_LABELS).map(([key, { label }]) => (
                  <SelectItem key={key} value={key} className="text-white">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger className="w-[180px] bg-[#0F172A] border-[#334155] text-white">
                <SelectValue placeholder="ประเภทข้อมูล" />
              </SelectTrigger>
              <SelectContent className="bg-[#1E293B] border-[#334155]">
                <SelectItem value="all" className="text-white">ทั้งหมด</SelectItem>
                <SelectItem value="entry" className="text-white">รายการแทง</SelectItem>
                <SelectItem value="customer" className="text-white">ลูกค้า</SelectItem>
                <SelectItem value="agent" className="text-white">เอเย่นต์</SelectItem>
                <SelectItem value="lottery" className="text-white">หวย</SelectItem>
                <SelectItem value="topup" className="text-white">ฝากเงิน</SelectItem>
                <SelectItem value="withdraw" className="text-white">ถอนเงิน</SelectItem>
                <SelectItem value="settings" className="text-white">ตั้งค่า</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="bg-[#1E293B]/80 border-[#334155]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[#334155] hover:bg-transparent">
                <TableHead className="text-[#94A3B8]">เวลา</TableHead>
                <TableHead className="text-[#94A3B8]">การกระทำ</TableHead>
                <TableHead className="text-[#94A3B8]">ผู้ดำเนินการ</TableHead>
                <TableHead className="text-[#94A3B8]">รายละเอียด</TableHead>
                <TableHead className="text-[#94A3B8]">IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const actionInfo = getActionInfo(log.action);
                const ActionIcon = actionInfo.icon;
                
                return (
                  <TableRow key={log.id} className="border-[#334155] hover:bg-[#0F172A]/50">
                    <TableCell className="text-white">
                      <div className="flex items-center gap-2">
                        <Clock className="size-4 text-[#94A3B8]" />
                        <span className="text-sm">{formatTime(log.created_at)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${actionInfo.color} text-white`}>
                        <ActionIcon className="size-3 mr-1" />
                        {actionInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-white">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-full bg-gradient-to-br from-[#EAB308] to-[#B8860B] flex items-center justify-center">
                          <User className="size-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium">{log.user?.name || 'System'}</p>
                          <p className="text-xs text-[#94A3B8]">{log.user?.role || 'auto'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-[#94A3B8] max-w-[300px] truncate">
                      {log.entity_type && (
                        <Badge variant="outline" className="mr-2 border-[#334155] text-[#94A3B8]">
                          {log.entity_type}
                        </Badge>
                      )}
                      {log.details ? (
                        <span className="text-sm">
                          {typeof log.details === 'string' 
                            ? log.details 
                            : JSON.stringify(log.details).slice(0, 50)}...
                        </span>
                      ) : (
                        <span className="text-sm">ID: {log.entity_id}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[#94A3B8] text-sm font-mono">
                      {log.ip_address || '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
              
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-[#94A3B8]">
                    ไม่พบประวัติการทำงาน
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#94A3B8]">
          แสดง {((page - 1) * pagination.limit) + 1} - {Math.min(page * pagination.limit, pagination.total)} จาก {pagination.total} รายการ
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="border-[#334155] text-white hover:bg-[#334155]"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-white px-4">
            หน้า {page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
            className="border-[#334155] text-white hover:bg-[#334155]"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
