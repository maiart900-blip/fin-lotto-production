'use client';

import { useState, useEffect } from 'react';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Ticket,
  Calculator,
  ArrowUpRight,
  Plus,
  Search,
  MoreVertical,
  UserPlus,
  Edit,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AgentStaffPage() {
  const { user, logout } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);

  // ดึงข้อมูล sub-agents/staff
  const { data: staffData, mutate } = useSWR(
    '/api/admin/agents?level=sub_agent',
    fetcher
  );

  const staff = staffData?.agents || [];

  const filteredStaff = staff.filter((s: any) => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const menuItems = [
    { icon: LayoutDashboard, label: 'แดชบอร์ด', href: '/agent/dashboard' },
    { icon: Ticket, label: 'รายการโพย', href: '/agent/entries' },
    { icon: Calculator, label: 'กำไร/ขาดทุน', href: '/agent/profit' },
    { icon: ArrowUpRight, label: 'ส่งยอด', href: '/agent/settlement' },
    { icon: Users, label: 'พนักงาน', href: '/agent/staff', active: true },
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
            <h2 className="text-2xl font-bold text-amber-600">จัดการพนักงาน</h2>
            <p className="text-muted-foreground">รายชื่อ Sub-Agent และพนักงานในสายงาน</p>
          </div>
          <Link href="/agent-system/agents">
            <Button className="bg-amber-500 hover:bg-amber-600 text-white gap-2">
              <UserPlus className="size-4" />
              เพิ่มพนักงาน
            </Button>
          </Link>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อ, username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Staff List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5 text-amber-500" />
              รายชื่อพนักงาน ({filteredStaff.length} คน)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredStaff.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="size-12 mx-auto mb-4 opacity-50" />
                <p>ยังไม่มีพนักงานในสายงาน</p>
                <p className="text-sm">กดปุ่ม "เพิ่มพนักงาน" เพื่อเริ่มต้น</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>ระดับ</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>ยอดคีย์วันนี้</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.code}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {s.role === 'sub_agent' ? 'Sub-Agent' : s.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={s.is_active ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'}>
                          {s.is_active ? 'ใช้งาน' : 'ระงับ'}
                        </Badge>
                      </TableCell>
                      <TableCell>0 บาท</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="size-4" />
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
