'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Shield, 
  Users, 
  Lock, 
  Unlock, 
  RefreshCw,
  Plus,
  Save,
  AlertTriangle,
  CheckCircle,
  Settings2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Role display names
const ROLE_NAMES: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  agent_auto: 'Agent Auto',
  agent_key: 'Agent Key',
  hybrid_agent: 'Hybrid Agent',
  key_staff: 'พนักงานคีย์หวย',
  member: 'สมาชิกสายงาน',
  customer: 'ลูกค้า',
};

export default function TwoFactorSettingsPage() {
  const { data, mutate, isLoading } = useSWR('/api/admin/2fa-requirements', fetcher);
  const requirements = data?.requirements || [];
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newRole, setNewRole] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  
  const handleToggle = async (role: string, currentValue: boolean) => {
    setSaving(role);
    try {
      const res = await fetch('/api/admin/2fa-requirements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          is_required: !currentValue,
        }),
      });
      
      const result = await res.json();
      
      if (result.success) {
        toast.success(`${!currentValue ? 'เปิด' : 'ปิด'}บังคับ 2FA สำหรับ ${ROLE_NAMES[role] || role}`);
        mutate();
      } else {
        toast.error(result.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setSaving(null);
    }
  };
  
  const handleAddRole = async () => {
    if (!newRole.trim()) {
      toast.error('กรุณากรอกชื่อ Role');
      return;
    }
    
    try {
      const res = await fetch('/api/admin/2fa-requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: newRole.trim().toLowerCase(),
          is_required: false,
        }),
      });
      
      const result = await res.json();
      
      if (result.success) {
        toast.success('เพิ่ม Role สำเร็จ');
        setNewRole('');
        setShowAddDialog(false);
        mutate();
      } else {
        toast.error(result.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };
  
  // Count required roles
  const requiredCount = requirements.filter((r: any) => r.is_required).length;
  const totalCount = requirements.length;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="size-7 text-amber-500" />
            ตั้งค่า Two-Factor Authentication
          </h1>
          <p className="text-muted-foreground mt-1">
            จัดการการบังคับใช้ 2FA ตามประเภทผู้ใช้
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            <RefreshCw className="size-4 mr-2" />
            รีเฟรช
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="size-4 mr-2" />
            เพิ่ม Role
          </Button>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Role ทั้งหมด</p>
                <p className="text-2xl font-bold">{totalCount}</p>
              </div>
              <Users className="size-8 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">บังคับ 2FA</p>
                <p className="text-2xl font-bold text-green-600">{requiredCount}</p>
              </div>
              <Lock className="size-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-gray-500/20 bg-gray-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ไม่บังคับ</p>
                <p className="text-2xl font-bold text-gray-600">{totalCount - requiredCount}</p>
              </div>
              <Unlock className="size-8 text-gray-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Settings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="size-5 text-amber-500" />
            การตั้งค่าตาม Role
          </CardTitle>
          <CardDescription>
            เปิด/ปิด การบังคับใช้ 2FA สำหรับแต่ละประเภทผู้ใช้
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="size-6 mx-auto mb-2 animate-spin" />
              กำลังโหลด...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>ชื่อแสดง</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                  <TableHead className="text-center">บังคับ 2FA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requirements.map((req: any) => (
                  <TableRow key={req.role}>
                    <TableCell className="font-mono text-sm">{req.role}</TableCell>
                    <TableCell className="font-medium">
                      {ROLE_NAMES[req.role] || req.role}
                    </TableCell>
                    <TableCell className="text-center">
                      {req.is_required ? (
                        <Badge className="bg-green-500/20 text-green-600">
                          <Lock className="size-3 mr-1" />
                          บังคับ
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          <Unlock className="size-3 mr-1" />
                          ไม่บังคับ
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={req.is_required}
                        onCheckedChange={() => handleToggle(req.role, req.is_required)}
                        disabled={saving === req.role}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* Info */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <AlertTriangle className="size-6 text-blue-500 shrink-0" />
            <div className="space-y-2">
              <p className="font-medium">หมายเหตุ</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Role ที่เปิดบังคับ 2FA จะต้อง setup และยืนยัน 2FA ก่อนเข้าระบบ</li>
                <li>ผู้ใช้ที่ยังไม่ได้ setup 2FA จะถูก redirect ไปหน้า setup อัตโนมัติ</li>
                <li>แนะนำให้เปิดบังคับ 2FA สำหรับ Admin และ Super Admin เสมอ</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Add Role Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่ม Role ใหม่</DialogTitle>
            <DialogDescription>
              เพิ่ม Role สำหรับกำหนดการบังคับ 2FA
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>ชื่อ Role (ภาษาอังกฤษ, ไม่มีเว้นวรรค)</Label>
              <Input
                placeholder="เช่น moderator, supervisor"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value.replace(/\s/g, '_'))}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleAddRole}>
              <Plus className="size-4 mr-2" />
              เพิ่ม
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
