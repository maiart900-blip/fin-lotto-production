'use client';

import { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Download, 
  Copy, 
  Check, 
  Link2, 
  UserPlus, 
  Key, 
  Users, 
  Handshake,
  Crown,
  Sparkles,
  QrCode,
  UsersRound
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// Marketing Links Configuration
const MARKETING_LINKS = [
  {
    id: 'register',
    title: 'หน้าสมัครสมาชิก',
    description: 'ลิงก์ทองคำสำหรับส่งให้ลูกค้าใหม่',
    path: '/c/register',
    icon: UserPlus,
    color: 'from-[#22C55E] to-[#16A34A]',
    badge: 'สำคัญ',
    badgeColor: 'bg-[rgba(34,197,94,0.15)] text-[#22C55E] border-[rgba(34,197,94,0.3)]',
  },
  {
    id: 'login',
    title: 'หน้าเข้าสู่ระบบ',
    description: 'ทางเข้าพรีเมียมสำหรับทุกคนในระบบ',
    path: '/c/login',
    icon: Key,
    color: 'from-[#3B82F6] to-[#2563EB]',
    badge: 'ทางเข้าหลัก',
    badgeColor: 'bg-[rgba(59,130,246,0.15)] text-[#3B82F6] border-[rgba(59,130,246,0.3)]',
  },
  {
    id: 'agent',
    title: 'แดชบอร์ดเอเย่นต์',
    description: 'หน้าเฉพาะสำหรับ Partner ดูยอดสายงาน',
    path: '/agent-dashboard',
    icon: UsersRound,
    color: 'from-[#D4AF37] to-[#B8860B]',
    badge: 'Partner',
    badgeColor: 'bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border-[rgba(212,175,55,0.3)]',
  },
  {
    id: 'member',
    title: 'หน้าหลักสมาชิก',
    description: 'Dashboard ส่วนตัวของคนแทงหวย',
    path: '/c',
    icon: Users,
    color: 'from-[#8B5CF6] to-[#7C3AED]',
    badge: 'VIP Zone',
    badgeColor: 'bg-[rgba(139,92,246,0.15)] text-[#8B5CF6] border-[rgba(139,92,246,0.3)]',
  },
  {
    id: 'partner',
    title: 'หน้าข้อมูลพาร์ทเนอร์',
    description: 'หน้าเว็บแนะนำธุรกิจดึงดูดเอเย่นต์',
    path: '/partners',
    icon: Handshake,
    color: 'from-[#F59E0B] to-[#D97706]',
    badge: 'Recruitment',
    badgeColor: 'bg-[rgba(245,158,11,0.15)] text-[#F59E0B] border-[rgba(245,158,11,0.3)]',
  },
];

export default function QRGeneratorPage() {
  const [selectedLink, setSelectedLink] = useState(MARKETING_LINKS[0]);
  const [customUrl, setCustomUrl] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://finlotto.com';
  
  const getFullUrl = (path: string) => {
    let url = `${baseUrl}${path}`;
    if (referralCode) {
      url += `?ref=${referralCode}`;
    }
    return url;
  };

  const currentUrl = customUrl || getFullUrl(selectedLink.path);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      toast.success('คัดลอกลิงก์แล้ว');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('ไม่สามารถคัดลอกได้');
    }
  };

  const downloadQR = () => {
    if (!qrRef.current) return;
    
    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 512;
      canvas.height = 512;
      if (ctx) {
        // Deep black background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 512, 512);
        
        // Draw QR
        ctx.drawImage(img, 56, 56, 400, 400);
        
        // Add gold border
        ctx.strokeStyle = '#D4AF37';
        ctx.lineWidth = 4;
        ctx.strokeRect(40, 40, 432, 432);
      }

      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `finlotto-qr-${selectedLink.id}.png`;
      downloadLink.click();
      toast.success('ดาวน์โหลด QR Code แล้ว');
    };

    img.crossOrigin = 'anonymous';
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="min-h-screen bg-black p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="size-12 rounded-xl bg-gradient-to-br from-[#D4AF37] via-[#F5D061] to-[#B8860B] flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.4)]">
            <QrCode className="size-6 text-black" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[#D4AF37] drop-shadow-[0_0_10px_rgba(212,175,55,0.3)]">สร้าง QR Code</h1>
            <p className="text-[#888888]">สร้าง QR Code สำหรับลิงก์การตลาดทุกประเภท</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Link Selection */}
        <div className="space-y-4">
          <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
            <CardHeader className="border-b border-[rgba(212,175,55,0.1)] pb-4">
              <CardTitle className="text-[#D4AF37] flex items-center gap-2">
                <Link2 className="size-5 text-[#D4AF37] drop-shadow-[0_0_4px_rgba(212,175,55,0.5)]" />
                เลือกลิงก์
              </CardTitle>
              <CardDescription className="text-[#666666]">
                เลือกหน้าที่ต้องการสร้าง QR Code
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {MARKETING_LINKS.map((link) => {
                const Icon = link.icon;
                const isSelected = selectedLink.id === link.id;
                return (
                  <button
                    key={link.id}
                    onClick={() => {
                      setSelectedLink(link);
                      setCustomUrl('');
                    }}
                    className={`w-full p-4 rounded-xl border transition-all duration-300 text-left ${
                      isSelected
                        ? 'bg-[rgba(212,175,55,0.1)] border-[rgba(212,175,55,0.5)] shadow-[0_0_15px_rgba(212,175,55,0.2)]'
                        : 'bg-[#121212] border-[#2a2a2a] hover:border-[rgba(212,175,55,0.3)] hover:bg-[#1a1a1a]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg bg-gradient-to-br ${link.color} ${
                          isSelected ? 'shadow-[0_0_10px_rgba(212,175,55,0.4)]' : ''
                        }`}
                      >
                        <Icon className="size-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${isSelected ? 'text-[#D4AF37]' : 'text-[#E5E5E5]'}`}>
                          {link.title}
                        </p>
                        <p className="text-xs text-[#666666]">{link.description}</p>
                      </div>
                      {isSelected && (
                        <Badge className={`${link.badgeColor} border`}>
                          {link.badge}
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Referral Code Input */}
          <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[#D4AF37] text-sm flex items-center gap-2">
                <Sparkles className="size-4 text-[#D4AF37] drop-shadow-[0_0_4px_rgba(212,175,55,0.5)]" />
                รหัสแนะนำ (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label className="text-[#888888] text-xs">Referral Code</Label>
                <Input
                  placeholder="เช่น AG001"
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

          {/* Custom URL */}
          <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[#D4AF37] text-sm">หรือใส่ URL เอง</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="https://..."
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="bg-[#121212] border-[#2a2a2a] text-white placeholder:text-[#555555] focus:border-[#D4AF37]"
              />
            </CardContent>
          </Card>
        </div>

        {/* Center: QR Code Display */}
        <div>
          <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)] h-full">
            <CardHeader className="border-b border-[rgba(212,175,55,0.1)] pb-4">
              <CardTitle className="text-[#D4AF37] text-center flex items-center justify-center gap-2">
                <QrCode className="size-5 text-[#D4AF37] drop-shadow-[0_0_4px_rgba(212,175,55,0.5)]" />
                QR Code Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex flex-col items-center justify-center">
              {/* QR Code */}
              <div
                ref={qrRef}
                className="p-6 bg-white rounded-2xl border-4 border-[#D4AF37] shadow-[0_0_30px_rgba(212,175,55,0.3)]"
              >
                <QRCodeSVG
                  value={currentUrl}
                  size={200}
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                  level="H"
                  includeMargin={false}
                />
              </div>

              {/* Selected Link Info */}
              <div className="mt-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  {(() => {
                    const Icon = selectedLink.icon;
                    return <Icon className="size-5 text-[#D4AF37] drop-shadow-[0_0_4px_rgba(212,175,55,0.5)]" />;
                  })()}
                  <span className="text-[#D4AF37] font-semibold">{selectedLink.title}</span>
                </div>
                <Badge className={`${selectedLink.badgeColor} border mb-2`}>
                  {selectedLink.badge}
                </Badge>
                <p className="text-[#666666] text-sm max-w-xs">{selectedLink.description}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <Button
                  onClick={downloadQR}
                  className="bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-semibold hover:from-[#F5D061] hover:to-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                >
                  <Download className="size-4 mr-2" />
                  ดาวน์โหลด PNG
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: URL & Copy */}
        <div className="space-y-4">
          <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
            <CardHeader className="border-b border-[rgba(212,175,55,0.1)] pb-4">
              <CardTitle className="text-[#D4AF37] flex items-center gap-2">
                <Link2 className="size-5 text-[#D4AF37] drop-shadow-[0_0_4px_rgba(212,175,55,0.5)]" />
                URL ที่สร้าง
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                {/* URL Display */}
                <div className="p-4 rounded-lg bg-[#121212] border border-[#2a2a2a]">
                  <p className="text-[#888888] text-sm break-all font-mono">{currentUrl}</p>
                </div>

                {/* Copy Button */}
                <Button
                  onClick={copyToClipboard}
                  className={`w-full transition-all duration-300 ${
                    copied
                      ? 'bg-[#22C55E] hover:bg-[#16A34A]'
                      : 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:from-[#F5D061] hover:to-[#D4AF37]'
                  } text-black font-semibold shadow-[0_0_15px_rgba(212,175,55,0.3)]`}
                >
                  {copied ? (
                    <>
                      <Check className="size-4 mr-2" />
                      คัดลอกแล้ว!
                    </>
                  ) : (
                    <>
                      <Copy className="size-4 mr-2" />
                      คัดลอกลิงก์
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tips Card */}
          <Card className="bg-gradient-to-br from-[rgba(212,175,55,0.1)] to-[rgba(184,134,11,0.05)] border-[rgba(212,175,55,0.3)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[#D4AF37] text-sm flex items-center gap-2">
                <Sparkles className="size-4 text-[#D4AF37] drop-shadow-[0_0_4px_rgba(212,175,55,0.5)]" />
                Tips การใช้งาน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[#888888]">
              <div className="flex items-start gap-2">
                <span className="text-[#D4AF37]">1.</span>
                <span>ใส่รหัสแนะนำเพื่อติดตามยอดสมัครจากลิงก์</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#D4AF37]">2.</span>
                <span>ดาวน์โหลด QR แล้วส่งผ่าน LINE หรือโซเชียล</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#D4AF37]">3.</span>
                <span>QR Code จะมีขอบสีทองสวยงามติดมาด้วย</span>
              </div>
            </CardContent>
          </Card>

          {/* Stats Preview */}
          <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[#D4AF37] text-sm">สถิติการคลิก</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[#121212] border border-[#2a2a2a] text-center">
                  <p className="text-2xl font-bold text-[#D4AF37] drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]">0</p>
                  <p className="text-xs text-[#666666]">คลิกทั้งหมด</p>
                </div>
                <div className="p-3 rounded-lg bg-[#121212] border border-[#2a2a2a] text-center">
                  <p className="text-2xl font-bold text-[#22C55E] drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]">0</p>
                  <p className="text-xs text-[#666666]">สมัครสำเร็จ</p>
                </div>
              </div>
              <p className="text-center text-[#555555] text-xs mt-3">
                ยังไม่มีข้อมูลสถิติ
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
