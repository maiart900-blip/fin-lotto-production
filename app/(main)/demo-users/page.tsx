'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  AlertTriangle,
  Search,
  Plus,
  Trash2,
  Users,
  Wallet,
  TestTube,
  RefreshCw,
  Loader2,
  ShieldOff,
  Ban,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function DemoUsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCreditDialogOpen, setIsCreditDialogOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  // Fetch all customers
  const { data: customers, isLoading: customersLoading, mutate: mutateCustomers } = useSWR(
    '/api/customers',
    fetcher
  );
  
  // Filter demo users
  const demoUsers = (customers || []).filter((c: any) => c.is_demo_user === true);
  const normalUsers = (customers || []).filter((c: any) => !c.is_demo_user);
  
  // Stats
  const totalDemoUsers = demoUsers.length;
  const totalDemoCredit = demoUsers.reduce((sum: number, u: any) => sum + (u.credit_balance || 0), 0);
  
  const handleAddDemoUser = async () => {
    if (!selectedCustomerId) {
      toast.error('กรุณาเลือกลูกค้า');
      return;
    }
    
    try {
      const res = await fetch('/api/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedCustomerId,
          is_demo_user: true,
        }),
      });
      
      if (!res.ok) throw new Error('Failed');
      
      toast.success('เพิ่มยูสนำแทงสำเร็จ');
      setIsAddDialogOpen(false);
      setSelectedCustomerId('');
      mutateCustomers();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };
  
  const handleRemoveDemoUser = async (userId: string) => {
    if (!confirm('ยืนยันการลบยูสนำแทง?')) return;
    
    try {
      const res = await fetch('/api/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          is_demo_user: false,
        }),
      });
      
      if (!res.ok) throw new Error('Failed');
      
      toast.success('ลบยูสนำแทงสำเร็จ');
      mutateCustomers();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };
  
  const handleAddCredit = async () => {
    if (!selectedUser || !creditAmount) {
      toast.error('กรุณากรอกจำนวนเงิน');
      return;
    }
    
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('จำนวนเงินไม่ถูกต้อง');
      return;
    }
    
    try {
      const res = await fetch('/api/credit-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedUser.id,
          amount: amount,
          type: 'deposit',
          note: 'เติมเครดิตยูสนำแทง (Demo)',
          skip_report: true, // Flag to skip reporting
        }),
      });
      
      if (!res.ok) throw new Error('Failed');
      
      toast.success(`เติมเครดิต ${amount.toLocaleString()} บาทสำเร็จ`);
      setIsCreditDialogOpen(false);
      setCreditAmount('');
      setSelectedUser(null);
      mutateCustomers();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };
  
  const filteredUsers = demoUsers.filter((user: any) =>
    !searchQuery || 
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.phone?.includes(searchQuery)
  );
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TestTube className="size-6 text-purple-500" />
            ยูสนำแทง (Demo)
          </h1>
          <p className="text-muted-foreground">
            จัดการยูสสำหรับทดสอบ - ยอดไม่เข้า Dashboard และไม่ sync ไปเว็บแม่
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => mutateCustomers()}>
            <RefreshCw className="size-4" />
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-purple-600 hover:bg-purple-700">
                <Plus className="size-4 mr-2" />
                เพิ่มยูสนำแทง
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>เพิ่มยูสนำแทงใหม่</DialogTitle>
                <DialogDescription>
                  เลือกลูกค้าที่ต้องการตั้งเป็นยูสนำแทง (Demo)
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="size-5 text-amber-500 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-600">ข้อควรทราบ</p>
                      <ul className="text-amber-600/80 mt-1 space-y-1">
                        <li>• ยูสนำแทงสามารถเติมเครดิตได้ไม่จำกัด</li>
                        <li>• ยอดแพ้/ชนะ ไม่เข้า Dashboard และ Reports</li>
                        <li>• ไม่ sync ข้อมูลไปเว็บแม่</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>เลือกลูกค้า</Label>
                  <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกลูกค้า..." />
                    </SelectTrigger>
                    <SelectContent>
                      {normalUsers.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.phone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  ยกเลิก
                </Button>
                <Button onClick={handleAddDemoUser} className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="size-4 mr-2" />
                  เพิ่ม
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {/* Warning Banner */}
      <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <ShieldOff className="size-5 text-purple-500" />
          </div>
          <div>
            <p className="font-semibold text-purple-600">ยูสนำแทง (Demo Mode)</p>
            <p className="text-sm text-purple-500/80">
              ยูสเหล่านี้ใช้สำหรับทดสอบระบบเท่านั้น ยอดแพ้/ชนะจะไม่ถูกนับรวมในรายงานและไม่ส่งไปเว็บแม่
            </p>
          </div>
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Users className="size-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalDemoUsers}</p>
                <p className="text-xs text-muted-foreground">ยูสนำแทงทั้งหมด</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Wallet className="size-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalDemoCredit.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">เครดิตรวม (บาท)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Ban className="size-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">ไม่นับ</p>
                <p className="text-xs text-muted-foreground">ใน Reports/Dashboard</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาด้วยชื่อหรือเบอร์โทร..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      
      {/* Demo Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>รายชื่อยูสนำแทง</CardTitle>
          <CardDescription>ยูสทดสอบที่ไม่นับยอดใน Reports</CardDescription>
        </CardHeader>
        <CardContent>
          {customersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ลูกค้า</TableHead>
                  <TableHead>เบอร์โทร</TableHead>
                  <TableHead className="text-right">เครดิต</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      ยังไม่มียูสนำแทง
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="size-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                            <TestTube className="size-4 text-purple-500" />
                          </div>
                          <span className="font-medium">{user.name}</span>
                          <Badge variant="outline" className="border-purple-500/50 text-purple-600 text-[10px]">
                            DEMO
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.phone}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-green-600">
                        {(user.credit_balance || 0).toLocaleString()} ฿
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-purple-500/20 text-purple-600 border-0">
                          <CheckCircle2 className="size-3 mr-1" />
                          Active
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 border-green-500/30 hover:bg-green-500/10"
                            onClick={() => {
                              setSelectedUser(user);
                              setIsCreditDialogOpen(true);
                            }}
                          >
                            <Wallet className="size-4 mr-1" />
                            เติมเครดิต
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleRemoveDemoUser(user.id)}
                          >
                            <Trash2 className="size-4" />
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
      
      {/* Add Credit Dialog */}
      <Dialog open={isCreditDialogOpen} onOpenChange={setIsCreditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เติมเครดิตยูสนำแทง</DialogTitle>
            <DialogDescription>
              {selectedUser?.name} ({selectedUser?.phone})
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
              <p className="text-sm text-green-600">เครดิตปัจจุบัน</p>
              <p className="text-2xl font-bold text-green-600">
                {(selectedUser?.credit_balance || 0).toLocaleString()} บาท
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>จำนวนเงินที่ต้องการเติม</Label>
              <Input
                type="number"
                placeholder="0"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="text-right font-mono text-lg"
              />
            </div>
            
            {/* Quick amount buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[100, 500, 1000, 5000].map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setCreditAmount(amount.toString())}
                >
                  +{amount.toLocaleString()}
                </Button>
              ))}
            </div>
            
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-xs text-amber-600">
                หมายเหตุ: เครดิตที่เติมให้ยูสนำแทงจะไม่ถูกนับรวมในรายงาน
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreditDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleAddCredit} className="bg-green-600 hover:bg-green-700">
              <Wallet className="size-4 mr-2" />
              เติมเครดิต
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
