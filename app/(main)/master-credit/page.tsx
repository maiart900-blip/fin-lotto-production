'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Wallet,
  Send,
  ArrowDownLeft,
  ArrowUpRight,
  Infinity,
  Users,
  RefreshCw,
  Loader2,
  Crown,
  User,
  Building2,
} from 'lucide-react';

interface UserCredit {
  id: string;
  username: string;
  display_name: string;
  role: string;
  credit_balance: number;
  is_unlimited_credit: boolean;
  parent_id: string | null;
  hierarchy_level: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  credit_balance: number;
}

interface Transfer {
  id: string;
  sender_id: string;
  receiver_id: string;
  receiver_customer_id: string | null;
  amount: number;
  sender_balance_before: number;
  sender_balance_after: number;
  receiver_balance_before: number;
  receiver_balance_after: number;
  note: string | null;
  created_at: string;
  sender?: { id: string; username: string; display_name: string };
  receiver?: { id: string; username: string; display_name: string };
  receiver_customer?: { id: string; name: string };
}

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'แอดมิน',
  agent: 'เอเย่นต์',
  partner: 'หุ้นส่วน',
  staff: 'พนักงาน',
  member: 'สมาชิก',
};

const roleColors: Record<string, string> = {
  super_admin: 'bg-yellow-500 text-black',
  admin: 'bg-red-500',
  agent: 'bg-blue-500',
  partner: 'bg-green-500',
  staff: 'bg-gray-500',
  member: 'bg-gray-400',
};

export default function MasterCreditPage() {
  const [users, setUsers] = useState<UserCredit[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [currentUser, setCurrentUser] = useState<UserCredit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransferring, setIsTransferring] = useState(false);

  // Transfer dialog
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferType, setTransferType] = useState<'user' | 'customer'>('user');
  const [selectedReceiver, setSelectedReceiver] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get current user from localStorage (or session)
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        
        // Fetch user credit info
        const userRes = await fetch(`/api/user-credits?user_id=${userData.id}`);
        const userCreditData = await userRes.json();
        
        if (userCreditData?.user) {
          setCurrentUser(userCreditData.user);
          setTransfers(userCreditData.transfers || []);
        }
      }

      // Fetch all users
      const usersRes = await fetch('/api/user-credits');
      const usersData = await usersRes.json();
      setUsers(Array.isArray(usersData) ? usersData : []);

      // Fetch all customers
      const customersRes = await fetch('/api/customers');
      const customersData = await customersRes.json();
      setCustomers(Array.isArray(customersData) ? customersData : []);
    } catch (error) {
      console.error('Fetch data error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTransfer = async () => {
    if (!currentUser) {
      toast.error('กรุณาเข้าสู่ระบบ');
      return;
    }

    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('กรุณากรอกจำนวนเงินที่ถูกต้อง');
      return;
    }

    if (!selectedReceiver) {
      toast.error('กรุณาเลือกผู้รับ');
      return;
    }

    // Check balance (unless unlimited)
    if (!currentUser.is_unlimited_credit && amount > currentUser.credit_balance) {
      toast.error('ยอดเครดิตไม่เพียงพอ');
      return;
    }

    setIsTransferring(true);
    try {
      const res = await fetch('/api/user-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: currentUser.id,
          receiver_id: transferType === 'user' ? selectedReceiver : undefined,
          receiver_customer_id: transferType === 'customer' ? selectedReceiver : undefined,
          amount,
          note: transferNote || undefined,
        }),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        toast.success(`โอนเครดิต ${amount.toLocaleString()} บาท สำเร็จ`);
        setShowTransferDialog(false);
        setSelectedReceiver('');
        setTransferAmount('');
        setTransferNote('');
        fetchData(); // Refresh data
      } else {
        toast.error(result.error || 'โอนเครดิตไม่สำเร็จ');
      }
    } catch (error) {
      console.error('Transfer error:', error);
      toast.error('เกิดข้อผิดพลาดในการโอนเครดิต');
    } finally {
      setIsTransferring(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="size-7 text-accent" />
            เครดิตแม่
          </h1>
          <p className="text-muted-foreground">จัดการเครดิตและโอนเงินให้ลูกข่าย</p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="size-4 mr-2" />
          รีเฟรช
        </Button>
      </div>

      {/* My Credit Card */}
      {currentUser && (
        <Card className="bg-gradient-to-br from-accent/20 to-accent/5 border-accent/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full bg-accent/20 flex items-center justify-center">
                  {currentUser.is_unlimited_credit ? (
                    <Infinity className="size-6 text-accent" />
                  ) : (
                    <Wallet className="size-6 text-accent" />
                  )}
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {currentUser.display_name || currentUser.username}
                    <Badge className={roleColors[currentUser.role]}>
                      {roleLabels[currentUser.role] || currentUser.role}
                    </Badge>
                  </CardTitle>
                  <CardDescription>@{currentUser.username}</CardDescription>
                </div>
              </div>
              <Button onClick={() => setShowTransferDialog(true)} className="gap-2">
                <Send className="size-4" />
                โอนเครดิต
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              {currentUser.is_unlimited_credit ? (
                <div className="flex items-center justify-center gap-2">
                  <Infinity className="size-10 text-accent" />
                  <span className="text-4xl font-bold text-accent">UNLIMITED</span>
                </div>
              ) : (
                <div className="text-4xl font-bold text-accent">
                  {currentUser.credit_balance.toLocaleString()} <span className="text-xl">บาท</span>
                </div>
              )}
              <p className="text-muted-foreground mt-2">ยอดเครดิตคงเหลือ</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="size-4" />
            ผู้ใช้ทั้งหมด
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-2">
            <User className="size-4" />
            ลูกค้า
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <RefreshCw className="size-4" />
            ประวัติการโอน
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>รายชื่อผู้ใช้และเครดิต</CardTitle>
              <CardDescription>ดูยอดเครดิตของผู้ใช้ทั้งหมดในระบบ</CardDescription>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  ยังไม่มีผู้ใช้ในระบบ
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ผู้ใช้</TableHead>
                      <TableHead>ตำแหน่ง</TableHead>
                      <TableHead>ระดับ</TableHead>
                      <TableHead className="text-right">เครดิต</TableHead>
                      <TableHead className="text-right">การกระทำ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="size-8 rounded-full bg-secondary flex items-center justify-center">
                              {user.is_unlimited_credit ? (
                                <Crown className="size-4 text-accent" />
                              ) : (
                                <User className="size-4" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{user.display_name || user.username}</div>
                              <div className="text-sm text-muted-foreground">@{user.username}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={roleColors[user.role]}>
                            {roleLabels[user.role] || user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">Lv.{user.hierarchy_level}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {user.is_unlimited_credit ? (
                            <span className="flex items-center justify-end gap-1 text-accent font-bold">
                              <Infinity className="size-4" /> Unlimited
                            </span>
                          ) : (
                            <span className="font-mono font-bold">
                              {user.credit_balance.toLocaleString()}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {currentUser && currentUser.id !== user.id && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setTransferType('user');
                                setSelectedReceiver(user.id);
                                setShowTransferDialog(true);
                              }}
                            >
                              <Send className="size-3 mr-1" />
                              โอน
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers">
          <Card>
            <CardHeader>
              <CardTitle>รายชื่อลูกค้าและเครดิต</CardTitle>
              <CardDescription>ดูและเติมเครดิตให้ลูกค้า</CardDescription>
            </CardHeader>
            <CardContent>
              {customers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  ยังไม่มีลูกค้าในระบบ
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ลูกค้า</TableHead>
                      <TableHead>เบอร์โทร</TableHead>
                      <TableHead className="text-right">เครดิต</TableHead>
                      <TableHead className="text-right">การกระทำ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="size-8 rounded-full bg-secondary flex items-center justify-center">
                              <User className="size-4" />
                            </div>
                            <span className="font-medium">{customer.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{customer.phone || '-'}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono font-bold">
                            {(customer.credit_balance || 0).toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {currentUser && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setTransferType('customer');
                                setSelectedReceiver(customer.id);
                                setShowTransferDialog(true);
                              }}
                            >
                              <Send className="size-3 mr-1" />
                              เติมเครดิต
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>ประวัติการโอนเครดิต</CardTitle>
              <CardDescription>รายการโอนเครดิตล่าสุด</CardDescription>
            </CardHeader>
            <CardContent>
              {transfers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  ยังไม่มีประวัติการโอน
                </div>
              ) : (
                <div className="space-y-3">
                  {transfers.map((transfer) => {
                    const isSender = currentUser?.id === transfer.sender_id;
                    const receiverName = transfer.receiver_customer?.name || 
                      transfer.receiver?.display_name || 
                      transfer.receiver?.username || 
                      'Unknown';

                    return (
                      <div
                        key={transfer.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`size-10 rounded-full flex items-center justify-center ${
                            isSender ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'
                          }`}>
                            {isSender ? (
                              <ArrowUpRight className="size-5" />
                            ) : (
                              <ArrowDownLeft className="size-5" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium">
                              {isSender ? `โอนให้ ${receiverName}` : `รับจาก ${transfer.sender?.display_name || 'Unknown'}`}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatDate(transfer.created_at)}
                            </div>
                            {transfer.note && (
                              <div className="text-sm text-muted-foreground mt-1">
                                หมายเหตุ: {transfer.note}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className={`text-lg font-bold ${isSender ? 'text-red-500' : 'text-green-500'}`}>
                          {isSender ? '-' : '+'}{transfer.amount.toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Transfer Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="size-5 text-accent" />
              โอนเครดิต
            </DialogTitle>
            <DialogDescription>
              โอนเครดิตให้ผู้ใช้หรือลูกค้า
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Transfer Type */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={transferType === 'user' ? 'default' : 'outline'}
                onClick={() => {
                  setTransferType('user');
                  setSelectedReceiver('');
                }}
                className="gap-2"
              >
                <Users className="size-4" />
                ผู้ใช้
              </Button>
              <Button
                variant={transferType === 'customer' ? 'default' : 'outline'}
                onClick={() => {
                  setTransferType('customer');
                  setSelectedReceiver('');
                }}
                className="gap-2"
              >
                <User className="size-4" />
                ลูกค้า
              </Button>
            </div>

            {/* Receiver Selection */}
            <div className="space-y-2">
              <Label>ผู้รับ</Label>
              <Select value={selectedReceiver} onValueChange={setSelectedReceiver}>
                <SelectTrigger>
                  <SelectValue placeholder={`เลือก${transferType === 'user' ? 'ผู้ใช้' : 'ลูกค้า'}`} />
                </SelectTrigger>
                <SelectContent>
                  {transferType === 'user' ? (
                    users
                      .filter((u) => u.id !== currentUser?.id)
                      .map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.display_name || user.username} ({roleLabels[user.role]})
                        </SelectItem>
                      ))
                  ) : (
                    customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} ({customer.phone || 'ไม่มีเบอร์'})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label>จำนวนเงิน (บาท)</Label>
              <Input
                type="number"
                placeholder="0"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="text-lg font-mono"
              />
              {currentUser && !currentUser.is_unlimited_credit && (
                <p className="text-sm text-muted-foreground">
                  ยอดคงเหลือ: {currentUser.credit_balance.toLocaleString()} บาท
                </p>
              )}
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label>หมายเหตุ (ไม่บังคับ)</Label>
              <Textarea
                placeholder="เพิ่มหมายเหตุ..."
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransferDialog(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleTransfer} disabled={isTransferring}>
              {isTransferring ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  กำลังโอน...
                </>
              ) : (
                <>
                  <Send className="size-4 mr-2" />
                  ยืนยันโอน
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
