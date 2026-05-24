'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Users, 
  Search, 
  UserCheck, 
  UserX,
  Building2,
  Plus
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';

interface Member {
  id: string;
  username: string;
  name: string;
  phone: string;
  agent_id: string;
  agent_name?: string;
  status: 'active' | 'inactive' | 'suspended';
  role: string;
  created_at: string;
}

interface Agent {
  id: string;
  username: string;
  name: string;
}

export default function ManualKeyMembersPage() {
  const { user } = useAuth();
  const isAgent = user?.role === 'agent';
  
  const [members, setMembers] = useState<Member[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '',
    username: '',
    password: '',
    phone: '',
    agent_id: '',
    position: 'member'
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
      const res = await fetch('/api/customers?system_type=manual_key');
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
      const res = await fetch('/api/agents?system_type=manual_key');
      const data = await res.json();
      setAgents(data.agents || data || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
    }
  };

  const filteredMembers = members.filter(member => {
    const matchesSearch = 
      member.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.phone?.includes(searchQuery);
    
    const matchesAgent = filterAgent === 'all' || member.agent_id === filterAgent;
    
    return matchesSearch && matchesAgent;
  });

  const activeCount = members.filter(m => m.status === 'active').length;
  const inactiveCount = members.filter(m => m.status !== 'active').length;

  // เพิ่มแมมเบอร์ใหม่ผ่าน API กลางจากเว็บแม่
  const handleAddMember = async () => {
    // ถ้าเป็น Agent ไม่ต้องเลือก agent_id (ใช้ตัวเอง)
    // ถ้าเป็น Admin ให้ agent_id เป็น optional
    if (!newMember.name) {
      alert('กรุณากรอกชื่อ');
      return;
    }
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newMember,
          system_type: 'manual_key' // ระบุว่าเป็นระบบคีย์หวย
        })
      });
      if (res.ok) {
        fetchMembers();
        setShowAddDialog(false);
        setNewMember({ name: '', username: '', password: '', phone: '', agent_id: '', position: 'member' });
      }
    } catch (error) {
      console.error('Error adding member:', error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">จัดการแมมเบอร์ (คีย์หวย)</h1>
          <p className="text-muted-foreground">เพิ่มและจัดการแมมเบอร์/พนักงานใต้สายงานเอเย่น</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          เพิ่มแมมเบอร์
        </Button>
      </div>

      {/* Info Alert - ข้อมูลเชื่อมตรงเว็บแม่ */}
      <Alert className="border-primary/50 bg-primary/10">
        <Building2 className="h-4 w-4 text-primary" />
        <AlertDescription className="text-foreground">
          <strong>ระบบเชื่อมต่อเว็บแม่:</strong> แมมเบอร์ที่สร้างจะเชื่อมตรงเข้าเอเย่นและขึ้นเว็บแม่อัตโนมัติ
          ระบบคีย์หวยและ commission ใช้จากเว็บแม่เท่านั้น ไม่มีการสร้างซ้ำซ้อน
        </AlertDescription>
      </Alert>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">แมมเบอร์ทั้งหมด</p>
                <p className="text-2xl font-bold text-foreground">{members.length}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ใช้งานอยู่</p>
                <p className="text-2xl font-bold text-green-500">{activeCount}</p>
              </div>
              <UserCheck className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ระงับการใช้งาน</p>
                <p className="text-2xl font-bold text-red-500">{inactiveCount}</p>
              </div>
              <UserX className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">ค้นหาและกรอง</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหา (ชื่อ, username, เบอร์โทร)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background"
              />
            </div>
            <Select value={filterAgent} onValueChange={setFilterAgent}>
              <SelectTrigger className="w-full md:w-[200px] bg-background">
                <SelectValue placeholder="เลือกเอเย่น" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name || agent.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Members Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            รายชื่อแมมเบอร์ ({filteredMembers.length})
          </CardTitle>
          <CardDescription>
            แมมเบอร์ใต้สายงานเอเย่นคีย์หวย (ดูอย่างเดียว)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>ยังไม่มีแมมเบอร์ในสายงาน</p>
              <p className="text-sm mt-2">แมมเบอร์จะถูกสร้างโดยเว็บแม่เท่านั้น</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>ชื่อผู้ใช้</TableHead>
                  <TableHead>ชื่อ-นามสกุล</TableHead>
                  <TableHead>เบอร์โทร</TableHead>
                  <TableHead>เอเย่นต้นสังกัด</TableHead>
                  <TableHead>ตำแหน่ง</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>วันที่สร้าง</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id} className="border-border">
                    <TableCell className="font-medium">@{member.username}</TableCell>
                    <TableCell>{member.name || '-'}</TableCell>
                    <TableCell>{member.phone || '-'}</TableCell>
                    <TableCell>
                      {member.agent_name || agents.find(a => a.id === member.agent_id)?.name || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {member.role === 'keyer' ? 'คีย์หวย' : 'พนักงาน'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={member.status === 'active' ? 'default' : 'destructive'}
                        className={member.status === 'active' ? 'bg-green-500' : ''}
                      >
                        {member.status === 'active' ? 'ใช้งาน' : 'ระงับ'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(member.created_at).toLocaleDateString('th-TH')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Member Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>เพิ่มแมมเบอร์ใหม่</DialogTitle>
            <DialogDescription>
              {isAgent 
                ? 'แมมเบอร์จะเชื่อมตรงเข้าสายงานของคุณอัตโนมัติ'
                : 'แมมเบอร์จะเชื่อมตรงเข้าเอเย่นและขึ้นเว็บแม่อัตโนมัติ'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* แสดง dropdown เลือกเอเย่นเฉพาะ Admin เท่านั้น */}
            {!isAgent && (
              <div className="grid gap-2">
                <Label>เอเย่นต้นสังกัด (ถ้ามี)</Label>
                <Select 
                  value={newMember.agent_id} 
                  onValueChange={(v) => setNewMember({...newMember, agent_id: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกเอเย่น (ไม่บังคับ)" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name || agent.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label>ชื่อ-นามสกุล *</Label>
              <Input 
                value={newMember.name}
                onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                placeholder="ชื่อ นามสกุล"
              />
            </div>
            <div className="grid gap-2">
              <Label>ชื่อผู้ใช้ (Username)</Label>
              <Input 
                value={newMember.username}
                onChange={(e) => setNewMember({...newMember, username: e.target.value})}
                placeholder="username"
              />
            </div>
            <div className="grid gap-2">
              <Label>รหัสผ่าน</Label>
              <Input 
                type="password"
                value={newMember.password}
                onChange={(e) => setNewMember({...newMember, password: e.target.value})}
                placeholder="รหัสผ่าน"
              />
            </div>
            <div className="grid gap-2">
              <Label>เบอร์โทร</Label>
              <Input 
                value={newMember.phone}
                onChange={(e) => setNewMember({...newMember, phone: e.target.value})}
                placeholder="0812345678"
              />
            </div>
            <div className="grid gap-2">
              <Label>ตำแหน่ง</Label>
              <Select 
                value={newMember.position} 
                onValueChange={(v) => setNewMember({...newMember, position: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">แมมเบอร์</SelectItem>
                  <SelectItem value="staff">พนักงาน</SelectItem>
                  <SelectItem value="manager">ผู้จัดการ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>ยกเลิก</Button>
            <Button onClick={handleAddMember}>เพิ่มแมมเบอร์</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
