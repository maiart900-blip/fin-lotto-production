'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { 
  Link2, 
  Copy, 
  Check, 
  QrCode, 
  ExternalLink, 
  UserPlus, 
  Key, 
  Users, 
  UsersRound, 
  Handshake,
  Download,
  Share2,
  Megaphone,
  Sparkles,
  Eye,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Marketing Links Configuration
const marketingLinks = [
  {
    id: 'register',
    title: 'หน้าสมัครสมาชิก',
    description: 'ลิงก์ทองคำสำหรับส่งให้ลูกค้าใหม่สมัครสมาชิก',
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
    description: 'หน้าเฉพาะสำหรับ Partner ดูยอดสายงานและกดถอนคอมมิชชัน',
    path: '/marketing-center/agent',
    icon: UsersRound,
    color: 'from-[#D4AF37] to-[#B8860B]',
    badge: 'Partner',
    badgeColor: 'bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border-[rgba(212,175,55,0.3)]',
  },
  {
    id: 'member',
    title: 'หน้าหลักสมาชิก',
    description: 'Dashboard ส่วนตัวของคนแทงหวย (จุดที่โชว์ VIP Rank)',
    path: '/marketing-center/member',
    icon: Users,
    color: 'from-[#8B5CF6] to-[#7C3AED]',
    badge: 'VIP Zone',
    badgeColor: 'bg-[rgba(139,92,246,0.15)] text-[#8B5CF6] border-[rgba(139,92,246,0.3)]',
  },
  {
    id: 'partner',
    title: 'หน้าข้อมูลพาร์ทเนอร์',
    description: 'หน้าเว็บแนะนำธุรกิจสำหรับดึงดูดคนให้มาร่วมเป็นเอเย่นต์',
    path: '/marketing-center/partner',
    icon: Handshake,
    color: 'from-[#F59E0B] to-[#D97706]',
    badge: 'Recruitment',
    badgeColor: 'bg-[rgba(245,158,11,0.15)] text-[#F59E0B] border-[rgba(245,158,11,0.3)]',
  },
];

export default function MarketingCenterPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState('');

  // Fetch stats from database
  const { data: campaignsData } = useSWR('/api/marketing-campaigns', fetcher);
  const { data: agentsData } = useSWR('/api/agents', fetcher);
  const { data: partnersData } = useSWR('/api/partners', fetcher);
  const { data: referralsData } = useSWR('/api/referrals', fetcher);

  const campaigns = campaignsData?.campaigns || [];
  const agents = agentsData?.agents || [];
  const agentsSummary = agentsData?.summary || {};
  const partners = partnersData?.partners || [];
  const referrals = referralsData || [];

  // Get base URL (in production, use actual domain)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://finlotto.com';

  const getFullUrl = (path: string) => {
    let url = `${baseUrl}${path}`;
    if (referralCode) {
      url += `?ref=${referralCode}`;
    }
    return url;
  };

  const copyToClipboard = async (id: string, path: string) => {
    const url = getFullUrl(path);
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success('คัดลอกลิงก์แล้ว', {
      description: url,
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadQRCode = (id: string) => {
    const svg = document.getElementById(`qr-${id}`);
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
        
        // Add gold border
        ctx.strokeStyle = '#D4AF37';
        ctx.lineWidth = 4;
        ctx.strokeRect(40, 40, 432, 432);
      }
      
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `finlotto-${id}-qr.png`;
      downloadLink.href = pngFile;
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
            <Megaphone className="size-6 text-black" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[#D4AF37] drop-shadow-[0_0_10px_rgba(212,175,55,0.3)]">ศูนย์การตลาด</h1>
            <p className="text-[#888888]">Marketing Center - จัดการลิงก์และ QR Code สำหรับส่งต่อ</p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-gradient-to-br from-[#22C55E] to-[#16A34A] flex items-center justify-center">
                <TrendingUp className="size-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#D4AF37]">{campaigns.filter((c: any) => c.is_active).length}</p>
                <p className="text-xs text-[#666666]">แคมเปญที่ใช้งาน</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center">
                <UsersRound className="size-5 text-black" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#D4AF37]">{agentsSummary.active || agents.length}</p>
                <p className="text-xs text-[#666666]">เอเย่นต์ Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-gradient-to-br from-[#F59E0B] to-[#D97706] flex items-center justify-center">
                <Handshake className="size-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#D4AF37]">{partners.filter((p: any) => p.is_active).length}</p>
                <p className="text-xs text-[#666666]">พาร์ทเนอร์</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] flex items-center justify-center">
                <Share2 className="size-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#D4AF37]">{Array.isArray(referrals) ? referrals.length : 0}</p>
                <p className="text-xs text-[#666666]">การแนะนำทั้งหมด</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Referral Code Input */}
      <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)] mb-8">
        <CardHeader className="pb-3 border-b border-[rgba(212,175,55,0.1)]">
          <CardTitle className="text-[#D4AF37] flex items-center gap-2">
            <Share2 className="size-5 text-[#D4AF37] drop-shadow-[0_0_4px_rgba(212,175,55,0.5)]" />
            รหัสแนะนำ (Referral Code)
          </CardTitle>
          <CardDescription className="text-[#666666]">
            ใส่รหัส Agent เพื่อติดท้ายลิงก์อัตโนมัติ ระบบจะนับยอดสมัครเข้าสายงานของคุณ
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex gap-3 items-center">
            <Input
              placeholder="เช่น AG001, PARTNER123"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              className="bg-[#121212] border-[#2a2a2a] text-white placeholder:text-[#555555] focus:border-[#D4AF37] font-mono max-w-xs"
            />
            {referralCode && (
              <Badge className="bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border border-[rgba(212,175,55,0.3)] h-10 px-4 flex items-center gap-2">
                <Sparkles className="size-3" />
                ลิงก์จะมี ?ref={referralCode}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Links Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {marketingLinks.map((link, index) => {
          const Icon = link.icon;
          const fullUrl = getFullUrl(link.path);
          
          return (
            <Card 
              key={link.id} 
              className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)] group hover:border-[rgba(212,175,55,0.5)] transition-all duration-300 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)]"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className={`size-12 rounded-xl bg-gradient-to-br ${link.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform group-hover:shadow-[0_0_15px_rgba(212,175,55,0.4)]`}>
                    <Icon className="size-6 text-white" />
                  </div>
                  <Badge className={`${link.badgeColor} border`}>
                    {link.badge}
                  </Badge>
                </div>
                <CardTitle className="text-[#E5E5E5] mt-4 group-hover:text-[#D4AF37] transition-colors">{link.title}</CardTitle>
                <CardDescription className="text-[#666666] text-sm">
                  {link.description}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* URL Display */}
                <div className="p-3 rounded-lg bg-[#121212] border border-[#2a2a2a] group-hover:border-[rgba(212,175,55,0.3)] transition-colors">
                  <code className="text-xs text-[#888888] break-all font-mono">
                    {fullUrl}
                  </code>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => copyToClipboard(link.id, link.path)}
                    className="flex-1 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-semibold hover:from-[#F5D061] hover:to-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.2)] h-10"
                  >
                    {copiedId === link.id ? (
                      <>
                        <Check className="size-4 mr-2" />
                        คัดลอกแล้ว
                      </>
                    ) : (
                      <>
                        <Copy className="size-4 mr-2" />
                        Copy Link
                      </>
                    )}
                  </Button>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="border-[rgba(212,175,55,0.3)] text-[#D4AF37] hover:bg-[rgba(212,175,55,0.1)] h-10 px-3"
                      >
                        <QrCode className="size-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#0a0a0a] border-[rgba(212,175,55,0.3)] max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-[#D4AF37] flex items-center gap-2">
                          <QrCode className="size-5" />
                          QR Code - {link.title}
                        </DialogTitle>
                        <DialogDescription className="text-[#666666]">
                          สแกน QR Code นี้เพื่อเข้าถึงหน้า {link.title}
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="flex flex-col items-center py-6 space-y-6">
                        {/* QR Code */}
                        <div className="p-6 bg-white rounded-2xl border-4 border-[#D4AF37] shadow-[0_0_30px_rgba(212,175,55,0.3)]">
                          <QRCodeSVG
                            id={`qr-${link.id}`}
                            value={fullUrl}
                            size={200}
                            level="H"
                            includeMargin={false}
                            fgColor="#000000"
                            bgColor="#FFFFFF"
                          />
                        </div>

                        {/* URL */}
                        <div className="w-full p-3 rounded-lg bg-[#121212] border border-[#2a2a2a]">
                          <code className="text-xs text-[#888888] break-all font-mono block text-center">
                            {fullUrl}
                          </code>
                        </div>

                        {/* Download Button */}
                        <div className="flex gap-3 w-full">
                          <Button
                            onClick={() => downloadQRCode(link.id)}
                            className="flex-1 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-semibold hover:from-[#F5D061] hover:to-[#D4AF37]"
                          >
                            <Download className="size-4 mr-2" />
                            ดาวน์โหลด PNG
                          </Button>
                          <Button
                            onClick={() => copyToClipboard(link.id, link.path)}
                            variant="outline"
                            className="border-[rgba(212,175,55,0.3)] text-[#D4AF37] hover:bg-[rgba(212,175,55,0.1)]"
                          >
                            <Copy className="size-4 mr-2" />
                            Copy URL
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button
                    variant="outline"
                    className="border-[rgba(212,175,55,0.3)] text-[#D4AF37] hover:bg-[rgba(212,175,55,0.1)] h-10 px-3"
                    asChild
                  >
                    <a href={link.path} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Active Campaigns */}
      {campaigns.length > 0 && (
        <Card className="bg-[#0a0a0a] border-[rgba(212,175,55,0.2)] mt-8">
          <CardHeader className="border-b border-[rgba(212,175,55,0.1)]">
            <CardTitle className="text-[#D4AF37] flex items-center gap-2">
              <TrendingUp className="size-5 text-[#D4AF37]" />
              แคมเปญที่กำลังดำเนินการ
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {campaigns.slice(0, 5).map((campaign: any) => (
                <div key={campaign.id} className="flex items-center justify-between p-3 rounded-lg bg-[#121212] border border-[#2a2a2a]">
                  <div className="flex items-center gap-3">
                    <div className={`size-2 rounded-full ${campaign.is_active ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <div>
                      <p className="text-white font-medium">{campaign.name}</p>
                      <p className="text-xs text-[#666666]">{campaign.code} - {campaign.campaign_type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[#D4AF37] font-medium">{campaign.total_registrations || 0} สมัคร</p>
                    <p className="text-xs text-[#666666]">{formatCurrency(campaign.total_deposits || 0)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
