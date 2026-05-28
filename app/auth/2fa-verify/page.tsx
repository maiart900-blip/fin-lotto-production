'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Loader2, Key, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function TwoFactorVerifyPage() {
  const router = useRouter();
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorDetails(null);
    
    const codeLength = useBackupCode ? 6 : 6;
    if (verificationCode.length < codeLength) {
      toast.error(`กรุณากรอกรหัส ${codeLength} หลัก`);
      return;
    }

    setIsVerifying(true);
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: verificationCode,
          isBackupCode: useBackupCode,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        // Show detailed error
        setError(data.error || 'รหัสไม่ถูกต้อง');
        if (data.details) {
          setErrorDetails(data.details);
        }
        if (res.status === 500) {
          setErrorDetails('Server error - กรุณาติดต่อผู้ดูแลระบบ หรือใช้ Recovery Mode');
        }
        throw new Error(data.error || 'รหัสไม่ถูกต้อง');
      }
      
      // Store user session in localStorage if user data is returned
      if (data.user) {
        localStorage.setItem('lottery_session', JSON.stringify({
          ...data.user,
          displayName: data.user.username,
        }));
      }
      
      toast.success('ยืนยัน 2FA สำเร็จ');
      
      // Redirect to dashboard or intended page
      const redirectTo = data.redirectTo || '/dashboard';
      router.push(redirectTo);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'รหัสไม่ถูกต้อง');
      setVerificationCode('');
    } finally {
      setIsVerifying(false);
    }
  };

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
          <h1 className="text-2xl font-bold text-white">ยืนยัน 2FA</h1>
          <p className="text-neutral-400 mt-2">กรอกรหัสจากแอป Authenticator</p>
        </div>

        {/* Card */}
        <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleVerify} className="space-y-6">
            {/* Toggle between TOTP and Backup code */}
            <div className="flex rounded-xl bg-neutral-800/50 p-1">
              <button
                type="button"
                onClick={() => {
                  setUseBackupCode(false);
                  setVerificationCode('');
                }}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  !useBackupCode 
                    ? 'bg-amber-500/20 text-amber-400' 
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Authenticator
              </button>
              <button
                type="button"
                onClick={() => {
                  setUseBackupCode(true);
                  setVerificationCode('');
                }}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  useBackupCode 
                    ? 'bg-amber-500/20 text-amber-400' 
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                รหัสสำรอง
              </button>
            </div>

            {/* Code input */}
            <div className="space-y-2">
              <label className="text-sm text-neutral-400">
                {useBackupCode ? 'รหัสสำรอง' : 'รหัส 6 หลัก'}
              </label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-neutral-500" />
                <input
                  type="text"
                  inputMode={useBackupCode ? 'text' : 'numeric'}
                  pattern={useBackupCode ? undefined : '[0-9]*'}
                  maxLength={useBackupCode ? 8 : 6}
                  value={verificationCode}
                  onChange={(e) => {
                    const value = useBackupCode 
                      ? e.target.value.toUpperCase() 
                      : e.target.value.replace(/\D/g, '');
                    setVerificationCode(value);
                  }}
                  placeholder={useBackupCode ? 'XXXXXX' : '000000'}
                  className="w-full h-14 pl-12 text-center text-xl font-mono tracking-widest bg-neutral-800/50 border border-neutral-700 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
                  autoFocus
                />
              </div>
            </div>

            {/* Error display */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="size-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-red-400 text-sm font-medium">{error}</p>
                    {errorDetails && (
                      <p className="text-red-400/70 text-xs mt-1">{errorDetails}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Verify button */}
            <button
              type="submit"
              disabled={isVerifying || verificationCode.length < 6}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
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

            {/* Back to login */}
            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="text-sm text-neutral-400 hover:text-white transition-colors"
              >
                ยกเลิกและกลับหน้าเข้าสู่ระบบ
              </button>
              <div>
                <a
                  href="/auth/recovery"
                  className="text-xs text-amber-500/70 hover:text-amber-400 transition-colors"
                >
                  Super Admin Recovery Mode
                </a>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
