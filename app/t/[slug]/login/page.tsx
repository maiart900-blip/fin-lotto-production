'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { Phone, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TenantSettings {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  primary_color?: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function TenantLoginPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  
  const { data: tenant } = useSWR<TenantSettings>(`/api/tenant/${slug}`, fetcher);
  
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone || !password) {
      toast.error('กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/tenant/${slug}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      localStorage.setItem('tenant_customer', JSON.stringify(data.customer));
      localStorage.setItem('tenant_token', data.token);
      
      toast.success('เข้าสู่ระบบสำเร็จ');
      router.replace(`/t/${slug}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  const primaryColor = tenant?.primary_color || '#f59e0b';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex flex-col">
      {/* Header */}
      <div className="text-center pt-8 pb-4">
        {tenant?.logo_url ? (
          <img src={tenant.logo_url} alt={tenant.name} className="h-20 mx-auto" />
        ) : (
          <h1 className="text-3xl font-bold" style={{ color: primaryColor }}>
            {tenant?.name || 'Loading...'}
          </h1>
        )}
        <p className="text-gray-400 mt-2">ระบบหวยออนไลน์ที่ดีที่สุด</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-green-400 text-sm">จ่ายจริง โอนไว มั่นคง 100%</span>
        </div>
      </div>

      {/* Login Form */}
      <div className="flex-1 flex items-start justify-center px-4 pt-4">
        <div className="w-full max-w-md">
          <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-center mb-6" style={{ color: primaryColor }}>
              เข้าสู่ระบบ
              <div className="h-1 w-16 mx-auto mt-2 rounded-full" style={{ backgroundColor: primaryColor }} />
            </h2>

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Phone Input */}
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  placeholder="เบอร์โทรศัพท์"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Password Input */}
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="รหัสผ่าน"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-xl py-4 pl-12 pr-12 text-white placeholder:text-gray-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 rounded-xl font-bold text-black transition-all disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  'เข้าสู่ระบบ'
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-gray-700" />
              <span className="text-gray-500 text-sm">หรือ</span>
              <div className="flex-1 h-px bg-gray-700" />
            </div>

            {/* Social Login */}
            <div className="grid grid-cols-2 gap-3">
              <button className="flex items-center justify-center gap-2 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M5.26620003,9.76452941 C6.19878754,6.93863203 8.85444915,4.90909091 12,4.90909091 C13.6909091,4.90909091 15.2181818,5.50909091 16.4181818,6.49090909 L19.9090909,3 C17.7818182,1.14545455 15.0545455,0 12,0 C7.27006974,0 3.1977497,2.69829785 1.23999023,6.65002441 L5.26620003,9.76452941 Z"/>
                  <path fill="#34A853" d="M16.0407269,18.0125889 C14.9509167,18.7163016 13.5660892,19.0909091 12,19.0909091 C8.86648613,19.0909091 6.21911939,17.076871 5.27698177,14.2678769 L1.23746264,17.3349879 C3.19279051,21.2970142 7.26500293,24 12,24 C14.9328362,24 17.7353462,22.9573905 19.834192,20.9995801 L16.0407269,18.0125889 Z"/>
                  <path fill="#4A90E2" d="M19.834192,20.9995801 C22.0291676,18.9520994 23.4545455,15.903663 23.4545455,12 C23.4545455,11.2909091 23.3454545,10.5272727 23.1818182,9.81818182 L12,9.81818182 L12,14.4545455 L18.4363636,14.4545455 C18.1187732,16.013626 17.2662994,17.2212117 16.0407269,18.0125889 L19.834192,20.9995801 Z"/>
                  <path fill="#FBBC05" d="M5.27698177,14.2678769 C5.03832634,13.556323 4.90909091,12.7937589 4.90909091,12 C4.90909091,11.2182781 5.03443647,10.4668121 5.26620003,9.76452941 L1.23999023,6.65002441 C0.43658717,8.26043162 0,10.0753848 0,12 C0,13.9195484 0.444780743,15.7## L1.23746264,17.3349879 L5.27698177,14.2678769 Z"/>
                </svg>
                <span className="text-white text-sm">Google</span>
              </button>
              <button className="flex items-center justify-center gap-2 py-3 bg-[#06C755] hover:bg-[#05b34c] rounded-xl transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.105.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                </svg>
                <span className="text-white text-sm">LINE</span>
              </button>
            </div>
          </div>

          {/* Register Link */}
          <p className="text-center mt-6 text-gray-400">
            ยังไม่มีบัญชี?{' '}
            <Link href={`/t/${slug}/register`} className="font-bold" style={{ color: primaryColor }}>
              สมัครสมาชิก
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
