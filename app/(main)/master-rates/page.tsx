'use client';

import { useState } from 'react';
import { 
  Crown, Settings, Lock, Unlock, Globe, AlertTriangle,
  Save, RotateCcw, Shield, Building2, ChevronRight,
  Ban, CheckCircle2, Info, Percent, DollarSign
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { cn } from '@/lib/utils';

// Master rates configuration
const defaultRates = {
  threeTop: { rate: 850, limit: 1000000 },
  threeBottom: { rate: 450, limit: 500000 },
  threeTod: { rate: 150, limit: 500000 },
  twoTop: { rate: 92, limit: 500000 },
  twoBottom: { rate: 92, limit: 500000 },
  runTop: { rate: 3.5, limit: 200000 },
  runBottom: { rate: 4.2, limit: 200000 },
};

// Limited numbers (เลขอั้น)
const limitedNumbers = [
  { number: '000', type: '3 ตัวบน', maxAmount: 50000, currentAmount: 48500, status: 'warning' },
  { number: '111', type: '3 ตัวบน', maxAmount: 50000, currentAmount: 50000, status: 'full' },
  { number: '222', type: '3 ตัวบน', maxAmount: 50000, currentAmount: 32000, status: 'normal' },
  { number: '555', type: '3 ตัวบน', maxAmount: 50000, currentAmount: 50000, status: 'full' },
  { number: '777', type: '3 ตัวบน', maxAmount: 50000, currentAmount: 45000, status: 'warning' },
  { number: '999', type: '3 ตัวบน', maxAmount: 50000, currentAmount: 50000, status: 'full' },
  { number: '00', type: '2 ตัว', maxAmount: 100000, currentAmount: 85000, status: 'warning' },
  { number: '11', type: '2 ตัว', maxAmount: 100000, currentAmount: 100000, status: 'full' },
  { number: '99', type: '2 ตัว', maxAmount: 100000, currentAmount: 100000, status: 'full' },
];

// Mock sites for override
const mockSites = [
  { id: 'site_001', name: 'LottoKing', useGlobalRates: true, useGlobalLimits: true },
  { id: 'site_002', name: 'HuayVIP', useGlobalRates: true, useGlobalLimits: false },
  { id: 'site_003', name: 'LottoPro', useGlobalRates: false, useGlobalLimits: true },
  { id: 'site_004', name: 'MegaLotto', useGlobalRates: true, useGlobalLimits: true },
];

export default function MasterRatesPage() {
  const [rates, setRates] = useState(defaultRates);
  const [forceGlobalRates, setForceGlobalRates] = useState(false);
  const [forceGlobalLimits, setForceGlobalLimits] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const updateRate = (key: keyof typeof defaultRates, field: 'rate' | 'limit', value: number) => {
    setRates(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value }
    }));
    setHasChanges(true);
  };

  const resetToDefault = () => {
    setRates(defaultRates);
    setHasChanges(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 
            className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 flex items-center gap-3"
            style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
          >
            <Crown className="size-8 text-amber-400" />
            Master Rate & Limits
          </h1>
          <p className="text-slate-400 mt-1">กำหนดเรทจ่ายกลางและเลขอั้นสำหรับทุกเว็บลูก</p>
        </div>
        
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="border-slate-600"
            onClick={resetToDefault}
            disabled={!hasChanges}
          >
            <RotateCcw className="size-4 mr-2" />
            รีเซ็ต
          </Button>
          <Button 
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold"
            disabled={!hasChanges}
          >
            <Save className="size-4 mr-2" />
            บันทึกการเปลี่ยนแปลง
          </Button>
        </div>
      </div>

      {/* Force Override Controls */}
      <Card className="bg-gradient-to-br from-red-900/20 to-red-950/20 border-red-500/30 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-red-400 flex items-center gap-2">
            <Shield className="size-5" />
            Master Override Control
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className={cn(
              "p-4 rounded-xl border transition-all",
              forceGlobalRates 
                ? "bg-red-500/10 border-red-500/30" 
                : "bg-black/40 border-amber-500/20"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {forceGlobalRates ? <Lock className="size-5 text-red-400" /> : <Unlock className="size-5 text-slate-400" />}
                  <div>
                    <p className="font-medium text-white">บังคับใช้เรทกลางทุกเว็บ</p>
                    <p className="text-sm text-slate-400">เว็บลูกจะไม่สามารถตั้งเรทเองได้</p>
                  </div>
                </div>
                <Switch 
                  checked={forceGlobalRates}
                  onCheckedChange={setForceGlobalRates}
                />
              </div>
              {forceGlobalRates && (
                <Badge className="mt-3 bg-red-500/20 text-red-400 border-red-500/30">
                  บังคับใช้กับ {mockSites.length} เว็บ
                </Badge>
              )}
            </div>
            
            <div className={cn(
              "p-4 rounded-xl border transition-all",
              forceGlobalLimits 
                ? "bg-red-500/10 border-red-500/30" 
                : "bg-black/40 border-amber-500/20"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {forceGlobalLimits ? <Lock className="size-5 text-red-400" /> : <Unlock className="size-5 text-slate-400" />}
                  <div>
                    <p className="font-medium text-white">บังคับใช้เลขอั้นกลางทุกเว็บ</p>
                    <p className="text-sm text-slate-400">เว็บลูกจะไม่สามารถตั้งอั้นเองได้</p>
                  </div>
                </div>
                <Switch 
                  checked={forceGlobalLimits}
                  onCheckedChange={setForceGlobalLimits}
                />
              </div>
              {forceGlobalLimits && (
                <Badge className="mt-3 bg-red-500/20 text-red-400 border-red-500/30">
                  บังคับใช้กับ {mockSites.length} เว็บ
                </Badge>
              )}
            </div>
          </div>
          
          {(forceGlobalRates || forceGlobalLimits) && (
            <Alert className="bg-red-500/10 border-red-500/30">
              <AlertTriangle className="size-4 text-red-400" />
              <AlertTitle className="text-red-400">Warning: Master Override Active</AlertTitle>
              <AlertDescription className="text-red-300/80">
                การบังคับใช้จะมีผลทันทีกับทุกเว็บลูก เว็บที่ตั้งค่าเองไว้จะถูก override
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="rates" className="space-y-6">
        <TabsList className="bg-black/40 border border-amber-500/20 p-1">
          <TabsTrigger 
            value="rates" 
            className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400"
          >
            <DollarSign className="size-4 mr-2" />
            เรทจ่ายกลาง
          </TabsTrigger>
          <TabsTrigger 
            value="limits" 
            className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400"
          >
            <Ban className="size-4 mr-2" />
            เลขอั้นกลาง
          </TabsTrigger>
          <TabsTrigger 
            value="sites" 
            className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400"
          >
            <Building2 className="size-4 mr-2" />
            สถานะเว็บลูก
          </TabsTrigger>
        </TabsList>

        {/* Rates Tab */}
        <TabsContent value="rates" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* 3 ตัว */}
            <Card className="bg-gradient-to-br from-black/60 to-black/40 border-amber-500/30 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-amber-400">เลข 3 ตัว</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-slate-300">3 ตัวบน</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">อัตราจ่าย</p>
                      <div className="relative">
                        <Input 
                          type="number"
                          value={rates.threeTop.rate}
                          onChange={(e) => updateRate('threeTop', 'rate', Number(e.target.value))}
                          className="bg-black/40 border-amber-500/30 pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">x</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">วงเงินสูงสุด</p>
                      <Input 
                        type="number"
                        value={rates.threeTop.limit}
                        onChange={(e) => updateRate('threeTop', 'limit', Number(e.target.value))}
                        className="bg-black/40 border-amber-500/30"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Label className="text-slate-300">3 ตัวล่าง</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">อัตราจ่าย</p>
                      <div className="relative">
                        <Input 
                          type="number"
                          value={rates.threeBottom.rate}
                          onChange={(e) => updateRate('threeBottom', 'rate', Number(e.target.value))}
                          className="bg-black/40 border-amber-500/30 pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">x</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">วงเงินสูงสุด</p>
                      <Input 
                        type="number"
                        value={rates.threeBottom.limit}
                        onChange={(e) => updateRate('threeBottom', 'limit', Number(e.target.value))}
                        className="bg-black/40 border-amber-500/30"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Label className="text-slate-300">3 ตัวโต๊ด</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">อัตราจ่าย</p>
                      <div className="relative">
                        <Input 
                          type="number"
                          value={rates.threeTod.rate}
                          onChange={(e) => updateRate('threeTod', 'rate', Number(e.target.value))}
                          className="bg-black/40 border-amber-500/30 pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">x</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">วงเงินสูงสุด</p>
                      <Input 
                        type="number"
                        value={rates.threeTod.limit}
                        onChange={(e) => updateRate('threeTod', 'limit', Number(e.target.value))}
                        className="bg-black/40 border-amber-500/30"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2 ตัว */}
            <Card className="bg-gradient-to-br from-black/60 to-black/40 border-blue-500/30 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-blue-400">เลข 2 ตัว</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-slate-300">2 ตัวบน</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">อัตราจ่าย</p>
                      <div className="relative">
                        <Input 
                          type="number"
                          value={rates.twoTop.rate}
                          onChange={(e) => updateRate('twoTop', 'rate', Number(e.target.value))}
                          className="bg-black/40 border-blue-500/30 pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">x</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">วงเงินสูงสุด</p>
                      <Input 
                        type="number"
                        value={rates.twoTop.limit}
                        onChange={(e) => updateRate('twoTop', 'limit', Number(e.target.value))}
                        className="bg-black/40 border-blue-500/30"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Label className="text-slate-300">2 ตัวล่าง</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">อัตราจ่าย</p>
                      <div className="relative">
                        <Input 
                          type="number"
                          value={rates.twoBottom.rate}
                          onChange={(e) => updateRate('twoBottom', 'rate', Number(e.target.value))}
                          className="bg-black/40 border-blue-500/30 pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">x</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">วงเงินสูงสุด</p>
                      <Input 
                        type="number"
                        value={rates.twoBottom.limit}
                        onChange={(e) => updateRate('twoBottom', 'limit', Number(e.target.value))}
                        className="bg-black/40 border-blue-500/30"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* วิ่ง */}
            <Card className="bg-gradient-to-br from-black/60 to-black/40 border-emerald-500/30 backdrop-blur-xl md:col-span-2">
              <CardHeader>
                <CardTitle className="text-emerald-400">เลขวิ่ง</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-slate-300">วิ่งบน</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">อัตราจ่าย</p>
                        <div className="relative">
                          <Input 
                            type="number"
                            step="0.1"
                            value={rates.runTop.rate}
                            onChange={(e) => updateRate('runTop', 'rate', Number(e.target.value))}
                            className="bg-black/40 border-emerald-500/30 pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">x</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">วงเงินสูงสุด</p>
                        <Input 
                          type="number"
                          value={rates.runTop.limit}
                          onChange={(e) => updateRate('runTop', 'limit', Number(e.target.value))}
                          className="bg-black/40 border-emerald-500/30"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <Label className="text-slate-300">วิ่งล่าง</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">อัตราจ่าย</p>
                        <div className="relative">
                          <Input 
                            type="number"
                            step="0.1"
                            value={rates.runBottom.rate}
                            onChange={(e) => updateRate('runBottom', 'rate', Number(e.target.value))}
                            className="bg-black/40 border-emerald-500/30 pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">x</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">วงเงินสูงสุด</p>
                        <Input 
                          type="number"
                          value={rates.runBottom.limit}
                          onChange={(e) => updateRate('runBottom', 'limit', Number(e.target.value))}
                          className="bg-black/40 border-emerald-500/30"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Limits Tab */}
        <TabsContent value="limits" className="space-y-6">
          <Card className="bg-gradient-to-br from-black/60 to-black/40 border-amber-500/30 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-amber-400">รายการเลขอั้นกลาง</CardTitle>
              <Button className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold">
                + เพิ่มเลขอั้น
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-amber-500/20">
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">เลข</th>
                      <th className="text-left py-3 px-4 text-slate-400 font-medium">ประเภท</th>
                      <th className="text-right py-3 px-4 text-slate-400 font-medium">วงเงินสูงสุด</th>
                      <th className="text-right py-3 px-4 text-slate-400 font-medium">ยอดปัจจุบัน</th>
                      <th className="text-center py-3 px-4 text-slate-400 font-medium">สถานะ</th>
                      <th className="text-center py-3 px-4 text-slate-400 font-medium">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {limitedNumbers.map((item, index) => (
                      <tr 
                        key={index}
                        className={cn(
                          "border-b border-white/5 transition-colors",
                          item.status === 'full' && "bg-red-500/10",
                          item.status === 'warning' && "bg-orange-500/10"
                        )}
                      >
                        <td className="py-3 px-4">
                          <span className="font-mono text-xl font-bold text-white">{item.number}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{item.type}</td>
                        <td className="py-3 px-4 text-right text-slate-300">
                          {item.maxAmount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={cn(
                            "font-bold",
                            item.status === 'full' && "text-red-400",
                            item.status === 'warning' && "text-orange-400",
                            item.status === 'normal' && "text-emerald-400"
                          )}>
                            {item.currentAmount.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge className={cn(
                            "text-xs",
                            item.status === 'full' && "bg-red-500/20 text-red-400 border-red-500/30",
                            item.status === 'warning' && "bg-orange-500/20 text-orange-400 border-orange-500/30",
                            item.status === 'normal' && "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          )}>
                            {item.status === 'full' ? 'เต็ม' : item.status === 'warning' ? 'ใกล้เต็ม' : 'ปกติ'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300">
                            <Settings className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sites Status Tab */}
        <TabsContent value="sites" className="space-y-6">
          <Card className="bg-gradient-to-br from-black/60 to-black/40 border-amber-500/30 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-amber-400">สถานะการใช้งานเรท/อั้นของเว็บลูก</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockSites.map((site) => (
                  <div 
                    key={site.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-white/5 hover:border-amber-500/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-black font-bold">
                        {site.name.substring(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium text-white">{site.name}</p>
                        <p className="text-xs text-slate-500">ID: {site.id}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {site.useGlobalRates ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                            <CheckCircle2 className="size-3 mr-1" />
                            เรทกลาง
                          </Badge>
                        ) : (
                          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">
                            <Info className="size-3 mr-1" />
                            เรทเอง
                          </Badge>
                        )}
                        
                        {site.useGlobalLimits ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                            <CheckCircle2 className="size-3 mr-1" />
                            อั้นกลาง
                          </Badge>
                        ) : (
                          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">
                            <Info className="size-3 mr-1" />
                            อั้นเอง
                          </Badge>
                        )}
                      </div>
                      
                      <Button variant="ghost" size="sm" className="text-slate-400 hover:text-amber-400">
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
