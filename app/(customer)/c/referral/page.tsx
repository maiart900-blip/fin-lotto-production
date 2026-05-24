'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Copy, 
  Check, 
  Link2, 
  Users, 
  Gift, 
  QrCode,
  Share2,
  Loader2,
  TrendingUp,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
};

export default function CustomerReferralPage() {
  const [copied, setCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [showQR, setShowQR] = useState(false);

  // ใช้ API แทน localStorage
  const { data: session, isLoading: sessionLoading } = useSWR('/api/customer/auth/session', fetcher);
  const customer = session?.customer;
  const customerId = customer?.id;

  const { data: referralData, isLoading: referralLoading } = useSWR(
    customerId ? `/api/customer/referral?customerId=${customerId}` : null,
    fetcher
  );

  const referralCode = customer?.referral_code || referralData?.referral_code || '';
  const referralLink = typeof window !== 'undefined' && referralCode
    ? `${window.location.origin}/c/register?ref=${referralCode}`
    : '';
  const referralCount = referralData?.referral_count || 0;
  const totalCommission = referralData?.total_commission || 0;

  useEffect(() => {
    if (referralLink) {
      QRCode.toDataURL(referralLink, {
        width: 256,
        margin: 2,
        color: {
          dark: '#dc2626',
          light: '#ffffff',
        },
      }).then(setQrCodeUrl).catch(() => {});
    }
  }, [referralLink]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('คัดลอกแล้ว!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'สมัครสมาชิก สลากพลัส',
          text: 'มาแทงหวยออนไลน์กับฉันสิ! สมัครผ่านลิงก์นี้',
          url: referralLink,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      copyToClipboard(referralLink);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const isLoading = sessionLoading || referralLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
        <p className="text-muted-foreground mb-4">กรุณาเข้าสู่ระบบ</p>
        <Link href="/c/login">
          <Button>เข้าสู่ระบบ</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/c">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">ลิงก์แนะนำเพื่อน</h1>
          <p className="text-sm text-muted-foreground">ชวนเพื่อนมาเล่น รับค่าคอมมิชชั่น</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="bg-gradient-to-br from-primary/20 to-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <Users className="size-6 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{referralCount}</p>
            <p className="text-xs text-muted-foreground">เพื่อนที่แนะนำ</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 border-yellow-500/20">
          <CardContent className="p-4 text-center">
            <Gift className="size-6 mx-auto text-yellow-500 mb-2" />
            <p className="text-2xl font-bold">{formatMoney(totalCommission)}</p>
            <p className="text-xs text-muted-foreground">ค่าคอมรวม</p>
          </CardContent>
        </Card>
      </div>

      {/* Referral Code */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="size-4" />
            รหัสแนะนำ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-muted rounded-lg p-3 font-mono text-lg text-center font-bold tracking-wider">
              {referralCode || 'ไม่มีรหัส'}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(referralCode)}
              disabled={!referralCode}
            >
              {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Referral Link */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">ลิงก์แนะนำเพื่อน</CardTitle>
          <CardDescription>แชร์ลิงก์นี้ให้เพื่อนสมัครสมาชิก</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-muted rounded-lg p-3 break-all text-sm">
            {referralLink || 'ไม่มีลิงก์'}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => copyToClipboard(referralLink)}
              disabled={!referralLink}
            >
              <Copy className="size-4 mr-1" />
              คัดลอก
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowQR(true)}
              disabled={!qrCodeUrl}
            >
              <QrCode className="size-4 mr-1" />
              QR
            </Button>
            <Button
              className="w-full bg-primary"
              onClick={shareLink}
              disabled={!referralLink}
            >
              <Share2 className="size-4 mr-1" />
              แชร์
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Benefits */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="size-4 text-green-500" />
            สิทธิประโยชน์
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <Badge variant="secondary" className="mt-0.5">1</Badge>
              <span>รับค่าคอมมิชชั่นจากยอดแทงของเพื่อน</span>
            </li>
            <li className="flex items-start gap-2">
              <Badge variant="secondary" className="mt-0.5">2</Badge>
              <span>รับโบนัสพิเศษเมื่อเพื่อนสมัครสำเร็จ</span>
            </li>
            <li className="flex items-start gap-2">
              <Badge variant="secondary" className="mt-0.5">3</Badge>
              <span>ไม่จำกัดจำนวนเพื่อนที่แนะนำ</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* QR Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">QR Code แนะนำเพื่อน</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center p-4">
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 rounded-lg" />
            ) : (
              <Loader2 className="size-12 animate-spin" />
            )}
            <p className="text-sm text-muted-foreground mt-3 text-center">
              ให้เพื่อนสแกน QR นี้เพื่อสมัครสมาชิก
            </p>
            <Button
              className="w-full mt-4"
              onClick={() => {
                const link = document.createElement('a');
                link.download = 'referral-qr.png';
                link.href = qrCodeUrl;
                link.click();
              }}
            >
              บันทึก QR Code
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
