'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  BookOpen, 
  CreditCard, 
  Users, 
  FileText, 
  Shield,
  Keyboard,
  Zap,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface HelpSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  badge?: string;
  items: HelpItem[];
}

interface HelpItem {
  question: string;
  answer: string;
  steps?: string[];
}

const helpSections: HelpSection[] = [
  {
    id: 'key-lottery',
    title: 'วิธีคีย์หวย',
    icon: <Keyboard className="h-5 w-5" />,
    badge: 'คีย์หวย',
    items: [
      {
        question: 'วิธีคีย์โพยหวยให้ลูกค้า',
        answer: 'คีย์โพยหวยสำหรับลูกค้าที่ไม่ได้แทงผ่านระบบออโต้',
        steps: [
          'เข้าเมนู "ระบบคีย์หวย" > "รายการคีย์หวย"',
          'กดปุ่ม "คีย์หวยใหม่"',
          'เลือกลูกค้าจากรายการ',
          'เลือกหวยที่ต้องการแทง',
          'ใส่เลขและจำนวนเงิน',
          'ตรวจสอบและกด "บันทึก"',
        ],
      },
      {
        question: 'วิธีแก้ไขโพยที่คีย์ผิด',
        answer: 'สามารถแก้ไขโพยได้ก่อนปิดรับ',
        steps: [
          'เข้า "รายการคีย์หวย"',
          'ค้นหาโพยที่ต้องการแก้ไข',
          'กดปุ่ม "แก้ไข"',
          'แก้ไขข้อมูลที่ผิด',
          'กด "บันทึก"',
        ],
      },
    ],
  },
  {
    id: 'approve-deposit',
    title: 'วิธีอนุมัติฝาก',
    icon: <CreditCard className="h-5 w-5" />,
    badge: 'การเงิน',
    items: [
      {
        question: 'ขั้นตอนการอนุมัติฝากเงิน',
        answer: 'ตรวจสอบสลิปและอนุมัติฝากเงินให้ลูกค้า',
        steps: [
          'เข้าเมนู "บัญชีและการเงิน" > "รอฝาก"',
          'ตรวจสอบรายการที่มีสถานะ "รออนุมัติ"',
          'คลิกที่รายการเพื่อดูรายละเอียด',
          'ตรวจสอบสลิปการโอน',
          'ตรวจสอบจำนวนเงินตรงกัน',
          'กดปุ่ม "อนุมัติ" หรือ "ปฏิเสธ"',
        ],
      },
      {
        question: 'กรณีสลิปไม่ชัด',
        answer: 'หากสลิปไม่ชัดหรือไม่ตรงกับจำนวนเงิน',
        steps: [
          'กดปุ่ม "ปฏิเสธ"',
          'ใส่เหตุผล "สลิปไม่ชัด กรุณาส่งใหม่"',
          'แจ้งลูกค้าให้ส่งสลิปใหม่',
        ],
      },
    ],
  },
  {
    id: 'approve-withdraw',
    title: 'วิธีตรวจถอน',
    icon: <DollarSign className="h-5 w-5" />,
    badge: 'การเงิน',
    items: [
      {
        question: 'Checklist ก่อนอนุมัติถอน',
        answer: 'ต้องตรวจสอบทุกข้อก่อนอนุมัติถอน',
        steps: [
          '1. ตรวจยอดเครดิตคงเหลือ - ต้องพอถอน',
          '2. ตรวจประวัติฝาก - ต้องมีการฝากจริง',
          '3. ตรวจประวัติแทง - ต้องมียอดแทงขั้นต่ำ',
          '4. ตรวจประวัติถูกรางวัล - ตรวจที่มาของเงิน',
          '5. ตรวจโปรโมชัน - เงื่อนไขครบหรือยัง',
          '6. ตรวจบัญชีธนาคาร - ชื่อตรงกับลูกค้า',
          '7. ยืนยันจำนวนเงิน - ตรงกับที่ขอถอน',
        ],
      },
      {
        question: 'วิธีโอนเงินและแนบสลิป',
        answer: 'หลังตรวจสอบครบแล้ว ให้โอนเงินและแนบสลิป',
        steps: [
          'โอนเงินไปยังบัญชีลูกค้า',
          'กดปุ่ม "อนุมัติและแนบสลิป"',
          'อัปโหลดรูปสลิปการโอน',
          'กด "ยืนยัน"',
        ],
      },
    ],
  },
  {
    id: 'credit-adjust',
    title: 'วิธีปรับเครดิต',
    icon: <CreditCard className="h-5 w-5" />,
    badge: 'การเงิน',
    items: [
      {
        question: 'วิธีเพิ่ม/ลดเครดิตลูกค้า',
        answer: 'ปรับเครดิตด้วยตนเองโดยไม่ต้องรอฝาก',
        steps: [
          'เข้าเมนู "บัญชีและการเงิน" > "ปรับเครดิต"',
          'ค้นหาลูกค้าที่ต้องการ',
          'กดปุ่ม "ปรับเครดิต"',
          'เลือก "เพิ่ม" หรือ "ลด"',
          'ใส่จำนวนเงิน',
          'ใส่เหตุผลในการปรับ',
          'กด "ยืนยัน"',
        ],
      },
    ],
  },
  {
    id: 'agent-management',
    title: 'วิธีจัดการสายงาน',
    icon: <Users className="h-5 w-5" />,
    badge: 'เอเย่น',
    items: [
      {
        question: 'วิธีโยกย้ายลูกค้าระหว่างสายงาน',
        answer: 'ย้ายลูกค้าจากเอเย่นหนึ่งไปอีกเอเย่น',
        steps: [
          'เข้าเมนู "เอเย่น / Partner" > "โยกย้ายลูกค้า"',
          'เลือกลูกค้าที่ต้องการย้าย',
          'เลือกเอเย่นปลายทาง',
          'ใส่เหตุผลในการย้าย',
          'กด "ยืนยันการย้าย"',
        ],
      },
      {
        question: 'วิธีระงับเอเย่น',
        answer: 'ระงับเอเย่นที่ทำผิดกฎ',
        steps: [
          'เข้าเมนู "เอเย่น / Partner" > "ระงับเอเย่น"',
          'ค้นหาเอเย่นที่ต้องการระงับ',
          'กดปุ่ม "ระงับ"',
          'ใส่เหตุผล',
          'กด "ยืนยัน"',
        ],
      },
    ],
  },
  {
    id: 'reports',
    title: 'วิธีดูรายงาน',
    icon: <FileText className="h-5 w-5" />,
    badge: 'รายงาน',
    items: [
      {
        question: 'วิธีดูรายงานกำไรขาดทุน',
        answer: 'ดูสรุปกำไรขาดทุนรายวัน/เดือน/ปี',
        steps: [
          'เข้าเมนู "รายงาน" > "กำไร-ขาดทุน"',
          'เลือกช่วงเวลาที่ต้องการ',
          'ดูสรุปยอดแทง ยอดถูก กำไร/ขาดทุน',
          'กด "Export" เพื่อดาวน์โหลด CSV',
        ],
      },
      {
        question: 'วิธีดูรายงานเปรียบเทียบ คีย์หวย vs ออโต้',
        answer: 'เปรียบเทียบยอดระหว่างระบบคีย์หวยและออโต้',
        steps: [
          'เข้าเมนู "รายงานเปรียบเทียบ"',
          'เลือกช่วงเวลา',
          'ดูกราฟเปรียบเทียบ',
          'ดูตารางสรุปแยกตามหวย',
        ],
      },
    ],
  },
  {
    id: 'audit-log',
    title: 'วิธีดู Audit Log',
    icon: <Shield className="h-5 w-5" />,
    badge: 'ความปลอดภัย',
    items: [
      {
        question: 'วิธีตรวจสอบประวัติการทำรายการ',
        answer: 'ดูว่าใครทำอะไร เมื่อไหร่',
        steps: [
          'เข้าเมนู "ความปลอดภัย" > "Audit Logs"',
          'เลือก filter ตามต้องการ (วันที่, ผู้ใช้, action)',
          'ดูรายละเอียดแต่ละรายการ',
        ],
      },
    ],
  },
  {
    id: 'troubleshoot',
    title: 'วิธีแก้ปัญหาเบื้องต้น',
    icon: <AlertTriangle className="h-5 w-5" />,
    badge: 'แก้ปัญหา',
    items: [
      {
        question: 'ลูกค้าแจ้งว่าเครดิตไม่ตรง',
        answer: 'ตรวจสอบและแก้ไขเครดิตที่ไม่ตรง',
        steps: [
          'เข้าดูประวัติธุรกรรมของลูกค้า',
          'ตรวจสอบรายการฝาก/ถอน/แทง',
          'ตรวจสอบรายการถูกรางวัล',
          'ถ้าพบความผิดปกติ ปรับเครดิตให้ถูกต้อง',
          'บันทึกเหตุผลใน audit log',
        ],
      },
      {
        question: 'ลูกค้าแจ้งว่าโอนแล้วไม่เข้า',
        answer: 'ตรวจสอบรายการฝากของลูกค้า',
        steps: [
          'เข้าดูรายการ "รอฝาก"',
          'ค้นหาชื่อลูกค้า',
          'ถ้าพบรายการ - ตรวจสอบสลิปและอนุมัติ',
          'ถ้าไม่พบ - ให้ลูกค้าแจ้งฝากใหม่พร้อมสลิป',
        ],
      },
    ],
  },
];

export default function HelpPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState<string[]>(['key-lottery']);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const toggleItem = (id: string) => {
    setExpandedItems(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const filteredSections = helpSections.filter(section => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      section.title.toLowerCase().includes(term) ||
      section.items.some(item => 
        item.question.toLowerCase().includes(term) ||
        item.answer.toLowerCase().includes(term)
      )
    );
  });

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <BookOpen className="h-8 w-8 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">คู่มือการใช้งาน</h1>
            <p className="text-zinc-400">สำหรับ Admin และ Operator</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-zinc-400" />
          <Input
            placeholder="ค้นหาคู่มือ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-zinc-900 border-zinc-800 text-white"
          />
        </div>

        {/* Help Sections */}
        <div className="space-y-4">
          {filteredSections.map((section) => (
            <Card key={section.id} className="bg-zinc-900 border-zinc-800">
              <CardHeader 
                className="cursor-pointer hover:bg-zinc-800/50 transition-colors"
                onClick={() => toggleSection(section.id)}
              >
                <CardTitle className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-zinc-800">
                      {section.icon}
                    </div>
                    <span>{section.title}</span>
                    {section.badge && (
                      <Badge variant="outline" className="text-xs">
                        {section.badge}
                      </Badge>
                    )}
                  </div>
                  {expandedSections.includes(section.id) ? (
                    <ChevronDown className="h-5 w-5 text-zinc-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-zinc-400" />
                  )}
                </CardTitle>
              </CardHeader>
              
              {expandedSections.includes(section.id) && (
                <CardContent className="space-y-3 pt-0">
                  {section.items.map((item, idx) => {
                    const itemId = `${section.id}-${idx}`;
                    return (
                      <div 
                        key={idx} 
                        className="border border-zinc-800 rounded-lg overflow-hidden"
                      >
                        <div 
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                          onClick={() => toggleItem(itemId)}
                        >
                          <span className="text-white font-medium">{item.question}</span>
                          {expandedItems.includes(itemId) ? (
                            <ChevronDown className="h-4 w-4 text-zinc-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-zinc-400" />
                          )}
                        </div>
                        
                        {expandedItems.includes(itemId) && (
                          <div className="px-4 pb-4 space-y-3">
                            <p className="text-zinc-400">{item.answer}</p>
                            {item.steps && (
                              <div className="space-y-2 pl-4">
                                {item.steps.map((step, stepIdx) => (
                                  <div key={stepIdx} className="flex items-start gap-2">
                                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                    <span className="text-zinc-300 text-sm">{step}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        {/* Quick Tips */}
        <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20">
          <CardHeader>
            <CardTitle className="text-amber-500 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              เคล็ดลับสำคัญ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-zinc-300 text-sm">
              - ตรวจสอบทุกครั้งก่อนอนุมัติถอน ป้องกันการโกง
            </p>
            <p className="text-zinc-300 text-sm">
              - บันทึกเหตุผลทุกครั้งเมื่อปรับเครดิต เพื่อตรวจสอบภายหลัง
            </p>
            <p className="text-zinc-300 text-sm">
              - ดู Audit Log เป็นประจำ เพื่อตรวจสอบความผิดปกติ
            </p>
            <p className="text-zinc-300 text-sm">
              - แยก &quot;คีย์หวย&quot; กับ &quot;ออโต้&quot; ให้ชัด ป้องกันความสับสน
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
