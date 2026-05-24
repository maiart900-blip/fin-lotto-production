'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CreditCard, Clock } from 'lucide-react';

export default function AgentTopupCreditPage() {
  return (
    <div className="min-h-screen bg-[#0A0F1C] p-4 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <CreditCard className="size-5 text-amber-400" />
          เติมเครดิต
        </h1>
        <p className="text-white/60 text-sm mt-1">เติมเครดิตให้ลูกค้าในสายงาน</p>
      </div>

      <Card className="bg-[#0D1321] border-amber-500/30">
        <CardHeader>
          <CardTitle className="text-amber-400 flex items-center gap-2 text-base">
            <Clock className="size-4" />
            กำลังเตรียมระบบ
          </CardTitle>
          <CardDescription className="text-white/60 text-sm">
            หน้าเติมเครดิตกำลังอยู่ในขั้นตอนการพัฒนา
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-white/70 text-sm">
            <p>จะสามารถเติมเครดิตให้ลูกค้าในสายงานได้จากหน้านี้</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
