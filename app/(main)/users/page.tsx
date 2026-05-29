'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Crown,
  Keyboard,
  AlertTriangle,
  Network,
} from 'lucide-react';
import { fetcher } from '@/lib/fetcher';

// =====================================================
// CONSOLIDATED USER MANAGEMENT - SINGLE SOURCE OF TRUTH
// =====================================================
// This page manages ALL user types:
// 1. Internal Staff (Admin, Key-in Staff)
// 2. 4-Tier Manual Key Hierarchy (Master -> Agent -> Sub-Agent)
// 
// STRICT DATA ISOLATION:
// - Master, Agent, Sub-Agent are EXCLUSIVELY for manual_key operations
// - They NEVER interact with Auto API streams
// =====================================================

interface User {
  id: string;
  username: string;
  display_name: string;
  role: string;
  user_type?: 'internal' | 'manual_key_agent';
  agent_tier?: 'master' | 'agent' | 'sub_agent';
  credit_balance: number;
  is_unlimited_credit: boolean;
  parent_id: string | null;
  hierarchy_level: number;
  source_type?: string;
  created_at: string;
}

// Internal Staff Roles
const INTERNAL_ROLE_LABELS: Record<string, string> = {
  owner: 'เจ้าของระบบ',
  super_admin: 'Super Admin (Mother Web)',
  admin: 'แอดมิน',
  key_staff: 'พนักงานคีย์หวย',
  staff: 'พนักงานทั่วไป',
};

const INTERNAL_ROLE_COLORS: Record<string, string> = {
  owner: 'bg-red-600',
  super_admin: 'bg-red-500',
  admin: 'bg-amber-500',
  key_staff: 'bg-blue-500',
  staff: 'bg-gray-500',
};

// 4-Tier Manual Key Hierarchy
const AGENT_TIER_LABELS: Record<string, string> = {
  master: 'Master Agent (มาสเตอร์)',
  agent: 'Agent (เอเย่นต์)',
  sub_agent: 'Sub-Agent (ซับเอเย่นต์)',
};

const AGENT_TIER_COLORS: Record<string, string> = {
  master: 'bg-purple-600',
  agent: 'bg-blue-600',
  sub_agent: 'bg-green-600',
};

const AGENT_TIER_LEVELS: Record<string, number> = {
  master: 1,
  agent: 2,
  sub_agent: 3,
};

export default function UsersPage() {
  const { user: authUser, isAdmin, isSuperAdmin } = useAuth();
  const { data: users = [], isLoading, error } = useSWR<User[]>('/api/users', fetcher);
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'internal' | 'manual_key'>('internal');
  
  // Form state - EXPANDED for all user types
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    displayName: '',
    phone: '',
    // User type selection
    userCategory: 'internal' as 'internal' | 'manual_key_agent',
    // Internal staff role
    internalRole: 'staff',
    // Manual Key Agent tier
    agentTier: 'agent' as 'master' | 'agent' | 'sub_agent',
    // Parent agent for hierarchy
    parentAgentId: '',
    // Commission rate for agents
    commissionRate: '5',
  });

  // Filter users by category
  const internalUsers = users.filter(u => 
    !u.user_type || u.user_type === 'internal' || 
    ['owner', 'super_admin', 'admin', 'staff', 'key_staff'].includes(u.role)
  );
  
  const manualKeyAgents = users.filter(u => 
    u.user_type === 'manual_key_agent' || 
    u.source_type === 'manual_key' ||
    ['master', 'agent', 'sub_agent'].includes(u.agent_tier || '')
  );

  // Get potential parent agents for hierarchy
  const potentialParents = manualKeyAgents.filter(a => {
    const tier = a.agent_tier || 'agent';
    const newTier = formData.agentTier;
    // Master can be parent of Agent
    // Agent can be parent of Sub-Agent
    if (newTier === 'agent') return tier === 'master';
    if (newTier === 'sub_agent') return tier === 'agent' || tier === 'master';
    return false;
  });

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      displayName: '',
      phone: '',
      userCategory: 'internal',
      internalRole: 'staff',
      agentTier: 'agent',
      parentAgentId: '',
      commissionRate: '5',
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
      const isManualKeyAgent = formData.userCategory === 'manual_key_agent';
      
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: formData.username.trim(),
          password: formData.password,
          displayName: formData.displayName.trim(),
          phone: formData.phone.trim() || null,
          // Determine role based on category
          role: isManualKeyAgent ? formData.agentTier : formData.internalRole,
          // User type for data isolation
          user_type: formData.userCategory,
          // Manual Key Agent specific fields
          agent_tier: isManualKeyAgent ? formData.agentTier : null,
          parent_id: isManualKeyAgent && formData.parentAgentId ? formData.parentAgentId : null,
          hierarchy_level: isManualKeyAgent ? AGENT_TIER_LEVELS[formData.agentTier] : 0,
          commission_rate: isManualKeyAgent ? parseFloat(formData.commissionRate) || 5 : null,
          // STRICT: Manual Key agents are stamped with manual_key source
          source_type: isManualKeyAgent ? 'manual_key' : null,
          source: isManualKeyAgent ? 'manual_key' : null,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user');
      }
      
      toast.success(isManualKeyAgent 
        ? `สร้าง ${AGENT_TIER_LABELS[formData.agentTier]} สำเร็จ` 
        : 'เพิ่มผู้ใช้สำเร็จ'
      );
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
      const isManualKeyAgent = editingUser.user_type === 'manual_key_agent' || 
        ['master', 'agent', 'sub_agent'].includes(editingUser.agent_tier || '');
      
      const body: Record<string, string | number | null> = {
        displayName: formData.displayName.trim(),
        phone: formData.phone.trim() || null,
      };
      
      // Role update based on user type
      if (isManualKeyAgent) {
        body.agent_tier = formData.agentTier;
        body.role = formData.agentTier;
        body.commission_rate = parseFloat(formData.commissionRate) || 5;
        if (formData.parentAgentId) {
          body.parent_id = formData.parentAgentId;
        }
      } else {
        body.role = formData.internalRole;
      }
      
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
    const isManualKeyAgent = user.user_type === 'manual_key_agent' || 
      ['master', 'agent', 'sub_agent'].includes(user.agent_tier || '');
    
    setFormData({
      username: user.username,
      password: '',
      displayName: user.display_name,
      phone: '',
      userCategory: isManualKeyAgent ? 'manual_key_agent' : 'internal',
      internalRole: isManualKeyAgent ? 'staff' : user.role,
      agentTier: (user.agent_tier as 'master' | 'agent' | 'sub_agent') || 'agent',
      parentAgentId: user.parent_id || '',
      commissionRate: '5',
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

  // Render user table helper
  const renderUserTable = (userList: User[], isManualKeyTab: boolean) => {
    if (isLoading) {
      return (
        <div className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto" />
          <p className="text-gray-400 mt-2">กำลังโหลด...</p>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="py-12 text-center">
          <p className="text-red-400">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
        </div>
      );
    }
    
    if (userList.length === 0) {
      return (
        <div className="py-12 text-center">
          <Users className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">
            {isManualKeyTab ? 'ยังไม่มีสายงานเอเย่นต์คีย์หวย' : 'ยังไม่มีพนักงาน'}
          </p>
        </div>
      );
    }
    
    return (
      <Table>
        <TableHeader>
          <TableRow className="border-slate-700">
            <TableHead className="text-gray-400">ชื่อผู้ใช้</TableHead>
            <TableHead className="text-gray-400">ชื่อแสดง</TableHead>
            <TableHead className="text-gray-400">
              {isManualKeyTab ? 'ระดับ (Tier)' : 'บทบาท'}
            </TableHead>
            {isManualKeyTab && <TableHead className="text-gray-400">ต้นสาย</TableHead>}
            <TableHead className="text-gray-400">เครดิต</TableHead>
            <TableHead className="text-gray-400">วันที่สร้าง</TableHead>
            <TableHead className="text-gray-400 text-right">จัดการ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {userList.map((user) => {
            const isManualKeyAgent = user.user_type === 'manual_key_agent' || 
              ['master', 'agent', 'sub_agent'].includes(user.agent_tier || '');
            const tierLabel = isManualKeyAgent && user.agent_tier 
              ? AGENT_TIER_LABELS[user.agent_tier] 
              : INTERNAL_ROLE_LABELS[user.role] || user.role;
            const tierColor = isManualKeyAgent && user.agent_tier
              ? AGENT_TIER_COLORS[user.agent_tier]
              : INTERNAL_ROLE_COLORS[user.role] || 'bg-gray-500';
            
            // Find parent name
            const parentUser = user.parent_id 
              ? users.find(u => u.id === user.parent_id) 
              : null;
            
            return (
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
                  <Badge className={`${tierColor} text-white`}>
                    {tierLabel}
                  </Badge>
                </TableCell>
                {isManualKeyTab && (
                  <TableCell className="text-gray-300">
                    {parentUser ? parentUser.display_name : '-'}
                  </TableCell>
                )}
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
                              คุณต้องการลบ &quot;{user.display_name}&quot; หรือไม่?
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
            );
          })}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-amber-500" />
            จัดการผู้ใช้งาน (ศูนย์กลาง)
          </h1>
          <p className="text-gray-400 mt-1">จัดการบัญชีผู้ใช้ทุกประเภท - พนักงาน และ สายงานเอเย่นต์คีย์หวย</p>
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
            เพิ่มผู้ใช้ใหม่
          </Button>
        </div>
      </div>

      {/* Data Isolation Alert */}
      <Alert className="bg-purple-500/10 border-purple-500/30">
        <AlertTriangle className="h-4 w-4 text-purple-400" />
        <AlertDescription className="text-purple-200">
          <strong>Data Isolation:</strong> สายงานเอเย่นต์ (Master/Agent/Sub-Agent) 
          แยกจากระบบออโต้โดยสมบูรณ์ - ใช้สำหรับคีย์หวยมือเท่านั้น (Manual Key Only)
        </AlertDescription>
      </Alert>

      {/* Tabs for User Categories */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'internal' | 'manual_key')}>
        <TabsList className="bg-slate-800">
          <TabsTrigger value="internal" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            พนักงาน/แอดมิน ({internalUsers.length})
          </TabsTrigger>
          <TabsTrigger value="manual_key" className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            สายงานคีย์หวย ({manualKeyAgents.length})
          </TabsTrigger>
        </TabsList>

        {/* Internal Staff Tab */}
        <TabsContent value="internal">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-amber-500" />
                พนักงานและแอดมิน
              </CardTitle>
              <CardDescription className="text-gray-400">
                บัญชีพนักงานภายใน ไม่เกี่ยวข้องกับสายงานเอเย่นต์
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderUserTable(internalUsers, false)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Key Agent Hierarchy Tab */}
        <TabsContent value="manual_key">
          <Card className="bg-slate-800 border-purple-500/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Network className="h-5 w-5 text-purple-400" />
                สายงานเอเย่นต์คีย์หวย (Manual Key Only)
              </CardTitle>
              <CardDescription className="text-gray-400">
                4-Tier Hierarchy: Mother Web → Master → Agent → Sub-Agent | 
                <span className="text-purple-400 ml-1">ใช้สำหรับคีย์เลขเท่านั้น</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Tier Legend */}
              <div className="flex gap-4 mb-4 p-3 bg-slate-900 rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-600 text-white">Mother Web</Badge>
                  <span className="text-xs text-gray-400">Level 0</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-600 text-white">Master</Badge>
                  <span className="text-xs text-gray-400">Level 1</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-600 text-white">Agent</Badge>
                  <span className="text-xs text-gray-400">Level 2</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-600 text-white">Sub-Agent</Badge>
                  <span className="text-xs text-gray-400">Level 3</span>
                </div>
              </div>
              {renderUserTable(manualKeyAgents, true)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add User Dialog - CONSOLIDATED */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-amber-500" />
              เพิ่มผู้ใช้ใหม่
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              เลือกประเภทผู้ใช้และกรอกข้อมูลให้ครบถ้วน
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* User Category Selection */}
            <div>
              <Label className="text-gray-300">ประเภทผู้ใช้</Label>
              <Select
                value={formData.userCategory}
                onValueChange={(value: 'internal' | 'manual_key_agent') => 
                  setFormData({ ...formData, userCategory: value })
                }
              >
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="internal">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      พนักงาน/แอดมิน (Internal)
                    </div>
                  </SelectItem>
                  <SelectItem value="manual_key_agent">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-purple-400" />
                      สายงานคีย์หวย (Manual Key Agent)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Manual Key Agent Alert */}
            {formData.userCategory === 'manual_key_agent' && (
              <Alert className="bg-purple-500/10 border-purple-500/30">
                <Keyboard className="h-4 w-4 text-purple-400" />
                <AlertDescription className="text-purple-200 text-sm">
                  ผู้ใช้นี้จะถูกสร้างในระบบคีย์หวยมือเท่านั้น ไม่เกี่ยวข้องกับระบบออโต้
                </AlertDescription>
              </Alert>
            )}

            {/* Role/Tier Selection */}
            {formData.userCategory === 'internal' ? (
              <div>
                <Label className="text-gray-300">บทบาท</Label>
                <Select
                  value={formData.internalRole}
                  onValueChange={(value) => setFormData({ ...formData, internalRole: value })}
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    <SelectItem value="staff">พนักงานทั่วไป</SelectItem>
                    <SelectItem value="key_staff">พนักงานคีย์หวย</SelectItem>
                    <SelectItem value="admin">แอดมิน</SelectItem>
                    {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div>
                  <Label className="text-gray-300">ระดับเอเย่นต์ (Tier)</Label>
                  <Select
                    value={formData.agentTier}
                    onValueChange={(value: 'master' | 'agent' | 'sub_agent') => 
                      setFormData({ ...formData, agentTier: value, parentAgentId: '' })
                    }
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="master">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-purple-600 text-white text-xs">Level 1</Badge>
                          Master Agent (มาสเตอร์)
                        </div>
                      </SelectItem>
                      <SelectItem value="agent">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-600 text-white text-xs">Level 2</Badge>
                          Agent (เอเย่นต์)
                        </div>
                      </SelectItem>
                      <SelectItem value="sub_agent">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-600 text-white text-xs">Level 3</Badge>
                          Sub-Agent (ซับเอเย่นต์)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Parent Agent Selection (for Agent and Sub-Agent) */}
                {formData.agentTier !== 'master' && (
                  <div>
                    <Label className="text-gray-300">ต้นสาย (Parent)</Label>
                    <Select
                      value={formData.parentAgentId}
                      onValueChange={(value) => setFormData({ ...formData, parentAgentId: value })}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="เลือกต้นสาย" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        {potentialParents.length === 0 ? (
                          <SelectItem value="" disabled>
                            ไม่มีต้นสายที่พร้อมใช้งาน
                          </SelectItem>
                        ) : (
                          potentialParents.map((parent) => (
                            <SelectItem key={parent.id} value={parent.id}>
                              {parent.display_name} ({AGENT_TIER_LABELS[parent.agent_tier || 'agent']})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Commission Rate */}
                <div>
                  <Label className="text-gray-300">อัตราคอมมิชชั่น (%)</Label>
                  <Input
                    type="number"
                    value={formData.commissionRate}
                    onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                    placeholder="5"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
              </>
            )}

            {/* Common Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">ชื่อผู้ใช้ (Username)</Label>
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
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                <Label className="text-gray-300">เบอร์โทร (ถ้ามี)</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="0812345678"
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
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
              className={formData.userCategory === 'manual_key_agent' 
                ? "bg-purple-600 hover:bg-purple-700 text-white"
                : "bg-amber-500 hover:bg-amber-600 text-black"
              }
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {formData.userCategory === 'manual_key_agent' 
                ? `สร้าง ${AGENT_TIER_LABELS[formData.agentTier]?.split(' ')[0] || 'Agent'}`
                : 'เพิ่มผู้ใช้'
              }
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
