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
  CreditCard,
  CheckCircle2,
  XCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
} from 'lucide-react';
import { toast } from 'sonner';

interface BankConfig {
  id: string;
  bank_code: string;
  bank_name: string;
  bank_name_th: string;
  is_active: boolean;
  supports_deposit: boolean;
  supports_withdraw: boolean;
  min_deposit: number;
  max_deposit: number;
  min_withdraw: number;
  max_withdraw: number;
  daily_deposit_limit: number;
  daily_withdraw_limit: number;
  created_at: string;
}

const THAI_BANKS = [
  { code: 'SCB', name: 'Siam Commercial Bank', nameTh: 'ธนาคารไทยพาณิชย์' },
  { code: 'KBANK', name: 'Kasikorn Bank', nameTh: 'ธนาคารกสิกรไทย' },
  { code: 'KTB', name: 'Krung Thai Bank', nameTh: 'ธนาคารกรุงไทย' },
  { code: 'BBL', name: 'Bangkok Bank', nameTh: 'ธนาคารกรุงเทพ' },
  { code: 'BAY', name: 'Bank of Ayudhya', nameTh: 'ธนาคารกรุงศรีอยุธยา' },
  { code: 'TMB', name: 'TMBThanachart Bank', nameTh: 'ธนาคารทีเอ็มบีธนชาต' },
  { code: 'GSB', name: 'Government Savings Bank', nameTh: 'ธนาคารออมสิน' },
  { code: 'BAAC', name: 'Bank for Agriculture', nameTh: 'ธ.ก.ส.' },
  { code: 'CIMB', name: 'CIMB Thai', nameTh: 'ธนาคารซีไอเอ็มบี' },
  { code: 'UOB', name: 'UOB', nameTh: 'ธนาคารยูโอบี' },
  { code: 'TBANK', name: 'Thanachart Bank', nameTh: 'ธนาคารธนชาต' },
  { code: 'LHBANK', name: 'Land and Houses Bank', nameTh: 'ธนาคารแลนด์ แอนด์ เฮ้าส์' },
];

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function BankSettingsPage() {
  const { data: banks = [], mutate, isLoading } = useSWR<BankConfig[]>('/api/bank-settings', fetcher);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<BankConfig | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    bank_code: '',
    supports_deposit: true,
    supports_withdraw: true,
    min_deposit: 100,
    max_deposit: 50000,
    min_withdraw: 100,
    max_withdraw: 50000,
    daily_deposit_limit: 500000,
    daily_withdraw_limit: 500000,
  });

  const openAddDialog = () => {
    setEditingBank(null);
    setFormData({
      bank_code: '',
      supports_deposit: true,
      supports_withdraw: true,
      min_deposit: 100,
      max_deposit: 50000,
      min_withdraw: 100,
      max_withdraw: 50000,
      daily_deposit_limit: 500000,
      daily_withdraw_limit: 500000,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (bank: BankConfig) => {
    setEditingBank(bank);
    setFormData({
      bank_code: bank.bank_code,
      supports_deposit: bank.supports_deposit,
      supports_withdraw: bank.supports_withdraw,
      min_deposit: bank.min_deposit,
      max_deposit: bank.max_deposit,
      min_withdraw: bank.min_withdraw,
      max_withdraw: bank.max_withdraw,
      daily_deposit_limit: bank.daily_deposit_limit,
      daily_withdraw_limit: bank.daily_withdraw_limit,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.bank_code) {
      toast.error('กรุณาเลือกธนาคาร');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedBank = THAI_BANKS.find(b => b.code === formData.bank_code);
      const payload = {
        ...formData,
        bank_name: selectedBank?.name,
        bank_name_th: selectedBank?.nameTh,
      };

      const res = await fetch('/api/bank-settings', {
        method: editingBank ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingBank ? { id: editingBank.id, ...payload } : payload),
      });

      if (!res.ok) throw new Error('Failed');

      toast.success(editingBank ? 'อัพเดทการตั้งค่าสำเร็จ' : 'เพิ่มธนาคารสำเร็จ');
      setIsDialogOpen(false);
      mutate();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (bank: BankConfig) => {
    try {
      const res = await fetch('/api/bank-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bank.id, is_active: !bank.is_active }),
      });

      if (!res.ok) throw new Error('Failed');

      toast.success(bank.is_active ? 'ปิดใช้งานแล้ว' : 'เปิดใช้งานแล้ว');
      mutate();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ยืนยันการลบธนาคารนี้?')) return;

    try {
      const res = await fetch(`/api/bank-settings?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');

      toast.success('ลบธนาคารสำเร็จ');
      mutate();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('th-TH').format(amount);
  };

  const activeCount = banks.filter(b => b.is_active).length;
  const depositBanks = banks.filter(b => b.supports_deposit && b.is_active).length;
  const withdrawBanks = banks.filter(b => b.supports_withdraw && b.is_active).length;

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen -m-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Landmark className="size-7 text-blue-600" />
            ตั้งค่าธนาคาร
          </h1>
          <p className="text-gray-600 mt-1">จัดการธนาคารและวงเงินสำหรับรับ-จ่ายเงิน</p>
        </div>
        <Button onClick={openAddDialog} className="bg-[#D4AF37] hover:bg-[#B8860B] text-black">
          <Plus className="size-4 mr-2" />
          เพิ่มธนาคาร
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">ธนาคารทั้งหมด</p>
                <p className="text-3xl font-bold text-gray-900">{banks.length}</p>
              </div>
              <Building2 className="size-10 text-blue-500/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">เปิดใช้งาน</p>
                <p className="text-3xl font-bold text-green-600">{activeCount}</p>
              </div>
              <CheckCircle2 className="size-10 text-green-500/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">รับฝาก</p>
                <p className="text-3xl font-bold text-emerald-600">{depositBanks}</p>
              </div>
              <ArrowDownToLine className="size-10 text-emerald-500/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">ถอนได้</p>
                <p className="text-3xl font-bold text-orange-600">{withdrawBanks}</p>
              </div>
              <ArrowUpFromLine className="size-10 text-orange-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bank List */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-gray-900">รายการธนาคาร</CardTitle>
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </CardHeader>
        <CardContent>
          {banks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CreditCard className="size-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">ยังไม่มีธนาคารในระบบ</p>
              <p className="text-sm mt-1">กดปุ่ม &quot;เพิ่มธนาคาร&quot; เพื่อเริ่มตั้งค่า</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>ธนาคาร</TableHead>
                  <TableHead>รับฝาก</TableHead>
                  <TableHead>ถอน</TableHead>
                  <TableHead>วงเงินฝาก</TableHead>
                  <TableHead>วงเงินถอน</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {banks.map((bank) => (
                  <TableRow key={bank.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-gray-900">{bank.bank_name_th}</div>
                        <div className="text-xs text-gray-500">{bank.bank_code}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {bank.supports_deposit ? (
                        <Badge className="bg-green-500/20 text-green-600">รับฝาก</Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-400">ปิด</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {bank.supports_withdraw ? (
                        <Badge className="bg-orange-500/20 text-orange-600">ถอนได้</Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-400">ปิด</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{formatMoney(bank.min_deposit)} - {formatMoney(bank.max_deposit)}</div>
                      <div className="text-xs text-gray-400">วันละ {formatMoney(bank.daily_deposit_limit)}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{formatMoney(bank.min_withdraw)} - {formatMoney(bank.max_withdraw)}</div>
                      <div className="text-xs text-gray-400">วันละ {formatMoney(bank.daily_withdraw_limit)}</div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={bank.is_active}
                        onCheckedChange={() => handleToggleActive(bank)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(bank)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleDelete(bank.id)}
                        >
                          <Trash2 className="size-4" />
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="size-5 text-blue-600" />
              {editingBank ? 'แก้ไขการตั้งค่าธนาคาร' : 'เพิ่มธนาคาร'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>ธนาคาร</Label>
              <Select
                value={formData.bank_code}
                onValueChange={(value) => setFormData(prev => ({ ...prev, bank_code: value }))}
                disabled={!!editingBank}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกธนาคาร" />
                </SelectTrigger>
                <SelectContent>
                  {THAI_BANKS.map((bank) => (
                    <SelectItem key={bank.code} value={bank.code}>
                      {bank.nameTh} ({bank.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <Label>รับฝาก</Label>
                <Switch
                  checked={formData.supports_deposit}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, supports_deposit: checked }))}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <Label>ถอนได้</Label>
                <Switch
                  checked={formData.supports_withdraw}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, supports_withdraw: checked }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ฝากขั้นต่ำ</Label>
                <Input
                  type="number"
                  value={formData.min_deposit}
                  onChange={(e) => setFormData(prev => ({ ...prev, min_deposit: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>ฝากสูงสุด</Label>
                <Input
                  type="number"
                  value={formData.max_deposit}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_deposit: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ถอนขั้นต่ำ</Label>
                <Input
                  type="number"
                  value={formData.min_withdraw}
                  onChange={(e) => setFormData(prev => ({ ...prev, min_withdraw: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>ถอนสูงสุด</Label>
                <Input
                  type="number"
                  value={formData.max_withdraw}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_withdraw: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>วงเงินฝากต่อวัน</Label>
                <Input
                  type="number"
                  value={formData.daily_deposit_limit}
                  onChange={(e) => setFormData(prev => ({ ...prev, daily_deposit_limit: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>วงเงินถอนต่อวัน</Label>
                <Input
                  type="number"
                  value={formData.daily_withdraw_limit}
                  onChange={(e) => setFormData(prev => ({ ...prev, daily_withdraw_limit: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-[#D4AF37] hover:bg-[#B8860B] text-black"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="size-4 mr-2 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : editingBank ? (
                'บันทึก'
              ) : (
                'เพิ่มธนาคาร'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
