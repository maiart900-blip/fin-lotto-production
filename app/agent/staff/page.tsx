'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  Plus,
  Search,
  MoreVertical,
  UserPlus,
  Edit,
  Trash2,
  ClipboardList,
  DollarSign,
  Key,
  UserX,
  UserCheck,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AgentStaffPage() {
  const { user, logout } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newStaff, setNewStaff] = useState({
    username: '',
    name: '',
    password: '',
    phone: '',
    role: 'staff' as 'staff' | 'operator',
  });

  // ดึงข้อมูล sub-agents/staff - ต้อง filter เฉพาะใต้สายของ agent นี้
  const { data: staffData, mutate } = useSWR(
    user?.id ? `/api/agent/team?agent_id=${user.id}` : null,
    fetcher
  );

  const staff = staffData?.members || staffData?.agents || [];

  const filteredStaff = staff.filter((s: any) => 
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ฟังก์ชันเพิ่มพนักงานใหม่ - ผูก parent_agent_id อัตโนมัติ
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault(); // ป้องกันหน้ารีเฟรช
    
    if (!newStaff.username || !newStaff.name || !newStaff.password) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    if (!user?.id) {
      toast.error('ไม่พบข้อมูลผู้ใช้งาน');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const res = await fetch('/api/agent/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newStaff,
          parent_agent_id: user.id, // ผูกกับ agent ที่ login อัตโนมัติ
          account_type: 'staff',
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('เพิ่มพนักงานสำเร็จ');
        setIsAddDialogOpen(false);
        setNewStaff({
          username: '',
          name: '',
          password: '',
          phone: '',
          role: 'staff',
        });
        mutate(); // refresh data
      } else {
        toast.error(data.message || data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Error adding staff:', error);
      toast.error('เกิดข้อผิดพลาดในการเพิ่มพนักงาน');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ฟังก์ชันเปลี่ยนสถานะพนักงาน
  const handleToggleStatus = async (staffId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/agent/staff/${staffId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      if (res.ok) {
        toast.success(currentStatus ? 'ระงับการใช้งานแล้ว' : 'เปิดใช้งานแล้ว');
        mutate();
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'แดชบอร์ด', href: '/agent/dashboard' },
    { icon: Ticket, label: 'รายการโพย', href: '/agent/entries' },
    { icon: Calculator, label: 'กำไร/ขาดทุน', href: '/agent/profit' },
    { icon: ArrowUpRight, label: 'ส่งยอด', href: '/agent/settlement' },
    { icon: Users, label: 'จัดการพนักงาน', href: '/agent/staff', active: true },
    { icon: ClipboardList, label: 'รายงานเข้างาน', href: '/agent/attendance' },
    { icon: DollarSign, label: 'สรุปเงินเดือน', href: '/agent/salary' },
    { icon: Settings, label: 'ตั้งค่า', href: '/agent/settings' },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0D1321] border-r border-white/10 p-4 flex flex-col">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-amber-400">ร้านหวย</h1>
          <p className="text-sm text-white/60">{user?.name || 'เอเย่นต์'}</p>
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
          
          {/* Dialog เพิ่มพนักงาน - เปิดในหน้านี้เลย ไม่ redirect */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-amber-500 hover:bg-amber-600 text-white gap-2">
                <UserPlus className="size-4" />
                เพิ่มพนักงาน
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>เพิ่มพนักงานใหม่</DialogTitle>
                <DialogDescription>
                  พนักงานจะถูกผูกเข้ากับสายงานของคุณ ({user?.name || user?.username}) โดยอัตโนมัติ
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddStaff}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">ชื่อผู้ใช้ (Username) *</Label>
                    <Input
                      id="username"
                      value={newStaff.username}
                      onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value })}
                      placeholder="username"
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">ชื่อ-นามสกุล *</Label>
                    <Input
                      id="name"
                      value={newStaff.name}
                      onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                      placeholder="ชื่อ-นามสกุล"
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">รหัสผ่าน *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newStaff.password}
                      onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                      placeholder="รหัสผ่าน"
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">เบอร์โทร</Label>
                    <Input
                      id="phone"
                      value={newStaff.phone}
                      onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                      placeholder="0812345678"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ตำแหน่ง</Label>
                    <Select
                      value={newStaff.role}
                      onValueChange={(value: 'staff' | 'operator') => setNewStaff({ ...newStaff, role: value })}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">พนักงาน (Staff)</SelectItem>
                        <SelectItem value="operator">ผู้ดูแลระบบ (Operator)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="mt-6">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsAddDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    ยกเลิก
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-amber-500 hover:bg-amber-600"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'กำลังบันทึก...' : 'เพิ่มพนักงาน'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
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
                <p className="text-sm">กดปุ่ม &quot;เพิ่มพนักงาน&quot; เพื่อเริ่มต้น</p>
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
                      <TableCell>{s.username || s.code}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {s.role === 'sub_agent' ? 'Sub-Agent' : 
                           s.role === 'operator' ? 'ผู้ดูแล' : 'พนักงาน'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={s.is_active ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'}>
                          {s.is_active ? 'ใช้งาน' : 'ระงับ'}
                        </Badge>
                      </TableCell>
                      <TableCell>0 บาท</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="size-4 mr-2" />
                              แก้ไข
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Key className="size-4 mr-2" />
                              เปลี่ยนรหัสผ่าน
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleToggleStatus(s.id, s.is_active)}
                            >
                              {s.is_active ? (
                                <>
                                  <UserX className="size-4 mr-2" />
                                  ระงับการใช้งาน
                                </>
                              ) : (
                                <>
                                  <UserCheck className="size-4 mr-2" />
                                  เปิดใช้งาน
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
