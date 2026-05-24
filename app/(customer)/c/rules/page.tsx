'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ScrollText, CheckCircle } from 'lucide-react';

export default function RulesPage() {
  const router = useRouter();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const res = await fetch('/api/content-pages?slug=rules');
      const data = await res.json();
      if (data.page) {
        setContent(data.page.content || '');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const defaultRules = [
    'สมาชิกต้องมีอายุ 20 ปีขึ้นไป',
    'ห้ามใช้โปรแกรมช่วยเล่นทุกชนิด',
    'ห้ามสมัครสมาชิกซ้ำซ้อน',
    'การตัดสินของแอดมินถือเป็นที่สิ้นสุด',
    'ผลหวยอ้างอิงจากเว็บหวยทางการเท่านั้น',
    'ยอดแทงขั้นต่ำ 1 บาท สูงสุด 10,000 บาท/เลข',
    'สามารถยกเลิกโพยได้ก่อนปิดรับแทง 5 นาที',
    'การถอนเงินขั้นต่ำ 100 บาท',
    'ต้องทำยอดหมุนเวียน 1 เท่าก่อนถอนเงิน',
    'บริษัทขอสงวนสิทธิ์ในการเปลี่ยนแปลงกฎกติกาโดยไม่ต้องแจ้งล่วงหน้า',
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="text-lg font-semibold">กฎกติกา</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Banner */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-900 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3">
            <ScrollText className="size-10" />
            <div>
              <h2 className="text-xl font-bold">กฎกติกาการใช้งาน</h2>
              <p className="text-white/80 text-sm">โปรดอ่านและทำความเข้าใจก่อนใช้งาน</p>
            </div>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-6 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : content ? (
          <Card>
            <CardContent className="p-6 prose prose-sm max-w-none">
              <div dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br/>') }} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-3">
                {defaultRules.map((rule, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle className="size-5 text-green-500 mt-0.5 shrink-0" />
                    <p className="text-sm">{rule}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Acceptance */}
        <p className="text-xs text-gray-500 text-center px-4">
          การใช้บริการถือว่าท่านยอมรับกฎกติกาทั้งหมดข้างต้น
        </p>
      </div>
    </div>
  );
}
