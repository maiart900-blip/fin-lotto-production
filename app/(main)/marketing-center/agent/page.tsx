'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { 
  UsersRound, 
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
  TrendingUp,
  DollarSign,
  Activity
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function AgentDashboardLinkPage() {
  const [copied, setCopied] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  
  // Fetch real data from database
  const { data: agentsData } = useSWR('/api/agents', fetcher, { refreshInterval: 30000 });
  const agents = agentsData?.agents || [];
  const summary = agentsData?.summary || {};
  
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://finlotto.com';
  const agentPath = '/agent';
  
  const getFullUrl = () => {
    let url = `${baseUrl}${agentPath}`;
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
    const svg = document.getElementById('agent-qr');
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
      downloadLink.download = 'finlotto-agent-qr.png';
      downloadLink.href = pngFile;
      downloadLink.click();
      toast.success('ดาวน์โหลด QR Code แล้ว');
    };
    
    img.crossOrigin = 'anonymous';
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  // Calculate active agents (with activity in last 24 hours)
  const activeToday = agents.filter((a: any) => {
    if (!a.last_activity_at) return false;
    const lastActivity = new Date(a.last_activity_at);
    const now = new Date();
    return (now.getTime() - lastActivity.getTime()) < 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="min-h-screen bg-black p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="size-12 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.4)]">
            <UsersRound className="size-6 text-black" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[#D4AF37] drop-shadow-[0_0_10px_rgba(212,175,55,0.3)]">แดชบอร์ดเอเย่นต์</h1>
            <p className="text-[#888888]">จัดการลิงก์แดชบอร์ดสำหรับ Partner</p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center">
                <UsersRound className="size-5 text-black" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#D4AF37]">{summary.total || agents.length}</p>
                <p className="text-xs text-[#666666]">เอเย่นต์ทั้งหมด</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-gradient-to-br from-[#22C55E] to-[#16A34A] flex items-center justify-center">
                <Activity className="size-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#22C55E]">{summary.active || 0}</p>
                <p className="text-xs text-[#666666]">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#2563EB] flex items-center justify-center">
                <TrendingUp className="size-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#3B82F6]">{formatCurrency(summary.totalBets || 0)}</p>
                <p className="text-xs text-[#666666]">ยอดรวม</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-gradient-to-br from-[#F59E0B] to-[#D97706] flex items-center justify-center">
                <DollarSign className="size-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#F59E0B]">{formatCurrency(summary.totalCommission || 0)}</p>
                <p className="text-xs text-[#666666]">คอมมิชชั่นรวม</p>
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
                  <a href={agentPath} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Agent Features */}
          <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.3)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[#D4AF37] text-sm flex items-center gap-2">
                <Crown className="size-4 text-[#D4AF37]" />
                ฟีเจอร์ในแดชบอร์ด
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[#121212] border border-[#2a2a2a]">
                <TrendingUp className="size-5 text-[#22C55E]" />
                <div>
                  <p className="text-[#E5E5E5] text-sm font-medium">ดูยอดสายงาน</p>
                  <p className="text-[#666666] text-xs">สมาชิก, ยอดแทง, กำไร</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[#121212] border border-[#2a2a2a]">
                <DollarSign className="size-5 text-[#D4AF37]" />
                <div>
                  <p className="text-[#E5E5E5] text-sm font-medium">ถอนคอมมิชชั่น</p>
                  <p className="text-[#666666] text-xs">กดถอนได้ตลอดเวลา</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-[#121212] border border-[#2a2a2a]">
                <UsersRound className="size-5 text-[#3B82F6]" />
                <div>
                  <p className="text-[#E5E5E5] text-sm font-medium">จัดการสมาชิก</p>
                  <p className="text-[#666666] text-xs">ดูรายชื่อ, ยอดแทง</p>
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
                สแกนเพื่อเข้าแดชบอร์ดเอเย่นต์
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 flex flex-col items-center">
              {/* QR Code Display */}
              <div className="p-6 bg-white rounded-2xl border-4 border-[#D4AF37] shadow-[0_0_30px_rgba(212,175,55,0.3)]">
                <QRCodeSVG
                  id="agent-qr"
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
                <Badge className="bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border border-[rgba(212,175,55,0.3)] mb-2">
                  Partner
                </Badge>
                <h3 className="text-[#E5E5E5] font-semibold">แดชบอร์ดเอเย่นต์</h3>
                <p className="text-[#666666] text-sm mt-1">
                  หน้าเฉพาะสำหรับ Partner ดูยอดสายงาน
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

        {/* Right Column - Recent Agents */}
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
                <a href={agentPath} target="_blank" rel="noopener noreferrer">
                  <Eye className="size-4 mr-2" />
                  ดูตัวอย่างหน้า
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* Recent Agents */}
          <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[#D4AF37] text-sm flex items-center gap-2">
                <UsersRound className="size-4 text-[#D4AF37]" />
                เอเย่นต์ล่าสุด
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {agents.length === 0 ? (
                <p className="text-[#666666] text-sm text-center py-4">ยังไม่มีเอเย่นต์</p>
              ) : (
                agents.slice(0, 5).map((agent: any) => (
                  <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg bg-[#121212] border border-[#2a2a2a]">
                    <div className="flex items-center gap-2">
                      <div className={`size-2 rounded-full ${agent.status === 'active' ? 'bg-green-500' : 'bg-gray-500'}`} />
                      <div>
                        <p className="text-white text-sm font-medium">{agent.name}</p>
                        <p className="text-[#666666] text-xs">{agent.code}</p>
                      </div>
                    </div>
                    <p className="text-[#D4AF37] text-sm font-medium">{formatCurrency(agent.total_bets || 0)}</p>
                  </div>
                ))
              )}
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
                <span>ส่งลิงก์นี้ให้ Partner ของคุณเท่านั้น</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#D4AF37]">2.</span>
                <span>Partner สามารถดูยอดและถอนคอมมิชชั่นได้</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#D4AF37]">3.</span>
                <span>ระบบจะแสดงเฉพาะข้อมูลของสายงานตัวเอง</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
