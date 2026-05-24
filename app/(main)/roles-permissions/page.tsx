'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Shield, Save, AlertCircle, Users, Eye, Edit, Trash2, Plus } from 'lucide-react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Permission {
  id: string;
  role: string;
  permission_key: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

const ROLES = ['super_admin', 'admin', 'agent', 'staff'];
const PERMISSIONS = [
  'dashboard',
  'entries',
  'customers',
  'lotteries',
  'results',
  'topup',
  'withdraw',
  'credits',
  'partners',
  'reports',
  'settings',
  'users',
  'backup',
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  agent: 'Agent',
  staff: 'Staff',
};

const PERMISSION_LABELS: Record<string, string> = {
  dashboard: 'แดชบอร์ด',
  entries: 'โพยหวย',
  customers: 'ลูกค้า',
  lotteries: 'หวย',
  results: 'ผลหวย',
  topup: 'เติมเงิน',
  withdraw: 'ถอนเงิน',
  credits: 'เครดิต',
  partners: 'หุ้นส่วน',
  reports: 'รายงาน',
  settings: 'ตั้งค่า',
  users: 'ผู้ใช้',
  backup: 'สำรองข้อมูล',
};

export default function RolesPermissionsPage() {
  const { canAccess } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, Record<string, Permission>>>({});
  const { data, mutate } = useSWR('/api/role-permissions', fetcher);

  useEffect(() => {
    if (data?.permissions) {
      const permMap: Record<string, Record<string, Permission>> = {};
      ROLES.forEach(role => {
        permMap[role] = {};
        PERMISSIONS.forEach(perm => {
          const existing = data.permissions.find(
            (p: Permission) => p.role === role && p.permission_key === perm
          );
          permMap[role][perm] = existing || {
            role,
            permission_key: perm,
            can_view: false,
            can_create: false,
            can_edit: false,
            can_delete: false,
          };
        });
      });
      setPermissions(permMap);
    }
  }, [data]);

  if (!canAccess('super_admin')) {
    return (
      <div className="p-6">
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-red-500">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-neutral-400 mt-2">เฉพาะ Super Admin เท่านั้น</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handlePermissionChange = (
    role: string, 
    permKey: string, 
    field: 'can_view' | 'can_create' | 'can_edit' | 'can_delete',
    value: boolean
  ) => {
    setPermissions(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permKey]: {
          ...prev[role][permKey],
          [field]: value,
        },
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const allPerms = Object.values(permissions).flatMap(rolePerms => 
        Object.values(rolePerms)
      );
      
      const res = await fetch('/api/role-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: allPerms }),
      });
      
      if (res.ok) {
        toast.success('บันทึกสิทธิ์สำเร็จ');
        mutate();
      } else {
        toast.error('เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">สิทธิ์การใช้งาน</h1>
          <p className="text-neutral-400">จัดการสิทธิ์การเข้าถึงตาม Role</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          className="bg-green-600 hover:bg-green-700"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </div>

      {/* Role Cards */}
      {ROLES.map(role => (
        <Card key={role} className="bg-white border-2 border-amber-400 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-neutral-900">
              <Shield className={`h-5 w-5 ${role === 'super_admin' ? 'text-red-500' : role === 'admin' ? 'text-blue-500' : role === 'agent' ? 'text-green-500' : 'text-neutral-500'}`} />
              {ROLE_LABELS[role]}
              {role === 'super_admin' && (
                <Badge className="ml-2 bg-red-500/20 text-red-500 border border-red-500">Full Access</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {role === 'super_admin' ? (
              <p className="text-neutral-600">Super Admin มีสิทธิ์เข้าถึงทุกฟังก์ชั่น</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-neutral-600 border-b border-amber-300">
                      <th className="py-2 px-3 text-neutral-800 font-semibold">เมนู</th>
                      <th className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-neutral-700">
                          <Eye className="h-4 w-4" />
                          <span>ดู</span>
                        </div>
                      </th>
                      <th className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-neutral-700">
                          <Plus className="h-4 w-4" />
                          <span>สร้าง</span>
                        </div>
                      </th>
                      <th className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-neutral-700">
                          <Edit className="h-4 w-4" />
                          <span>แก้ไข</span>
                        </div>
                      </th>
                      <th className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1 text-neutral-700">
                          <Trash2 className="h-4 w-4" />
                          <span>ลบ</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSIONS.map(perm => (
                      <tr key={perm} className="border-b border-amber-200 hover:bg-amber-50">
                        <td className="py-2 px-3 text-neutral-900 font-medium">{PERMISSION_LABELS[perm]}</td>
                        {(['can_view', 'can_create', 'can_edit', 'can_delete'] as const).map(field => (
                          <td key={field} className="py-2 px-3 text-center">
                            <Checkbox
                              checked={permissions[role]?.[perm]?.[field] || false}
                              onCheckedChange={(checked) => 
                                handlePermissionChange(role, perm, field, !!checked)
                              }
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Info */}
      <Card className="bg-blue-500/10 border-blue-500/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-400">คำอธิบาย Role</p>
              <ul className="text-sm text-neutral-400 mt-2 space-y-1">
                <li><strong>Super Admin:</strong> สิทธิ์สูงสุด เข้าถึงได้ทุกฟังก์ชั่น</li>
                <li><strong>Admin:</strong> จัดการระบบทั่วไป ยกเว้นลบข้อมูลสำคัญ</li>
                <li><strong>Agent:</strong> จัดการสายงานตัวเอง</li>
                <li><strong>Staff:</strong> ดูและบันทึกข้อมูลพื้นฐาน</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
