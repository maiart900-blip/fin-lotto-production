'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Users, Search, Eye, Loader2, UserPlus, RefreshCw, PenLine, Trash2 } from 'lucide-react';
import { EditCustomerModal } from '@/components/admin/edit-customer-modal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface Customer {
  id: string;
  name: string;
  phone: string;
  username: string | null;
  credit_balance: number;
  is_active: boolean;
  referral_code: string | null;
  bank_code: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  last_login_at: string | null;
  created_at: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

// Format Thai date
function formatThaiDate(dateString: string) {
  const date = new Date(dateString);
  const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const day = date.getDate();
  const month = thaiMonths[date.getMonth()];
  const year = date.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

export default function CustomersPage() {
  const { data: customers = [], mutate, isLoading, error } = useSWR<Customer[]>('/api/customers', fetcher);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<Customer | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState<Customer | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete user function
  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/users/${deletingUser.id}`, {
        method: 'DELETE',
      });
      
      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(result.error || 'ลบไม่สำเร็จ');
      }
      
      toast.success(result.message || 'ลบสมาชิกสำเร็จ', {
        style: {
          background: 'linear-gradient(145deg, #D4AF37, #B8860B)',
          color: '#000',
          fontWeight: 'bold',
        },
      });
      
      // Refresh data
      mutate();
      setShowDeleteDialog(false);
      setDeletingUser(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(s) ||
      c.phone?.includes(s) ||
      c.username?.toLowerCase().includes(s) ||
      c.id?.toLowerCase().includes(s)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-destructive">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
        <Button onClick={() => mutate()} variant="outline">
          <RefreshCw className="size-4 mr-2" />
          ลองใหม่
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="size-6" />
            สมาชิก
          </h1>
          <p className="text-muted-foreground">จัดการข้อมูลสมาชิกทั้งหมด</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            <RefreshCw className="size-4 mr-2" />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{customers.length}</div>
            <p className="text-sm text-muted-foreground">สมาชิกทั้งหมด</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-500">
              {customers.filter(c => c.is_active).length}
            </div>
            <p className="text-sm text-muted-foreground">ใช้งานปกติ</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-500">
              {customers.filter(c => !c.is_active).length}
            </div>
            <p className="text-sm text-muted-foreground">ถูกระงับ</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-500">
              {customers.reduce((sum, c) => sum + (c.credit_balance || 0), 0).toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground">เครดิตรวม</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ค้นหาสมาชิก</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาด้วยชื่อ / เบอร์โทร / username / ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ</TableHead>
                <TableHead>เบอร์โทร</TableHead>
                <TableHead className="text-right">เครดิต</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>วันที่สมัคร</TableHead>
                <TableHead>เข้าสู่ระบบล่าสุด</TableHead>
                <TableHead className="text-center">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {search ? 'ไม่พบสมาชิกที่ค้นหา' : 'ยังไม่มีสมาชิก'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{customer.name || '-'}</div>
                        {customer.username && (
                          <div className="text-xs text-muted-foreground">@{customer.username}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{customer.phone || '-'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {(customer.credit_balance || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={customer.is_active ? 'default' : 'destructive'}>
                        {customer.is_active ? 'ใช้งาน' : 'ระงับ'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {customer.created_at ? formatThaiDate(customer.created_at) : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {customer.last_login_at ? formatThaiDate(customer.last_login_at) : 'ยังไม่เคยเข้าสู่ระบบ'}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setEditingUser(customer as any);
                            setShowEditModal(true);
                          }}
                          className="border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10"
                        >
                          <PenLine className="size-4 mr-1" />
                          แก้ไข
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setDeletingUser(customer);
                            setShowDeleteDialog(true);
                          }}
                          className="border-red-500/50 text-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 className="size-4 mr-1" />
                          ลบ
                        </Button>
                        <Link href={`/customers/${customer.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="size-4 mr-1" />
                            ดูรายละเอียด
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <EditCustomerModal
        customer={editingUser}
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingUser(null);
        }}
        onSuccess={() => mutate()}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-[#0a0a0a] border border-red-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500 flex items-center gap-2">
              <Trash2 className="size-5" />
              ยืนยันการลบสมาชิก
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              คุณแน่ใจใช่ไหมที่จะลบสมาชิก <span className="text-white font-semibold">{deletingUser?.name || deletingUser?.username}</span>?
              <br /><br />
              <span className="text-yellow-500">
                หมายเลขโทรศัพท์: {deletingUser?.phone}
              </span>
              <br /><br />
              <span className="text-red-400">
                การดำเนินการนี้จะลบข้อมูลทั้งหมดของสมาชิกออกจากระบบ
                และสมาชิกจะสามารถใช้เบอร์นี้สมัครใหม่ได้ทันที
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="bg-gray-800 border-gray-700 hover:bg-gray-700"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeletingUser(null);
              }}
            >
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  กำลังลบ...
                </>
              ) : (
                <>
                  <Trash2 className="size-4 mr-2" />
                  ยืนยันลบ
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
