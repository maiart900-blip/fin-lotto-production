'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Trophy,
  DollarSign,
  User,
  CreditCard,
  Upload,
  CheckCircle,
  Clock,
  RefreshCw,
  Building,
  Phone,
  FileText,
  Send,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Bank codes mapping
const BANK_NAMES: Record<string, string> = {
  'KBANK': 'กสิกรไทย',
  'SCB': 'ไทยพาณิชย์',
  'BBL': 'กรุงเทพ',
  'KTB': 'กรุงไทย',
  'BAY': 'กรุงศรี',
  'TMB': 'ทหารไทยธนชาต',
  'TTB': 'ทีเอ็มบีธนชาต',
  'GSB': 'ออมสิน',
  'BAAC': 'ธ.ก.ส.',
  'CIMB': 'ซีไอเอ็มบี',
  'UOB': 'ยูโอบี',
  'LH': 'แลนด์แอนด์เฮ้าส์',
  'TISCO': 'ทิสโก้',
  'KKP': 'เกียรตินาคินภัทร',
  'ICBC': 'ไอซีบีซี',
};

const BET_TYPE_LABELS: Record<string, string> = {
  '3top': '3 ตัวบน',
  '3tod': '3 ตัวโต๊ด',
  '3tong': 'ตอง',
  '2top': '2 ตัวบน',
  '2bot': '2 ตัวล่าง',
  '2rev': '2 ตัวกลับ',
  '1top': 'วิ่งบน',
  '1bot': 'วิ่งล่าง',
};

export default function PrizePayoutPage() {
  const [filter, setFilter] = useState<'pending' | 'paid' | 'all'>('pending');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'manual' | 'auto' | 'tenant'>('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [slipUrl, setSlipUrl] = useState('');
  const [note, setNote] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Fetch prize entries
  const { data, mutate, isLoading } = useSWR(
    `/api/prize-payout?status=${filter}&date=${selectedDate}&source=${sourceFilter}`,
    fetcher,
    { refreshInterval: 10000 } // Refresh every 10 seconds
  );
  
  const entries = data?.entries || [];
  const stats = data?.stats || { total_winners: 0, total_payout: 0, pending_count: 0, paid_count: 0 };
  
  // Handle file upload
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) throw new Error('Upload failed');
      
      const { url } = await res.json();
      setSlipUrl(url);
      toast.success('อัปโหลดสลิปสำเร็จ');
    } catch (error) {
      toast.error('อัปโหลดสลิปล้มเหลว');
    } finally {
      setIsUploading(false);
    }
  }, []);
  
  // Submit payout
  const handleSubmitPayout = useCallback(async () => {
    if (!selectedEntry || !slipUrl) {
      toast.error('กรุณาอัปโหลดสลิปก่อน');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/prize-payout/${selectedEntry.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slip_url: slipUrl, note }),
      });
      
      if (!res.ok) throw new Error('Failed to submit');
      
      toast.success('บันทึกการจ่ายรางวัลสำเร็จ');
      setShowPayDialog(false);
      setSelectedEntry(null);
      setSlipUrl('');
      setNote('');
      mutate();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedEntry, slipUrl, note, mutate]);
  
  // Open pay dialog
  const openPayDialog = (entry: any) => {
    setSelectedEntry(entry);
    setSlipUrl('');
    setNote('');
    setShowPayDialog(true);
  };
  
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
            <Trophy className="h-6 w-6" />
            จ่ายรางวัลลูกค้าคีย์
          </h1>
          <p className="text-gray-400 text-sm mt-1">รายการลูกค้าที่ถูกรางวัลรอจ่ายเงิน</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-[#111] border-gray-800 text-white w-40"
          />
          <Button
            onClick={() => mutate()}
            variant="outline"
            className="border-gray-700"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-amber-500/20 to-yellow-500/10 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-amber-400" />
              <div>
                <p className="text-2xl font-bold text-amber-400">{stats.total_winners}</p>
                <p className="text-xs text-gray-400">ผู้ถูกรางวัลทั้งหมด</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/20 to-emerald-500/10 border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-400" />
              <div>
                <p className="text-2xl font-bold text-green-400">฿{stats.total_payout.toLocaleString()}</p>
                <p className="text-xs text-gray-400">ยอดจ่ายรวม</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-orange-500/20 to-red-500/10 border-orange-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-orange-400" />
              <div>
                <p className="text-2xl font-bold text-orange-400">{stats.pending_count}</p>
                <p className="text-xs text-gray-400">รอจ่าย</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-blue-400">{stats.paid_count}</p>
                <p className="text-xs text-gray-400">จ่ายแล้ว</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        <Button
          onClick={() => setFilter('pending')}
          variant={filter === 'pending' ? 'default' : 'outline'}
          className={filter === 'pending' 
            ? 'bg-orange-500 hover:bg-orange-600 text-white' 
            : 'border-gray-700 text-gray-400'}
        >
          <Clock className="h-4 w-4 mr-2" />
          รอจ่าย ({stats.pending_count})
        </Button>
        <Button
          onClick={() => setFilter('paid')}
          variant={filter === 'paid' ? 'default' : 'outline'}
          className={filter === 'paid' 
            ? 'bg-green-500 hover:bg-green-600 text-white' 
            : 'border-gray-700 text-gray-400'}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          จ่ายแล้ว ({stats.paid_count})
        </Button>
        <Button
          onClick={() => setFilter('all')}
          variant={filter === 'all' ? 'default' : 'outline'}
          className={filter === 'all' 
            ? 'bg-gray-600 hover:bg-gray-500 text-white' 
            : 'border-gray-700 text-gray-400'}
        >
          ทั้งหมด
        </Button>
        
        {/* Separator */}
        <div className="w-px bg-gray-700 mx-2" />
        
        {/* Source Type Filter */}
        <Button
          onClick={() => setSourceFilter('all')}
          variant={sourceFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          className={sourceFilter === 'all' 
            ? 'bg-purple-500 hover:bg-purple-600 text-white' 
            : 'border-gray-700 text-gray-400'}
        >
          ทุกช่องทาง
        </Button>
        <Button
          onClick={() => setSourceFilter('manual')}
          variant={sourceFilter === 'manual' ? 'default' : 'outline'}
          size="sm"
          className={sourceFilter === 'manual' 
            ? 'bg-amber-500 hover:bg-amber-600 text-white' 
            : 'border-gray-700 text-gray-400'}
        >
          คีย์หวย
        </Button>
        <Button
          onClick={() => setSourceFilter('auto')}
          variant={sourceFilter === 'auto' ? 'default' : 'outline'}
          size="sm"
          className={sourceFilter === 'auto' 
            ? 'bg-green-500 hover:bg-green-600 text-white' 
            : 'border-gray-700 text-gray-400'}
        >
          ออโต้
        </Button>
        <Button
          onClick={() => setSourceFilter('tenant')}
          variant={sourceFilter === 'tenant' ? 'default' : 'outline'}
          size="sm"
          className={sourceFilter === 'tenant' 
            ? 'bg-blue-500 hover:bg-blue-600 text-white' 
            : 'border-gray-700 text-gray-400'}
        >
          เว็บลูก
        </Button>
      </div>
      
      {/* Winners List */}
      <Card className="bg-[#111] border-gray-800">
        <CardHeader className="border-b border-gray-800">
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-400" />
            รายการผู้ถูกรางวัล
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
            </div>
          ) : entries.length > 0 ? (
            <ScrollArea className="h-[500px]">
              <div className="divide-y divide-gray-800">
                {entries.map((entry: any) => (
                  <div key={entry.id} className="p-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-center justify-between">
                      {/* Left - Customer Info */}
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
                          <User className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-white text-lg">
                            {entry.customer?.name || entry.customer_name || 'ไม่ระบุชื่อ'}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <span>{entry.lottery?.name || 'หวย'}</span>
                            <span>•</span>
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                              {BET_TYPE_LABELS[entry.bet_type] || entry.bet_type} {entry.number}
                            </Badge>
                          </div>
                          {entry.customer && (entry.customer.bank_code || entry.customer.bank_account_number) && (
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Building className="h-3 w-3" />
                                {BANK_NAMES[entry.customer.bank_code] || entry.customer.bank_code || '-'}
                              </span>
                              <span className="flex items-center gap-1">
                                <CreditCard className="h-3 w-3" />
                                {entry.customer.bank_account_number || '-'}
                              </span>
                              <span>({entry.customer.bank_account_name || '-'})</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Right - Amount & Action */}
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-gray-500">ยอดถูกรางวัล</p>
                          <p className="text-2xl font-bold text-green-400">
                            ฿{(entry.payout_amount || 0).toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            แทง ฿{entry.amount}
                          </p>
                        </div>
                        
                        <div className="text-right min-w-[100px]">
                          {entry.payout_status === 'paid' ? (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              จ่ายแล้ว
                            </Badge>
                          ) : (
                            <Button
                              onClick={() => openPayDialog(entry)}
                              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white"
                              size="sm"
                            >
                              <Send className="h-4 w-4 mr-2" />
                              จ่ายเงิน
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-gray-500">
              <AlertCircle className="h-12 w-12 mb-2" />
              <p>ไม่มีรายการผู้ถูกรางวัล</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Pay Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent className="bg-[#111] border-gray-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-amber-400 flex items-center gap-2">
              <Send className="h-5 w-5" />
              จ่ายรางวัล
            </DialogTitle>
          </DialogHeader>
          
          {selectedEntry && (
            <div className="space-y-4 py-4">
              {/* Customer Info */}
              <div className="bg-[#0a0a0a] rounded-lg p-4 border border-gray-800">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <User className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{selectedEntry.customer?.name || selectedEntry.customer_name || 'ไม่ระบุชื่อ'}</p>
                    <p className="text-xs text-gray-400">{selectedEntry.lottery?.name}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">เลขที่ถูก</p>
                    <p className="text-green-400 font-mono font-bold text-lg">
                      {BET_TYPE_LABELS[selectedEntry.bet_type]} {selectedEntry.number}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">ยอดจ่าย</p>
                    <p className="text-green-400 font-bold text-lg">
                      ฿{(selectedEntry.payout_amount || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Bank Info - แสดงเฉพาะเมื่อมีข้อมูลบัญชี */}
              {selectedEntry.customer && (selectedEntry.customer.bank_code || selectedEntry.customer.bank_account_number) ? (
                <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 rounded-lg p-4 border border-blue-500/30">
                  <p className="text-xs text-gray-400 mb-2">ข้อมูลบัญชีรับเงิน</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-blue-400" />
                      <span className="text-white">
                        {BANK_NAMES[selectedEntry.customer.bank_code] || selectedEntry.customer.bank_code || '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-blue-400" />
                      <span className="text-white font-mono">
                        {selectedEntry.customer.bank_account_number || '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-400" />
                      <span className="text-white">
                        {selectedEntry.customer.bank_account_name || '-'}
                      </span>
                    </div>
                    {selectedEntry.customer.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-blue-400" />
                        <span className="text-white">
                          {selectedEntry.customer.phone}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-orange-500/10 to-red-500/5 rounded-lg p-4 border border-orange-500/30">
                  <p className="text-xs text-orange-400 mb-1">ไม่มีข้อมูลบัญชีธนาคาร</p>
                  <p className="text-xs text-gray-500">ลูกค้ายังไม่ได้กรอกข้อมูลบัญชีสำหรับรับเงิน</p>
                </div>
              )}
              
              {/* Upload Slip */}
              <div>
                <p className="text-sm text-gray-400 mb-2">อัปโหลดสลิปโอนเงิน</p>
                <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 text-center">
                  {slipUrl ? (
                    <div className="relative">
                      <img src={slipUrl} alt="Slip" className="max-h-40 mx-auto rounded" />
                      <Button
                        onClick={() => setSlipUrl('')}
                        variant="destructive"
                        size="icon"
                        className="absolute top-0 right-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={isUploading}
                      />
                      <div className="flex flex-col items-center gap-2">
                        {isUploading ? (
                          <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                        ) : (
                          <Upload className="h-8 w-8 text-gray-500" />
                        )}
                        <p className="text-gray-500">คลิกเพื่ออัปโหลดสลิป</p>
                      </div>
                    </label>
                  )}
                </div>
              </div>
              
              {/* Note */}
              <div>
                <p className="text-sm text-gray-400 mb-2">หมายเหตุ (ไม่บังคับ)</p>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="เช่น โอนผ่านแอป, รอยืนยัน"
                  className="bg-[#0a0a0a] border-gray-700 text-white"
                  rows={2}
                />
              </div>
              
              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowPayDialog(false)}
                  className="flex-1 border-gray-700"
                >
                  ยกเลิก
                </Button>
                <Button
                  onClick={handleSubmitPayout}
                  disabled={!slipUrl || isSubmitting}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  บันทึกการจ่าย
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
