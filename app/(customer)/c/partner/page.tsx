'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Handshake, 
  TrendingUp, 
  DollarSign, 
  BarChart3, 
  Calendar,
  Users,
  Link as LinkIcon,
  Copy,
  Check,
  QrCode,
  Wallet,
  Target,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function CustomerPartnerPage() {
  const { data: session } = useSWR('/api/customer/auth/session', fetcher);
  const { data: partnerData } = useSWR('/api/customer/partner', fetcher);
  const { data: teamData } = useSWR('/api/customer/team', fetcher);

  const [copied, setCopied] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);

  const customer = session?.customer;
  const isPartner = customer?.is_partner || false;
  const referralCode = customer?.referral_code || '';
  
  // Get base URL
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const referralLink = `${baseUrl}/c/register?ref=${referralCode}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success('คัดลอกลิงก์แล้ว');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('ไม่สามารถคัดลอกได้');
    }
  };

  const generateQR = async () => {
    try {
      const qr = await QRCode.toDataURL(referralLink, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrImage(qr);
      setQrDialogOpen(true);
    } catch {
      toast.error('ไม่สามารถสร้าง QR Code ได้');
    }
  };

  // Calculate today and this month earnings
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().slice(0, 7);
  
  const todayEarnings = partnerData?.dailyEarnings?.[today] || 0;
  const monthlyEarnings = partnerData?.monthlySummary?.find(
    (m: { period: string }) => m.period === thisMonth
  )?.earnings || 0;

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/c">
            <Button variant="ghost" size="icon" className="text-white">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">พาร์ทเนอร์</h1>
        </div>

        {/* Referral Link Card - Show for all users */}
        <Card className="bg-gradient-to-r from-red-600 to-red-700 border-0">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <LinkIcon className="h-8 w-8 text-white/80" />
              <div>
                <p className="text-sm text-white/70">ลิงก์แนะนำเพื่อน</p>
                <p className="font-bold">รหัสแนะนำ: {referralCode}</p>
              </div>
            </div>
            
            <div className="bg-black/20 rounded-lg p-3">
              <code className="text-xs break-all text-white/80">{referralLink}</code>
            </div>
            
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-white/20 hover:bg-white/30 text-white"
                onClick={copyToClipboard}
              >
                {copied ? (
                  <Check className="h-4 w-4 mr-2 text-green-400" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                คัดลอก
              </Button>
              <Button
                className="bg-white/20 hover:bg-white/30 text-white"
                onClick={generateQR}
              >
                <QrCode className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Team Stats */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-500/20">
                <Users className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-neutral-400">จำนวนลูกทีม</p>
                <p className="text-2xl font-bold">{teamData?.total || 0} <span className="text-sm font-normal text-neutral-500">คน</span></p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isPartner ? (
          <>
            {/* Partner Status */}
            <Card className="bg-gradient-to-r from-amber-600 to-amber-700 border-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Handshake className="h-10 w-10 text-white/80" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-white/70">สถานะพาร์ทเนอร์</p>
                      <Badge className="bg-green-500/20 text-green-300 border-0">เปิดใช้งาน</Badge>
                    </div>
                    <p className="text-xl font-bold">ส่วนแบ่ง {partnerData?.sharePercent || 15}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-neutral-900 border-neutral-800">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-500" />
                  <p className="text-2xl font-bold">{Number(partnerData?.totalSales || 0).toLocaleString()}</p>
                  <p className="text-xs text-neutral-400">ยอดแทงลูกทีม (บาท)</p>
                </CardContent>
              </Card>
              
              <Card className="bg-neutral-900 border-neutral-800">
                <CardContent className="p-4 text-center">
                  <Wallet className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
                  <p className="text-2xl font-bold">{Number(partnerData?.totalEarnings || 0).toLocaleString()}</p>
                  <p className="text-xs text-neutral-400">รายได้รวม (บาท)</p>
                </CardContent>
              </Card>

              <Card className="bg-neutral-900 border-neutral-800">
                <CardContent className="p-4 text-center">
                  <Clock className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                  <p className="text-2xl font-bold text-green-400">+{Number(todayEarnings).toLocaleString()}</p>
                  <p className="text-xs text-neutral-400">รายได้วันนี้</p>
                </CardContent>
              </Card>

              <Card className="bg-neutral-900 border-neutral-800">
                <CardContent className="p-4 text-center">
                  <Target className="h-6 w-6 mx-auto mb-2 text-purple-500" />
                  <p className="text-2xl font-bold text-green-400">+{Number(monthlyEarnings).toLocaleString()}</p>
                  <p className="text-xs text-neutral-400">รายได้เดือนนี้</p>
                </CardContent>
              </Card>
            </div>

            {/* Commission */}
            <Card className="bg-neutral-900 border-neutral-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-yellow-500/20">
                    <DollarSign className="h-6 w-6 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-400">ค่าคอมมิชชั่น</p>
                    <p className="text-2xl font-bold">{Number(partnerData?.commission || 0).toLocaleString()} <span className="text-sm font-normal text-neutral-500">บาท</span></p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Summary */}
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  สรุปรายเดือน
                </CardTitle>
              </CardHeader>
              <CardContent>
                {partnerData?.monthlySummary?.length > 0 ? (
                  <div className="space-y-3">
                    {partnerData.monthlySummary.map((month: { period: string; sales: number; earnings: number }) => (
                      <div key={month.period} className="bg-neutral-800 rounded-lg p-3 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-neutral-400" />
                          <span>{month.period}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-green-400">+{Number(month.earnings).toLocaleString()} บาท</p>
                          <p className="text-xs text-neutral-500">ยอดขาย {Number(month.sales).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BarChart3 className="h-12 w-12 mx-auto text-neutral-700 mb-3" />
                    <p className="text-neutral-500">ยังไม่มีข้อมูลรายเดือน</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          /* Non-Partner View */
          <Card className="bg-neutral-900 border-neutral-800">
            <CardContent className="p-6 text-center">
              <Handshake className="h-16 w-16 mx-auto text-neutral-600 mb-4" />
              <h2 className="text-xl font-bold mb-2">โปรแกรมพาร์ทเนอร์</h2>
              <p className="text-neutral-400 mb-4">
                คุณยังไม่ได้เป็นพาร์ทเนอร์ กรุณาติดต่อแอดมินเพื่อสมัครเป็นพาร์ทเนอร์
              </p>
              
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-left">
                <h3 className="font-semibold text-amber-400 mb-2">สิทธิประโยชน์พาร์ทเนอร์</h3>
                <ul className="text-sm text-neutral-400 space-y-2">
                  <li className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-yellow-500" />
                    รับส่วนแบ่งรายได้สูงถึง 15%
                  </li>
                  <li className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    เข้าถึงรายงานยอดขายแบบ realtime
                  </li>
                  <li className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-500" />
                    สามารถดูข้อมูลลูกค้าในสายงาน
                  </li>
                  <li className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-purple-500" />
                    รับโบนัสพิเศษตามเป้าหมาย
                  </li>
                </ul>
              </div>
              
              <Button className="mt-4 bg-amber-600 hover:bg-amber-700 w-full">
                ติดต่อแอดมิน
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* QR Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm bg-neutral-900 border-neutral-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <QrCode className="h-5 w-5 text-red-500" />
              QR Code แนะนำเพื่อน
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrImage && (
              <img
                src={qrImage}
                alt="QR Code"
                className="w-64 h-64 rounded-lg"
              />
            )}
            <code className="text-xs bg-neutral-800 px-3 py-2 rounded break-all max-w-full text-neutral-300">
              {referralLink}
            </code>
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1 border-neutral-700"
                onClick={copyToClipboard}
              >
                <Copy className="h-4 w-4 mr-2" />
                คัดลอกลิงก์
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-neutral-700"
                onClick={() => {
                  if (qrImage) {
                    const link = document.createElement('a');
                    link.download = `qr-referral.png`;
                    link.href = qrImage;
                    link.click();
                  }
                }}
              >
                ดาวน์โหลด QR
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
