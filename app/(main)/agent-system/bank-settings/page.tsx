'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { 
  Landmark, 
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Building2,
  CheckCircle2,
  ArrowDownToLine,
  ArrowUpFromLine,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

interface AgentBankAccount {
  id: string;
  agent_id: string;
  agent_name?: string;
  bank_code: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  is_active: boolean;
  for_deposit: boolean;
  for_withdraw: boolean;
  created_at: string;
}

const THAI_BANKS = [
  { code: 'SCB', name: 'ธนาคารไทยพาณิชย์' },
  { code: 'KBANK', name: 'ธนาคารกสิกรไทย' },
  { code: 'KTB', name: 'ธนาคารกรุงไทย' },
  { code: 'BBL', name: 'ธนาคารกรุงเทพ' },
  { code: 'BAY', name: 'ธนาคารกรุงศรีอยุธยา' },
  { code: 'TMB', name: 'ธนาคารทีเอ็มบีธนชาต' },
  { code: 'GSB', name: 'ธนาคารออมสิน' },
  { code: 'BAAC', name: 'ธ.ก.ส.' },
  { code: 'CIMB', name: 'ธนาคารซีไอเอ็มบี' },
  { code: 'UOB', name: 'ธนาคารยูโอบี' },
  { code: 'TBANK', name: 'ธนาคารธนชาต' },
  { code: 'LHBANK', name: 'ธนาคารแลนด์ แอนด์ เฮ้าส์' },
  { code: 'PROMPTPAY', name: 'พร้อมเพย์' },
  { code: 'TRUEWALLET', name: 'TrueMoney Wallet' },
];

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AutoAgentBankSettingsPage() {
  const { data, mutate, isLoading } = useSWR('/api/auto-agents/bank-settings', fetcher);
  const accounts: AgentBankAccount[] = data?.accounts || [];
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AgentBankAccount | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    bank_code: '',
    account_number: '',
    account_name: '',
    for_deposit: true,
    for_withdraw: true,
  });

  const resetForm = () => {
    setFormData({
      bank_code: '',
      account_number: '',
      account_name: '',
      for_deposit: true,
      for_withdraw: true,
    });
    setEditingAccount(null);
  };

  const handleOpenDialog = (account?: AgentBankAccount) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        bank_code: account.bank_code,
        account_number: account.account_number,
        account_name: account.account_name,
        for_deposit: account.for_deposit,
        for_withdraw: account.for_withdraw,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.bank_code || !formData.account_number || !formData.account_name) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setIsSubmitting(true);
    try {
      const bank = THAI_BANKS.find(b => b.code === formData.bank_code);
      const payload = {
        ...formData,
        bank_name: bank?.name || formData.bank_code,
      };

      const url = '/api/auto-agents/bank-settings';
      const method = editingAccount ? 'PUT' : 'POST';
      const body = editingAccount ? { ...payload, id: editingAccount.id } : payload;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to save');

      toast.success(editingAccount ? 'อัพเดทบัญชีเรียบร้อย' : 'เพิ่มบัญชีเรียบร้อย');
      setIsDialogOpen(false);
      resetForm();
      mutate();
    } catch {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (account: AgentBankAccount) => {
    try {
      await fetch('/api/auto-agents/bank-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: account.id, is_active: !account.is_active }),
      });
      toast.success(account.is_active ? 'ปิดใช้งานบัญชี' : 'เปิดใช้งานบัญชี');
      mutate();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const handleDelete = async (account: AgentBankAccount) => {
    if (!confirm(`ยืนยันลบบัญชี ${account.account_number}?`)) return;
    
    try {
      await fetch('/api/auto-agents/bank-settings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: account.id }),
      });
      toast.success('ลบบัญชีเรียบร้อย');
      mutate();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const summary = {
    total: accounts.length,
    active: accounts.filter(a => a.is_active).length,
    forDeposit: accounts.filter(a => a.for_deposit && a.is_active).length,
    forWithdraw: accounts.filter(a => a.for_withdraw && a.is_active).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#D4AF37] flex items-center gap-2">
            <Zap className="h-6 w-6" />
            ธนาคารเอเย่นออโต้
          </h1>
          <p className="text-muted-foreground">จัดการบัญชีธนาคารสำหรับระบบออโต้</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
          <Button onClick={() => handleOpenDialog()} className="bg-[#D4AF37] hover:bg-[#B4941F] text-black">
            <Plus className="h-4 w-4 mr-2" />
            เพิ่มบัญชี
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border-[#D4AF37]/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">บัญชีทั้งหมด</p>
                <p className="text-2xl font-bold text-[#D4AF37]">{summary.total}</p>
              </div>
              <Landmark className="h-8 w-8 text-[#D4AF37]/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">เปิดใช้งาน</p>
                <p className="text-2xl font-bold text-green-400">{summary.active}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">รับฝาก</p>
                <p className="text-2xl font-bold text-blue-400">{summary.forDeposit}</p>
              </div>
              <ArrowDownToLine className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ถอนได้</p>
                <p className="text-2xl font-bold text-purple-400">{summary.forWithdraw}</p>
              </div>
              <ArrowUpFromLine className="h-8 w-8 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bank Accounts Table */}
      <Card className="bg-[#0d0d1a] border-[#D4AF37]/20">
        <CardHeader>
          <CardTitle className="text-[#D4AF37] flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            บัญชีธนาคารทั้งหมด
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              ยังไม่มีบัญชีธนาคาร กดปุ่ม &quot;เพิ่มบัญชี&quot; เพื่อเริ่มต้น
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#D4AF37]/20">
                  <TableHead>ธนาคาร</TableHead>
                  <TableHead>เลขบัญชี</TableHead>
                  <TableHead>ชื่อบัญชี</TableHead>
                  <TableHead className="text-center">รับฝาก</TableHead>
                  <TableHead className="text-center">ถอนได้</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id} className="border-[#D4AF37]/10 hover:bg-[#D4AF37]/5">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Landmark className="h-4 w-4 text-[#D4AF37]" />
                        <span className="font-medium">{account.bank_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{account.account_number}</TableCell>
                    <TableCell>{account.account_name}</TableCell>
                    <TableCell className="text-center">
                      {account.for_deposit ? (
                        <Badge className="bg-blue-500/20 text-blue-400">รับฝาก</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">-</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {account.for_withdraw ? (
                        <Badge className="bg-purple-500/20 text-purple-400">ถอนได้</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">-</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={account.is_active}
                        onCheckedChange={() => handleToggleActive(account)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleOpenDialog(account)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(account)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-[#0d0d1a] border-[#D4AF37]/30">
          <DialogHeader>
            <DialogTitle className="text-[#D4AF37]">
              {editingAccount ? 'แก้ไขบัญชีธนาคาร' : 'เพิ่มบัญชีธนาคารใหม่'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>ธนาคาร</Label>
              <Select value={formData.bank_code} onValueChange={(v) => setFormData({ ...formData, bank_code: v })}>
                <SelectTrigger className="bg-[#1a1a2e] border-[#D4AF37]/30">
                  <SelectValue placeholder="เลือกธนาคาร" />
                </SelectTrigger>
                <SelectContent>
                  {THAI_BANKS.map((bank) => (
                    <SelectItem key={bank.code} value={bank.code}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>เลขบัญชี</Label>
              <Input
                value={formData.account_number}
                onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                placeholder="xxx-x-xxxxx-x"
                className="bg-[#1a1a2e] border-[#D4AF37]/30"
              />
            </div>

            <div className="space-y-2">
              <Label>ชื่อบัญชี</Label>
              <Input
                value={formData.account_name}
                onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                placeholder="ชื่อ-นามสกุล"
                className="bg-[#1a1a2e] border-[#D4AF37]/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#1a1a2e] border border-[#D4AF37]/20">
                <div className="flex items-center gap-2">
                  <ArrowDownToLine className="h-4 w-4 text-blue-400" />
                  <span className="text-sm">รับฝาก</span>
                </div>
                <Switch
                  checked={formData.for_deposit}
                  onCheckedChange={(v) => setFormData({ ...formData, for_deposit: v })}
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#1a1a2e] border border-[#D4AF37]/20">
                <div className="flex items-center gap-2">
                  <ArrowUpFromLine className="h-4 w-4 text-purple-400" />
                  <span className="text-sm">ถอนได้</span>
                </div>
                <Switch
                  checked={formData.for_withdraw}
                  onCheckedChange={(v) => setFormData({ ...formData, for_withdraw: v })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>ยกเลิก</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="bg-[#D4AF37] hover:bg-[#B4941F] text-black"
            >
              {isSubmitting ? 'กำลังบันทึก...' : editingAccount ? 'อัพเดท' : 'เพิ่มบัญชี'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
