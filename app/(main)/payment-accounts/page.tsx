'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogTrigger,
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
  QrCode,
  CreditCard,
  Building2,
  Smartphone,
  Eye,
  Loader2,
  Upload,
  Store,
  CheckCircle,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

interface PaymentAccount {
  id: string;
  account_name: string;
  bank_name: string;
  account_number: string | null;
  promptpay_number: string | null;
  qr_image_url: string | null;
  is_active: boolean;
  is_qr_only: boolean;
  note: string | null;
  sort_order: number;
  created_at: string;
  merchant_id?: string | null;
  phone_number?: string | null;
  qr_mode?: 'upload' | 'merchant_id' | 'promptpay';
  gateway_provider?: string | null;
  display_mode?: 'qr_only' | 'qr_with_bank' | 'bank_only';
}

const BANK_OPTIONS = [
  { value: 'scb', label: 'SCB (ไทยพาณิชย์)', color: 'bg-purple-500' },
  { value: 'scb_maemani', label: 'SCB แม่มณี', color: 'bg-purple-600' },
  { value: 'kbank', label: 'KBANK (กสิกรไทย)', color: 'bg-green-500' },
  { value: 'bbl', label: 'BBL (กรุงเทพ)', color: 'bg-blue-700' },
  { value: 'ktb', label: 'KTB (กรุงไทย)', color: 'bg-blue-500' },
  { value: 'bay', label: 'BAY (กรุงศรี)', color: 'bg-yellow-500' },
  { value: 'ttb', label: 'TTB (ทหารไทยธนชาต)', color: 'bg-blue-400' },
  { value: 'gsb', label: 'GSB (ออมสิน)', color: 'bg-pink-500' },
  { value: 'promptpay', label: 'พร้อมเพย์', color: 'bg-blue-600' },
  { value: 'truemoney', label: 'TrueMoney Wallet', color: 'bg-orange-500' },
  { value: 'qr_promptpay', label: 'QR พร้อมเพย์', color: 'bg-indigo-500' },
  { value: 'other', label: 'อื่นๆ', color: 'bg-gray-500' },
];

const QR_MODES = [
  { value: 'upload', label: 'อัปโหลด QR', icon: Upload, description: 'อัปโหลดรูป QR Code เอง', color: 'bg-gray-100' },
  { value: 'merchant_id', label: 'Merchant ID', icon: Store, description: 'ใส่ Merchant ID สร้าง QR อัตโนมัติ', color: 'bg-purple-100' },
  { value: 'promptpay', label: 'PromptPay', icon: Smartphone, description: 'ใส่เบอร์โทร/บัตร ปชช. สร้าง QR อัตโนมัติ', color: 'bg-blue-100' },
];

const DISPLAY_MODES = [
  { value: 'qr_only', label: 'แสดงเฉพาะ QR', description: 'ลูกค้าเห็นเฉพาะ QR Code ไม่เห็นเลขบัญชี', color: 'text-purple-600' },
  { value: 'qr_with_bank', label: 'QR + ข้อมูลบัญชี', description: 'ลูกค้าเห็นทั้ง QR และเลขบัญชี', color: 'text-blue-600' },
  { value: 'bank_only', label: 'บัญชีเท่านั้น', description: 'ลูกค้าเห็นเฉพาะเลขบัญชี ไม่แสดง QR', color: 'text-green-600' },
];

const GATEWAY_PROVIDERS = [
  { value: 'scb', label: 'SCB Payment' },
  { value: 'kbank', label: 'K PLUS' },
  { value: 'promptpay', label: 'Thai QR' },
  { value: 'askme_pay', label: 'AskmePay' },
  { value: 'gbprimepay', label: 'GB Prime Pay' },
];

const fetcher = async (url: string) => {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

export default function PaymentAccountsPage() {
  const { data: accounts = [], mutate, isLoading, error } = useSWR<PaymentAccount[]>('/api/payment-accounts', fetcher, {
    fallbackData: [],
    revalidateOnFocus: false,
    shouldRetryOnError: true,
    errorRetryCount: 3,
  });
  
  // Safe accounts - always an array
  const safeAccounts = Array.isArray(accounts) ? accounts : [];
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<PaymentAccount | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [previewQrUrl, setPreviewQrUrl] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    account_name: '',
    bank_name: '',
    account_number: '',
    promptpay_number: '',
    qr_image_url: '',
    note: '',
    is_active: true,
    qr_mode: 'upload' as 'upload' | 'merchant_id' | 'promptpay',
    merchant_id: '',
    phone_number: '',
    gateway_provider: '',
    display_mode: 'qr_with_bank' as 'qr_only' | 'qr_with_bank' | 'bank_only',
  });
  const [qrRetryCount, setQrRetryCount] = useState(0); // ใช้บังคับ re-render img
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file'); // เลือกวิธีอัปโหลด

  const resetForm = () => {
    setFormData({
      account_name: '',
      bank_name: '',
      account_number: '',
      promptpay_number: '',
      qr_image_url: '',
      note: '',
      is_active: true,
      qr_mode: 'upload',
      merchant_id: '',
      phone_number: '',
      gateway_provider: '',
      display_mode: 'qr_with_bank',
    });
    setPreviewQrUrl(null);
    setQrRetryCount(0);
    setUploadMode('file');
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('รองรับเฉพาะไฟล์ PNG, JPG, JPEG หรือ WebP เท่านั้น');
      return;
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('ไฟล์ใหญ่เกินไป ขนาดสูงสุด 2MB');
      return;
    }

    setIsUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const res = await fetch('/api/upload/qr', {
        method: 'POST',
        body: formDataUpload,
      });

      const data = await res.json();
      
      if (data.success && data.url) {
        setFormData({ ...formData, qr_image_url: data.url });
        setPreviewQrUrl(data.url);
        toast.success('อัปโหลด QR Code สำเร็จ');
      } else {
        toast.error(data.error || 'อัปโหลดไม่สำเร็จ');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการอัปโหลด');
    } finally {
      setIsUploading(false);
    }
  };

  // Generate QR Preview
  const handleGenerateQrPreview = async () => {
    setIsGeneratingQr(true);
    try {
      let type: string;
      let target: string | undefined;
      let mid: string | undefined;

      if (formData.qr_mode === 'promptpay') {
        type = 'promptpay';
        target = formData.promptpay_number || formData.phone_number;
        if (!target) {
          toast.error('กรุณากรอกเบอร์โทรหรือเลขบัตรประชาชน');
          setIsGeneratingQr(false);
          return;
        }
      } else if (formData.qr_mode === 'merchant_id') {
        type = 'merchant_id';
        mid = formData.merchant_id;
        if (!mid) {
          toast.error('กรุณากรอก Merchant ID');
          setIsGeneratingQr(false);
          return;
        }
      } else {
        // Upload mode - just show the URL
        if (formData.qr_image_url) {
          setPreviewQrUrl(formData.qr_image_url);
        }
        setIsGeneratingQr(false);
        return;
      }

      const res = await fetch('/api/payment-accounts/generate-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, target, merchantId: mid, size: 300 }),
      });

      const data = await res.json();
      if (data.success) {
        setPreviewQrUrl(data.qrUrl);
        toast.success('สร้าง QR Code สำเร็จ');
      } else {
        toast.error(data.error || 'ไม่สามารถสร้าง QR ได้');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsGeneratingQr(false);
    }
  };

  // Update preview when URL changes in upload mode
  useEffect(() => {
    if (formData.qr_mode === 'upload' && formData.qr_image_url) {
      setPreviewQrUrl(formData.qr_image_url);
    }
  }, [formData.qr_image_url, formData.qr_mode]);

  const handleAdd = async () => {
    // Validation
    if (!formData.account_name) {
      toast.error('กรุณากรอกชื่อบัญชี/ร้านค้า');
      return;
    }

    // Validation ตาม qr_mode
    if (formData.qr_mode === 'upload') {
      // ต้องมี URL รูป QR ที่ valid
      if (!formData.qr_image_url) {
        toast.error('กรุณาใส่ URL รูป QR Code');
        return;
      }
      if (!formData.qr_image_url.startsWith('https://')) {
        toast.error('URL ต้องขึ้นต้นด้วย https://');
        return;
      }
      if (!previewQrUrl) {
        toast.error('รูป QR ยังไม่โหลด กรุณารอให้รูปแสดงก่อนบันทึก');
        return;
      }
    }
    if (formData.qr_mode === 'merchant_id' && !formData.merchant_id) {
      toast.error('กรุณากรอก Merchant ID');
      return;
    }
    if (formData.qr_mode === 'promptpay' && !formData.promptpay_number && !formData.phone_number) {
      toast.error('กรุณากรอกเบอร์โทรหรือเลขบัตรประชาชน');
      return;
    }

    // ถ้าเปิด is_active ต้องมีข้อมูลครบตาม qr_mode
    if (formData.is_active) {
      if (formData.qr_mode === 'upload' && !formData.qr_image_url) {
        toast.error('ไม่สามารถเปิดใช้งานได้ เนื่องจากยังไม่มี QR Code');
        return;
      }
      if (formData.qr_mode === 'merchant_id' && !formData.merchant_id) {
        toast.error('ไม่สามารถเปิดใช้งานได้ เนื่องจากยังไม่มี Merchant ID');
        return;
      }
      if (formData.qr_mode === 'promptpay' && !formData.promptpay_number && !formData.phone_number) {
        toast.error('ไม่สามารถเปิดใช้งานได้ เนื่องจากยังไม่มีเบอร์ PromptPay');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/payment-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_name: formData.account_name,
          bank_name: formData.bank_name || (formData.qr_mode === 'promptpay' ? 'promptpay' : 'scb'),
          account_number: formData.account_number || null,
          promptpay_number: formData.promptpay_number || formData.phone_number || null,
          qr_image_url: formData.qr_image_url || previewQrUrl || null,
          note: formData.note || null,
          is_active: formData.is_active,
          is_qr_only: formData.qr_mode !== 'upload',
          qr_mode: formData.qr_mode,
          merchant_id: formData.merchant_id || null,
          phone_number: formData.phone_number || null,
          gateway_provider: formData.gateway_provider || null,
          display_mode: formData.display_mode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create');
      }

      toast.success('เพิ่มบัญชีรับเงินสำเร็จ');
      mutate();
      setIsAddOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedAccount) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/payment-accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedAccount.id,
          account_name: formData.account_name,
          bank_name: formData.bank_name,
          account_number: formData.account_number || null,
          promptpay_number: formData.promptpay_number || null,
          qr_image_url: formData.qr_image_url || previewQrUrl || null,
          note: formData.note || null,
          is_active: formData.is_active,
          is_qr_only: formData.qr_mode !== 'upload',
          qr_mode: formData.qr_mode,
          merchant_id: formData.merchant_id || null,
          phone_number: formData.phone_number || null,
          gateway_provider: formData.gateway_provider || null,
          display_mode: formData.display_mode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update');
      }

      toast.success('แก้ไขบัญชีรับเงินสำเร็จ');
      mutate();
      setIsEditOpen(false);
      setSelectedAccount(null);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAccount) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/payment-accounts?id=${selectedAccount.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }

      toast.success('ลบบัญชีรับเงินสำเร็จ');
      mutate();
      setIsDeleteOpen(false);
      setSelectedAccount(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (account: PaymentAccount) => {
    try {
      const res = await fetch('/api/payment-accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: account.id, is_active: !account.is_active }),
      });

      if (!res.ok) throw new Error('Failed to update');

      toast.success(account.is_active ? 'ปิดใช้งานบัญชีแล้ว' : 'เปิดใช้งานบัญชีแล้ว');
      mutate();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const openEdit = (account: PaymentAccount) => {
    setSelectedAccount(account);
    setFormData({
      account_name: account.account_name,
      bank_name: account.bank_name,
      account_number: account.account_number || '',
      promptpay_number: account.promptpay_number || '',
      qr_image_url: account.qr_image_url || '',
      note: account.note || '',
      is_active: account.is_active,
      qr_mode: account.qr_mode || 'upload',
      merchant_id: account.merchant_id || '',
      phone_number: account.phone_number || '',
      gateway_provider: account.gateway_provider || '',
      display_mode: account.display_mode || 'qr_with_bank',
    });
    setPreviewQrUrl(account.qr_image_url || null);
    setIsEditOpen(true);
  };

  const getBankInfo = (bankName: string) => {
    return BANK_OPTIONS.find(b => b.value === bankName) || BANK_OPTIONS[BANK_OPTIONS.length - 1];
  };

  const getQrModeLabel = (mode?: string) => {
    return QR_MODES.find(m => m.value === mode)?.label || 'อัปโหลด QR';
  };

  const activeAccounts = safeAccounts.filter(a => a.is_active);
  const merchantIdAccounts = safeAccounts.filter(a => a.qr_mode === 'merchant_id');
  const promptpayAccounts = safeAccounts.filter(a => a.qr_mode === 'promptpay');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Form Component
  const AccountForm = () => (
    <div className="space-y-6 py-4">
      {/* QR Mode Selection */}
      <div className="space-y-3">
        <Label>เลือกโหมด QR Code</Label>
        <div className="grid grid-cols-3 gap-3">
          {QR_MODES.map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => {
                  setFormData({ ...formData, qr_mode: mode.value as typeof formData.qr_mode });
                  setPreviewQrUrl(null);
                }}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  formData.qr_mode === mode.value
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-muted-foreground/50'
                }`}
              >
                <Icon className={`size-6 mb-2 ${formData.qr_mode === mode.value ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="font-medium text-sm">{mode.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{mode.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Common Fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>ชื่อบัญชี / ร้านค้า *</Label>
          <Input
            value={formData.account_name}
            onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
            placeholder="เช่น บัญชีหลัก, ร้าน ABC"
          />
        </div>
        <div className="space-y-2">
          <Label>ธนาคาร</Label>
          <Select value={formData.bank_name} onValueChange={(v) => setFormData({ ...formData, bank_name: v })}>
            <SelectTrigger>
              <SelectValue placeholder="เลือกธนาคาร" />
            </SelectTrigger>
            <SelectContent>
              {BANK_OPTIONS.map((bank) => (
                <SelectItem key={bank.value} value={bank.value}>
                  <div className="flex items-center gap-2">
                    <div className={`size-3 rounded-full ${bank.color}`} />
                    {bank.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Upload Mode Fields - รองรับทั้ง File Upload และ URL */}
      {formData.qr_mode === 'upload' && (
        <div className="space-y-4 p-4 rounded-lg bg-muted/50">
          {/* ข้อกำหนดการอัปโหลด */}
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <div className="flex items-start gap-2">
              <QrCode className="size-4 text-blue-500 mt-0.5 shrink-0" />
              <div className="text-xs space-y-1">
                <p className="font-medium text-blue-600">ข้อกำหนดรูป QR Code:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                  <li>ขนาดแนะนำ: <span className="font-medium text-foreground">300x300 ถึง 1024x1024 พิกเซล</span></li>
                  <li>ขนาดไฟล์สูงสุด: <span className="font-medium text-foreground">2MB</span></li>
                  <li>รองรับไฟล์: <span className="font-medium text-foreground">PNG, JPG, JPEG, WebP</span></li>
                  <li>ใช้รูปที่ชัดเจน พื้นหลังสีขาวหรือสีอ่อน</li>
                </ul>
              </div>
            </div>
          </div>

          {/* เลือกวิธีอัปโหลด */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={uploadMode === 'file' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUploadMode('file')}
              className={uploadMode === 'file' ? 'bg-primary' : ''}
            >
              <Upload className="size-4 mr-1" />
              อัปโหลดไฟล์
            </Button>
            <Button
              type="button"
              variant={uploadMode === 'url' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUploadMode('url')}
              className={uploadMode === 'url' ? 'bg-primary' : ''}
            >
              <QrCode className="size-4 mr-1" />
              ใส่ URL รูป
            </Button>
          </div>

          {/* File Upload Mode */}
          {uploadMode === 'file' && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Upload className="size-4" />
                อัปโหลดรูป QR Code <span className="text-red-500">*</span>
              </Label>
              <div className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="qr-file-upload"
                  disabled={isUploading}
                />
                <label
                  htmlFor="qr-file-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="size-10 animate-spin text-primary" />
                      <p className="text-sm">กำลังอัปโหลด...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="size-10 text-muted-foreground" />
                      <p className="text-sm font-medium">คลิกเพื่อเลือกไฟล์ QR Code</p>
                      <p className="text-xs text-muted-foreground">PNG, JPG, JPEG, WebP (สูงสุด 2MB)</p>
                    </>
                  )}
                </label>
              </div>
            </div>
          )}

          {/* URL Mode */}
          {uploadMode === 'url' && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <QrCode className="size-4" />
                URL รูป QR Code <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.qr_image_url}
                onChange={(e) => {
                  let url = e.target.value.trim();
                  
                  // Auto-extract src from HTML img tag
                  if (url.includes('<img') && url.includes('src=')) {
                    const match = url.match(/src=["']([^"']+)["']/);
                    if (match && match[1]) {
                      url = match[1];
                      toast.info('ดึง URL รูปจาก HTML code แล้ว');
                    }
                  }
                  
                  setFormData({ ...formData, qr_image_url: url });
                  
                  // Validate and preview
                  if (url && url.startsWith('https://')) {
                    setPreviewQrUrl(url);
                    setQrRetryCount(prev => prev + 1);
                  } else if (url && !url.startsWith('https://')) {
                    setPreviewQrUrl(null);
                  }
                }}
                placeholder="https://i.ibb.co/xxxx/qr.jpg"
                className={!formData.qr_image_url ? 'border-amber-500' : previewQrUrl ? 'border-green-500' : 'border-red-500'}
              />
              <p className="text-xs text-muted-foreground">
                วาง URL รูปโดยตรงจาก imgbb, imgur หรือ cloudinary (ต้องขึ้นต้นด้วย https://)
              </p>
            </div>
          )}

          {/* Preview */}
          {(formData.qr_image_url || previewQrUrl) && (
            <div className="flex flex-col items-center gap-3 p-4 rounded-lg border">
              {previewQrUrl ? (
                <>
                  <div className="bg-white p-3 rounded-lg shadow">
                    <img 
                      key={`qr-preview-${qrRetryCount}`}
                      src={previewQrUrl} 
                      alt="QR Preview" 
                      className="size-40 object-contain"
                      onError={() => {
                        toast.error('URL รูปไม่ถูกต้องหรือโหลดไม่ได้ กรุณาใช้ลิงก์รูปโดยตรง');
                        setPreviewQrUrl(null);
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="size-4" />
                    รูป QR โหลดสำเร็จ
                  </div>
                  {formData.qr_image_url && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFormData({ ...formData, qr_image_url: '' });
                        setPreviewQrUrl(null);
                      }}
                    >
                      <Trash2 className="size-3 mr-1" />
                      ลบรูปและเลือกใหม่
                    </Button>
                  )}
                </>
              ) : formData.qr_image_url ? (
                <div className="text-center py-4">
                  <p className="text-sm text-red-500">รูป QR โหลดไม่ได้</p>
                  <p className="text-xs text-muted-foreground mt-1">กรุณาตรวจสอบ URL หรือลองใหม่</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      if (formData.qr_image_url.startsWith('https://')) {
                        setPreviewQrUrl(formData.qr_image_url);
                        setQrRetryCount(prev => prev + 1);
                        toast.info('กำลังโหลดรูปใหม่...');
                      }
                    }}
                  >
                    <RefreshCw className="size-3 mr-1" />
                    ลองโหลดใหม่
                  </Button>
                </div>
              ) : null}
            </div>
          )}
          
          {/* Optional Fields - แสดงเป็นส่วนที่ยุบได้ */}
          <details className="group">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              ข้อมูลเพิ่มเติม (ไม่บังคับ)
            </summary>
            <div className="mt-4 space-y-4 pl-6 border-l-2 border-muted">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">เลขบัญชี (ไม่บังคับ)</Label>
                  <Input
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    placeholder="xxx-x-xxxxx-x"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">เบอร์พร้อมเพย์ (ไม่บังคับ)</Label>
                  <Input
                    value={formData.promptpay_number}
                    onChange={(e) => setFormData({ ...formData, promptpay_number: e.target.value })}
                    placeholder="0812345678"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                ถ้าใส่ข้อมูลเพิ่มเติม ลูกค้าจะเห็นทั้ง QR และข้อมูลบัญชี (ขึ้นกับโหมดแสดงผลด้านล่าง)
              </p>
            </div>
          </details>
        </div>
      )}

      {/* Merchant ID Mode Fields */}
      {formData.qr_mode === 'merchant_id' && (
        <div className="space-y-4 p-4 rounded-lg bg-purple-500/10">
          <div className="flex items-start gap-3">
            <Store className="size-5 text-purple-600 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-2">
              <Label>Merchant ID *</Label>
              <Input
                value={formData.merchant_id}
                onChange={(e) => setFormData({ ...formData, merchant_id: e.target.value })}
                placeholder="รหัสร้านค้า เช่น 1234567890123"
              />
              <p className="text-xs text-muted-foreground">
                รหัสร้านค้าจาก SCB แม่มณี หรือ Payment Gateway
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>เบอร์โทรร้าน (ไม่บังคับ)</Label>
              <Input
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                placeholder="0812345678"
              />
            </div>
            <div className="space-y-2">
              <Label>Gateway Provider</Label>
              <Select value={formData.gateway_provider} onValueChange={(v) => setFormData({ ...formData, gateway_provider: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือก (ไม่บังคับ)" />
                </SelectTrigger>
                <SelectContent>
                  {GATEWAY_PROVIDERS.map((gw) => (
                    <SelectItem key={gw.value} value={gw.value}>
                      {gw.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* PromptPay Mode Fields */}
      {formData.qr_mode === 'promptpay' && (
        <div className="space-y-4 p-4 rounded-lg bg-blue-500/10">
          <div className="flex items-start gap-3">
            <Smartphone className="size-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-2">
              <Label>เบอร์โทร หรือ เลขบัตรประชาชน *</Label>
              <Input
                value={formData.promptpay_number}
                onChange={(e) => setFormData({ ...formData, promptpay_number: e.target.value })}
                placeholder="0812345678 หรือ 1234567890123"
              />
              <p className="text-xs text-muted-foreground">
                ระบบจะสร้าง Thai QR Payment อัตโนมัติ
              </p>
            </div>
          </div>
        </div>
      )}

      {/* QR Preview */}
      {(formData.qr_mode === 'merchant_id' || formData.qr_mode === 'promptpay') && (
        <div className="flex flex-col items-center p-4 rounded-lg border border-dashed">
          <Button
            type="button"
            variant="outline"
            onClick={handleGenerateQrPreview}
            disabled={isGeneratingQr}
            className="mb-4"
          >
            {isGeneratingQr ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <QrCode className="size-4 mr-2" />
            )}
            ทดสอบสร้าง QR Code
          </Button>
          {previewQrUrl && (
            <div className="bg-white p-4 rounded-lg shadow">
              <img 
                src={previewQrUrl} 
                alt="QR Preview" 
                className="size-48"
                onError={() => {
                  toast.error('รูป QR โหลดไม่ได้ กรุณาตรวจสอบ URL');
                  setPreviewQrUrl(null);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Upload mode preview */}
      {formData.qr_mode === 'upload' && previewQrUrl && (
        <div className="flex justify-center p-4 rounded-lg border border-dashed">
          <div className="bg-white p-4 rounded-lg shadow">
            <img 
              src={previewQrUrl} 
              alt="QR Preview" 
              className="size-48 object-contain"
              onError={() => {
                toast.error('รูป QR โหลดไม่ได้ กรุณาตรวจสอบ URL');
                setPreviewQrUrl(null);
              }}
            />
            <p className="text-xs text-green-600 text-center mt-2">รูป QR โหลดสำเร็จ</p>
          </div>
        </div>
      )}

      {/* Note */}
      <div className="space-y-2">
        <Label>หมายเหตุ (ไม่บังคับ)</Label>
        <Textarea
          value={formData.note}
          onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          placeholder="หมายเหตุเพิ่มเติม..."
          rows={2}
        />
      </div>

      {/* Display Mode - สำคัญ: ควบคุมสิ่งที่ลูกค้าเห็น */}
      <div className="space-y-3 p-4 rounded-lg border-2 border-amber-500/30 bg-amber-500/5">
        <div className="flex items-center gap-2 text-amber-600">
          <Eye className="size-4" />
          <Label className="font-semibold">โหมดแสดงผลฝั่งลูกค้า</Label>
        </div>
        <div className="grid gap-2">
          {DISPLAY_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => setFormData({ ...formData, display_mode: mode.value as typeof formData.display_mode })}
              className={`flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-colors ${
                formData.display_mode === mode.value
                  ? 'border-primary bg-primary/5'
                  : 'border-transparent bg-muted/50 hover:bg-muted'
              }`}
            >
              <div className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                formData.display_mode === mode.value ? 'border-primary bg-primary' : 'border-muted-foreground'
              }`}>
                {formData.display_mode === mode.value && (
                  <CheckCircle className="size-3 text-white" />
                )}
              </div>
              <div className="flex-1">
                <div className={`font-medium ${mode.color}`}>{mode.label}</div>
                <div className="text-xs text-muted-foreground">{mode.description}</div>
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs text-amber-600 font-medium">
          ** หากเลือก &quot;แสดงเฉพาะ QR&quot; ลูกค้าจะไม่เห็นเลขบัญชี/พร้อมเพย์ เห็นเฉพาะ QR Code เท่านั้น
        </p>
      </div>

      {/* Active Toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
        <div>
          <div className="font-medium">เปิดใช้งาน</div>
          <div className="text-sm text-muted-foreground">แสดงบัญชีนี้ให้ลูกค้าเห็น</div>
        </div>
        <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">บัญชีรับเงิน</h1>
          <p className="text-muted-foreground">จัดการบัญชีธนาคาร QR Code พร้อมเพย์ Merchant ID</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => mutate()}>
            <RefreshCw className="size-4 mr-2" />
            รีเฟรช
          </Button>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="size-4 mr-2" />
                เพิ่มบัญชี
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>เพิ่มบัญชีรับเงินใหม่</DialogTitle>
              </DialogHeader>
              <AccountForm />
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>ยกเลิก</Button>
                <Button onClick={handleAdd} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
                  เพิ่มบัญชี
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CreditCard className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">บัญชีทั้งหมด</p>
                <p className="text-2xl font-bold">{safeAccounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="size-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">เปิดใช้งาน</p>
                <p className="text-2xl font-bold text-green-600">{activeAccounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Store className="size-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Merchant ID</p>
                <p className="text-2xl font-bold text-purple-600">{merchantIdAccounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Smartphone className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">PromptPay</p>
                <p className="text-2xl font-bold text-blue-600">{promptpayAccounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-5" />
            รายการบัญชีรับเงิน
          </CardTitle>
        </CardHeader>
        <CardContent>
          {safeAccounts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="size-12 mx-auto mb-4 opacity-50" />
              <p>ยังไม่มีบัญชีรับเงิน</p>
              <p className="text-sm">กดปุ่ม &quot;เพิ่มบัญชี&quot; เพื่อเริ่มต้น</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>บัญชี</TableHead>
                    <TableHead>ธนาคาร</TableHead>
                    <TableHead>โหมด QR</TableHead>
                    <TableHead>ID / เลขบัญชี</TableHead>
                    <TableHead>QR</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {safeAccounts.map((account) => {
                    const bankInfo = getBankInfo(account.bank_name);
                    return (
                      <TableRow key={account.id} className={!account.is_active ? 'opacity-50' : ''}>
                        <TableCell>
                          <div className="font-medium">{account.account_name}</div>
                          {account.note && (
                            <div className="text-xs text-muted-foreground">{account.note}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            <div className={`size-2 rounded-full ${bankInfo.color}`} />
                            {bankInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              account.qr_mode === 'merchant_id'
                                ? 'default'
                                : account.qr_mode === 'promptpay'
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {getQrModeLabel(account.qr_mode)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {account.qr_mode === 'merchant_id'
                            ? account.merchant_id
                            : account.qr_mode === 'promptpay'
                            ? account.promptpay_number || account.phone_number
                            : account.account_number || account.promptpay_number || '-'}
                        </TableCell>
                        <TableCell>
                          {account.qr_image_url ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedAccount(account);
                                setIsPreviewOpen(true);
                              }}
                            >
                              <Eye className="size-4 mr-1" />
                              ดู QR
                            </Button>
                          ) : account.qr_mode !== 'upload' ? (
                            <Badge variant="outline" className="text-xs">
                              Auto QR
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={account.is_active}
                            onCheckedChange={() => handleToggleActive(account)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(account)}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setSelectedAccount(account);
                                setIsDeleteOpen(true);
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>แก้ไขบัญชีรับเงิน</DialogTitle>
          </DialogHeader>
          <AccountForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleEdit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบบัญชีรับเงิน</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบบัญชี &quot;{selectedAccount?.account_name}&quot; ใช่หรือไม่?
              การดำเนินการนี้ไม่สามารถยกเลิกได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isSubmitting && <Loader2 className="size-4 mr-2 animate-spin" />}
              ลบบัญชี
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* QR Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">{selectedAccount?.account_name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            {selectedAccount?.qr_image_url ? (
              <div className="bg-white p-4 rounded-lg shadow-lg">
                <img
                  src={selectedAccount.qr_image_url}
                  alt="QR Code"
                  className="w-64 h-64 object-contain"
                />
              </div>
            ) : (
              <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center">
                <QrCode className="size-16 text-muted-foreground" />
              </div>
            )}
            <div className="mt-4 text-center">
              <Badge>{getBankInfo(selectedAccount?.bank_name || '').label}</Badge>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
