'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/hooks/use-auth';
import {
  Users,
  UserPlus,
  Pencil,
  Trash2,
  Shield,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { fetcher } from '@/lib/fetcher';

interface User {
  id: string;
  username: string;
  display_name: string;
  role: string;
  credit_balance: number;
  is_unlimited_credit: boolean;
  parent_id: string | null;
  hierarchy_level: number;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'เจ้าของระบบ',
  super_admin: 'ซุปเปอร์แอดมิน',
  admin: 'แอดมิน',
  agent: 'เอเย่นต์',
  staff: 'พนักงาน',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-purple-500',
  super_admin: 'bg-red-500',
  admin: 'bg-amber-500',
  agent: 'bg-blue-500',
  staff: 'bg-gray-500',
};

export default function UsersPage() {
  const { user: authUser, isAdmin, isSuperAdmin } = useAuth();
  const { data: users = [], isLoading, error } = useSWR<User[]>('/api/users', fetcher);
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    displayName: '',
    role: 'staff',
  });

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      displayName: '',
      role: 'staff',
    });
    setShowPassword(false);
  };

  const handleAdd = async () => {
    if (!formData.username.trim() || !formData.password.trim() || !formData.displayName.trim()) {
      toast.error('กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: formData.username.trim(),
          password: formData.password,
          displayName: formData.displayName.trim(),
          role: formData.role,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user');
      }
      
      toast.success('เพิ่มผู้ใช้สำเร็จ');
      setIsAddOpen(false);
      resetForm();
      mutate('/api/users');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingUser) return;
    if (!formData.displayName.trim()) {
      toast.error('กรุณากรอกชื่อแสดง');
      return;
    }

    setIsSubmitting(true);
    try {
      const body: Record<string, string> = {
        displayName: formData.displayName.trim(),
        role: formData.role,
      };
      
      // Only update password if provided
      if (formData.password.trim()) {
        body.password = formData.password;
      }
      
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update user');
      }
      
      toast.success('แก้ไขผู้ใช้สำเร็จ');
      setEditingUser(null);
      resetForm();
      mutate('/api/users');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete user');
      }
      
      toast.success('ลบผู้ใช้สำเร็จ');
      mutate('/api/users');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  };

  const openEdit = (user: User) => {
    setFormData({
      username: user.username,
      password: '',
      displayName: user.display_name,
      role: user.role,
    });
    setEditingUser(user);
  };

  // Check if can manage users
  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="p-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <p className="text-gray-400">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-amber-500" />
            จัดการผู้ใช้งาน
          </h1>
          <p className="text-gray-400 mt-1">จัดการบัญชีผู้ใช้งานในระบบ</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate('/api/users')}
            className="border-slate-600"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            รีเฟรช
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setIsAddOpen(true);
            }}
            className="bg-amber-500 hover:bg-amber-600 text-black"
          >
            <UserPlus className="h-4 w-4 mr-1" />
            เพิ่มผู้ใช้
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">รายชื่อผู้ใช้งาน</CardTitle>
          <CardDescription className="text-gray-400">
            ทั้งหมด {users.length} บัญชี
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto" />
              <p className="text-gray-400 mt-2">กำลังโหลด...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <p className="text-red-400">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">ยังไม่มีผู้ใช้งาน</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-gray-400">ชื่อผู้ใช้</TableHead>
                  <TableHead className="text-gray-400">ชื่อแสดง</TableHead>
                  <TableHead className="text-gray-400">บทบาท</TableHead>
                  <TableHead className="text-gray-400">เครดิต</TableHead>
                  <TableHead className="text-gray-400">วันที่สร้าง</TableHead>
                  <TableHead className="text-gray-400 text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="border-slate-700">
                    <TableCell className="text-white font-medium">
                      {user.username}
                      {user.id === authUser?.id && (
                        <Badge variant="outline" className="ml-2 text-amber-500 border-amber-500">
                          คุณ
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-300">{user.display_name}</TableCell>
                    <TableCell>
                      <Badge className={`${ROLE_COLORS[user.role] || 'bg-gray-500'} text-white`}>
                        {ROLE_LABELS[user.role] || user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {user.is_unlimited_credit ? (
                        <span className="text-amber-400">ไม่จำกัด</span>
                      ) : (
                        <span>฿{user.credit_balance?.toLocaleString() || 0}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-400">
                      {new Date(user.created_at).toLocaleDateString('th-TH')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(user)}
                          className="text-amber-500 hover:text-amber-400"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {user.id !== authUser?.id && user.role !== 'owner' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-slate-800 border-slate-700">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="text-white">ยืนยันการลบ</AlertDialogTitle>
                                <AlertDialogDescription className="text-gray-400">
                                  คุณต้องการลบผู้ใช้ &quot;{user.display_name}&quot; หรือไม่?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-slate-700 text-white border-slate-600">
                                  ยกเลิก
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(user.id)}
                                  className="bg-red-500 hover:bg-red-600"
                                >
                                  ลบ
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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

      {/* Add User Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-amber-500" />
              เพิ่มผู้ใช้ใหม่
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              กรอกข้อมูลเพื่อสร้างบัญชีผู้ใช้ใหม่
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">ชื่อผู้ใช้</Label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="username"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-300">รหัสผ่าน</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="รหัสผ่าน"
                  className="bg-slate-700 border-slate-600 text-white pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full text-gray-400"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-gray-300">ชื่อแสดง</Label>
              <Input
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="ชื่อที่แสดง"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-300">บทบาท</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="staff">พนักงาน</SelectItem>
                  <SelectItem value="agent">เอเย่นต์</SelectItem>
                  <SelectItem value="admin">แอดมิน</SelectItem>
                  {isSuperAdmin && <SelectItem value="super_admin">ซุปเปอร์แอดมิน</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddOpen(false)}
              className="border-slate-600 text-gray-300"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleAdd}
              disabled={isSubmitting}
              className="bg-amber-500 hover:bg-amber-600 text-black"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              เพิ่มผู้ใช้
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Pencil className="h-5 w-5 text-amber-500" />
              แก้ไขผู้ใช้
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              แก้ไขข้อมูลผู้ใช้ {editingUser?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">ชื่อผู้ใช้</Label>
              <Input
                value={formData.username}
                disabled
                className="bg-slate-700 border-slate-600 text-gray-400"
              />
            </div>
            <div>
              <Label className="text-gray-300">รหัสผ่านใหม่ (เว้นว่างหากไม่ต้องการเปลี่ยน)</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="รหัสผ่านใหม่"
                  className="bg-slate-700 border-slate-600 text-white pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full text-gray-400"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-gray-300">ชื่อแสดง</Label>
              <Input
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="ชื่อที่แสดง"
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-300">บทบาท</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
                disabled={editingUser?.role === 'owner'}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="staff">พนักงาน</SelectItem>
                  <SelectItem value="agent">เอเย่นต์</SelectItem>
                  <SelectItem value="admin">แอดมิน</SelectItem>
                  {isSuperAdmin && <SelectItem value="super_admin">ซุปเปอร์แอดมิน</SelectItem>}
                  {editingUser?.role === 'owner' && <SelectItem value="owner">เจ้าของระบบ</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingUser(null)}
              className="border-slate-600 text-gray-300"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleEdit}
              disabled={isSubmitting}
              className="bg-amber-500 hover:bg-amber-600 text-black"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
