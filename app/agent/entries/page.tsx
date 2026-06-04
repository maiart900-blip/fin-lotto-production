'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Ticket,
  Calculator,
  ArrowUpRight,
  Search,
  Filter,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  ClipboardList,
  DollarSign,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AgentEntriesPage() {
  const { user, logout } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const today = new Date().toISOString().split('T')[0];

  // ดึงข้อมูล entries - ต้องส่ง agent_id
  const { data: entriesData } = useSWR(
    user?.id ? `/api/agent/entries?agent_id=${user.id}&date=${today}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );

  const entries = entriesData?.entries || [];

  const menuItems = [
    { icon: LayoutDashboard, label: 'แดชบอร์ด', href: '/agent/dashboard' },
    { icon: Ticket, label: 'รายการโพย', href: '/agent/entries', active: true },
    { icon: Calculator, label: 'กำไร/ขาดทุน', href: '/agent/profit' },
    { icon: ArrowUpRight, label: 'ส่งยอด', href: '/agent/settlement' },
    { icon: Users, label: 'จัดการพนักงาน', href: '/agent/staff' },
    { icon: ClipboardList, label: 'รายงานเข้างาน', href: '/agent/attendance' },
    { icon: DollarSign, label: 'สรุปเงินเดือน', href: '/agent/salary' },
    { icon: Settings, label: 'ตั้งค่า', href: '/agent/settings' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-600"><Clock className="size-3 mr-1" />รอผล</Badge>;
      case 'won':
        return <Badge className="bg-green-500/20 text-green-600"><CheckCircle className="size-3 mr-1" />ถูกรางวัล</Badge>;
      case 'lost':
        return <Badge className="bg-red-500/20 text-red-600"><XCircle className="size-3 mr-1" />ไม่ถูก</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0D1321] border-r border-white/10 p-4 flex flex-col">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-amber-400">ร้านหวย</h1>
          <p className="text-sm text-white/60">{user?.name || 'เอเย่น'}</p>
          <Badge className="mt-2 bg-green-500/20 text-green-400 border-green-500/30">
            กำไร 90%
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
            <h2 className="text-2xl font-bold text-amber-600">รายการโพย</h2>
            <p className="text-muted-foreground">รายการที่คีย์เข้ามาวันนี้</p>
          </div>
          <Link href="/manual-key/entries">
            <Button className="bg-amber-500 hover:bg-amber-600 text-white gap-2">
              <Ticket className="size-4" />
              คีย์โพยใหม่
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาเลข, ชื่อลูกค้า..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="size-4 mr-2" />
                  <SelectValue placeholder="สถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="pending">รอผล</SelectItem>
                  <SelectItem value="won">ถูกรางวัล</SelectItem>
                  <SelectItem value="lost">ไม่ถูก</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Entries List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="size-5 text-amber-500" />
              รายการวันนี้ ({entries.length} รายการ)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Ticket className="size-12 mx-auto mb-4 opacity-50" />
                <p>ยังไม่มีรายการคีย์วันนี้</p>
                <p className="text-sm">กดปุ่ม "คีย์โพยใหม่" เพื่อเริ่มต้น</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เวลา</TableHead>
                    <TableHead>ลูกค้า</TableHead>
                    <TableHead>หวย</TableHead>
                    <TableHead>จำนวนเลข</TableHead>
                    <TableHead className="text-right">ยอด</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry: any) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(entry.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell className="font-medium">{entry.customer_name || '-'}</TableCell>
                      <TableCell>{entry.lottery_name || '-'}</TableCell>
                      <TableCell>{entry.numbers_count || 0} เลข</TableCell>
                      <TableCell className="text-right font-medium">
                        {(entry.total_amount || 0).toLocaleString()} บ.
                      </TableCell>
                      <TableCell>{getStatusBadge(entry.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <Eye className="size-4" />
                        </Button>
                      </TableCell>
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
