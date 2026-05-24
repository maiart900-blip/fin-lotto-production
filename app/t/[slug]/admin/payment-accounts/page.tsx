'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, QrCode, CreditCard, Building2, Smartphone, Edit2, Trash2, Loader2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const BANK_LIST = [
  { code: 'SCB', name: 'ธนาคารไทยพาณิชย์', color: '#4E2A84' },
  { code: 'KBANK', name: 'ธนาคารกสิกรไทย', color: '#138F2D' },
  { code: 'KTB', name: 'ธนาคารกรุงไทย', color: '#1BA5E0' },
  { code: 'BBL', name: 'ธนาคารกรุงเทพ', color: '#1E4598' },
  { code: 'BAY', name: 'ธนาคารกรุงศรีอยุธยา', color: '#FEC43B' },
  { code: 'TMB', name: 'ธนาคารทหารไทยธนชาต', color: '#1279BE' },
  { code: 'GSB', name: 'ธนาคารออมสิน', color: '#EB198D' },
  { code: 'PROMPTPAY', name: 'พร้อมเพย์', color: '#003D6A' },
  { code: 'TRUEWALLET', name: 'True Wallet', color: '#FF6600' },
];

const ACCOUNT_TYPES = [
  { value: 'bank', label: 'บัญชีธนาคาร', icon: Building2 },
  { value: 'promptpay', label: 'พร้อมเพย์', icon: Smartphone },
  { value: 'truewallet', label: 'True Wallet', icon: CreditCard },
  { value: 'qr', label: 'QR Code', icon: QrCode },
];

export default function PaymentAccountsPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const { data, mutate, isLoading } = useSWR(`/api/tenant/${slug}/admin/payment-accounts`, fetcher);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  
  // Form state
  const [accountType, setAccountType] = useState('bank');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [minDeposit, setMinDeposit] = useState('100');
  const [maxDeposit, setMaxDeposit] = useState('50000');

  const accounts = data?.accounts || [];

  const resetForm = () => {
    setAccountType('bank');
    setBankCode('');
    setAccountNumber('');
    setAccountName('');
    setIsActive(true);
    setMinDeposit('100');
    setMaxDeposit('50000');
    setEditingAccount(null);
  };

  const handleSave = async () => {
    if (!accountNumber || !accountName) {
      toast.error('กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    setSaving(true);
    try {
      const endpoint = editingAccount 
        ? `/api/tenant/${slug}/admin/payment-accounts/${editingAccount.id}`
        : `/api/tenant/${slug}/admin/payment-accounts`;
      
      const res = await fetch(endpoint, {
        method: editingAccount ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_type: accountType,
          bank_code: bankCode,
          account_number: accountNumber,
          account_name: accountName,
          is_active: isActive,
          min_deposit: parseFloat(minDeposit),
          max_deposit: parseFloat(maxDeposit),
        }),
      });

      if (!res.ok) throw new Error('บันทึกไม่สำเร็จ');
      
      toast.success(editingAccount ? 'แก้ไขบัญชีสำเร็จ' : 'เพิ่มบัญชีสำเร็จ');
      mutate();
      setShowAddDialog(false);
      resetForm();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ต้องการลบบัญชีนี้?')) return;
    
    try {
      await fetch(`/api/tenant/${slug}/admin/payment-accounts/${id}`, { method: 'DELETE' });
      toast.success('ลบบัญชีสำเร็จ');
      mutate();
    } catch (error) {
      toast.error('ลบไม่สำเร็จ');
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const getBankInfo = (code: string) => BANK_LIST.find(b => b.code === code);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">บัญชีรับเงิน</h1>
          <p className="text-gray-400">จัดการบัญชีสำหรับรับเงินฝากจากลูกค้า</p>
        </div>
        <Button onClick={() => { resetForm(); setShowAddDialog(true); }} className="bg-amber-500 hover:bg-amber-600 text-black">
          <Plus className="h-4 w-4 mr-2" />
          เพิ่มบัญชี
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#1a1a2e] border-white/10">
          <CardContent className="p-4">
            <p className="text-gray-400 text-sm">บัญชีทั้งหมด</p>
            <p className="text-2xl font-bold text-white">{accounts.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1a1a2e] border-white/10">
          <CardContent className="p-4">
            <p className="text-gray-400 text-sm">เปิดใช้งาน</p>
            <p className="text-2xl font-bold text-green-400">{accounts.filter((a: any) => a.is_active).length}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1a1a2e] border-white/10">
          <CardContent className="p-4">
            <p className="text-gray-400 text-sm">บัญชีธนาคาร</p>
            <p className="text-2xl font-bold text-blue-400">{accounts.filter((a: any) => a.account_type === 'bank').length}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1a1a2e] border-white/10">
          <CardContent className="p-4">
            <p className="text-gray-400 text-sm">พร้อมเพย์/Wallet</p>
            <p className="text-2xl font-bold text-purple-400">{accounts.filter((a: any) => a.account_type !== 'bank').length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Account List */}
      <div className="grid gap-4">
        {isLoading ? (
          <Card className="bg-[#1a1a2e] border-white/10 p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-400" />
          </Card>
        ) : accounts.length === 0 ? (
          <Card className="bg-[#1a1a2e] border-white/10 p-8 text-center">
            <QrCode className="h-12 w-12 mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400">ยังไม่มีบัญชีรับเงิน</p>
            <Button onClick={() => setShowAddDialog(true)} variant="outline" className="mt-4">
              เพิ่มบัญชีแรก
            </Button>
          </Card>
        ) : (
          accounts.map((account: any) => {
            const bank = getBankInfo(account.bank_code);
            return (
              <Card key={account.id} className="bg-[#1a1a2e] border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: bank?.color || '#666' }}
                      >
                        {account.bank_code?.slice(0, 2) || '??'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-white">{bank?.name || account.bank_code}</p>
                          <Badge variant={account.is_active ? 'default' : 'secondary'} className={account.is_active ? 'bg-green-500/20 text-green-400' : ''}>
                            {account.is_active ? 'เปิดใช้งาน' : 'ปิด'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-gray-400">{account.account_number}</p>
                          <button onClick={() => handleCopy(account.account_number, account.id)} className="text-gray-500 hover:text-white">
                            {copied === account.id ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                        <p className="text-sm text-gray-500">{account.account_name}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          ฝากขั้นต่ำ ฿{account.min_deposit?.toLocaleString()} - สูงสุด ฿{account.max_deposit?.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          setEditingAccount(account);
                          setAccountType(account.account_type);
                          setBankCode(account.bank_code);
                          setAccountNumber(account.account_number);
                          setAccountName(account.account_name);
                          setIsActive(account.is_active);
                          setMinDeposit(account.min_deposit?.toString() || '100');
                          setMaxDeposit(account.max_deposit?.toString() || '50000');
                          setShowAddDialog(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300" onClick={() => handleDelete(account.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'แก้ไขบัญชี' : 'เพิ่มบัญชีรับเงิน'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>ประเภทบัญชี</Label>
              <Select value={accountType} onValueChange={setAccountType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {accountType === 'bank' && (
              <div className="space-y-2">
                <Label>ธนาคาร</Label>
                <Select value={bankCode} onValueChange={setBankCode}>
                  <SelectTrigger><SelectValue placeholder="เลือกธนาคาร" /></SelectTrigger>
                  <SelectContent>
                    {BANK_LIST.filter(b => !['PROMPTPAY', 'TRUEWALLET'].includes(b.code)).map(bank => (
                      <SelectItem key={bank.code} value={bank.code}>{bank.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>{accountType === 'promptpay' ? 'เบอร์โทร/เลขบัตร' : accountType === 'truewallet' ? 'เบอร์โทร' : 'เลขบัญชี'}</Label>
              <Input 
                value={accountNumber} 
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder={accountType === 'bank' ? '000-0-00000-0' : '08X-XXX-XXXX'}
                className="bg-white/5 border-white/10"
              />
            </div>

            <div className="space-y-2">
              <Label>ชื่อบัญชี</Label>
              <Input 
                value={accountName} 
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="ชื่อ-นามสกุล"
                className="bg-white/5 border-white/10"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ฝากขั้นต่ำ (บาท)</Label>
                <Input 
                  type="number"
                  value={minDeposit} 
                  onChange={(e) => setMinDeposit(e.target.value)}
                  className="bg-white/5 border-white/10"
                />
              </div>
              <div className="space-y-2">
                <Label>ฝากสูงสุด (บาท)</Label>
                <Input 
                  type="number"
                  value={maxDeposit} 
                  onChange={(e) => setMaxDeposit(e.target.value)}
                  className="bg-white/5 border-white/10"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>เปิดใช้งาน</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-black">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingAccount ? 'บันทึก' : 'เพิ่มบัญชี'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
