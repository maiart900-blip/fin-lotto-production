'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, ShieldCheck, ShieldOff, Smartphone, Mail, Key,
  QrCode, Copy, CheckCircle, AlertTriangle, RefreshCw, Trash2,
  Eye, EyeOff, Lock, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import Image from 'next/image';

interface TwoFactorSettings {
  is_enabled: boolean;
  method: 'email' | 'totp';
  totp_secret?: string;
  backup_codes?: string[];
  last_verified_at?: string;
}

export default function TwoFactorAuthPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<TwoFactorSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupStep, setSetupStep] = useState<'select' | 'qr' | 'verify' | 'backup' | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showSecret, setShowSecret] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/auth/2fa');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching 2FA settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const startTOTPSetup = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/2fa/totp/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userType: user?.role || 'admin',
          userId: user?.id // ส่ง userId ไปด้วย
        }),
      });

      if (!res.ok) throw new Error('Setup failed');

      const data = await res.json();
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setSetupStep('qr');
    } catch {
      toast.error('เกิดข้อผิดพลาดในการสร้าง QR Code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyTOTP = async () => {
    if (verifyCode.length !== 6) {
      toast.error('กรุณากรอกรหัส 6 หลัก');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/2fa/totp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: verifyCode, 
          isSetup: true,
          userId: user?.id // ส่ง userId ไปด้วย
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'รหัสไม่ถูกต้อง');
        return;
      }

      setBackupCodes(data.backupCodes || []);
      setSetupStep('backup');
      toast.success('ตั้งค่า 2FA สำเร็จ');
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const disable2FA = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/2fa', { method: 'DELETE' });
      if (res.ok) {
        toast.success('ปิดใช้งาน 2FA แล้ว');
        setSettings({ is_enabled: false, method: 'email' });
        setShowDisableDialog(false);
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('คัดลอกแล้ว');
  };

  const downloadBackupCodes = () => {
    const content = `FIN LOTTO - Backup Codes\n${'='.repeat(30)}\n\n${backupCodes.join('\n')}\n\nเก็บรักษาไว้ในที่ปลอดภัย\nใช้ได้ครั้งเดียวต่อรหัส`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fin-lotto-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const finishSetup = () => {
    setSetupStep(null);
    setQrCode(null);
    setSecret(null);
    setVerifyCode('');
    setBackupCodes([]);
    fetchSettings();
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="size-6 text-[#D4AF37]" />
            การยืนยันตัวตน 2 ชั้น (2FA)
          </h1>
          <p className="text-muted-foreground mt-1">
            เพิ่มความปลอดภัยด้วย Google Authenticator หรือแอพยืนยันตัวตน
          </p>
        </div>
        {settings?.is_enabled && (
          <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-sm px-3 py-1">
            <ShieldCheck className="size-4 mr-1" />
            เปิดใช้งานแล้ว
          </Badge>
        )}
      </div>

      {/* Current Status */}
      <Card className={settings?.is_enabled ? 'border-green-500/50 bg-green-500/5' : 'border-yellow-500/50 bg-yellow-500/5'}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            {settings?.is_enabled ? (
              <ShieldCheck className="size-12 text-green-500" />
            ) : (
              <ShieldOff className="size-12 text-yellow-500" />
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-lg">
                {settings?.is_enabled ? 'การยืนยันตัวตน 2 ชั้นเปิดใช้งานอยู่' : 'ยังไม่ได้เปิดใช้งาน 2FA'}
              </h3>
              <p className="text-muted-foreground">
                {settings?.is_enabled 
                  ? `ใช้งาน: ${settings.method === 'totp' ? 'Google Authenticator' : 'รหัส OTP ทาง Email'}`
                  : 'เปิดใช้งานเพื่อเพิ่มความปลอดภัยให้บัญชีของคุณ'
                }
              </p>
              {settings?.last_verified_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  ยืนยันล่าสุด: {new Date(settings.last_verified_at).toLocaleString('th-TH')}
                </p>
              )}
            </div>
            <div>
              {settings?.is_enabled ? (
                <Button variant="destructive" onClick={() => setShowDisableDialog(true)}>
                  <ShieldOff className="size-4 mr-2" />
                  ปิดใช้งาน
                </Button>
              ) : (
                <Button onClick={() => setSetupStep('select')} className="bg-[#D4AF37] hover:bg-[#B8860B] text-black">
                  <ShieldCheck className="size-4 mr-2" />
                  เปิดใช้งาน 2FA
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Setup Methods */}
      {!settings?.is_enabled && !setupStep && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="hover:border-[#D4AF37]/50 cursor-pointer transition-colors" onClick={() => setSetupStep('select')}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-[#D4AF37]/10">
                  <Smartphone className="size-8 text-[#D4AF37]" />
                </div>
                <div>
                  <h3 className="font-semibold">Google Authenticator</h3>
                  <p className="text-sm text-muted-foreground">
                    ใช้แอพ Authenticator สร้างรหัส OTP (แนะนำ)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:border-blue-500/50 cursor-pointer transition-colors opacity-60">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-500/10">
                  <Mail className="size-8 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold">รหัส OTP ทาง Email</h3>
                  <p className="text-sm text-muted-foreground">
                    รับรหัส OTP ผ่านอีเมล (ใช้งานอยู่)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Role-Based 2FA Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">การตั้งค่าตามบทบาท</CardTitle>
          <CardDescription>
            ระบบ 2FA รองรับทุกบทบาทในระบบ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="size-5 text-red-500" />
                <span className="font-semibold text-red-600">ระบบแม่ (Super Admin)</span>
              </div>
              <p className="text-sm text-muted-foreground">
                บังคับใช้ 2FA - ต้องยืนยันทุกครั้งที่ล็อกอิน
              </p>
              <Badge className="mt-2 bg-red-500/20 text-red-600">บังคับ</Badge>
            </div>

            <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="size-5 text-orange-500" />
                <span className="font-semibold text-orange-600">ระบบเอเย่น (Agent)</span>
              </div>
              <p className="text-sm text-muted-foreground">
                แนะนำใช้ 2FA - สามารถตั้งค่าเพิ่มความปลอดภัย
              </p>
              <Badge className="mt-2 bg-orange-500/20 text-orange-600">แนะนำ</Badge>
            </div>

            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="size-5 text-blue-500" />
                <span className="font-semibold text-blue-600">ระบบเมมเบอร์ (Member)</span>
              </div>
              <p className="text-sm text-muted-foreground">
                ไม่บังคับ - สามารถเปิดใช้งานเองได้
              </p>
              <Badge className="mt-2 bg-blue-500/20 text-blue-600">ไม่บังคับ</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <Dialog open={setupStep !== null} onOpenChange={(open) => !open && finishSetup()}>
        <DialogContent className="max-w-md">
          {setupStep === 'select' && (
            <>
              <DialogHeader>
                <DialogTitle>เลือกวิธีการยืนยันตัวตน</DialogTitle>
                <DialogDescription>
                  เลือกวิธีที่คุณต้องการใช้สำหรับ 2FA
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto p-4"
                  onClick={startTOTPSetup}
                  disabled={isSubmitting}
                >
                  <Smartphone className="size-6 mr-3 text-[#D4AF37]" />
                  <div className="text-left">
                    <div className="font-medium">Google Authenticator</div>
                    <div className="text-sm text-muted-foreground">สแกน QR Code ด้วยแอพ Authenticator</div>
                  </div>
                </Button>
              </div>
            </>
          )}

          {setupStep === 'qr' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <QrCode className="size-5" />
                  สแกน QR Code
                </DialogTitle>
                <DialogDescription>
                  สแกน QR Code ด้วย Google Authenticator หรือแอพยืนยันตัวตนอื่นๆ
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {qrCode && (
                  <div className="flex justify-center">
                    <div className="p-4 bg-white rounded-lg">
                      <Image 
                        src={qrCode} 
                        alt="QR Code" 
                        width={200} 
                        height={200}
                        className="rounded"
                      />
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label>หรือใส่รหัสด้วยตนเอง</Label>
                  <div className="flex gap-2">
                    <Input
                      value={showSecret ? secret || '' : '••••••••••••••••'}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowSecret(!showSecret)}
                    >
                      {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(secret || '')}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                </div>

                <Alert>
                  <AlertTriangle className="size-4" />
                  <AlertDescription>
                    เก็บรหัสลับไว้ในที่ปลอดภัย ใช้สำหรับกู้คืนบัญชีหากทำโทรศัพท์หาย
                  </AlertDescription>
                </Alert>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={finishSetup}>
                  ยกเลิก
                </Button>
                <Button onClick={() => setSetupStep('verify')} className="bg-[#D4AF37] hover:bg-[#B8860B] text-black">
                  ถัดไป
                </Button>
              </DialogFooter>
            </>
          )}

          {setupStep === 'verify' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Key className="size-5" />
                  ยืนยันรหัส OTP
                </DialogTitle>
                <DialogDescription>
                  กรอกรหัส 6 หลักจากแอพ Authenticator
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>รหัส OTP</Label>
                  <Input
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="text-center text-2xl font-mono tracking-widest"
                    maxLength={6}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSetupStep('qr')}>
                  ย้อนกลับ
                </Button>
                <Button 
                  onClick={verifyTOTP} 
                  disabled={verifyCode.length !== 6 || isSubmitting}
                  className="bg-[#D4AF37] hover:bg-[#B8860B] text-black"
                >
                  {isSubmitting ? <RefreshCw className="size-4 animate-spin mr-2" /> : <CheckCircle className="size-4 mr-2" />}
                  ยืนยัน
                </Button>
              </DialogFooter>
            </>
          )}

          {setupStep === 'backup' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="size-5" />
                  ตั้งค่า 2FA สำเร็จ!
                </DialogTitle>
                <DialogDescription>
                  บันทึกรหัสสำรองไว้ในที่ปลอดภัย
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Alert className="bg-yellow-500/10 border-yellow-500/30">
                  <AlertTriangle className="size-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-600">
                    รหัสสำรองใช้ได้ครั้งเดียว เก็บไว้ใช้กรณีทำโทรศัพท์หาย
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg">
                  {backupCodes.map((code, i) => (
                    <div key={i} className="font-mono text-sm p-2 bg-background rounded text-center">
                      {code}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => copyToClipboard(backupCodes.join('\n'))}
                  >
                    <Copy className="size-4 mr-2" />
                    คัดลอก
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={downloadBackupCodes}
                  >
                    <Download className="size-4 mr-2" />
                    ดาวน์โหลด
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={finishSetup} className="w-full bg-green-600 hover:bg-green-700">
                  <CheckCircle className="size-4 mr-2" />
                  เสร็จสิ้น
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="size-5" />
              ปิดใช้งาน 2FA
            </DialogTitle>
            <DialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการปิดการยืนยันตัวตน 2 ชั้น?
            </DialogDescription>
          </DialogHeader>
          <Alert className="bg-red-500/10 border-red-500/30">
            <AlertTriangle className="size-4 text-red-600" />
            <AlertDescription className="text-red-600">
              การปิดใช้งาน 2FA จะทำให้บัญชีของคุณมีความปลอดภัยน้อยลง
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisableDialog(false)}>
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={disable2FA} disabled={isSubmitting}>
              {isSubmitting ? <RefreshCw className="size-4 animate-spin mr-2" /> : <Trash2 className="size-4 mr-2" />}
              ปิดใช้งาน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
