'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { 
  Wallet, Plus, Settings, Trash2, Copy, Check, 
  Building2, CreditCard, ArrowUpDown, Shield,
  RefreshCw, Loader2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Types
interface BankAccount {
  id: string;
  site_id: string;
  site_name: string;
  bank_code: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  account_type: 'deposit' | 'withdrawal' | 'both';
  is_active: boolean;
  balance: number;
  created_at: string;
}

const BANKS = [
  { code: 'SCB', name: 'ธนาคารไทยพาณิชย์' },
  { code: 'KBANK', name: 'ธนาคารกสิกรไทย' },
  { code: 'BBL', name: 'ธนาคารกรุงเทพ' },
  { code: 'KTB', name: 'ธนาคารกรุงไทย' },
  { code: 'TMB', name: 'ธนาคารทหารไทยธนชาต' },
  { code: 'GSB', name: 'ธนาคารออมสิน' },
];

export default function WalletManagerPage() {
  // Fetch real data from API
  const { data: accountsData, error: accountsError, isLoading, mutate } = useSWR('/api/bank-accounts', fetcher);
  const { data: tenantsData } = useSWR('/api/tenants', fetcher);

  const bankAccounts: BankAccount[] = accountsData?.accounts || [];
  const tenants = tenantsData?.tenants || [];

  const [showAddBank, setShowAddBank] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    site_id: 'master',
    bank_code: '',
    account_number: '',
    account_name: '',
    account_type: 'both',
    balance: '',
  });

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleSubmit = async () => {
    if (!formData.bank_code || !formData.account_number || !formData.account_name) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedBank = BANKS.find(b => b.code === formData.bank_code);
      const selectedTenant = tenants.find((t: any) => t.id === formData.site_id);

      const res = await fetch('/api/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_id: formData.site_id,
          site_name: selectedTenant?.name || 'Master',
          bank_code: formData.bank_code,
          bank_name: selectedBank?.name || formData.bank_code,
          account_number: formData.account_number,
          account_name: formData.account_name,
          account_type: formData.account_type,
          balance: parseFloat(formData.balance) || 0,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('เพิ่มบัญชีสำเร็จ');
        setShowAddBank(false);
        setFormData({
          site_id: 'master',
          bank_code: '',
          account_number: '',
          account_name: '',
          account_type: 'both',
          balance: '',
        });
        mutate();
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalBalance = bankAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6 -m-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            จัดการกระเป๋าเงิน
          </h1>
          <p className="text-gray-600 mt-1">จัดการบัญชีธนาคารและ API Tokens แยกตาม Site ID</p>
        </div>
        <Badge className="bg-emerald-100 text-emerald-700 px-4 py-2 text-sm border border-emerald-200">
          <Shield className="size-4 mr-2" />
          AES-256 Encrypted
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-amber-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Wallet className="size-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">ยอดรวมทุกบัญชี</p>
                <p className="text-xl font-bold text-amber-600">
                  {isLoading ? '...' : `฿${formatCurrency(totalBalance)}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-emerald-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <ArrowUpDown className="size-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Net Flow (MTD)</p>
                <p className="text-xl font-bold text-emerald-600">฿0</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-blue-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Building2 className="size-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">บัญชีทั้งหมด</p>
                <p className="text-xl font-bold text-blue-600">
                  {isLoading ? '...' : `${bankAccounts.length} บัญชี`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-purple-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <CreditCard className="size-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">API Tokens</p>
                <p className="text-xl font-bold text-purple-600">0 tokens</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList className="bg-white border border-gray-200">
          <TabsTrigger value="accounts" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">
            <Building2 className="size-4 mr-2" />
            บัญชีธนาคาร
          </TabsTrigger>
          <TabsTrigger value="tokens" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">
            <CreditCard className="size-4 mr-2" />
            API Tokens
          </TabsTrigger>
          <TabsTrigger value="routing" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">
            <ArrowUpDown className="size-4 mr-2" />
            Money Routing
          </TabsTrigger>
        </TabsList>

        {/* Bank Accounts Tab */}
        <TabsContent value="accounts" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">บัญชีธนาคารทั้งหมด</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => mutate()}>
                <RefreshCw className="size-4 mr-2" />
                รีเฟรช
              </Button>
              <Dialog open={showAddBank} onOpenChange={setShowAddBank}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold">
                    <Plus className="size-4 mr-2" />
                    เพิ่มบัญชี
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white">
                  <DialogHeader>
                    <DialogTitle className="text-amber-600">เพิ่มบัญชีธนาคารใหม่</DialogTitle>
                    <DialogDescription>กรอกข้อมูลบัญชีธนาคาร</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Site</Label>
                      <Select 
                        value={formData.site_id} 
                        onValueChange={(v) => setFormData(prev => ({ ...prev, site_id: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="เลือก Site" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="master">Master (เว็บหลัก)</SelectItem>
                          {tenants.map((tenant: any) => (
                            <SelectItem key={tenant.id} value={tenant.id}>
                              {tenant.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>ธนาคาร *</Label>
                      <Select 
                        value={formData.bank_code} 
                        onValueChange={(v) => setFormData(prev => ({ ...prev, bank_code: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกธนาคาร" />
                        </SelectTrigger>
                        <SelectContent>
                          {BANKS.map((bank) => (
                            <SelectItem key={bank.code} value={bank.code}>
                              {bank.name} ({bank.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>เลขบัญชี *</Label>
                      <Input 
                        placeholder="XXX-X-XXXXX-X" 
                        value={formData.account_number}
                        onChange={(e) => setFormData(prev => ({ ...prev, account_number: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>ชื่อบัญชี *</Label>
                      <Input 
                        placeholder="ชื่อบัญชี" 
                        value={formData.account_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, account_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>ประเภทการใช้งาน</Label>
                      <Select 
                        value={formData.account_type} 
                        onValueChange={(v) => setFormData(prev => ({ ...prev, account_type: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกประเภท" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deposit">รับฝากเท่านั้น</SelectItem>
                          <SelectItem value="withdrawal">ถอนเท่านั้น</SelectItem>
                          <SelectItem value="both">ทั้งฝากและถอน</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>ยอดเงินเริ่มต้น</Label>
                      <Input 
                        type="number"
                        placeholder="0" 
                        value={formData.balance}
                        onChange={(e) => setFormData(prev => ({ ...prev, balance: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddBank(false)}>ยกเลิก</Button>
                    <Button 
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="bg-amber-500 hover:bg-amber-600 text-white"
                    >
                      {isSubmitting ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
                      บันทึก
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card className="bg-white shadow-sm">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-8 animate-spin text-amber-500" />
              </div>
            ) : accountsError ? (
              <div className="text-center py-12 text-red-500">
                เกิดข้อผิดพลาดในการโหลดข้อมูล
              </div>
            ) : bankAccounts.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="size-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">ยังไม่มีบัญชีธนาคาร</p>
                <p className="text-sm text-gray-400 mt-1">กดปุ่ม "เพิ่มบัญชี" เพื่อเริ่มต้น</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead>ธนาคาร</TableHead>
                    <TableHead>เลขบัญชี</TableHead>
                    <TableHead>ชื่อบัญชี</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead className="text-right">ยอดคงเหลือ</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bankAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {account.site_id === 'master' && (
                            <Badge className="bg-amber-100 text-amber-700 text-xs">MASTER</Badge>
                          )}
                          <span>{account.site_name || 'Master'}</span>
                        </div>
                      </TableCell>
                      <TableCell>{account.bank_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {account.account_number}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="size-6 p-0"
                            onClick={() => copyToClipboard(account.account_number, account.id)}
                          >
                            {copiedId === account.id ? (
                              <Check className="size-3 text-emerald-500" />
                            ) : (
                              <Copy className="size-3 text-gray-400" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{account.account_name}</TableCell>
                      <TableCell>
                        <Badge className={cn(
                          "text-xs",
                          account.account_type === 'deposit' && "bg-emerald-100 text-emerald-700",
                          account.account_type === 'withdrawal' && "bg-orange-100 text-orange-700",
                          account.account_type === 'both' && "bg-blue-100 text-blue-700",
                        )}>
                          {account.account_type === 'deposit' && 'ฝาก'}
                          {account.account_type === 'withdrawal' && 'ถอน'}
                          {account.account_type === 'both' && 'ฝาก/ถอน'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-emerald-600 font-mono font-bold">
                          ฿{formatCurrency(account.balance || 0)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {account.is_active ? (
                          <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="size-8 p-0">
                            <Settings className="size-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="size-8 p-0 text-red-500 hover:text-red-600">
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* API Tokens Tab */}
        <TabsContent value="tokens" className="space-y-4">
          <Card className="bg-white shadow-sm">
            <div className="text-center py-12">
              <CreditCard className="size-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">ยังไม่มี API Tokens</p>
              <p className="text-sm text-gray-400 mt-1">กรุณาเพิ่ม API Token เพื่อเชื่อมต่อกับธนาคาร</p>
            </div>
          </Card>
        </TabsContent>

        {/* Money Routing Tab */}
        <TabsContent value="routing" className="space-y-4">
          <Card className="bg-white shadow-sm">
            <div className="text-center py-12">
              <ArrowUpDown className="size-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">ยังไม่มีการตั้งค่า Money Routing</p>
              <p className="text-sm text-gray-400 mt-1">กรุณาเพิ่มบัญชีธนาคารก่อน</p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
