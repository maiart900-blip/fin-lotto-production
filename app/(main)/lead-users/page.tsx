'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Crown,
  Search,
  Plus,
  Edit,
  Trash2,
  Users,
  TrendingUp,
  Target,
  Star,
  Pin,
  PinOff,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Settings,
  Copy,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function LeadUsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  
  // Form states
  const [leadBadge, setLeadBadge] = useState('');
  const [bio, setBio] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  
  // Fetch all customers (for adding new lead users)
  const { data: customers, isLoading: customersLoading } = useSWR('/api/customers', fetcher);
  
  // Fetch lead users
  const { data: leadUsersData, isLoading, mutate } = useSWR('/api/lead-users?admin=true', fetcher);
  
  // Ensure leadUsers is always an array
  const leadUsers = Array.isArray(leadUsersData) ? leadUsersData : [];
  
  // Stats
  const totalLeadUsers = leadUsers.length;
  const pinnedUsers = leadUsers.filter((u: any) => u.is_pinned).length;
  const totalFollowers = leadUsers.reduce((sum: number, u: any) => sum + (u.lead_user_stats?.[0]?.followers_count || 0), 0);
  const totalCopies = leadUsers.reduce((sum: number, u: any) => sum + (u.lead_user_stats?.[0]?.copy_count || 0), 0);
  
  const handleAddLeadUser = async () => {
    if (!selectedCustomerId) {
      toast.error('กรุณาเลือกลูกค้า');
      return;
    }
    
    try {
      const res = await fetch('/api/lead-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomerId,
          lead_badge: leadBadge,
          bio: bio,
          is_pinned: isPinned,
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed');
      }
      
      toast.success('เพิ่มยูสนำแทงสำเร็จ');
      setIsAddDialogOpen(false);
      setSelectedCustomerId('');
      setLeadBadge('');
      setBio('');
      setIsPinned(false);
      mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    }
  };
  
  const handleUpdateLeadUser = async () => {
    if (!editingUser) return;
    
    try {
      const res = await fetch('/api/lead-users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: editingUser.id,
          lead_badge: leadBadge,
          bio: bio,
          is_pinned: isPinned,
        }),
      });
      
      if (!res.ok) throw new Error('Failed');
      
      toast.success('อัพเดทสำเร็จ');
      setIsDialogOpen(false);
      setEditingUser(null);
      mutate();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };
  
  const handleRemoveLeadUser = async (userId: string) => {
    if (!confirm('ยืนยันการลบยูสนำแทง?')) return;
    
    try {
      const res = await fetch('/api/lead-users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: userId }),
      });
      
      if (!res.ok) throw new Error('Failed');
      
      toast.success('ลบสำเร็จ');
      mutate();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };
  
  const handleTogglePin = async (user: any) => {
    try {
      const res = await fetch('/api/lead-users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: user.id,
          is_pinned: !user.is_pinned,
        }),
      });
      
      if (!res.ok) throw new Error('Failed');
      
      toast.success(user.is_pinned ? 'ยกเลิกปักหมุดแล้ว' : 'ปักหมุดแล้ว');
      mutate();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };
  
  const openEditDialog = (user: any) => {
    setEditingUser(user);
    setLeadBadge(user.lead_badge || '');
    setBio(user.bio || '');
    setIsPinned(user.is_pinned || false);
    setIsDialogOpen(true);
  };
  
  const filteredUsers = leadUsers.filter((user: any) =>
    !searchQuery || 
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.phone?.includes(searchQuery)
  );
  
  // Get customers that are not already lead users
  const availableCustomers = (Array.isArray(customers) ? customers : []).filter((c: any) => 
    !leadUsers.some((lu: any) => lu.id === c.id)
  );
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Crown className="size-6 text-amber-500" />
            ยูสนำแทง
          </h1>
          <p className="text-muted-foreground">จัดการเซียนหวยและยูสนำแทง</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => mutate()}>
            <RefreshCw className="size-4" />
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4 mr-2" />
                เพิ่มยูสนำแทง
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>เพิ่มยูสนำแทงใหม่</DialogTitle>
                <DialogDescription>เลือกลูกค้าที่ต้องการแต่งตั้งเป็นยูสนำแทง</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>เลือกลูกค้า</Label>
                  <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกลูกค้า..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCustomers.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.phone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>ป้ายยศ (Badge)</Label>
                  <Input
                    placeholder="เช่น เซียนหวย, Pro, VIP"
                    value={leadBadge}
                    onChange={(e) => setLeadBadge(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>คำอธิบาย (Bio)</Label>
                  <Textarea
                    placeholder="คำอธิบายสั้นๆ เกี่ยวกับเซียนคนนี้"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label>ปักหมุด (แสดงด้านบน)</Label>
                  <Switch checked={isPinned} onCheckedChange={setIsPinned} />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  ยกเลิก
                </Button>
                <Button onClick={handleAddLeadUser}>
                  <UserPlus className="size-4 mr-2" />
                  เพิ่ม
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Crown className="size-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalLeadUsers}</p>
                <p className="text-xs text-muted-foreground">ยูสนำแทงทั้งหมด</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Pin className="size-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pinnedUsers}</p>
                <p className="text-xs text-muted-foreground">ปักหมุด</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalFollowers}</p>
                <p className="text-xs text-muted-foreground">ผู้ติดตามรวม</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Copy className="size-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCopies}</p>
                <p className="text-xs text-muted-foreground">แทงตามรวม</p>
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
      
      {/* Lead Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>รายชื่อยูสนำแทง</CardTitle>
          <CardDescription>จัดการยูสนำแทงและเซียนหวยทั้งหมด</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ผู้ใช้</TableHead>
                  <TableHead>ป้ายยศ</TableHead>
                  <TableHead className="text-center">ผู้ติดตาม</TableHead>
                  <TableHead className="text-center">แทงตาม</TableHead>
                  <TableHead className="text-center">อัตราถูก</TableHead>
                  <TableHead className="text-center">กำไร</TableHead>
                  <TableHead className="text-center">ปักหมุด</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      ยังไม่มียูสนำแทง
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user: any) => {
                    const stats = user.lead_user_stats?.[0] || {};
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-10">
                              <AvatarImage src={user.avatar_url} />
                              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                {user.name?.charAt(0)?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{user.name}</p>
                              <p className="text-xs text-muted-foreground">{user.phone}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.lead_badge ? (
                            <Badge variant="outline" className="border-amber-500/50 text-amber-600">
                              {user.lead_badge}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-mono">{stats.followers_count || 0}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-mono">{stats.copy_count || 0}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-mono ${(stats.win_rate || 0) >= 50 ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {(stats.win_rate || 0).toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-mono ${(stats.total_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {(stats.total_profit || 0) >= 0 ? '+' : ''}{(stats.total_profit || 0).toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleTogglePin(user)}
                            className={user.is_pinned ? 'text-amber-500' : 'text-muted-foreground'}
                          >
                            {user.is_pinned ? <Pin className="size-4" /> : <PinOff className="size-4" />}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(user)}
                            >
                              <Edit className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleRemoveLeadUser(user.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขยูสนำแทง</DialogTitle>
            <DialogDescription>
              {editingUser?.name} ({editingUser?.phone})
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>ป้ายยศ (Badge)</Label>
              <Input
                placeholder="เช่น เซียนหวย, Pro, VIP"
                value={leadBadge}
                onChange={(e) => setLeadBadge(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>คำอธิบาย (Bio)</Label>
              <Textarea
                placeholder="คำอธิบายสั้นๆ"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label>ปักหมุด (แสดงด้านบน)</Label>
              <Switch checked={isPinned} onCheckedChange={setIsPinned} />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleUpdateLeadUser}>
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
