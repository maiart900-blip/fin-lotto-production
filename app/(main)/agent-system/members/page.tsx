'use client';

import { useState, useEffect } from 'react';
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
  TableRow 
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Users, 
  Plus, 
  Search, 
  UserCheck, 
  UserX,
  MoreHorizontal,
  Edit,
  Key,
  Shield,
  ShieldCheck,
  ShieldOff
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';

interface Member {
  id: string;
  username: string;
  name: string;
  phone: string;
  agent_id: string;
  agent_name?: string;
  status: 'active' | 'inactive' | 'suspended';
  role: 'staff' | 'operator';
  two_factor_enabled?: boolean;
  created_at: string;
}

interface Agent {
  id: string;
  username: string;
  name: string;
}

export default function AutoAgentMembersPage() {
  const { user } = useAuth();
  const isAgent = user?.role === 'agent';
  
  const [members, setMembers] = useState<Member[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newMember, setNewMember] = useState({
    username: '',
    name: '',
    password: '',
    phone: '',
    agent_id: '',
    role: 'staff' as 'staff' | 'operator',
  });

  useEffect(() => {
    // ถ้าเป็น Agent ให้กำหนด agent_id เป็นตัวเองอัตโนมัติ
    if (isAgent && user?.id) {
      setNewMember(prev => ({ ...prev, agent_id: user.id }));
    }
  }, [isAgent, user?.id]);

  useEffect(() => {
    fetchMembers();
    // ถ้าเป็น Admin ถึงจะ fetch รายชื่อ agents มาให้เลือก
    if (!isAgent) {
      fetchAgents();
    }
  }, [isAgent]);

  const fetchMembers = async () => {
    try {
      // ใช้ API กลางจากเว็บแม่ พร้อม filter system_type
      const res = await fetch('/api/customers?system_type=auto');
      const data = await res.json();
      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents?system_type=auto');
      const data = await res.json();
      setAgents(data.agents || data || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
    }
  };

  const handleAddMember = async () => {
    if (!newMember.username || !newMember.name || !newMember.password || !newMember.agent_id) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    try {
      // ใช้ API กลางจากเว็บแม่ พร้อมระบุ system_type
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newMember,
          system_type: 'auto' // ระบุว่าเป็นระบบออโต้
        }),
      });

      if (res.ok) {
        toast.success('เพิ่มแมมเบอร์สำเร็จ');
        setIsAddDialogOpen(false);
        setNewMember({
          username: '',
          name: '',
          password: '',
          phone: '',
          agent_id: '',
          role: 'staff',
        });
        fetchMembers();
      } else {
        const error = await res.json();
        toast.error(error.message || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเพิ่มแมมเบอร์');
    }
  };

  const handleToggleStatus = async (memberId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      const res = await fetch(`/api/auto-agents/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        toast.success(newStatus === 'active' ? 'เปิดใช้งานแล้ว' : 'ระงับการใช้งานแล้ว');
        fetchMembers();
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  // State สำหรับ dialog เปลี่ยนรหัสผ่าน
  const [passwordDialog, setPasswordDialog] = useState<{ open: boolean; memberId: string; memberName: string }>({ 
    open: false, memberId: '', memberName: '' 
  });
  const [newPassword, setNewPassword] = useState('');

  // ฟังก์ชันเปลี่ยนรหัสผ่าน
  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    try {
      const res = await fetch(`/api/auto-agents/members/${passwordDialog.memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      if (res.ok) {
        toast.success('เปลี่ยนรหัสผ่านสำเร็จ');
        setPasswordDialog({ open: false, memberId: '', memberName: '' });
        setNewPassword('');
      } else {
        toast.error('เกิดข้อผิดพลาด');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  // ฟังก์ชันเปิด/ปิด 2FA
  const handleToggle2FA = async (memberId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/auto-agents/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ two_factor_enabled: !currentStatus }),
      });
      if (res.ok) {
        toast.success(!currentStatus ? 'เปิดใช้งาน 2FA แล้ว' : 'ปิดใช้งาน 2FA แล้ว');
        fetchMembers();
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const filteredMembers = members.filter(member =>
    member.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.phone?.includes(searchQuery)
  );

  const activeCount = members.filter(m => m.status === 'active').length;
  const suspendedCount = members.filter(m => m.status === 'suspended').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">จัดการแมมเบอร์ (ออโต้)</h1>
          <p className="text-muted-foreground">เปิดและจัดการพนักงาน/แมมเบอร์ใต้สายงานเอเย่นออโต้</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              เพิ่มแมมเบอร์
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่มแมมเบอร์ใหม่</DialogTitle>
              <DialogDescription>
                {isAgent 
                  ? 'แมมเบอร์จะเชื่อมตรงเข้าสายงานของคุณอัตโนมัติ'
                  : 'เปิดแมมเบอร์/พนักงานใต้สายงานเอเย่นออโต้'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* แสดง dropdown เลือกเอเย่นเฉพาะ Admin เท่านั้น */}
              {!isAgent && (
                <div className="space-y-2">
                  <Label>เลือกเอเย่น (ถ้ามี)</Label>
                  <Select
                    value={newMember.agent_id}
                    onValueChange={(value) => setNewMember({ ...newMember, agent_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกเอเย่นต้นสังกัด (ไม่บังคับ)" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name || agent.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>ชื่อผู้ใช้ *</Label>
                <Input
                  value={newMember.username}
                  onChange={(e) => setNewMember({ ...newMember, username: e.target.value })}
                  placeholder="username"
                />
              </div>
              <div className="space-y-2">
                <Label>ชื่อ-นามสกุล *</Label>
                <Input
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                  placeholder="ชื่อ-นามสกุล"
                />
              </div>
              <div className="space-y-2">
                <Label>รหัสผ่าน *</Label>
                <Input
                  type="password"
                  value={newMember.password}
                  onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                  placeholder="รหัสผ่าน"
                />
              </div>
              <div className="space-y-2">
                <Label>เบอร์โทร</Label>
                <Input
                  value={newMember.phone}
                  onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                  placeholder="0812345678"
                />
              </div>
              <div className="space-y-2">
                <Label>ตำแหน่ง</Label>
                <Select
                  value={newMember.role}
                  onValueChange={(value: 'staff' | 'operator') => setNewMember({ ...newMember, role: value })}
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                ยกเลิก
              </Button>
              <Button onClick={handleAddMember}>
                เพิ่มแมมเบอร์
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">แมมเบอร์ทั้งหมด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold">{members.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ใช้งานอยู่</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-green-500" />
              <span className="text-2xl font-bold text-green-500">{activeCount}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ระงับการใช้งาน</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <UserX className="w-5 h-5 text-red-500" />
              <span className="text-2xl font-bold text-red-500">{suspendedCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหา (ชื่อ, username, เบอร์โทร)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>รายชื่อแมมเบอร์ ({filteredMembers.length})</CardTitle>
          <CardDescription>แมมเบอร์/พนักงานใต้สายงานเอเย่นออโต้</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              ยังไม่มีแมมเบอร์ในระบบ
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>แมมเบอร์</TableHead>
                  <TableHead>เอเย่นต้นสังกัด</TableHead>
                  <TableHead>ตำแหน่ง</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>วันที่สร้าง</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{member.name}</div>
                        <div className="text-sm text-muted-foreground">@{member.username}</div>
                        {member.phone && (
                          <div className="text-xs text-muted-foreground">{member.phone}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {member.agent_name || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.role === 'operator' ? 'default' : 'secondary'}>
                        {member.role === 'operator' ? 'ผู้ดูแลระบบ' : 'พนักงาน'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.status === 'active' ? 'default' : 'destructive'}>
                        {member.status === 'active' ? 'ใช้งาน' : 'ระงับ'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(member.created_at).toLocaleDateString('th-TH')}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="w-4 h-4 mr-2" />
                            แก้ไข
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPasswordDialog({ 
                            open: true, 
                            memberId: member.id, 
                            memberName: member.name || member.username 
                          })}>
                            <Key className="w-4 h-4 mr-2" />
                            เปลี่ยนรหัสผ่าน
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggle2FA(member.id, member.two_factor_enabled || false)}>
                            {member.two_factor_enabled ? (
                              <>
                                <ShieldOff className="w-4 h-4 mr-2" />
                                ปิด 2FA
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-4 h-4 mr-2" />
                                เปิด 2FA
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleToggleStatus(member.id, member.status)}
                          >
                            {member.status === 'active' ? (
                              <>
                                <UserX className="w-4 h-4 mr-2" />
                                ระงับการใช้งาน
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-4 h-4 mr-2" />
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

      {/* Dialog เปลี่ยนรหัสผ่าน */}
      <Dialog open={passwordDialog.open} onOpenChange={(open) => {
        if (!open) {
          setPasswordDialog({ open: false, memberId: '', memberName: '' });
          setNewPassword('');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>เปลี่ยนรหัสผ่าน</DialogTitle>
            <DialogDescription>
              ตั้งรหัสผ่านใหม่สำหรับ: {passwordDialog.memberName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>รหัสผ่านใหม่</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="อย่างน้อย 6 ตัวอักษร"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setPasswordDialog({ open: false, memberId: '', memberName: '' });
              setNewPassword('');
            }}>
              ยกเลิก
            </Button>
            <Button onClick={handleChangePassword}>
              บันทึกรหัสผ่าน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
