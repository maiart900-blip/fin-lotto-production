'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  UserPlus, 
  CreditCard, 
  Banknote,
  HelpCircle,
  ChevronRight,
  Sparkles,
  Play,
  CheckCircle2,
  Loader2,
  BookOpen
} from 'lucide-react';

interface ContentPage {
  id: string;
  slug: string;
  title: string;
  content: string;
}

const menuItems = [
  { 
    slug: 'how-to-register', 
    title: 'วิธีสมัครสมาชิก', 
    description: 'สมัครง่ายใน 3 ขั้นตอน',
    icon: UserPlus, 
    gradient: 'from-emerald-500 to-green-600',
    glow: 'shadow-emerald-500/30'
  },
  { 
    slug: 'how-to-deposit', 
    title: 'วิธีฝากเงิน', 
    description: 'เติมเครดิตอัตโนมัติ 24 ชม.',
    icon: CreditCard, 
    gradient: 'from-primary to-cyan-500',
    glow: 'shadow-primary/30'
  },
  { 
    slug: 'how-to-withdraw', 
    title: 'วิธีถอนเงิน', 
    description: 'ถอนไว ไม่มีขั้นต่ำ',
    icon: Banknote, 
    gradient: 'from-amber-500 to-orange-500',
    glow: 'shadow-amber-500/30'
  },
  { 
    slug: 'how-to-bet', 
    title: 'วิธีแทงหวย', 
    description: 'แทงหวยง่าย จ่ายสูงสุด',
    icon: HelpCircle, 
    gradient: 'from-purple-500 to-pink-500',
    glow: 'shadow-purple-500/30'
  },
];

export default function HowToPage() {
  const router = useRouter();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [content, setContent] = useState<ContentPage | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchContent = async (slug: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/content-pages?slug=${slug}`);
      const data = await res.json();
      // API returns the page directly, not wrapped in { page: ... }
      if (data && data.id) {
        setContent(data);
        setSelectedSlug(slug);
      } else if (data.error) {
        console.error('Content not found:', slug);
        // Show default content if not in database
        setContent({
          id: slug,
          slug: slug,
          title: menuItems.find(m => m.slug === slug)?.title || 'วิธีใช้งาน',
          content: getDefaultContent(slug)
        });
        setSelectedSlug(slug);
      }
    } catch (error) {
      console.error('Error:', error);
      // Fallback to default content
      setContent({
        id: slug,
        slug: slug,
        title: menuItems.find(m => m.slug === slug)?.title || 'วิธีใช้งาน',
        content: getDefaultContent(slug)
      });
      setSelectedSlug(slug);
    } finally {
      setLoading(false);
    }
  };
  
  // Default content for how-to pages
  const getDefaultContent = (slug: string): string => {
    const contents: Record<string, string> = {
      'how-to-register': `
        <h2>ขั้นตอนการสมัครสมาชิก</h2>
        <ol>
          <li><strong>กดปุ่ม "สมัครสมาชิก"</strong> - ที่หน้าแรกของเว็บไซต์</li>
          <li><strong>กรอกข้อมูล</strong> - เบอร์โทรศัพท์ และตั้งรหัสผ่าน</li>
          <li><strong>ยืนยันตัวตน</strong> - รอ OTP ทาง SMS และกรอกรหัส</li>
        </ol>
        <p>เพียงเท่านี้ก็สมัครสมาชิกเสร็จเรียบร้อย พร้อมใช้งานได้ทันที!</p>
      `,
      'how-to-deposit': `
        <h2>ขั้นตอนการฝากเงิน</h2>
        <ol>
          <li><strong>เข้าหน้ากระเป๋าเงิน</strong> - กดเมนู "กระเป๋าเงิน"</li>
          <li><strong>กดปุ่ม "เติมเงิน"</strong></li>
          <li><strong>เลือกช่องทางการฝาก</strong> - โอนผ่านธนาคาร หรือ PromptPay</li>
          <li><strong>โอนเงินตามจำนวน</strong> - ระบบจะเติมเครดิตอัตโนมัติ</li>
        </ol>
        <p>เครดิตจะเข้าบัญชีภายใน 1-3 นาที</p>
      `,
      'how-to-withdraw': `
        <h2>ขั้นตอนการถอนเงิน</h2>
        <ol>
          <li><strong>เข้าหน้ากระเป๋าเงิน</strong> - กดเมนู "กระเป๋าเงิน"</li>
          <li><strong>กดปุ่ม "ถอนเงิน"</strong></li>
          <li><strong>กรอกจำนวนเงิน</strong> - ที่ต้องการถอน</li>
          <li><strong>ยืนยันบัญชีธนาคาร</strong> - ตรวจสอบข้อมูลให้ถูกต้อง</li>
          <li><strong>รอรับเงิน</strong> - เงินจะเข้าบัญชีภายใน 5-15 นาที</li>
        </ol>
        <p>ถอนได้ไม่มีขั้นต่ำ ไม่มีค่าธรรมเนียม!</p>
      `,
      'how-to-bet': `
        <h2>ขั้นตอนการแทงหวย</h2>
        <ol>
          <li><strong>เลือกหวย</strong> - กดเมนู "แทงหวย" และเลือกประเภทหวย</li>
          <li><strong>เลือกเลข</strong> - กรอกเลขที่ต้องการแทง</li>
          <li><strong>เลือกประเภทการแทง</strong> - 3 ตัวบน, 2 ตัวล่าง, วิ่งบน ฯลฯ</li>
          <li><strong>ใส่จำนวนเงิน</strong> - กำหนดยอดเดิมพัน</li>
          <li><strong>ยืนยันโพย</strong> - ตรวจสอบและกดยืนยัน</li>
        </ol>
        <p>จ่ายสูงสุดบาทละ 900! ผลรางวัลออกตรงเวลา</p>
      `,
    };
    return contents[slug] || '<p>ไม่พบเนื้อหา กรุณาติดต่อแอดมิน</p>';
  };

  const selectedItem = menuItems.find(item => item.slug === selectedSlug);

  if (selectedSlug && content) {
    return (
      <div className="space-y-4 fade-in-up">
        {/* Back Button Header */}
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setSelectedSlug(null)}
            className="size-10 rounded-xl bg-white/5 hover:bg-white/10 text-white"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex items-center gap-3">
            {selectedItem && (
              <div className={`size-10 rounded-xl bg-gradient-to-br ${selectedItem.gradient} flex items-center justify-center shadow-lg ${selectedItem.glow}`}>
                <selectedItem.icon className="size-5 text-white" />
              </div>
            )}
            <h1 className="text-xl font-bold text-white">{content.title}</h1>
          </div>
        </div>

        {/* Content Card */}
        <Card className="glass-card border-0 overflow-hidden">
          <CardContent className="p-6">
            <div 
              className="prose prose-invert prose-sm max-w-none 
                prose-headings:text-white prose-headings:font-bold
                prose-p:text-[#94A3B8] prose-p:leading-relaxed
                prose-strong:text-white
                prose-ul:text-[#94A3B8]
                prose-li:marker:text-primary
                prose-a:text-primary prose-a:no-underline hover:prose-a:underline"
              dangerouslySetInnerHTML={{ __html: content.content?.replace(/\n/g, '<br/>') || '' }} 
            />
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button 
            variant="outline" 
            className="h-auto py-4 border-white/10 bg-white/5 hover:bg-white/10 text-white flex flex-col items-center gap-2"
            onClick={() => router.push('/c/contact')}
          >
            <HelpCircle className="size-5 text-primary" />
            <span className="text-sm">ต้องการความช่วยเหลือ?</span>
          </Button>
          <Button 
            className="h-auto py-4 btn-premium flex flex-col items-center gap-2"
            onClick={() => {
              if (selectedSlug === 'how-to-register') router.push('/c/register');
              else if (selectedSlug === 'how-to-deposit') router.push('/c/topup');
              else if (selectedSlug === 'how-to-withdraw') router.push('/c/withdraw');
              else router.push('/c/buy');
            }}
          >
            <Play className="size-5" />
            <span className="text-sm">เริ่มต้นใช้งาน</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in-up">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.back()}
          className="size-10 rounded-xl bg-white/5 hover:bg-white/10 text-white"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-white">วิธีใช้งาน</h1>
          <p className="text-sm text-[#64748B]">คู่มือการใช้งานระบบ</p>
        </div>
      </div>

      {/* Hero Section */}
      <Card className="glass-card border-0 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-cyan-500/10" />
        <CardContent className="p-6 relative">
          <div className="flex items-start gap-4">
            <div className="size-14 rounded-2xl bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center shadow-lg glow-blue flex-shrink-0">
              <BookOpen className="size-7 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white mb-1">เริ่มต้นใช้งานง่ายๆ</h2>
              <p className="text-sm text-[#94A3B8] leading-relaxed">
                เรียนรู้วิธีการใช้งานระบบหวยออนไลน์ของเราได้ง่ายๆ ผ่านคู่มือที่เราจัดเตรียมไว้ให้
              </p>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                  <span>สมัครฟรี</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-primary">
                  <Sparkles className="size-3.5" />
                  <span>ใช้งานง่าย</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Menu Items */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider px-1">
          เลือกหัวข้อที่ต้องการ
        </h3>
        
        {menuItems.map((item, index) => (
          <Card 
            key={item.slug}
            className="glass-card border-0 cursor-pointer group"
            onClick={() => fetchContent(item.slug)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className={`size-12 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-lg ${item.glow} group-hover:scale-110 transition-transform duration-300`}>
                  {loading && selectedSlug === item.slug ? (
                    <Loader2 className="size-6 text-white animate-spin" />
                  ) : (
                    <item.icon className="size-6 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-[#64748B]">{item.description}</p>
                </div>
                <div className="size-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <ChevronRight className="size-4 text-[#64748B] group-hover:text-primary transition-colors" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Help Section */}
      <Card className="glass-card border-0 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="size-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <HelpCircle className="size-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-white font-medium">ยังมีคำถาม?</p>
              <p className="text-xs text-[#64748B]">ติดต่อทีมงานได้ตลอด 24 ชม.</p>
            </div>
            <Button 
              size="sm"
              variant="outline"
              className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              onClick={() => router.push('/c/contact')}
            >
              ติดต่อเรา
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
