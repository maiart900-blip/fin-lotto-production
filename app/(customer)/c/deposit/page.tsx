'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// Redirect to /c/topup - unified deposit page
export default function DepositRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/c/topup');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="size-8 animate-spin text-amber-400 mx-auto mb-4" />
        <p className="text-white/60">กำลังโหลดหน้าเติมเงิน...</p>
      </div>
    </div>
  );
}
