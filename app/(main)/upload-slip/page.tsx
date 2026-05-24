'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Upload, Image as ImageIcon, X, Send, RefreshCw, CheckCircle2, Clock, AlertCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface SlipHistory {
  id: string;
  type: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  note?: string;
  slip_url?: string;
}

export default function UploadSlipPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [slipType, setSlipType] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: history, mutate } = useSWR<SlipHistory[]>('/api/upload-slip/history', fetcher);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024 // 5MB
  });

  const clearFile = () => {
    setSelectedFile(null);
    setPreview(null);
  };

  const handleSubmit = async () => {
    if (!selectedFile || !amount || !slipType) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('amount', amount);
      formData.append('type', slipType);
      formData.append('note', note);

      const res = await fetch('/api/upload-slip', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        toast.success('ส่งสลิปสำเร็จ รอการตรวจสอบ');
        clearFile();
        setAmount('');
        setSlipType('');
        setNote('');
        mutate();
      } else {
        const data = await res.json();
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการส่งสลิป');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />อนุมัติ</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><AlertCircle className="w-3 h-3 mr-1" />ไม่อนุมัติ</Badge>;
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" />รอตรวจสอบ</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#D4AF37]">อัปโหลดสลิป</h1>
          <p className="text-[#B8B8B8]">ส่งหลักฐานการโอนเงินเข้าระบบ</p>
        </div>
        <Button variant="outline" onClick={() => mutate()} className="border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10">
          <RefreshCw className="w-4 h-4 mr-2" />
          รีเฟรช
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Form */}
        <Card className="bg-[#1a1a1a] border-[#333]">
          <CardHeader>
            <CardTitle className="text-[#F5F5F5] flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#D4AF37]" />
              ส่งสลิปใหม่
            </CardTitle>
            <CardDescription className="text-[#888]">อัปโหลดรูปสลิปและกรอกข้อมูล</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-[#D4AF37] bg-[#D4AF37]/10' : 'border-[#444] hover:border-[#D4AF37]/50'
              }`}
            >
              <input {...getInputProps()} />
              {preview ? (
                <div className="relative">
                  <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded-lg" />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2"
                    onClick={(e) => { e.stopPropagation(); clearFile(); }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="py-8">
                  <ImageIcon className="w-12 h-12 mx-auto text-[#666] mb-3" />
                  <p className="text-[#888]">ลากไฟล์มาวางหรือคลิกเพื่อเลือก</p>
                  <p className="text-[#666] text-sm mt-1">รองรับ JPG, PNG, WEBP (สูงสุด 5MB)</p>
                </div>
              )}
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <Label className="text-[#B8B8B8]">ประเภท</Label>
                <Select value={slipType} onValueChange={setSlipType}>
                  <SelectTrigger className="bg-[#0d0d0d] border-[#333] text-[#F5F5F5]">
                    <SelectValue placeholder="เลือกประเภท" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-[#333]">
                    <SelectItem value="deposit" className="text-[#F5F5F5]">ฝากเงิน</SelectItem>
                    <SelectItem value="withdraw_confirm" className="text-[#F5F5F5]">ยืนยันถอนเงิน</SelectItem>
                    <SelectItem value="topup" className="text-[#F5F5F5]">เติมเครดิต</SelectItem>
                    <SelectItem value="commission" className="text-[#F5F5F5]">คอมมิชชั่น</SelectItem>
                    <SelectItem value="other" className="text-[#F5F5F5]">อื่นๆ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[#B8B8B8]">จำนวนเงิน (บาท)</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="bg-[#0d0d0d] border-[#333] text-[#F5F5F5]"
                />
              </div>

              <div>
                <Label className="text-[#B8B8B8]">หมายเหตุ (ถ้ามี)</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="รายละเอียดเพิ่มเติม..."
                  className="bg-[#0d0d0d] border-[#333] text-[#F5F5F5]"
                  rows={3}
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !selectedFile || !amount || !slipType}
                className="w-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-semibold hover:opacity-90"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                ส่งสลิป
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* History */}
        <Card className="bg-[#1a1a1a] border-[#333]">
          <CardHeader>
            <CardTitle className="text-[#F5F5F5] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#D4AF37]" />
              ประวัติการส่งสลิป
            </CardTitle>
            <CardDescription className="text-[#888]">รายการที่ส่งไปแล้ว</CardDescription>
          </CardHeader>
          <CardContent>
            {!history || history.length === 0 ? (
              <div className="text-center py-8 text-[#666]">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>ยังไม่มีประวัติการส่งสลิป</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {history.map((item) => (
                  <div key={item.id} className="p-3 rounded-lg bg-[#0d0d0d] border border-[#333]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[#F5F5F5] font-medium">
                        {item.type === 'deposit' ? 'ฝากเงิน' :
                         item.type === 'withdraw_confirm' ? 'ยืนยันถอน' :
                         item.type === 'topup' ? 'เติมเครดิต' :
                         item.type === 'commission' ? 'คอมมิชชั่น' : 'อื่นๆ'}
                      </span>
                      {getStatusBadge(item.status)}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#D4AF37] font-semibold">{Number(item.amount).toLocaleString()} บาท</span>
                      <span className="text-[#666]">{new Date(item.created_at).toLocaleString('th-TH')}</span>
                    </div>
                    {item.note && (
                      <p className="text-[#888] text-sm mt-1">{item.note}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
