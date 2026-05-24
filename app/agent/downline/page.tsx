'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Users, UserPlus, Settings, ChevronRight, 
  Building, Percent, CreditCard, Edit, Network
} from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Demo agent ID - ในระบบจริงจะได้จาก auth
const DEMO_AGENT_ID = '7cf23d72-858d-4395-9b94-67e7a7ca821f';

export default function DownlinePage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [newAgent, setNewAgent] = useState({
    name: '',
    phone: '',
    password: '',
    share_percent: 85,
    commission_rate: 5,
    credit_limit: 10000,
    type: 'agent',
  });
  const [editData, setEditData] = useState({
    share_percent: 0,
    commission_rate: 0,
    credit_limit: 0,
  });

  const { data, isLoading } = useSWR(
    `/api/agent/downline?agent_id=${DEMO_AGENT_ID}&level=all`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const agent = data?.agent;
  const downline = data?.downline || [];

  const handleCreateDownline = async () => {
    try {
      const res = await fetch('/api/agent/downline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_id: DEMO_AGENT_ID,
          ...newAgent,
        }),
      });
      const result = await res.json();
      
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.message);
      setIsCreateOpen(false);
      setNewAgent({
        name: '',
        phone: '',
        password: '',
        share_percent: 85,
        commission_rate: 5,
        credit_limit: 10000,
        type: 'agent',
      });
      mutate(`/api/agent/downline?agent_id=${DEMO_AGENT_ID}&level=all`);
    } catch (error: any) {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const handleEditShare = async () => {
    if (!selectedAgent) return;
    
    try {
      const res = await fetch('/api/agent/share-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: selectedAgent.id,
          requester_id: DEMO_AGENT_ID,
          ...editData,
        }),
      });
      const result = await res.json();
      
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.message);
      setIsEditOpen(false);
      setSelectedAgent(null);
      mutate(`/api/agent/downline?agent_id=${DEMO_AGENT_ID}&level=all`);
    } catch (error: any) {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const openEditDialog = (agentData: any) => {
    setSelectedAgent(agentData);
    setEditData({
      share_percent: agentData.share_percent || 90,
      commission_rate: agentData.commission_rate || 5,
      credit_limit: agentData.credit_limit || 10000,
    });
    setIsEditOpen(true);
  };

  // แบ่ง downline ตาม level
  const getLevelLabel = (level: number) => {
    const labels: Record<number, string> = {
      1: 'ลูก (Level 1)',
      2: 'หลาน (Level 2)',
      3: 'เหลน (Level 3)',
      4: 'โหลน (Level 4)',
      5: 'Level 5',
    };
    return labels[level] || `Level ${level}`;
  };

  const getLevelColor = (level: number) => {
    const colors: Record<number, string> = {
      1: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      2: 'bg-green-500/20 text-green-400 border-green-500/30',
      3: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      4: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      5: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    };
    return colors[level] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Network className="size-7 text-amber-400" />
              จัดการสายงาน (Downline)
            </h1>
            <p className="text-white/60 mt-1">
              เปิดเอเย่นลูก หลาน เหลน... และแก้ไข % ส่วนแบ่ง
            </p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-amber-500 hover:bg-amber-600 text-black">
                <UserPlus className="size-4 mr-2" />
                เปิดเอเย่นลูก
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700 text-white">
              <DialogHeader>
                <DialogTitle>เปิดเอเย่นลูก (Downline)</DialogTitle>
                <DialogDescription className="text-white/60">
                  สร้างเอเย่นใต้สายงานของคุณ
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>ชื่อ</Label>
                  <Input
                    value={newAgent.name}
                    onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                    placeholder="ชื่อเอเย่น"
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
                <div>
                  <Label>เบอร์โทร</Label>
                  <Input
                    value={newAgent.phone}
                    onChange={(e) => setNewAgent({ ...newAgent, phone: e.target.value })}
                    placeholder="0812345678"
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
                <div>
                  <Label>รหัสผ่าน</Label>
                  <Input
                    type="password"
                    value={newAgent.password}
                    onChange={(e) => setNewAgent({ ...newAgent, password: e.target.value })}
                    placeholder="รหัสผ่าน"
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>% ส่วนแบ่ง (ลูกได้)</Label>
                    <Input
                      type="number"
                      value={newAgent.share_percent}
                      onChange={(e) => setNewAgent({ ...newAgent, share_percent: Number(e.target.value) })}
                      min={0}
                      max={agent?.share_percent || 90}
                      className="bg-slate-700 border-slate-600"
                    />
                    <p className="text-xs text-white/50 mt-1">
                      สูงสุด: {agent?.share_percent || 90}% (ส่วนของคุณ)
                    </p>
                  </div>
                  <div>
                    <Label>วงเงิน</Label>
                    <Input
                      type="number"
                      value={newAgent.credit_limit}
                      onChange={(e) => setNewAgent({ ...newAgent, credit_limit: Number(e.target.value) })}
                      className="bg-slate-700 border-slate-600"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  ยกเลิก
                </Button>
                <Button onClick={handleCreateDownline} className="bg-amber-500 hover:bg-amber-600 text-black">
                  สร้าง
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Agent Info */}
        <Card className="bg-slate-800/50 border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-amber-400 flex items-center gap-2">
              <Building className="size-5" />
              ข้อมูลเอเย่นของคุณ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-700/50 p-4 rounded-lg">
                <p className="text-white/60 text-sm">ชื่อ</p>
                <p className="text-xl font-bold text-white">{agent?.name || '-'}</p>
              </div>
              <div className="bg-slate-700/50 p-4 rounded-lg">
                <p className="text-white/60 text-sm">Level</p>
                <p className="text-xl font-bold text-amber-400">{agent?.level || 1}</p>
              </div>
              <div className="bg-slate-700/50 p-4 rounded-lg">
                <p className="text-white/60 text-sm">% ส่วนแบ่งของคุณ</p>
                <p className="text-xl font-bold text-green-400">{agent?.share_percent || 90}%</p>
              </div>
              <div className="bg-slate-700/50 p-4 rounded-lg">
                <p className="text-white/60 text-sm">Downline ทั้งหมด</p>
                <p className="text-xl font-bold text-white">{downline.length} คน</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Downline Table */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="size-5 text-amber-400" />
              รายชื่อ Downline ({downline.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-white/60">กำลังโหลด...</div>
            ) : downline.length === 0 ? (
              <div className="text-center py-8 text-white/60">
                <Users className="size-12 mx-auto mb-4 opacity-30" />
                <p>ยังไม่มี Downline</p>
                <p className="text-sm">กด "เปิดเอเย่นลูก" เพื่อเริ่มต้น</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-white/60">ชื่อ</TableHead>
                    <TableHead className="text-white/60">Level</TableHead>
                    <TableHead className="text-white/60">เบอร์โทร</TableHead>
                    <TableHead className="text-white/60 text-center">% ส่วนแบ่ง</TableHead>
                    <TableHead className="text-white/60 text-center">วงเงิน</TableHead>
                    <TableHead className="text-white/60">สถานะ</TableHead>
                    <TableHead className="text-white/60">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {downline.map((d: any) => (
                    <TableRow key={d.id} className="border-slate-700">
                      <TableCell className="text-white font-medium">{d.name}</TableCell>
                      <TableCell>
                        <Badge className={getLevelColor(d.level || 1)}>
                          {getLevelLabel(d.level || 1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-white/80">{d.phone || '-'}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-green-400 font-bold">{d.share_percent || 90}%</span>
                      </TableCell>
                      <TableCell className="text-center text-white/80">
                        {(d.credit_limit || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          d.status === 'active' 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }>
                          {d.status === 'active' ? 'ใช้งาน' : 'ระงับ'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(d)}
                          className="text-amber-400 hover:text-amber-300"
                        >
                          <Edit className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle>แก้ไข % ส่วนแบ่ง</DialogTitle>
              <DialogDescription className="text-white/60">
                แก้ไขส่วนแบ่งของ {selectedAgent?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>% ส่วนแบ่ง (เอเย่นได้)</Label>
                <Input
                  type="number"
                  value={editData.share_percent}
                  onChange={(e) => setEditData({ ...editData, share_percent: Number(e.target.value) })}
                  min={0}
                  max={agent?.share_percent || 90}
                  className="bg-slate-700 border-slate-600"
                />
                <p className="text-xs text-white/50 mt-1">
                  ต้องไม่เกิน {agent?.share_percent || 90}% (ส่วนของคุณ)
                </p>
              </div>
              <div>
                <Label>ค่าคอมมิชชั่น %</Label>
                <Input
                  type="number"
                  value={editData.commission_rate}
                  onChange={(e) => setEditData({ ...editData, commission_rate: Number(e.target.value) })}
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              <div>
                <Label>วงเงิน</Label>
                <Input
                  type="number"
                  value={editData.credit_limit}
                  onChange={(e) => setEditData({ ...editData, credit_limit: Number(e.target.value) })}
                  className="bg-slate-700 border-slate-600"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                ยกเลิก
              </Button>
              <Button onClick={handleEditShare} className="bg-amber-500 hover:bg-amber-600 text-black">
                บันทึก
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
