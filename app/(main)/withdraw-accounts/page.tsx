'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Pencil,
  Trash2,
  Building2,
  Loader2,
  CheckCircle,
  XCircle,
  ArrowUpFromLine,
  Wallet,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface WithdrawAccount {
  id: string;
  account_name: string;
  bank_name: string;
  account_number: string;
  is_active: boolean;
  is_primary: boolean;
  daily_limit: number;
  current_daily_used: number;
  min_withdraw: number;
  max_withdraw: number;
  note: string | null;
  sort_order: number;
  created_at: string;
}

const BANK_OPTIONS = [
  { value: 'scb', label: 'SCB (ไทยพาณิชย์)', color: 'bg-purple-500' },
  { value: 'kbank', label: 'KBANK (กสิกรไทย)', color: 'bg-green-500' },
  { value: 'bbl', label: 'BBL (กรุงเทพ)', color: 'bg-blue-700' },
  { value: 'ktb', label: 'KTB (กรุงไทย)', color: 'bg-blue-500' },
  { value: 'bay', label: 'BAY (กรุงศรี)', color: 'bg-yellow-500' },
  { value: 'ttb', label: 'TTB (ทหารไทยธนชาต)', color: 'bg-blue-400' },
  { value: 'gsb', label: 'GSB (ออมสิน)', color: 'bg-pink-500' },
  { value: 'uob', label: 'UOB', color: 'bg-blue-600' },
  { value: 'cimb', label: 'CIMB', color: 'bg-red-600' },
  { value: 'lh', label: 'LH Bank', color: 'bg-green-600' },
];

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function WithdrawAccountsPage() {
  const { data: accounts, mutate, isLoading } = useSWR<WithdrawAccount[]>('/api/withdraw-accounts', fetcher);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<WithdrawAccount | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    bank_code: '',
    bank_name: '',
    account_name: '',
    account_number: '',
    is_active: true,
    is_primary: false,
    daily_limit: 500000,
    min_withdraw: 100,
    max_withdraw: 50000,
    note: '',
    sort_order: 0,
  });

  const resetForm = () => {
    setFormData({
      bank_code: '',
      bank_name: '',
      account_name: '',
      account_number: '',
      is_active: true,
      is_primary: false,
      daily_limit: 500000,
      min_withdraw: 100,
      max_withdraw: 50000,
      note: '',
      sort_order: 0,
    });
    setSelectedAccount(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (account: WithdrawAccount) => {
    setSelectedAccount(account);
    // Find bank_code from bank_name
    const bankOption = BANK_OPTIONS.find(b => b.label === account.bank_name);
    setFormData({
      bank_code: bankOption?.value || '',
      bank_name: account.bank_name,
      account_name: account.account_name,
      account_number: account.account_number,
      is_active: account.is_active,
      is_primary: account.is_primary,
      daily_limit: account.daily_limit,
      min_withdraw: account.min_withdraw,
      max_withdraw: account.max_withdraw,
      note: account.note || '',
      sort_order: account.sort_order,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.bank_code || !formData.account_name || !formData.account_number) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setIsSaving(true);
    try {
      const url = selectedAccount 
        ? `/api/withdraw-accounts/${selectedAccount.id}` 
        : '/api/withdraw-accounts';
      
      const response = await fetch(url, {
        method: selectedAccount ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to save');
      
      toast.success(selectedAccount ? 'แก้ไขบัญชีสำเร็จ' : 'เพิ่มบัญชีสำเร็จ');
      mutate();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAccount) return;
    
    try {
      const response = await fetch(`/api/withdraw-accounts/${selectedAccount.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to delete');
      
      toast.success('ลบบัญชีสำเร็จ');
      mutate();
      setIsDeleteDialogOpen(false);
      setSelectedAccount(null);
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const toggleActive = async (account: WithdrawAccount) => {
    try {
      const response = await fetch(`/api/withdraw-accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !account.is_active }),
      });
      
      if (!response.ok) throw new Error('Failed to toggle');
      
      toast.success(account.is_active ? 'ปิดใช้งานบัญชีแล้ว' : 'เปิดใช้งานบัญชีแล้ว');
      mutate();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const setPrimary = async (account: WithdrawAccount) => {
    try {
      const response = await fetch(`/api/withdraw-accounts/${account.id}/set-primary`, {
        method: 'POST',
      });
      
      if (!response.ok) throw new Error('Failed to set primary');
      
      toast.success('ตั้งเป็นบัญชีหลักแล้ว');
      mutate();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const getBankInfo = (bankName: string) => {
    return BANK_OPTIONS.find(b => b.value === bankName) || { label: bankName, color: 'bg-gray-500' };
  };

  const accountsList = Array.isArray(accounts) ? accounts : [];
  const totalDailyLimit = accountsList.reduce((sum, acc) => acc.is_active ? sum + acc.daily_limit : sum, 0);
  const totalDailyUsed = accountsList.reduce((sum, acc) => sum + (acc.current_daily_used || 0), 0);
  const activeAccounts = accountsList.filter(acc => acc.is_active).length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#D4AF37] flex items-center gap-2">
            <ArrowUpFromLine className="size-6" />
            บัญชีถอนเงิน
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            จัดการบัญชีธนาคารสำหรับโอนเงินออกให้ลูกค้า
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={async () => {
              try {
                const res = await fetch('/api/withdraw-accounts/reset-daily', { method: 'POST' });
                if (res.ok) {
                  toast.success('รีเซ็ตยอดรายวันสำเร็จ');
                  mutate();
                }
              } catch {
                toast.error('เกิดข้อผิดพลาด');
              }
            }}
            className="border-[#334155] text-[#94A3B8] hover:bg-[#334155] hover:text-white"
          >
            <RefreshCw className="size-4 mr-2" />
            รีเซ็ตยอดรายวัน
          </Button>
          <Button onClick={openAddDialog} className="bg-[#D4AF37] hover:bg-[#B8860B] text-black">
            <Plus className="size-4 mr-2" />
            เพิ่มบัญชี
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">บัญชีทั้งหมด</p>
                <p className="text-2xl font-bold text-white">{accountsList.length}</p>
              </div>
              <Building2 className="size-8 text-[#D4AF37]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1E293B] border-[#334155]">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">บัญชีที่ใช้งาน</p>
                <p className="text-2xl font-bold text-[#22C55E]">{activeAccounts}</p>
              </div>
              <CheckCircle className="size-8 text-[#22C55E]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1E293B] border-[#334155]">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">วงเงินวันนี้</p>
                <p className="text-2xl font-bold text-[#D4AF37]">{totalDailyLimit.toLocaleString()}</p>
              </div>
              <Wallet className="size-8 text-[#D4AF37]" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1E293B] border-[#334155]">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#94A3B8]">โอนไปแล้ววันนี้</p>
                <p className="text-2xl font-bold text-[#EF4444]">{totalDailyUsed.toLocaleString()}</p>
              </div>
              <ArrowUpFromLine className="size-8 text-[#EF4444]" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Alert */}
      <Card className="bg-[#1E293B]/50 border-[#D4AF37]/30">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 text-[#D4AF37] mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[#D4AF37]">คำแนะนำ</p>
              <p className="text-xs text-[#94A3B8] mt-1">
                บัญชีถอนเงินจะใช้สำหรับโอนเงินออกให้ลูกค้าเมื่อมีคำขอถอนเงิน ควรตั้งค่าวงเงินรายวันให้เหมาะสมกับปริมาณการถอน
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Table */}
      <Card className="bg-[#1E293B] border-[#334155]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">รายการบัญชี</CardTitle>
            <Button variant="outline" size="sm" onClick={() => mutate()} className="border-[#334155]">
              <RefreshCw className="size-4 mr-2" />
              รีเฟรช
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-[#D4AF37]" />
            </div>
          ) : accountsList.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="size-12 text-[#64748B] mx-auto mb-4" />
              <p className="text-[#94A3B8]">ยังไม่มีบัญชีถอนเงิน</p>
              <Button onClick={openAddDialog} className="mt-4 bg-[#D4AF37] hover:bg-[#B8860B] text-black">
                <Plus className="size-4 mr-2" />
                เพิ่มบัญชีแรก
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#334155]">
                  <TableHead className="text-[#94A3B8]">ธนาคาร</TableHead>
                  <TableHead className="text-[#94A3B8]">ชื่อบัญชี</TableHead>
                  <TableHead className="text-[#94A3B8]">เลขบัญชี</TableHead>
                  <TableHead className="text-[#94A3B8]">วงเงิน/วัน</TableHead>
                  <TableHead className="text-[#94A3B8]">ใช้ไปวันนี้</TableHead>
                  <TableHead className="text-[#94A3B8]">สถานะ</TableHead>
                  <TableHead className="text-[#94A3B8] text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountsList.map((account) => {
                  const bankInfo = getBankInfo(account.bank_name);
                  const usagePercent = account.daily_limit > 0 
                    ? (account.current_daily_used / account.daily_limit) * 100 
                    : 0;
                  
                  return (
                    <TableRow key={account.id} className="border-[#334155]">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`size-8 rounded-full ${bankInfo.color} flex items-center justify-center`}>
                            <Building2 className="size-4 text-white" />
                          </div>
                          <span className="text-white font-medium">{bankInfo.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-white">{account.account_name}</span>
                          {account.is_primary && (
                            <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] text-xs">หลัก</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-[#94A3B8] font-mono">{account.account_number}</TableCell>
                      <TableCell>
                        <div>
                          <span className="text-white">{account.daily_limit.toLocaleString()}</span>
                          <div className="w-24 h-1.5 bg-[#334155] rounded-full mt-1">
                            <div 
                              className={`h-full rounded-full ${usagePercent > 80 ? 'bg-[#EF4444]' : usagePercent > 50 ? 'bg-[#F59E0B]' : 'bg-[#22C55E]'}`}
                              style={{ width: `${Math.min(usagePercent, 100)}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-[#EF4444]">{account.current_daily_used.toLocaleString()}</TableCell>
                      <TableCell>
                        <Switch 
                          checked={account.is_active}
                          onCheckedChange={() => toggleActive(account)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!account.is_primary && account.is_active && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setPrimary(account)}
                              className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10"
                            >
                              ตั้งเป็นหลัก
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(account)}>
                            <Pencil className="size-4 text-[#94A3B8]" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => {
                              setSelectedAccount(account);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="size-4 text-[#EF4444]" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-[#1E293B] border-[#334155] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#D4AF37]">
              {selectedAccount ? 'แก้ไขบัญชีถอนเงิน' : 'เพิ่มบัญชีถอนเงิน'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>ธนาคาร</Label>
              <Select 
                value={formData.bank_code} 
                onValueChange={(v) => {
                  const bank = BANK_OPTIONS.find(b => b.value === v);
                  setFormData(prev => ({ 
                    ...prev, 
                    bank_code: v,
                    bank_name: bank?.label || v 
                  }));
                }}
              >
                <SelectTrigger className="bg-[#0F172A] border-[#334155]">
                  <SelectValue placeholder="เลือกธนาคาร" />
                </SelectTrigger>
                <SelectContent className="bg-[#1E293B] border-[#334155]">
                  {BANK_OPTIONS.map(bank => (
                    <SelectItem key={bank.value} value={bank.value}>{bank.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>ชื่อบัญชี</Label>
              <Input 
                value={formData.account_name}
                onChange={(e) => setFormData(prev => ({ ...prev, account_name: e.target.value }))}
                placeholder="ชื่อ-นามสกุล"
                className="bg-[#0F172A] border-[#334155] text-white placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-2">
              <Label>เลขบัญชี</Label>
              <Input 
                value={formData.account_number}
                onChange={(e) => setFormData(prev => ({ ...prev, account_number: e.target.value }))}
                placeholder="xxx-x-xxxxx-x"
                className="bg-[#0F172A] border-[#334155] text-white placeholder:text-gray-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-[#D4AF37]">วงเงิน/วัน</Label>
                <Input 
                  type="number"
                  value={formData.daily_limit}
                  onChange={(e) => setFormData(prev => ({ ...prev, daily_limit: Number(e.target.value) }))}
                  className="bg-[#1A1A2E] border-[#D4AF37]/30 text-white placeholder:text-gray-500"
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#D4AF37]">ถอนขั้นต่ำ</Label>
                <Input 
                  type="number"
                  value={formData.min_withdraw}
                  onChange={(e) => setFormData(prev => ({ ...prev, min_withdraw: Number(e.target.value) }))}
                  className="bg-[#1A1A2E] border-[#D4AF37]/30 text-white placeholder:text-gray-500"
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#D4AF37]">ถอนสูงสุด</Label>
                <Input 
                  type="number"
                  value={formData.max_withdraw}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_withdraw: Number(e.target.value) }))}
                  className="bg-[#1A1A2E] border-[#D4AF37]/30 text-white placeholder:text-gray-500"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>หมายเหตุ</Label>
              <Textarea 
                value={formData.note}
                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                className="bg-[#0F172A] border-[#334155] text-white placeholder:text-gray-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch 
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, is_active: v }))}
                />
                <Label>เปิดใช้งาน</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={formData.is_primary}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, is_primary: v }))}
                />
                <Label>บัญชีหลัก</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-[#334155]">
              ยกเลิก
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-[#D4AF37] hover:bg-[#B8860B] text-black">
              {isSaving && <Loader2 className="size-4 mr-2 animate-spin" />}
              {selectedAccount ? 'บันทึก' : 'เพิ่มบัญชี'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#1E293B] border-[#334155]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription className="text-[#94A3B8]">
              คุณต้องการลบบัญชี {selectedAccount?.account_name} ({selectedAccount?.account_number}) ใช่หรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#334155]">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-[#EF4444] hover:bg-[#DC2626]">
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
