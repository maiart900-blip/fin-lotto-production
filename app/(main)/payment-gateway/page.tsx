'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  CreditCard, 
  Settings,
  Plus,
  Trash2,
  Edit,
  CheckCircle2,
  XCircle,
  QrCode,
  Banknote,
  Shield,
  Zap,
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface GatewaySettings {
  id: string;
  provider: string;
  name: string;
  api_key: string;
  secret_key: string;
  merchant_id: string;
  promptpay_id: string;
  callback_url: string;
  auto_deposit: boolean;
  auto_withdraw: boolean;
  auto_withdraw_limit: number;
  daily_limit: number;
  min_deposit: number;
  max_deposit: number;
  min_withdraw: number;
  max_withdraw: number;
  is_active: boolean;
  created_at: string;
}

const providerOptions = [
  { value: 'promptpay', label: 'PromptPay QR', icon: QrCode },
  { value: 'truewallet', label: 'TrueMoney Wallet', icon: Banknote },
  { value: 'bank_api', label: 'Bank API (SCB/KBANK)', icon: CreditCard },
  { value: 'custom', label: 'Custom Gateway', icon: Settings },
];

export default function PaymentGatewayPage() {
  const { data: gateways, error, isLoading, mutate } = useSWR<GatewaySettings[]>('/api/payment-gateway', fetcher);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGateway, setEditingGateway] = useState<GatewaySettings | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    provider: 'promptpay',
    name: '',
    api_key: '',
    secret_key: '',
    merchant_id: '',
    promptpay_id: '',
    callback_url: '',
    auto_deposit: true,
    auto_withdraw: false,
    auto_withdraw_limit: 5000,
    daily_limit: 100000,
    min_deposit: 100,
    max_deposit: 50000,
    min_withdraw: 100,
    max_withdraw: 50000,
  });

  const resetForm = () => {
    setFormData({
      provider: 'promptpay',
      name: '',
      api_key: '',
      secret_key: '',
      merchant_id: '',
      promptpay_id: '',
      callback_url: '',
      auto_deposit: true,
      auto_withdraw: false,
      auto_withdraw_limit: 5000,
      daily_limit: 100000,
      min_deposit: 100,
      max_deposit: 50000,
      min_withdraw: 100,
      max_withdraw: 50000,
    });
    setEditingGateway(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (gateway: GatewaySettings) => {
    setEditingGateway(gateway);
    setFormData({
      provider: gateway.provider,
      name: gateway.name,
      api_key: gateway.api_key,
      secret_key: gateway.secret_key,
      merchant_id: gateway.merchant_id,
      promptpay_id: gateway.promptpay_id,
      callback_url: gateway.callback_url,
      auto_deposit: gateway.auto_deposit,
      auto_withdraw: gateway.auto_withdraw,
      auto_withdraw_limit: gateway.auto_withdraw_limit,
      daily_limit: gateway.daily_limit,
      min_deposit: gateway.min_deposit,
      max_deposit: gateway.max_deposit,
      min_withdraw: gateway.min_withdraw,
      max_withdraw: gateway.max_withdraw,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error('กรุณากรอกชื่อ Gateway');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = '/api/payment-gateway';
      const method = editingGateway ? 'PUT' : 'POST';
      const body = editingGateway 
        ? { id: editingGateway.id, ...formData }
        : formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to save');

      toast.success(editingGateway ? 'อัพเดทสำเร็จ' : 'เพิ่ม Gateway สำเร็จ');
      setIsDialogOpen(false);
      resetForm();
      mutate();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ยืนยันการลบ Gateway นี้?')) return;

    try {
      const res = await fetch(`/api/payment-gateway?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');

      toast.success('ลบสำเร็จ');
      mutate();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const toggleActive = async (gateway: GatewaySettings) => {
    try {
      const res = await fetch('/api/payment-gateway', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: gateway.id, is_active: !gateway.is_active }),
      });

      if (!res.ok) throw new Error('Failed to update');

      toast.success(gateway.is_active ? 'ปิดใช้งานแล้ว' : 'เปิดใช้งานแล้ว');
      mutate();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('คัดลอกแล้ว');
  };

  const gatewaysList = Array.isArray(gateways) ? gateways : [];
  const activeGateways = gatewaysList.filter(g => g.is_active).length;

  // Generate webhook URL
  const webhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/webhooks/payment`
    : '/api/webhooks/payment';

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen -m-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="size-7 text-blue-600" />
            จัดการ Payment Gateway
          </h1>
          <p className="text-gray-600 mt-1">ตั้งค่าช่องทางรับ-จ่ายเงินอัตโนมัติ</p>
        </div>
        <Button onClick={openAddDialog} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="size-4 mr-2" />
          เพิ่ม Gateway
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Gateway ทั้งหมด</p>
                <p className="text-2xl font-bold text-gray-900">{gatewaysList.length}</p>
              </div>
              <CreditCard className="size-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">ใช้งานอยู่</p>
                <p className="text-2xl font-bold text-green-600">{activeGateways}</p>
              </div>
              <CheckCircle2 className="size-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">ฝากอัตโนมัติ</p>
                <p className="text-2xl font-bold text-blue-600">
                  {gatewaysList.filter(g => g.auto_deposit && g.is_active).length}
                </p>
              </div>
              <QrCode className="size-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">ถอนอัตโนมัติ</p>
                <p className="text-2xl font-bold text-amber-600">
                  {gatewaysList.filter(g => g.auto_withdraw && g.is_active).length}
                </p>
              </div>
              <Zap className="size-8 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Webhook URL Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-blue-700 text-sm flex items-center gap-2">
            <Shield className="size-4" />
            Webhook URL สำหรับรับ Callback
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white px-3 py-2 rounded border border-blue-200 text-sm font-mono text-gray-800">
              {webhookUrl}
            </code>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => copyToClipboard(webhookUrl)}
              className="border-blue-300"
            >
              <Copy className="size-4" />
            </Button>
          </div>
          <p className="text-xs text-blue-600 mt-2">
            นำ URL นี้ไปตั้งค่าใน Payment Gateway Provider ของคุณ
          </p>
        </CardContent>
      </Card>

      {/* Gateway List */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-gray-900">รายการ Payment Gateway</CardTitle>
            <Button variant="outline" size="sm" onClick={() => mutate()}>
              <RefreshCw className="size-4 mr-2" />
              รีเฟรช
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">กำลังโหลด...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">เกิดข้อผิดพลาด</div>
          ) : gatewaysList.length === 0 ? (
            <div className="text-center py-12">
              <div className="size-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <CreditCard className="size-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">ยังไม่มี Payment Gateway</h3>
              <p className="text-gray-500 mb-4">เพิ่ม Gateway เพื่อเริ่มรับ-จ่ายเงินอัตโนมัติ</p>
              <Button onClick={openAddDialog} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="size-4 mr-2" />
                เพิ่ม Gateway แรก
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {gatewaysList.map((gateway) => {
                const provider = providerOptions.find(p => p.value === gateway.provider);
                const ProviderIcon = provider?.icon || CreditCard;
                
                return (
                  <div
                    key={gateway.id}
                    className={`border rounded-lg p-4 ${
                      gateway.is_active ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`size-12 rounded-lg flex items-center justify-center ${
                          gateway.is_active ? 'bg-green-100' : 'bg-gray-200'
                        }`}>
                          <ProviderIcon className={`size-6 ${
                            gateway.is_active ? 'text-green-600' : 'text-gray-500'
                          }`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{gateway.name}</h3>
                            <Badge className={gateway.is_active 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-gray-100 text-gray-600'
                            }>
                              {gateway.is_active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500">{provider?.label || gateway.provider}</p>
                          
                          <div className="flex flex-wrap gap-2 mt-2">
                            {gateway.auto_deposit && (
                              <Badge variant="outline" className="text-xs border-blue-300 text-blue-600">
                                <QrCode className="size-3 mr-1" />
                                ฝากอัตโนมัติ
                              </Badge>
                            )}
                            {gateway.auto_withdraw && (
                              <Badge variant="outline" className="text-xs border-amber-300 text-amber-600">
                                <Zap className="size-3 mr-1" />
                                ถอนอัตโนมัติ (≤{gateway.auto_withdraw_limit.toLocaleString()})
                              </Badge>
                            )}
                          </div>

                          <div className="mt-3 text-xs text-gray-500 space-y-1">
                            {gateway.promptpay_id && (
                              <p>PromptPay: {gateway.promptpay_id}</p>
                            )}
                            <p>วงเงินต่อวัน: {gateway.daily_limit.toLocaleString()} บาท</p>
                            <p>ฝาก: {gateway.min_deposit.toLocaleString()}-{gateway.max_deposit.toLocaleString()} บาท</p>
                            <p>ถอน: {gateway.min_withdraw.toLocaleString()}-{gateway.max_withdraw.toLocaleString()} บาท</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={gateway.is_active}
                          onCheckedChange={() => toggleActive(gateway)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(gateway)}
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(gateway.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>

                    {/* API Keys (masked) */}
                    {(gateway.api_key || gateway.secret_key) && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="size-4 text-gray-400" />
                          <span className="text-xs text-gray-500">API Credentials</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => setShowSecrets(prev => ({ 
                              ...prev, 
                              [gateway.id]: !prev[gateway.id] 
                            }))}
                          >
                            {showSecrets[gateway.id] ? (
                              <EyeOff className="size-3" />
                            ) : (
                              <Eye className="size-3" />
                            )}
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-400">API Key: </span>
                            <code className="text-gray-600">
                              {showSecrets[gateway.id] 
                                ? gateway.api_key 
                                : gateway.api_key ? '••••••••' + gateway.api_key.slice(-4) : '-'
                              }
                            </code>
                          </div>
                          <div>
                            <span className="text-gray-400">Secret: </span>
                            <code className="text-gray-600">
                              {showSecrets[gateway.id] 
                                ? gateway.secret_key 
                                : gateway.secret_key ? '••••••••' + gateway.secret_key.slice(-4) : '-'
                              }
                            </code>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-blue-600" />
              {editingGateway ? 'แก้ไข Payment Gateway' : 'เพิ่ม Payment Gateway'}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">ข้อมูลพื้นฐาน</TabsTrigger>
              <TabsTrigger value="credentials">API Credentials</TabsTrigger>
              <TabsTrigger value="limits">วงเงินและขีดจำกัด</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ประเภท Gateway</Label>
                  <Select 
                    value={formData.provider} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, provider: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {providerOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>ชื่อ Gateway *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="เช่น PromptPay หลัก"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>PromptPay ID (เบอร์โทร/เลขบัตรประชาชน)</Label>
                <Input
                  value={formData.promptpay_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, promptpay_id: e.target.value }))}
                  placeholder="0812345678"
                />
              </div>

              <div className="space-y-2">
                <Label>Callback URL</Label>
                <Input
                  value={formData.callback_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, callback_url: e.target.value }))}
                  placeholder="https://your-domain.com/api/webhooks/payment"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">ฝากเงินอัตโนมัติ</p>
                  <p className="text-sm text-gray-500">เปิดรับเงินผ่าน QR Code อัตโนมัติ</p>
                </div>
                <Switch
                  checked={formData.auto_deposit}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, auto_deposit: v }))}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">ถอนเงินอัตโนมัติ</p>
                  <p className="text-sm text-gray-500">อนุมัติการถอนอัตโนมัติตามเงื่อนไข</p>
                </div>
                <Switch
                  checked={formData.auto_withdraw}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, auto_withdraw: v }))}
                />
              </div>

              {formData.auto_withdraw && (
                <div className="p-4 border border-amber-200 rounded-lg bg-amber-50/50">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="size-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">วงเงินถอนอัตโนมัติ</span>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-amber-700">ยอดไม่เกิน (บาท)</Label>
                    <Input
                      type="number"
                      value={formData.auto_withdraw_limit}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        auto_withdraw_limit: Number(e.target.value) 
                      }))}
                      className="bg-white"
                    />
                    <p className="text-xs text-amber-600">
                      ยอดถอนไม่เกินจำนวนนี้จะอนุมัติอัตโนมัติ
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="credentials" className="space-y-4 mt-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="size-4 text-red-600" />
                  <span className="text-sm font-medium text-red-800">ข้อมูลลับ</span>
                </div>
                <p className="text-xs text-red-600">
                  ข้อมูลนี้จะถูกเข้ารหัสก่อนบันทึก กรุณาเก็บรักษาไว้อย่างปลอดภัย
                </p>
              </div>

              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={formData.api_key}
                  onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                  placeholder="sk_live_..."
                />
              </div>

              <div className="space-y-2">
                <Label>Secret Key</Label>
                <Input
                  type="password"
                  value={formData.secret_key}
                  onChange={(e) => setFormData(prev => ({ ...prev, secret_key: e.target.value }))}
                  placeholder="whsec_..."
                />
              </div>

              <div className="space-y-2">
                <Label>Merchant ID</Label>
                <Input
                  value={formData.merchant_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, merchant_id: e.target.value }))}
                  placeholder="MERCHANT123"
                />
              </div>
            </TabsContent>

            <TabsContent value="limits" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>วงเงินต่อวัน (บาท)</Label>
                <Input
                  type="number"
                  value={formData.daily_limit}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    daily_limit: Number(e.target.value) 
                  }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ฝากขั้นต่ำ (บาท)</Label>
                  <Input
                    type="number"
                    value={formData.min_deposit}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      min_deposit: Number(e.target.value) 
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ฝากสูงสุด (บาท)</Label>
                  <Input
                    type="number"
                    value={formData.max_deposit}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      max_deposit: Number(e.target.value) 
                    }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ถอนขั้นต่ำ (บาท)</Label>
                  <Input
                    type="number"
                    value={formData.min_withdraw}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      min_withdraw: Number(e.target.value) 
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ถอนสูงสุด (บาท)</Label>
                  <Input
                    type="number"
                    value={formData.max_withdraw}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      max_withdraw: Number(e.target.value) 
                    }))}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? 'กำลังบันทึก...' : editingGateway ? 'บันทึกการแก้ไข' : 'เพิ่ม Gateway'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
