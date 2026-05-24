'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Printer, Share2, Download, CheckCircle, Crown } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface ReceiptEntry {
  number: string;
  betType: string;
  amount: number;
  payRate?: number;
}

interface ThermalReceiptProps {
  ticketId: string;
  customerName: string;
  lotteryName: string;
  drawDate: string;
  entries: ReceiptEntry[];
  totalAmount: number;
  createdAt: string;
  agentName?: string;
  siteName?: string;
}

const BET_TYPE_LABELS: Record<string, string> = {
  three_top: '3 ตัวบน',
  three_tod: '3 ตัวโต๊ด',
  two_top: '2 ตัวบน',
  two_bot: '2 ตัวล่าง',
  run_top: 'วิ่งบน',
  run_bot: 'วิ่งล่าง',
};

export function ThermalReceipt({
  ticketId,
  customerName,
  lotteryName,
  drawDate,
  entries,
  totalAmount,
  createdAt,
  agentName = 'FIN LOTTO R+',
  siteName = 'FIN LOTTO R+',
}: ThermalReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  // Print receipt
  const handlePrint = () => {
    if (!receiptRef.current) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const styles = `
      <style>
        @page { size: 80mm auto; margin: 0; }
        body { 
          font-family: 'Courier New', monospace; 
          width: 80mm; 
          margin: 0; 
          padding: 8px;
          background: white;
        }
        .receipt { padding: 10px; }
        .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; }
        .logo { font-size: 18px; font-weight: bold; }
        .gold { color: #B8860B; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; padding: 2px 0; }
        .entries { margin: 10px 0; }
        .entry { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; }
        .total { font-weight: bold; font-size: 16px; background: #f5f5f5; padding: 8px; margin: 10px 0; }
        .footer { text-align: center; font-size: 10px; color: #666; margin-top: 15px; }
        .qr { text-align: center; margin: 10px 0; }
        .success-badge { 
          background: #10B981; 
          color: white; 
          padding: 4px 12px; 
          border-radius: 20px; 
          display: inline-block;
          margin: 10px 0;
        }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head><title>Receipt - ${ticketId}</title>${styles}</head>
        <body>${receiptRef.current.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Share to LINE
  const handleShareLine = () => {
    const text = `
[${siteName}] ใบเสร็จ
==================
เลขที่: ${ticketId}
ลูกค้า: ${customerName}
หวย: ${lotteryName}
งวด: ${drawDate}
------------------
${entries.map(e => `${e.number} (${BET_TYPE_LABELS[e.betType] || e.betType}) = ${e.amount.toLocaleString()} บาท`).join('\n')}
------------------
รวม: ${totalAmount.toLocaleString()} บาท
==================
ขอบคุณที่ใช้บริการ!
    `.trim();

    const lineUrl = `https://line.me/R/share?text=${encodeURIComponent(text)}`;
    window.open(lineUrl, '_blank');
  };

  // Download as image
  const handleDownload = async () => {
    if (!receiptRef.current) return;
    
    try {
      // Dynamic import html2canvas
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
      });
      
      const link = document.createElement('a');
      link.download = `receipt-${ticketId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      // Fallback: copy text
      const text = `ใบเสร็จ ${ticketId}\nรวม ${totalAmount.toLocaleString()} บาท`;
      navigator.clipboard.writeText(text);
      alert('บันทึกข้อความลงคลิปบอร์ดแล้ว');
    }
  };

  const formattedDate = format(new Date(createdAt), 'dd MMM yyyy HH:mm', { locale: th });
  const formattedDrawDate = format(new Date(drawDate), 'dd MMM yyyy', { locale: th });

  return (
    <div className="space-y-4">
      {/* Receipt Preview */}
      <Card className="bg-white border-[rgba(234,179,8,0.3)] overflow-hidden max-w-sm mx-auto">
        <div ref={receiptRef} className="receipt p-4 font-mono text-sm">
          {/* Header */}
          <div className="header text-center border-b-2 border-dashed border-[#B8860B] pb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Crown className="size-6 text-[#B8860B]" />
              <span className="logo text-xl font-bold text-[#B8860B]">{siteName}</span>
            </div>
            <p className="text-xs text-[#64748B]">Premium Lotto Platform</p>
            <div className="success-badge inline-flex items-center gap-1 bg-[#10B981] text-white px-3 py-1 rounded-full text-xs mt-2">
              <CheckCircle className="size-3" />
              รับแทงสำเร็จ
            </div>
          </div>

          {/* Ticket Info */}
          <div className="py-3 space-y-1 text-xs">
            <div className="row flex justify-between">
              <span className="text-[#64748B]">เลขที่:</span>
              <span className="font-bold text-[#0F172A]">{ticketId}</span>
            </div>
            <div className="row flex justify-between">
              <span className="text-[#64748B]">ลูกค้า:</span>
              <span className="text-[#0F172A]">{customerName}</span>
            </div>
            {agentName && (
              <div className="row flex justify-between">
                <span className="text-[#64748B]">เอเย่นต์:</span>
                <span className="text-[#0F172A]">{agentName}</span>
              </div>
            )}
            <div className="row flex justify-between">
              <span className="text-[#64748B]">หวย:</span>
              <span className="text-[#0F172A]">{lotteryName}</span>
            </div>
            <div className="row flex justify-between">
              <span className="text-[#64748B]">งวดวันที่:</span>
              <span className="text-[#0F172A]">{formattedDrawDate}</span>
            </div>
            <div className="row flex justify-between">
              <span className="text-[#64748B]">วันที่ทำรายการ:</span>
              <span className="text-[#0F172A]">{formattedDate}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="divider border-t border-dashed border-[#B8860B] my-2" />

          {/* Entries */}
          <div className="entries py-2">
            <div className="flex justify-between text-xs font-bold text-[#64748B] mb-2">
              <span>เลข</span>
              <span>ประเภท</span>
              <span>ยอด</span>
            </div>
            {entries.map((entry, idx) => (
              <div key={idx} className="entry flex justify-between text-xs py-1 border-b border-dotted border-[#E2E8F0] last:border-0">
                <span className="font-mono font-bold text-[#0F172A] w-16">{entry.number}</span>
                <span className="text-[#64748B] flex-1 text-center">{BET_TYPE_LABELS[entry.betType] || entry.betType}</span>
                <span className="text-[#0F172A] w-20 text-right">{entry.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="divider border-t border-dashed border-[#B8860B] my-2" />

          {/* Total */}
          <div className="total bg-gradient-to-r from-[#EAB308]/10 to-[#B8860B]/10 p-3 rounded-lg border border-[#EAB308]/30">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-[#64748B]">ยอดรวมทั้งหมด</span>
              <span className="text-xl font-bold text-[#B8860B]">{totalAmount.toLocaleString()} บาท</span>
            </div>
          </div>

          {/* Footer */}
          <div className="footer text-center text-[10px] text-[#94A3B8] mt-4 space-y-1">
            <p>*** ขอบคุณที่ใช้บริการ ***</p>
            <p>กรุณาเก็บใบเสร็จนี้เพื่อเป็นหลักฐาน</p>
            <p className="text-[#B8860B]">{siteName} - Premium Lotto Platform</p>
          </div>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-2 justify-center max-w-sm mx-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrint}
          className="flex-1 border-[#EAB308] text-[#B8860B] hover:bg-[rgba(234,179,8,0.1)]"
        >
          <Printer className="size-4 mr-1" />
          พิมพ์
        </Button>
        <Button
          size="sm"
          onClick={handleShareLine}
          className="flex-1 bg-[#06C755] hover:bg-[#05a647] text-white"
        >
          <Share2 className="size-4 mr-1" />
          แชร์ LINE
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          className="flex-1 border-[#64748B] text-[#64748B] hover:bg-[#F1F5F9]"
        >
          <Download className="size-4 mr-1" />
          บันทึก
        </Button>
      </div>
    </div>
  );
}
