'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardCheck, CreditCard, ArrowDownToLine, AlertTriangle, FileText, Receipt } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function PendingReviewPage() {
  const { data: pendingCounts } = useSWR('/api/admin/pending-counts', fetcher, {
    refreshInterval: 5000,
  });

  const items = [
    {
      title: 'คำขอเติมเงิน',
      href: '/topup-requests',
      icon: CreditCard,
      count: pendingCounts?.topupPending || 0,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: 'รอตรวจสลิป',
      href: '/topup-requests?status=pending_slip',
      icon: Receipt,
      count: pendingCounts?.slipPending || 0,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'คำขอถอนเงิน',
      href: '/withdraw-requests',
      icon: ArrowDownToLine,
      count: pendingCounts?.withdrawPending || 0,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      title: 'แจ้งปัญหาฝากเงิน',
      href: '/deposit-issues',
      icon: AlertTriangle,
      count: pendingCounts?.depositIssuesPending || 0,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  const totalPending = pendingCounts?.totalPending || 0;

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen -m-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-100">
          <ClipboardCheck className="size-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">รายการรอตรวจสอบ</h1>
          <p className="text-gray-600">
            รวมรายการที่ต้องดำเนินการทั้งหมด {totalPending} รายการ
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {items.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className={`cursor-pointer bg-white border-gray-200 shadow-sm hover:border-blue-400 transition-colors ${item.count > 0 ? 'border-red-300' : ''}`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-gray-900">
                  <div className={`p-2 rounded-lg ${item.bgColor}`}>
                    <item.icon className={`size-5 ${item.color}`} />
                  </div>
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-sm">รอดำเนินการ</span>
                  <span className={`text-3xl font-bold ${item.count > 0 ? item.color : 'text-gray-400'}`}>
                    {item.count}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {totalPending === 0 && (
        <Card className="border-dashed bg-white border-gray-300">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="size-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <ClipboardCheck className="size-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-green-600">ไม่มีรายการรอตรวจสอบ</h3>
            <p className="text-sm text-gray-500 mt-1">ทุกรายการได้รับการดำเนินการแล้ว</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
