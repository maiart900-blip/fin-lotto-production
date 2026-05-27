'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Shield, Loader2, Copy, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function TwoFactorSetupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [step, setStep] = useState<'setup' | 'backup' | 'verify'>('setup');

  useEffect(() => {
    initiate2FASetup();
  }, []);

  const initiate2FASetup = async () => {
    try {
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'ไม่สามารถเริ่มตั้งค่า 2FA ได้');
      }
      
      const data = await res.json();
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setBackupCodes(data.backupCodes || []);
      setIsLoading(false);
    } catch (error) {
      console.error('2FA setup error:', error);
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
      router.push('/login');
    }
  };

  const handleCopySecret = () => {
    if (secret) {
      navigator.clipboard.writeText(secret);
      setCopiedSecret(true);
      toast.success('คัดลอกรหัสแล้ว');
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (verificationCode.length !== 6) {
      toast.error('กรุณากรอกรหัส 6 หลัก');
      return;
    }

    setIsVerifying(true);
    try {
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'รหัสไม่ถูกต้อง');
      }
      
      toast.success('ตั้งค่า 2FA สำเร็จ');
      
      // Redirect to login to complete authentication
      router.push('/login?message=2fa_setup_complete');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'รหัสไม่ถูกต้อง');
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="size-8 animate-spin text-amber-500 mx-auto" />
          <p className="text-neutral-400">กำลังเตรียมการตั้งค่า 2FA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-4">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-amber-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 mb-4">
            <Shield className="size-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-white">ตั้งค่า 2FA</h1>
          <p className="text-neutral-400 mt-2">เพิ่มความปลอดภัยให้บัญชีของคุณ</p>
        </div>

        {/* Card */}
        <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-6">
          
          {step === 'setup' && (
            <>
              {/* Step 1: Scan QR */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-amber-400">
                  <span className="flex items-center justify-center size-6 rounded-full bg-amber-500/20 text-xs font-bold">1</span>
                  <span className="font-medium">สแกน QR Code</span>
                </div>
                
                <p className="text-sm text-neutral-400">
                  ใช้แอป Authenticator (Google Authenticator, Authy, etc.) สแกน QR Code ด้านล่าง
                </p>
                
                {qrCode && (
                  <div className="flex justify-center">
                    <div className="bg-white p-4 rounded-xl">
                      <Image src={qrCode} alt="2FA QR Code" width={200} height={200} />
                    </div>
                  </div>
                )}
                
                {/* Manual entry */}
                <div className="space-y-2">
                  <p className="text-xs text-neutral-500">หรือกรอกรหัสด้วยตนเอง:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-neutral-800 rounded-lg text-sm text-amber-400 font-mono overflow-x-auto">
                      {secret}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors"
                    >
                      {copiedSecret ? (
                        <Check className="size-4 text-green-400" />
                      ) : (
                        <Copy className="size-4 text-neutral-400" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStep('backup')}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold hover:from-amber-400 hover:to-amber-500 transition-all"
              >
                ถัดไป
              </button>
            </>
          )}

          {step === 'backup' && (
            <>
              {/* Step 2: Backup Codes */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-amber-400">
                  <span className="flex items-center justify-center size-6 rounded-full bg-amber-500/20 text-xs font-bold">2</span>
                  <span className="font-medium">บันทึกรหัสสำรอง</span>
                </div>
                
                <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                  <AlertTriangle className="size-5 text-orange-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-orange-300">
                    เก็บรหัสเหล่านี้ไว้ในที่ปลอดภัย ใช้เมื่อไม่สามารถเข้าถึงแอป Authenticator ได้
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, index) => (
                    <div
                      key={index}
                      className="px-3 py-2 bg-neutral-800 rounded-lg text-center font-mono text-sm text-white"
                    >
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('setup')}
                  className="flex-1 h-12 rounded-xl border border-neutral-700 text-white font-medium hover:bg-neutral-800 transition-all"
                >
                  ย้อนกลับ
                </button>
                <button
                  onClick={() => setStep('verify')}
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold hover:from-amber-400 hover:to-amber-500 transition-all"
                >
                  ถัดไป
                </button>
              </div>
            </>
          )}

          {step === 'verify' && (
            <>
              {/* Step 3: Verify */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-amber-400">
                  <span className="flex items-center justify-center size-6 rounded-full bg-amber-500/20 text-xs font-bold">3</span>
                  <span className="font-medium">ยืนยันการตั้งค่า</span>
                </div>
                
                <p className="text-sm text-neutral-400">
                  กรอกรหัส 6 หลักจากแอป Authenticator เพื่อยืนยันการตั้งค่า
                </p>

                <form onSubmit={handleVerify} className="space-y-4">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full h-14 text-center text-2xl font-mono tracking-[0.5em] bg-neutral-800/50 border border-neutral-700 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
                    autoFocus
                  />

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep('backup')}
                      className="flex-1 h-12 rounded-xl border border-neutral-700 text-white font-medium hover:bg-neutral-800 transition-all"
                    >
                      ย้อนกลับ
                    </button>
                    <button
                      type="submit"
                      disabled={isVerifying || verificationCode.length !== 6}
                      className="flex-1 h-12 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                      {isVerifying ? (
                        <>
                          <Loader2 className="size-5 animate-spin" />
                          <span>กำลังยืนยัน...</span>
                        </>
                      ) : (
                        'ยืนยัน'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
