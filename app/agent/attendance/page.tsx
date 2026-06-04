'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Ticket,
  Calculator,
  ArrowUpRight,
  Clock,
  ClipboardList,
  DollarSign,
  CheckCircle,
  XCircle,
  Calendar,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AgentAttendancePage() {
  const { user, logout } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // ดึงข้อมูล attendance ของ sub-agents ใต้สาย
  const { data: attendanceData } = useSWR(
    user?.id ? `/api/agent/attendance?agent_id=${user.id}&month=${selectedMonth}` : null,
    fetcher,
    { refreshInterval: 60000 }
  );

  const records = attendanceData?.records || [];
  const summary = attendanceData?.summary || {};

  const menuItems = [
    { icon: LayoutDashboard, label: 'แดชบอร์ด', href: '/agent/dashboard' },
    { icon: Ticket, label: 'รายการโพย', href: '/agent/entries' },
    { icon: Calculator, label: 'กำไร/ขาดทุน', href: '/agent/profit' },
    { icon: ArrowUpRight, label: 'ส่งยอด', href: '/agent/settlement' },
    { icon: Users, label: 'จัดการพนักงาน', href: '/agent/staff' },
    { icon: ClipboardList, label: 'รายงานเข้างาน', href: '/agent/attendance', active: true },
    { icon: DollarSign, label: 'สรุปเงินเดือน', href: '/agent/salary' },
    { icon: Settings, label: 'ตั้งค่า', href: '/agent/settings' },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0D1321] border-r border-white/10 p-4 flex flex-col">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-amber-400">ร้านหวย</h1>
          <p className="text-sm text-white/60">{user?.name || 'เอเย่น'}</p>
          <Badge className="mt-2 bg-green-500/20 text-green-400 border-green-500/30">
            กำไร {user?.share_percent || 90}%
          </Badge>
        </div>

        <nav className="flex-1 space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                item.active
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon className="size-5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <Button 
          variant="ghost" 
          onClick={() => logout()}
          className="mt-auto text-white/60 hover:text-white justify-start gap-3"
        >
          <LogOut className="size-5" />
          ออกจากระบบ
        </Button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 bg-[#f8f5f0]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-amber-600">รายงานเข้างานพนักงาน</h2>
            <p className="text-muted-foreground">สรุปการลงเวลางานของ Sub-Agent ใต้สาย</p>
          </div>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40">
              <Calendar className="size-4 mr-2" />
              <SelectValue placeholder="เลือกเดือน" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 6 }, (_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                const value = date.toISOString().slice(0, 7);
                return (
                  <SelectItem key={value} value={value}>
                    {date.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">พนักงานทั้งหมด</p>
              <p className="text-2xl font-bold">{summary.total_staff || 0} คน</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">วันทำงานรวม</p>
              <p className="text-2xl font-bold text-green-600">{summary.total_work_days || 0} วัน</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">ขาดงาน</p>
              <p className="text-2xl font-bold text-red-600">{summary.total_absent || 0} วัน</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">สาย</p>
              <p className="text-2xl font-bold text-yellow-600">{summary.total_late || 0} ครั้ง</p>
            </CardContent>
          </Card>
        </div>

        {/* Attendance Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-5 text-amber-500" />
              รายละเอียดการเข้างาน
            </CardTitle>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="size-12 mx-auto mb-4 opacity-50" />
                <p>ยังไม่มีข้อมูลการเข้างาน</p>
                <p className="text-sm">ข้อมูลจะแสดงเมื่อพนักงานลงเวลางาน</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>พนักงาน</TableHead>
                    <TableHead>วันที่</TableHead>
                    <TableHead>เวลาเข้า</TableHead>
                    <TableHead>เวลาออก</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">ชั่วโมงทำงาน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{record.staff_name}</TableCell>
                      <TableCell>{new Date(record.date).toLocaleDateString('th-TH')}</TableCell>
                      <TableCell>{record.check_in || '-'}</TableCell>
                      <TableCell>{record.check_out || '-'}</TableCell>
                      <TableCell>
                        {record.status === 'present' ? (
                          <Badge className="bg-green-500/20 text-green-600">
                            <CheckCircle className="size-3 mr-1" />มาทำงาน
                          </Badge>
                        ) : record.status === 'late' ? (
                          <Badge className="bg-yellow-500/20 text-yellow-600">
                            <Clock className="size-3 mr-1" />มาสาย
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/20 text-red-600">
                            <XCircle className="size-3 mr-1" />ขาดงาน
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{record.hours || 0} ชม.</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
