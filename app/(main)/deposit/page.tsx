'use client';

import { useState, useEffect } from 'react';
import { 
  QrCode, 
  Wallet, 
  Clock, 
  CheckCircle2, 
  Copy, 
  RefreshCw,
  Smartphone,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Quick amount buttons
const QUICK_AMOUNTS = [100, 500, 1000, 2000, 5000, 10000];

export default function DepositPage() {
  const [amount, setAmount] = useState('');
  const [qrGenerated, setQrGenerated] = useState(false);
  const [reference, setReference] = useState('');
  const [expiresIn, setExpiresIn] = useState(900); // 15 minutes in seconds
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (qrGenerated && expiresIn > 0) {
      const timer = setInterval(() => {
        setExpiresIn(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [qrGenerated, expiresIn]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const handleGenerateQR = async () => {
    if (!amount || parseInt(amount) < 100) {
      alert('กรุณาใส่จำนวนเงินขั้นต่ำ 100 บาท');
      return;
    }
    
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Generate reference
    const ref = `FLR${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    setReference(ref);
    setQrGenerated(true);
    setExpiresIn(900);
    setIsLoading(false);
  };

  const handleCopyReference = () => {
    navigator.clipboard.writeText(reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNewQR = () => {
    setQrGenerated(false);
    setAmount('');
    setReference('');
    setExpiresIn(900);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 
          className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
          style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
        >
          เติมเงินอัตโนมัติ
        </h1>
        <p className="text-slate-400 mt-2">ผ่าน QR Code PromptPay - เครดิตเข้าทันที</p>
      </div>

      <div className="max-w-md mx-auto space-y-6">
        {!qrGenerated ? (
          <>
            {/* Amount Input */}
            <Card className="bg-black/40 backdrop-blur-xl border-amber-500/20">
              <CardHeader>
                <CardTitle className="text-amber-400 flex items-center gap-2">
                  <Wallet className="size-5" />
                  ระบุจำนวนเงิน
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-black/30 border-amber-500/30 text-white text-2xl text-center h-16 pr-12"
                    placeholder="0.00"
                    min={100}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-400 font-medium">
                    บาท
                  </span>
                </div>

                {/* Quick Amount Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  {QUICK_AMOUNTS.map((quickAmount) => (
                    <Button
                      key={quickAmount}
                      variant="outline"
                      className={cn(
                        "border-amber-500/30 text-amber-400 hover:bg-amber-500/10",
                        amount === quickAmount.toString() && "bg-amber-500/20 border-amber-400"
                      )}
                      onClick={() => setAmount(quickAmount.toString())}
                    >
                      {quickAmount.toLocaleString()}
                    </Button>
                  ))}
                </div>

                <Button
                  className="w-full h-12 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-lg"
                  onClick={handleGenerateQR}
                  disabled={isLoading || !amount}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="size-5 mr-2 animate-spin" />
                      กำลังสร้าง QR Code...
                    </>
                  ) : (
                    <>
                      <QrCode className="size-5 mr-2" />
                      สร้าง QR Code
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="bg-blue-900/20 border-blue-500/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Info className="size-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-slate-300 space-y-1">
                    <p>- ยอดขั้นต่ำ 100 บาท</p>
                    <p>- QR Code หมดอายุใน 15 นาที</p>
                    <p>- เครดิตเข้าภายใน 1-3 นาทีหลังชำระ</p>
                    <p>- รองรับทุกธนาคารและแอป Wallet</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {/* QR Code Display */}
            <Card className="bg-black/40 backdrop-blur-xl border-amber-500/20">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-amber-400">สแกนเพื่อชำระเงิน</CardTitle>
                <CardDescription className="text-slate-400">
                  PromptPay QR Code
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Timer Warning */}
                {expiresIn <= 0 ? (
                  <div className="p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-center">
                    <AlertTriangle className="size-6 text-red-400 mx-auto mb-2" />
                    <p className="text-red-400 font-medium">QR Code หมดอายุแล้ว</p>
                    <Button 
                      variant="outline" 
                      className="mt-2 border-red-500/50 text-red-400"
                      onClick={handleNewQR}
                    >
                      สร้าง QR ใหม่
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Timer */}
                    <div className={cn(
                      "flex items-center justify-center gap-2 p-2 rounded-lg",
                      expiresIn <= 60 
                        ? "bg-red-900/30 border border-red-500/30" 
                        : expiresIn <= 180 
                          ? "bg-yellow-900/30 border border-yellow-500/30"
                          : "bg-emerald-900/30 border border-emerald-500/30"
                    )}>
                      <Clock className={cn(
                        "size-5",
                        expiresIn <= 60 ? "text-red-400" : expiresIn <= 180 ? "text-yellow-400" : "text-emerald-400"
                      )} />
                      <span className={cn(
                        "font-mono text-lg font-bold",
                        expiresIn <= 60 ? "text-red-400" : expiresIn <= 180 ? "text-yellow-400" : "text-emerald-400"
                      )}>
                        {formatTime(expiresIn)}
                      </span>
                      <span className="text-slate-400 text-sm">เหลือเวลา</span>
                    </div>

                    {/* QR Code Image */}
                    <div className="bg-white p-6 rounded-2xl mx-auto w-fit">
                      {/* Placeholder QR - In production use real QR generator */}
                      <div className="size-48 bg-gradient-to-br from-slate-200 to-slate-300 rounded-lg flex items-center justify-center">
                        <QrCode className="size-32 text-slate-600" />
                      </div>
                    </div>

                    {/* Amount Display */}
                    <div className="text-center p-4 rounded-xl bg-gradient-to-r from-amber-900/30 to-amber-950/50 border border-amber-500/20">
                      <p className="text-slate-400 text-sm">จำนวนเงิน</p>
                      <p className="text-3xl font-bold text-amber-400">
                        {formatCurrency(parseInt(amount))} บาท
                      </p>
                    </div>

                    {/* Reference */}
                    <div className="p-3 rounded-lg bg-black/30 border border-slate-700/50">
                      <p className="text-slate-400 text-xs mb-1">Reference No.</p>
                      <div className="flex items-center justify-between">
                        <code className="text-white font-mono">{reference}</code>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-amber-400 hover:text-amber-300"
                          onClick={handleCopyReference}
                        >
                          {copied ? <CheckCircle2 className="size-4" /> : <Copy className="size-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Instructions */}
                    <div className="space-y-2 text-sm text-slate-400">
                      <div className="flex items-center gap-2">
                        <Smartphone className="size-4 text-amber-400" />
                        <span>เปิดแอปธนาคารหรือ Wallet</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <QrCode className="size-4 text-amber-400" />
                        <span>สแกน QR Code ด้านบน</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-amber-400" />
                        <span>ยืนยันการชำระเงิน</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1 border-slate-600 text-slate-400"
                        onClick={handleNewQR}
                      >
                        ยกเลิก
                      </Button>
                      <Button 
                        className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700"
                        onClick={() => alert('กรุณาสแกน QR Code เพื่อชำระเงิน')}
                      >
                        <RefreshCw className="size-4 mr-2" />
                        ตรวจสอบสถานะ
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Recent Deposits */}
            <Card className="bg-black/40 backdrop-blur-xl border-slate-700/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-slate-300 text-sm">รายการเติมเงินล่าสุด</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded bg-emerald-900/20 border border-emerald-500/20">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400" />
                    <span className="text-white text-sm">+1,000 บาท</span>
                  </div>
                  <span className="text-xs text-slate-400">5 นาทีที่แล้ว</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-emerald-900/20 border border-emerald-500/20">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400" />
                    <span className="text-white text-sm">+5,000 บาท</span>
                  </div>
                  <span className="text-xs text-slate-400">2 ชั่วโมงที่แล้ว</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
