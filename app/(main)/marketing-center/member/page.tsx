'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { 
  Users, 
  Copy, 
  Check, 
  ExternalLink, 
  QrCode,
  Download,
  Link2,
  Eye,
  Share2,
  Sparkles,
  Crown,
  Trophy,
  Star,
  Wallet,
  Activity,
  TrendingUp
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Customer {
  id: string;
  name: string;
  is_active: boolean;
  credit_balance: number;
  total_turnover: number;
  created_at: string;
  user_type: string;
}

export default function MemberDashboardLinkPage() {
  const [copied, setCopied] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  
  // Fetch real data from database
  const { data: customers, isLoading } = useSWR<Customer[]>('/api/customers', fetcher);
  
  // Calculate real stats
  const totalMembers = customers?.length || 0;
  const vipMembers = customers?.filter(c => c.user_type === 'vip' || (c.total_turnover || 0) >= 10000)?.length || 0;
  const activeMembers = customers?.filter(c => c.is_active)?.length || 0;
  const totalTurnover = customers?.reduce((sum, c) => sum + (c.total_turnover || 0), 0) || 0;
  
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://finlotto.com';
  const memberPath = '/c';
  
  const getFullUrl = () => {
    let url = `${baseUrl}${memberPath}`;
    if (referralCode) {
      url += `?ref=${referralCode}`;
    }
    return url;
  };

  const fullUrl = getFullUrl();

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    toast.success('คัดลอกลิงก์แล้ว');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQRCode = () => {
    const svg = document.getElementById('member-qr');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 512;
      canvas.height = 512;
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 512, 512);
        ctx.drawImage(img, 56, 56, 400, 400);
        ctx.strokeStyle = '#D4AF37';
        ctx.lineWidth = 4;
        ctx.strokeRect(40, 40, 432, 432);
      }
      
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = 'finlotto-member-qr.png';
      downloadLink.href = pngFile;
      downloadLink.click();
      toast.success('ดาวน์โหลด QR Code แล้ว');
    };
    
    img.crossOrigin = 'anonymous';
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-black p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="size-12 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.4)]">
            <Users className="size-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[#D4AF37] drop-shadow-[0_0_10px_rgba(212,175,55,0.3)]">หน้าหลักสมาชิก</h1>
            <p className="text-[#888888]">จัดการลิงก์ Dashboard ส่วนตัวของสมาชิก</p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-[#666666]">สมาชิกทั้งหมด</p>
                <p className="text-xl font-bold text-white">
                  {isLoading ? '...' : formatNumber(totalMembers)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Activity className="size-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-[#666666]">Active</p>
                <p className="text-xl font-bold text-white">
                  {isLoading ? '...' : formatNumber(activeMembers)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Crown className="size-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-[#666666]">VIP Members</p>
                <p className="text-xl font-bold text-white">
                  {isLoading ? '...' : formatNumber(vipMembers)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#D4AF37]/10">
                <TrendingUp className="size-5 text-[#D4AF37]" />
              </div>
              <div>
                <p className="text-xs text-[#666666]">ยอดเทิร์นรวม</p>
                <p className="text-xl font-bold text-[#D4AF37]">
                  {isLoading ? '...' : formatNumber(totalTurnover)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Settings */}
        <div className="space-y-6">
          {/* Referral Code */}
          <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
            <CardHeader className="border-b border-[rgba(212,175,55,0.1)] pb-4">
              <CardTitle className="text-[#D4AF37] flex items-center gap-2">
                <Share2 className="size-5 text-[#D4AF37] drop-shadow-[0_0_4px_rgba(212,175,55,0.5)]" />
                รหัสแนะนำ
              </CardTitle>
              <CardDescription className="text-[#666666]">
                ใส่รหัส Agent เพื่อติดท้ายลิงก์
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                <Label className="text-[#888888]">Referral Code</Label>
                <Input
                  placeholder="เช่น AG001, PARTNER123"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  className="bg-[#121212] border-[#2a2a2a] text-white placeholder:text-[#555555] focus:border-[#D4AF37] font-mono"
                />
                {referralCode && (
                  <Badge className="bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border border-[rgba(212,175,55,0.3)]">
                    ?ref={referralCode}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Link Preview */}
          <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
            <CardHeader className="border-b border-[rgba(212,175,55,0.1)] pb-4">
              <CardTitle className="text-[#D4AF37] flex items-center gap-2">
                <Link2 className="size-5 text-[#D4AF37] drop-shadow-[0_0_4px_rgba(212,175,55,0.5)]" />
                URL ที่สร้าง
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="p-4 rounded-lg bg-[#121212] border border-[#2a2a2a]">
                <code className="text-sm text-[#888888] break-all font-mono">
                  {fullUrl}
                </code>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={copyToClipboard}
                  className="flex-1 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-semibold hover:from-[#F5D061] hover:to-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                >
                  {copied ? (
                    <>
                      <Check className="size-4 mr-2" />
                      คัดลอกแล้ว
                    </>
                  ) : (
                    <>
                      <Copy className="size-4 mr-2" />
                      คัดลอกลิงก์
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="border-[rgba(212,175,55,0.3)] text-[#D4AF37] hover:bg-[rgba(212,175,55,0.1)] hover:text-[#F5D061]"
                  asChild
                >
                  <a href={memberPath} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* VIP Features */}
          <Card className="bg-[#0a0a0a] border-[rgba(139,92,246,0.3)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[#8B5CF6] text-sm flex items-center gap-2">
                <Crown className="size-4" />
                ฟีเจอร์ VIP ในหน้าสมาชิก
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[#121212] border border-[#2a2a2a]">
                <Star className="size-5 text-[#D4AF37]" />
                <div>
                  <p className="text-[#E5E5E5] text-sm font-medium">VIP Rank</p>
                  <p className="text-[#666666] text-xs">แสดงระดับ VIP ของสมาชิก</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[#121212] border border-[#2a2a2a]">
                <Trophy className="size-5 text-[#22C55E]" />
                <div>
                  <p className="text-[#E5E5E5] text-sm font-medium">ประวัติการแทง</p>
                  <p className="text-[#666666] text-xs">ดูผลแพ้ชนะย้อนหลัง</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[#121212] border border-[#2a2a2a]">
                <Wallet className="size-5 text-[#3B82F6]" />
                <div>
                  <p className="text-[#E5E5E5] text-sm font-medium">Wallet</p>
                  <p className="text-[#666666] text-xs">ฝาก-ถอน, ดูยอดเงิน</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center Column - QR Code */}
        <div>
          <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)] h-full">
            <CardHeader className="border-b border-[rgba(212,175,55,0.1)] pb-4">
              <CardTitle className="text-[#D4AF37] text-center flex items-center justify-center gap-2">
                <QrCode className="size-5 text-[#D4AF37] drop-shadow-[0_0_4px_rgba(212,175,55,0.5)]" />
                QR Code
              </CardTitle>
              <CardDescription className="text-[#666666] text-center">
                สแกนเพื่อเข้าหน้าหลักสมาชิก
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 flex flex-col items-center">
              {/* QR Code Display */}
              <div className="p-6 bg-white rounded-2xl border-4 border-[#D4AF37] shadow-[0_0_30px_rgba(212,175,55,0.3)]">
                <QRCodeSVG
                  id="member-qr"
                  value={fullUrl}
                  size={200}
                  level="H"
                  includeMargin={false}
                  fgColor="#000000"
                  bgColor="#FFFFFF"
                />
              </div>

              {/* Page Info */}
              <div className="mt-6 text-center">
                <Badge className="bg-[rgba(139,92,246,0.15)] text-[#8B5CF6] border border-[rgba(139,92,246,0.3)] mb-2">
                  VIP Zone
                </Badge>
                <h3 className="text-[#E5E5E5] font-semibold">หน้าหลักสมาชิก</h3>
                <p className="text-[#666666] text-sm mt-1">
                  Dashboard ส่วนตัวของคนแทงหวย
                </p>
              </div>

              {/* Download Button */}
              <Button
                onClick={downloadQRCode}
                className="mt-6 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-semibold hover:from-[#F5D061] hover:to-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.3)]"
              >
                <Download className="size-4 mr-2" />
                ดาวน์โหลด QR Code
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Actions & Tips */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card className="bg-gradient-to-br from-[rgba(212,175,55,0.1)] to-[rgba(184,134,11,0.05)] border-[rgba(212,175,55,0.3)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[#D4AF37] text-sm flex items-center gap-2">
                <Sparkles className="size-4 text-[#D4AF37] drop-shadow-[0_0_4px_rgba(212,175,55,0.5)]" />
                การดำเนินการด่วน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={copyToClipboard}
                className="w-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-semibold hover:from-[#F5D061] hover:to-[#D4AF37]"
              >
                <Copy className="size-4 mr-2" />
                คัดลอกลิงก์
              </Button>
              <Button
                onClick={downloadQRCode}
                variant="outline"
                className="w-full border-[rgba(212,175,55,0.3)] text-[#D4AF37] hover:bg-[rgba(212,175,55,0.1)]"
              >
                <Download className="size-4 mr-2" />
                ดาวน์โหลด QR
              </Button>
              <Button
                variant="outline"
                className="w-full border-[rgba(212,175,55,0.3)] text-[#D4AF37] hover:bg-[rgba(212,175,55,0.1)]"
                asChild
              >
                <a href={memberPath} target="_blank" rel="noopener noreferrer">
                  <Eye className="size-4 mr-2" />
                  ดูตัวอย่างหน้า
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[#D4AF37] text-sm flex items-center gap-2">
                <Sparkles className="size-4 text-[#D4AF37] drop-shadow-[0_0_4px_rgba(212,175,55,0.5)]" />
                Tips การใช้งาน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[#888888]">
              <div className="flex items-start gap-2">
                <span className="text-[#D4AF37]">1.</span>
                <span>ส่งลิงก์นี้ให้สมาชิกเพื่อเข้าหน้าส่วนตัว</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#D4AF37]">2.</span>
                <span>สมาชิกสามารถดู VIP Rank และสิทธิพิเศษได้</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#D4AF37]">3.</span>
                <span>หน้านี้แสดงเฉพาะข้อมูลของสมาชิกคนนั้น</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
