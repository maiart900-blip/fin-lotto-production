'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, User, Lock, Building2, CreditCard, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface User {
  id: string;
  username: string;
  display_name: string;
  role: string;
  is_active: boolean;
  bank_code: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  credit_balance: number;
  commission_percent: number;
  share_percent: number;
}

interface EditUserModalProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const THAI_BANKS = [
  { code: 'kbank', name: 'ธนาคารกสิกรไทย', color: '#138f2d' },
  { code: 'scb', name: 'ธนาคารไทยพาณิชย์', color: '#4e2a82' },
  { code: 'bbl', name: 'ธนาคารกรุงเทพ', color: '#1e4598' },
  { code: 'ktb', name: 'ธนาคารกรุงไทย', color: '#1ba5e0' },
  { code: 'bay', name: 'ธนาคารกรุงศรี', color: '#fec43b' },
  { code: 'ttb', name: 'ธนาคารทีทีบี', color: '#fc4f1f' },
  { code: 'gsb', name: 'ธนาคารออมสิน', color: '#eb198d' },
  { code: 'baac', name: 'ธ.ก.ส.', color: '#4b9b1d' },
  { code: 'cimb', name: 'ธนาคาร CIMB', color: '#7b0c13' },
  { code: 'uob', name: 'ธนาคาร UOB', color: '#0b3979' },
  { code: 'lhbank', name: 'ธนาคาร LH', color: '#6d6e71' },
  { code: 'tisco', name: 'ธนาคาร TISCO', color: '#12549f' },
];

export function EditUserModal({ user, open, onClose, onSuccess }: EditUserModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    display_name: '',
    password: '',
    confirmPassword: '',
    bank_code: '',
    bank_account_number: '',
    bank_account_name: '',
    is_active: true,
    credit_balance: 0,
    commission_percent: 0,
    share_percent: 0,
  });

  useEffect(() => {
    if (user) {
      setFormData({
        display_name: user.display_name || '',
        password: '',
        confirmPassword: '',
        bank_code: user.bank_code || '',
        bank_account_number: user.bank_account_number || '',
        bank_account_name: user.bank_account_name || '',
        is_active: user.is_active ?? true,
        credit_balance: user.credit_balance || 0,
        commission_percent: user.commission_percent || 0,
        share_percent: user.share_percent || 0,
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password && formData.password !== formData.confirmPassword) {
      toast.error('รหัสผ่านไม่ตรงกัน');
      return;
    }

    if (formData.password && formData.password.length < 6) {
      toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    setIsLoading(true);
    try {
      const updateData: Record<string, unknown> = {
        display_name: formData.display_name,
        bank_code: formData.bank_code || null,
        bank_account_number: formData.bank_account_number || null,
        bank_account_name: formData.bank_account_name || null,
        is_active: formData.is_active,
        credit_balance: formData.credit_balance,
        commission_percent: formData.commission_percent,
        share_percent: formData.share_percent,
      };

      if (formData.password) {
        updateData.password = formData.password;
      }

      const res = await fetch(`/api/users/${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to update');
      }

      // Success toast with gold theme
      toast.success('บันทึกข้อมูลสำเร็จ', {
        style: {
          background: 'linear-gradient(145deg, #D4AF37, #B8860B)',
          color: '#000',
          border: 'none',
          fontWeight: 'bold',
        },
        icon: '✓',
      });

      // Real-time update - call onSuccess to refresh data
      onSuccess();
      onClose();
    } catch (error) {
      console.error('[v0] Update error:', error);
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#0a0a0a] border-[#D4AF37]/30 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#D4AF37] flex items-center gap-2">
            <User className="size-5" />
            แก้ไขข้อมูลสมาชิก
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Info */}
          <div className="p-4 rounded-lg bg-[#1a1a1a] border border-[#D4AF37]/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-10 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center">
                <User className="size-5 text-black" />
              </div>
              <div>
                <p className="font-medium">{user.username}</p>
                <p className="text-sm text-gray-400">ID: {user.id.slice(0, 8)}...</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">ชื่อแสดง</Label>
                <Input
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="bg-white text-black border-[#D4AF37]/50 focus:border-[#D4AF37] placeholder:text-gray-500"
                  placeholder="ชื่อที่แสดงในระบบ"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300 flex items-center gap-2">
                  <Shield className="size-4" />
                  สถานะ
                </Label>
                <div className="flex items-center gap-3 h-10">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <span className={formData.is_active ? 'text-green-400' : 'text-red-400'}>
                    {formData.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Password */}
          <div className="p-4 rounded-lg bg-[#1a1a1a] border border-[#D4AF37]/20">
            <h4 className="font-medium text-[#D4AF37] mb-4 flex items-center gap-2">
              <Lock className="size-4" />
              เปลี่ยนรหัสผ่าน (เว้นว่างถ้าไม่ต้องการเปลี่ยน)
            </h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">รหัสผ่านใหม่</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="bg-white text-black border-[#D4AF37]/50 focus:border-[#D4AF37] placeholder:text-gray-500"
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">ยืนยันรหัสผ่าน</Label>
                <Input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="bg-white text-black border-[#D4AF37]/50 focus:border-[#D4AF37] placeholder:text-gray-500"
                  placeholder="ยืนยันรหัสผ่านใหม่"
                />
              </div>
            </div>
          </div>

          {/* Bank Info */}
          <div className="p-4 rounded-lg bg-[#1a1a1a] border border-[#D4AF37]/20">
            <h4 className="font-medium text-[#D4AF37] mb-4 flex items-center gap-2">
              <Building2 className="size-4" />
              ข้อมูลธนาคาร
            </h4>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">ธนาคาร</Label>
                <Select
                  value={formData.bank_code}
                  onValueChange={(value) => setFormData({ ...formData, bank_code: value })}
                >
                  <SelectTrigger className="bg-white text-black border-[#D4AF37]/50">
                    <SelectValue placeholder="เลือกธนาคาร" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#D4AF37]/50">
                    {THAI_BANKS.map((bank) => (
                      <SelectItem key={bank.code} value={bank.code} className="text-black hover:bg-[#D4AF37]/20">
                        <div className="flex items-center gap-2">
                          <div 
                            className="size-3 rounded-full" 
                            style={{ backgroundColor: bank.color }}
                          />
                          {bank.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">เลขบัญชี</Label>
                <Input
                  value={formData.bank_account_number}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setFormData({ ...formData, bank_account_number: value });
                  }}
                  className="bg-white text-black border-[#D4AF37]/50 focus:border-[#D4AF37] placeholder:text-gray-500"
                  placeholder="เลขบัญชีธนาคาร"
                  maxLength={15}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">ชื่อบัญชี</Label>
                <Input
                  value={formData.bank_account_name}
                  onChange={(e) => setFormData({ ...formData, bank_account_name: e.target.value })}
                  className="bg-white text-black border-[#D4AF37]/50 focus:border-[#D4AF37] placeholder:text-gray-500"
                  placeholder="ชื่อเจ้าของบัญชี"
                />
              </div>
            </div>
          </div>

          {/* Credit & Commission */}
          <div className="p-4 rounded-lg bg-[#1a1a1a] border border-[#D4AF37]/20">
            <h4 className="font-medium text-[#D4AF37] mb-4 flex items-center gap-2">
              <CreditCard className="size-4" />
              เครดิตและค่าคอม
            </h4>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">เครดิตคงเหลือ</Label>
                <Input
                  type="number"
                  value={formData.credit_balance}
                  onChange={(e) => setFormData({ ...formData, credit_balance: Number(e.target.value) })}
                  className="bg-white text-black border-[#D4AF37]/50 focus:border-[#D4AF37]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">ค่าคอม %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.commission_percent}
                  onChange={(e) => setFormData({ ...formData, commission_percent: Number(e.target.value) })}
                  className="bg-white text-black border-[#D4AF37]/50 focus:border-[#D4AF37]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">PT %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.share_percent}
                  onChange={(e) => setFormData({ ...formData, share_percent: Number(e.target.value) })}
                  className="bg-white text-black border-[#D4AF37]/50 focus:border-[#D4AF37]"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-bold hover:from-[#F5D061] hover:to-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.4)]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Save className="size-4 mr-2" />
                  บันทึกข้อมูล
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
