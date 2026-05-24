'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, KeyRound, AlertTriangle, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function Verify2FAPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/';
  
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  useEffect(() => {
    // Load user from localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
      } catch {
        router.push('/login');
      }
    } else {
      router.push('/login');
    }
  }, [router]);
  
  const handleInputChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    
    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    
    // Auto-submit when all digits entered
    if (newCode.every(d => d) && newCode.join('').length === 6) {
      handleVerify(newCode.join(''));
    }
  };
  
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };
  
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = [...code];
    pastedData.split('').forEach((char, i) => {
      if (i < 6) newCode[i] = char;
    });
    setCode(newCode);
    
    if (pastedData.length === 6) {
      handleVerify(pastedData);
    }
  };
  
  const handleVerify = async (verifyCode?: string) => {
    const codeToVerify = verifyCode || code.join('');
    if (codeToVerify.length !== 6) {
      setError('กรุณากรอกรหัส 6 หลัก');
      return;
    }
    
    if (!user) {
      setError('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      return;
    }
    
    setIsVerifying(true);
    setError('');
    
    try {
      const res = await fetch('/api/auth/2fa/verify-guard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          user_type: user.userType === 'customer' ? 'customer' : 'agent',
          role: user.role,
          code: codeToVerify,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Update user in localStorage with 2FA verified status
        const updatedUser = {
          ...user,
          twoFactorVerified: true,
          twoFactorVerifiedAt: data.verified_at,
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        toast.success('ยืนยันตัวตนสำเร็จ');
        router.push(returnTo);
      } else {
        setError(data.error || 'รหัสไม่ถูกต้อง');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsVerifying(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-amber-500/20">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex items-center justify-center size-16 rounded-full bg-amber-500/10 border border-amber-500/30">
            <Shield className="size-8 text-amber-500" />
          </div>
          <CardTitle className="text-2xl">ยืนยันตัวตน 2 ขั้นตอน</CardTitle>
          <CardDescription>
            กรุณากรอกรหัส 6 หลักจากแอป Authenticator ของคุณ
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {user && (
            <div className="text-center text-sm text-muted-foreground">
              <p>ผู้ใช้: <span className="text-foreground font-medium">{user.displayName || user.username}</span></p>
            </div>
          )}
          
          {error && (
            <Alert variant="destructive" className="border-red-500/50 bg-red-500/10">
              <AlertTriangle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-4">
            <Label className="text-center block">รหัสยืนยัน</Label>
            <div className="flex justify-center gap-2" onPaste={handlePaste}>
              {code.map((digit, index) => (
                <Input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="size-12 text-center text-xl font-mono font-bold border-amber-500/30 focus:border-amber-500"
                  disabled={isVerifying}
                  autoFocus={index === 0}
                />
              ))}
            </div>
          </div>
          
          <Button
            onClick={() => handleVerify()}
            disabled={isVerifying || code.some(d => !d)}
            className="w-full bg-amber-500 hover:bg-amber-600 text-black"
          >
            {isVerifying ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                กำลังตรวจสอบ...
              </>
            ) : (
              <>
                <KeyRound className="size-4 mr-2" />
                ยืนยัน
              </>
            )}
          </Button>
          
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              หากคุณไม่มีรหัส กรุณาติดต่อผู้ดูแลระบบ
            </p>
            
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <ArrowLeft className="size-4 mr-2" />
                กลับไปหน้าเข้าสู่ระบบ
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
