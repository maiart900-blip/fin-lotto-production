'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
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
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Users,
  UserPlus,
  Search,
  Edit,
  Trash2,
  Shield,
  Mail,
  Phone,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface User {
  id: string;
  username: string;
  display_name: string;
  email: string;
  phone: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

const ROLES = [
  { value: 'admin', label: 'แอดมิน', color: 'bg-purple-500' },
  { value: 'staff', label: 'พนักงาน', color: 'bg-blue-500' },
  { value: 'cashier', label: 'แคชเชียร์', color: 'bg-green-500' },
  { value: 'support', label: 'ซัพพอร์ต', color: 'bg-orange-500' },
];

export default function StaffManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    display_name: '',
    email: '',
    phone: '',
    role: 'staff',
    password: '',
  });

  const { data, mutate, isLoading } = useSWR('/api/users', fetcher, {
    refreshInterval: 30000,
  });

  const users: User[] = data?.users || [];

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleAddUser = async () => {
    if (!formData.username || !formData.display_name || !formData.password) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to add user');
      }

      toast.success('เพิ่มพนักงานสำเร็จ');
      setIsAddDialogOpen(false);
      setFormData({
        username: '',
        display_name: '',
        email: '',
        phone: '',
        role: 'staff',
        password: '',
      });
      mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: formData.display_name,
          email: formData.email,
          phone: formData.phone,
          role: formData.role,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update user');
      }

      toast.success('แก้ไขข้อมูลพนักงานสำเร็จ');
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !user.is_active }),
      });

      if (!res.ok) throw new Error('Failed to update user');

      toast.success(user.is_active ? 'ปิดการใช้งานสำเร็จ' : 'เปิดการใช้งานสำเร็จ');
      mutate();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      display_name: user.display_name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role,
      password: '',
    });
    setIsEditDialogOpen(true);
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = ROLES.find((r) => r.value === role);
    return (
      <Badge className={`${roleConfig?.color || 'bg-gray-500'} text-white`}>
        {roleConfig?.label || role}
      </Badge>
    );
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
            <Users className="h-6 w-6" />
            จัดการพนักงาน
          </h1>
          <p className="text-amber-300/80">เพิ่ม แก้ไข และจัดการพนักงานในระบบ</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            รีเฟรช
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold">
                <UserPlus className="h-4 w-4 mr-2" />
                เพิ่มพนักงาน
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  เพิ่มพนักงานใหม่
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Username *</Label>
                    <Input
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="username"
                    />
                  </div>
                  <div>
                    <Label>ชื่อที่แสดง *</Label>
                    <Input
                      value={formData.display_name}
                      onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                      placeholder="ชื่อ-นามสกุล"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>อีเมล</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <Label>เบอร์โทร</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="08x-xxx-xxxx"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>ตำแหน่ง</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) => setFormData({ ...formData, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>รหัสผ่าน *</Label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="********"
                    />
                  </div>
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold"
                  onClick={handleAddUser}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  เพิ่มพนักงาน
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-black/90 border-slate-800">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="ค้นหาพนักงาน..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-black/80 border-slate-700 text-white"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-48 bg-black/80 border-slate-700 text-white">
                <SelectValue placeholder="ตำแหน่ง" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกตำแหน่ง</SelectItem>
                {ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-400 mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs">พนักงานทั้งหมด</span>
            </div>
            <p className="text-2xl font-bold text-blue-300">{users.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-400 mb-1">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs">ใช้งานอยู่</span>
            </div>
            <p className="text-2xl font-bold text-green-300">
              {users.filter((u) => u.is_active).length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-purple-400 mb-1">
              <Shield className="h-4 w-4" />
              <span className="text-xs">แอดมิน</span>
            </div>
            <p className="text-2xl font-bold text-purple-300">
              {users.filter((u) => u.role === 'admin').length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange-400 mb-1">
              <XCircle className="h-4 w-4" />
              <span className="text-xs">ปิดการใช้งาน</span>
            </div>
            <p className="text-2xl font-bold text-orange-300">
              {users.filter((u) => !u.is_active).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="bg-black/90 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">รายชื่อพนักงาน</CardTitle>
          <CardDescription className="text-slate-400">
            จัดการและดูข้อมูลพนักงานทั้งหมด
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-transparent">
                  <TableHead className="text-white font-semibold">ชื่อผู้ใช้</TableHead>
                  <TableHead className="text-white font-semibold">ชื่อที่แสดง</TableHead>
                  <TableHead className="text-white font-semibold">ติดต่อ</TableHead>
                  <TableHead className="text-white font-semibold">ตำแหน่ง</TableHead>
                  <TableHead className="text-white font-semibold">สถานะ</TableHead>
                  <TableHead className="text-white font-semibold">เข้าสู่ระบบล่าสุด</TableHead>
                  <TableHead className="text-right text-white font-semibold">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                      ไม่พบพนักงาน
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} className="border-slate-800 hover:bg-slate-900/50">
                      <TableCell className="font-mono text-white">{user.username}</TableCell>
                      <TableCell className="text-white">{user.display_name || '-'}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {user.email && (
                            <div className="flex items-center gap-1 text-sm text-slate-300">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </div>
                          )}
                          {user.phone && (
                            <div className="flex items-center gap-1 text-sm text-slate-300">
                              <Phone className="h-3 w-3" />
                              {user.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            user.is_active
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }
                        >
                          {user.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-300">{formatDate(user.last_login)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-white hover:bg-slate-800"
                            onClick={() => openEditDialog(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={
                              user.is_active
                                ? 'text-red-400 hover:bg-red-500/20'
                                : 'text-green-400 hover:bg-green-500/20'
                            }
                            onClick={() => handleToggleActive(user)}
                          >
                            {user.is_active ? (
                              <XCircle className="h-4 w-4" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              แก้ไขข้อมูลพนักงาน
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Username</Label>
              <Input value={formData.username} disabled className="bg-slate-800" />
            </div>
            <div>
              <Label>ชื่อที่แสดง</Label>
              <Input
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>อีเมล</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <Label>เบอร์โทร</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>ตำแหน่ง</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold"
              onClick={handleEditUser}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Edit className="h-4 w-4 mr-2" />
              )}
              บันทึกการแก้ไข
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
