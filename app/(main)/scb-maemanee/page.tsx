'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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
  Edit,
  Trash2,
  QrCode,
  Smartphone,
  Building2,
  Copy,
  CheckCircle,
  XCircle,
  Search,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Banknote,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ScbAccount {
  id: string;
  shop_name: string;
  account_name: string;
  bank_name: string;
  account_number: string | null;
  promptpay_id: string | null;
  merchant_id: string | null;
  phone: string | null;
  qr_image_url: string | null;
  is_active: boolean;
  note: string | null;
  created_at: string;
}

interface SlipHash {
  id: string;
  hash: string;
  topup_request_id: string | null;
  created_at: string;
  topup_requests?: {
    amount: number;
    status: string;
    customers?: { name: string };
  };
}

export default function ScbMaemaneePage() {
  const { canAccess } = useAuth();
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ScbAccount | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<ScbAccount | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [slipUrl, setSlipUrl] = useState('');
  const [verifyResult, setVerifyResult] = useState<{
    is_duplicate: boolean;
    message: string;
    hash?: string;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    shop_name: '',
    account_name: '',
    bank_name: 'ธนาคารไทยพาณิชย์',
    account_number: '',
    promptpay_id: '',
    merchant_id: '',
    phone: '',
    qr_image_url: '',
    is_active: true,
    note: '',
  });
  
  const { data: accounts = [], mutate } = useSWR<ScbAccount[]>('/api/scb-maemanee', fetcher);
  const { data: slipHashes = [] } = useSWR<SlipHash[]>('/api/slip-verify', fetcher, { refreshInterval: 30000 });
  
  const activeAccounts = accounts.filter(a => a.is_active);
  
  const resetForm = () => {
    setFormData({
      shop_name: '',
      account_name: '',
      bank_name: 'ธนาคารไทยพาณิชย์',
      account_number: '',
      promptpay_id: '',
      merchant_id: '',
      phone: '',
      qr_image_url: '',
      is_active: true,
      note: '',
    });
    setEditingAccount(null);
  };
  
  const handleOpenDialog = (account?: ScbAccount) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        shop_name: account.shop_name,
        account_name: account.account_name,
        bank_name: account.bank_name,
        account_number: account.account_number || '',
        promptpay_id: account.promptpay_id || '',
        merchant_id: account.merchant_id || '',
        phone: account.phone || '',
        qr_image_url: account.qr_image_url || '',
        is_active: account.is_active,
        note: account.note || '',
      });
    } else {
      resetForm();
    }
    setShowDialog(true);
  };
  
  const handleSubmit = async () => {
    if (!formData.shop_name || !formData.account_name) {
      toast.error('กรุณากรอกชื่อร้านและชื่อบัญชี');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const method = editingAccount ? 'PUT' : 'POST';
      const body = editingAccount 
        ? { ...formData, id: editingAccount.id }
        : formData;
      
      const res = await fetch('/api/scb-maemanee', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (!res.ok) throw new Error('Failed to save');
      
      toast.success(editingAccount ? 'อัปเดตบัญชีเรียบร้อย' : 'เพิ่มบัญชีเรียบร้อย');
      mutate();
      setShowDialog(false);
      resetForm();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleDelete = async () => {
    if (!deleteId) return;
    
    try {
      const res = await fetch(`/api/scb-maemanee?id=${deleteId}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) throw new Error('Failed to delete');
      
      toast.success('ลบบัญชีเรียบร้อย');
      mutate();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setShowDeleteDialog(false);
      setDeleteId(null);
    }
  };
  
  const handleToggleActive = async (account: ScbAccount) => {
    try {
      const res = await fetch('/api/scb-maemanee', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: account.id,
          is_active: !account.is_active,
        }),
      });
      
      if (!res.ok) throw new Error('Failed to toggle');
      
      toast.success(account.is_active ? 'ปิดใช้งานบัญชีแล้ว' : 'เปิดใช้งานบัญชีแล้ว');
      mutate();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };
  
  const handleVerifySlip = async () => {
    if (!slipUrl) {
      toast.error('กรุณากรอก URL สลิป');
      return;
    }
    
    setVerifying(true);
    setVerifyResult(null);
    
    try {
      const res = await fetch('/api/slip-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slip_url: slipUrl }),
      });
      
      const data = await res.json();
      setVerifyResult(data);
      
      if (data.is_duplicate) {
        toast.error('สลิปนี้เคยถูกใช้งานแล้ว!');
      } else {
        toast.success('สลิปนี้ยังไม่เคยถูกใช้งาน');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการตรวจสอบ');
    } finally {
      setVerifying(false);
    }
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('คัดลอกแล้ว');
  };
  
  if (!canAccess('super_admin')) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SCB แม่มณี</h1>
          <p className="text-muted-foreground">จัดการบัญชี SCB แม่มณีและตรวจสอบสลิป</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="size-4 mr-2" />
          เพิ่มบัญชี
        </Button>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Building2 className="size-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">บัญชีทั้งหมด</p>
                <p className="text-2xl font-bold">{accounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <CheckCircle className="size-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">เปิดใช้งาน</p>
                <p className="text-2xl font-bold">{activeAccounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <ShieldCheck className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">สลิปตรวจสอบแล้ว</p>
                <p className="text-2xl font-bold">{slipHashes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <AlertTriangle className="size-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">สลิปซ้ำที่พบ</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="accounts">บัญชี SCB แม่มณี</TabsTrigger>
          <TabsTrigger value="verify">ตรวจสอบสลิป</TabsTrigger>
          <TabsTrigger value="history">ประวัติสลิป</TabsTrigger>
        </TabsList>
        
        {/* Accounts Tab */}
        <TabsContent value="accounts">
          <Card>
            <CardHeader>
              <CardTitle>รายการบัญชี SCB แม่มณี</CardTitle>
            </CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="size-12 mx-auto mb-4 opacity-50" />
                  <p>ยังไม่มีบัญชี SCB แม่มณี</p>
                  <Button variant="outline" className="mt-4" onClick={() => handleOpenDialog()}>
                    <Plus className="size-4 mr-2" />
                    เพิ่มบัญชีแรก
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ชื่อร้าน</TableHead>
                      <TableHead>ชื่อบัญชี</TableHead>
                      <TableHead>เลขบัญชี/พร้อมเพย์</TableHead>
                      <TableHead>Merchant ID</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead className="text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">{account.shop_name}</TableCell>
                        <TableCell>{account.account_name}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {account.account_number && (
                              <button
                                className="flex items-center gap-1 text-sm hover:text-primary"
                                onClick={() => copyToClipboard(account.account_number!)}
                              >
                                <Banknote className="size-3" />
                                <span className="font-mono">{account.account_number}</span>
                                <Copy className="size-3" />
                              </button>
                            )}
                            {account.promptpay_id && (
                              <button
                                className="flex items-center gap-1 text-sm hover:text-primary"
                                onClick={() => copyToClipboard(account.promptpay_id!)}
                              >
                                <Smartphone className="size-3" />
                                <span className="font-mono">{account.promptpay_id}</span>
                                <Copy className="size-3" />
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {account.merchant_id && (
                            <span className="font-mono text-sm">{account.merchant_id}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={account.is_active}
                              onCheckedChange={() => handleToggleActive(account)}
                            />
                            <Badge variant={account.is_active ? 'default' : 'secondary'}>
                              {account.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {account.qr_image_url && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedAccount(account);
                                  setShowQrDialog(true);
                                }}
                              >
                                <QrCode className="size-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(account)}
                            >
                              <Edit className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeleteId(account.id);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="size-4 text-red-500" />
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
        </TabsContent>
        
        {/* Verify Slip Tab */}
        <TabsContent value="verify">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5" />
                ตรวจสอบสลิปซ้ำ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-xl space-y-4">
                <div>
                  <Label>URL รูปสลิป</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="https://example.com/slip.jpg"
                      value={slipUrl}
                      onChange={(e) => setSlipUrl(e.target.value)}
                    />
                    <Button onClick={handleVerifySlip} disabled={verifying}>
                      {verifying ? (
                        <Clock className="size-4 animate-spin" />
                      ) : (
                        <Search className="size-4" />
                      )}
                      <span className="ml-2">ตรวจสอบ</span>
                    </Button>
                  </div>
                </div>
                
                {verifyResult && (
                  <div className={`p-4 rounded-lg border ${
                    verifyResult.is_duplicate 
                      ? 'bg-red-500/10 border-red-500/30' 
                      : 'bg-green-500/10 border-green-500/30'
                  }`}>
                    <div className="flex items-center gap-3">
                      {verifyResult.is_duplicate ? (
                        <XCircle className="size-6 text-red-500" />
                      ) : (
                        <CheckCircle className="size-6 text-green-500" />
                      )}
                      <div>
                        <p className="font-medium">{verifyResult.message}</p>
                        {verifyResult.hash && (
                          <p className="text-sm text-muted-foreground font-mono">
                            Hash: {verifyResult.hash}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>ประวัติสลิปที่ตรวจสอบแล้ว</CardTitle>
            </CardHeader>
            <CardContent>
              {slipHashes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="size-12 mx-auto mb-4 opacity-50" />
                  <p>ยังไม่มีประวัติการตรวจสอบสลิป</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hash</TableHead>
                      <TableHead>ลูกค้า</TableHead>
                      <TableHead>จำนวนเงิน</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead>วันที่</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slipHashes.map((hash) => (
                      <TableRow key={hash.id}>
                        <TableCell className="font-mono text-xs">{hash.hash}</TableCell>
                        <TableCell>
                          {hash.topup_requests?.customers?.name || '-'}
                        </TableCell>
                        <TableCell>
                          {hash.topup_requests?.amount 
                            ? formatMoney(hash.topup_requests.amount) 
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {hash.topup_requests?.status && (
                            <Badge variant={
                              hash.topup_requests.status === 'approved' ? 'default' :
                              hash.topup_requests.status === 'rejected' ? 'destructive' :
                              'secondary'
                            }>
                              {hash.topup_requests.status === 'approved' ? 'อนุมัติ' :
                               hash.topup_requests.status === 'rejected' ? 'ปฏิเสธ' :
                               'รอดำเนินการ'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(hash.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Add/Edit Account Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? 'แก้ไขบัญชี SCB แม่มณี' : 'เพิ่มบัญชี SCB แม่มณี'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>ชื่อร้าน *</Label>
                <Input
                  className="mt-2"
                  placeholder="ชื่อร้าน"
                  value={formData.shop_name}
                  onChange={(e) => setFormData({ ...formData, shop_name: e.target.value })}
                />
              </div>
              <div>
                <Label>ชื่อบัญชี *</Label>
                <Input
                  className="mt-2"
                  placeholder="ชื่อบัญชี"
                  value={formData.account_name}
                  onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>เลขบัญชี</Label>
                <Input
                  className="mt-2"
                  placeholder="xxx-x-xxxxx-x"
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                />
              </div>
              <div>
                <Label>พร้อมเพย์</Label>
                <Input
                  className="mt-2"
                  placeholder="เบอร์โทร/เลขประจำตัว"
                  value={formData.promptpay_id}
                  onChange={(e) => setFormData({ ...formData, promptpay_id: e.target.value })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Merchant ID</Label>
                <Input
                  className="mt-2"
                  placeholder="Merchant ID"
                  value={formData.merchant_id}
                  onChange={(e) => setFormData({ ...formData, merchant_id: e.target.value })}
                />
              </div>
              <div>
                <Label>เบอร์โทร</Label>
                <Input
                  className="mt-2"
                  placeholder="0xx-xxx-xxxx"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            
            <div>
              <Label>URL รูป QR Code</Label>
              <Input
                className="mt-2"
                placeholder="https://example.com/qr.png"
                value={formData.qr_image_url}
                onChange={(e) => setFormData({ ...formData, qr_image_url: e.target.value })}
              />
            </div>
            
            <div>
              <Label>หมายเหตุ</Label>
              <Textarea
                className="mt-2"
                placeholder="หมายเหตุเพิ่มเติม..."
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>เปิดใช้งาน</Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'กำลังบันทึก...' : editingAccount ? 'บันทึก' : 'เพิ่มบัญชี'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* QR Code Dialog */}
      <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">{selectedAccount?.shop_name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            {selectedAccount?.qr_image_url ? (
              <img
                src={selectedAccount.qr_image_url}
                alt="QR Code"
                className="max-w-full h-auto rounded-lg border"
              />
            ) : (
              <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center">
                <QrCode className="size-12 text-muted-foreground" />
              </div>
            )}
            <div className="mt-4 text-center space-y-2">
              <p className="font-medium">{selectedAccount?.account_name}</p>
              {selectedAccount?.account_number && (
                <button
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 mx-auto"
                  onClick={() => copyToClipboard(selectedAccount.account_number!)}
                >
                  <span className="font-mono">{selectedAccount.account_number}</span>
                  <Copy className="size-4" />
                </button>
              )}
              {selectedAccount?.promptpay_id && (
                <button
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 mx-auto"
                  onClick={() => copyToClipboard(selectedAccount.promptpay_id!)}
                >
                  <Smartphone className="size-4" />
                  <span className="font-mono">{selectedAccount.promptpay_id}</span>
                  <Copy className="size-4" />
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบบัญชี SCB แม่มณีนี้หรือไม่? การดำเนินการนี้ไม่สามารถยกเลิกได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
