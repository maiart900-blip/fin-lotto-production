'use client';

import { useState, useEffect } from 'react';
import { 
  Crown, Settings, Lock, Unlock, Globe, AlertTriangle,
  Save, RotateCcw, Shield, Building2, ChevronRight,
  Ban, CheckCircle2, Info, Percent, DollarSign, Plus, Pencil, Trash2, X, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

// Limited numbers (เลขอั้น) - จะถูก replace ด้วยข้อมูลจาก database
const initialLimitedNumbers: BlockedNumber[] = [];

// Mock sites for override
const mockSites = [
  { id: 'site_001', name: 'LottoKing', useGlobalRates: true, useGlobalLimits: true },
  { id: 'site_002', name: 'HuayVIP', useGlobalRates: true, useGlobalLimits: false },
  { id: 'site_003', name: 'LottoPro', useGlobalRates: false, useGlobalLimits: true },
  { id: 'site_004', name: 'MegaLotto', useGlobalRates: true, useGlobalLimits: true },
];

// Types
interface BlockedNumber {
  id?: string;
  number: string;
  entry_type: string;
  limit_amount: number | null;
  current_amount: number;
  is_blocked: boolean;
  note: string | null;
  lottery_id?: string | null;
  created_at?: string;
}

const entryTypes = [
  { value: 'three_top', label: '3 ตัวบน' },
  { value: 'three_bottom', label: '3 ตัวล่าง' },
  { value: 'three_tod', label: '3 ตัวโต๊ด' },
  { value: 'two_top', label: '2 ตัวบน' },
  { value: 'two_bottom', label: '2 ตัวล่าง' },
  { value: 'run_top', label: 'วิ่งบน' },
  { value: 'run_bottom', label: 'วิ่งล่าง' },
];

const getEntryTypeLabel = (value: string) => {
  const type = entryTypes.find(t => t.value === value);
  return type?.label || value;
};

export default function MasterRatesPage() {
  const [rates, setRates] = useState(defaultRates);
  const [forceGlobalRates, setForceGlobalRates] = useState(false);
  const [forceGlobalLimits, setForceGlobalLimits] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Blocked numbers state
  const [blockedNumbers, setBlockedNumbers] = useState<BlockedNumber[]>([]);
  const [loadingNumbers, setLoadingNumbers] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingNumber, setEditingNumber] = useState<BlockedNumber | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    number: '',
    entry_type: 'three_top',
    limit_amount: '',
    is_blocked: false,
    note: '',
  });

  // Fetch blocked numbers from database
  const fetchBlockedNumbers = async () => {
    try {
      setLoadingNumbers(true);
      const res = await fetch('/api/blocked-numbers');
      const data = await res.json();
      setBlockedNumbers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching blocked numbers:', error);
      setBlockedNumbers([]);
    } finally {
      setLoadingNumbers(false);
    }
  };

  useEffect(() => {
    fetchBlockedNumbers();
  }, []);

  // Reset form
  const resetForm = () => {
    setFormData({
      number: '',
      entry_type: 'three_top',
      limit_amount: '',
      is_blocked: false,
      note: '',
    });
  };

  // Open add modal
  const openAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  // Open edit modal
  const openEditModal = (item: BlockedNumber) => {
    setEditingNumber(item);
    setFormData({
      number: item.number,
      entry_type: item.entry_type,
      limit_amount: item.limit_amount?.toString() || '',
      is_blocked: item.is_blocked,
      note: item.note || '',
    });
    setIsEditModalOpen(true);
  };

  // Add blocked number
  const handleAdd = async () => {
    if (!formData.number.trim()) {
      toast.error('กรุณากรอกเลข');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/blocked-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: formData.number.trim(),
          entry_type: formData.entry_type,
          limit_amount: formData.limit_amount ? parseInt(formData.limit_amount) : null,
          is_blocked: formData.is_blocked,
          note: formData.note || null,
          lottery_id: null, // Global blocked number
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.error || 'ไม่สามารถเพิ่มเลขอั้นได้');
        return;
      }

      toast.success('เพิ่มเลขอั้นสำเร็จ');
      setIsAddModalOpen(false);
      resetForm();
      fetchBlockedNumbers();
    } catch (error) {
      console.error('handleAdd error:', error);
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };

  // Update blocked number
  const handleUpdate = async () => {
    if (!editingNumber?.id || !formData.number.trim()) {
      toast.error('กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/blocked-numbers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingNumber.id,
          number: formData.number.trim(),
          entry_type: formData.entry_type,
          limit_amount: formData.limit_amount ? parseInt(formData.limit_amount) : null,
          is_blocked: formData.is_blocked,
          note: formData.note || null,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.error || 'ไม่สามารถแก้ไขได้');
        return;
      }

      toast.success('แก้ไขเลขอั้นสำเร็จ');
      setIsEditModalOpen(false);
      setEditingNumber(null);
      resetForm();
      fetchBlockedNumbers();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete blocked number
  const handleDelete = async (id: string) => {
    if (!confirm('ต้องการลบเลขอั้นนี้หรือไม่?')) return;

    try {
      const res = await fetch(`/api/blocked-numbers?id=${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        toast.error('ไม่สามารถลบได้');
        return;
      }

      toast.success('ลบเลขอั้นสำเร็จ');
      fetchBlockedNumbers();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  // Toggle blocked status
  const handleToggleBlocked = async (item: BlockedNumber) => {
    try {
      const res = await fetch('/api/blocked-numbers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          is_blocked: !item.is_blocked,
        }),
      });

      if (!res.ok) {
        toast.error('ไม่สามารถเปลี่ยนสถานะได้');
        return;
      }

      toast.success(item.is_blocked ? 'เปิดใช้งานเลขอั้นแล้ว' : 'ปิดใช้งานเลขอั้นแล้ว');
      fetchBlockedNumbers();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  // Get status for display
  const getStatus = (item: BlockedNumber) => {
    if (item.is_blocked) return 'blocked';
    if (!item.limit_amount) return 'normal';
    const percentage = (item.current_amount / item.limit_amount) * 100;
    if (percentage >= 100) return 'full';
    if (percentage >= 80) return 'warning';
    return 'normal';
  };

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
              <CardTitle className="text-amber-400">รายการเลขอั้นกลาง ({blockedNumbers.length})</CardTitle>
              <Button 
                onClick={openAddModal}
                className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold"
              >
                <Plus className="size-4 mr-2" />
                เพิ่มเลขอั้น
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                {loadingNumbers ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-8 animate-spin text-amber-400" />
                  </div>
                ) : blockedNumbers.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Ban className="size-12 mx-auto mb-3 opacity-50" />
                    <p>ยังไม่มีเลขอั้นในระบบ</p>
                    <p className="text-sm mt-1">กดปุ่ม "เพิ่มเลขอั้น" เพื่อเริ่มต้น</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-amber-500/20">
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">เลข</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">ประเภท</th>
                        <th className="text-right py-3 px-4 text-slate-400 font-medium">วงเงินสูงสุด</th>
                        <th className="text-right py-3 px-4 text-slate-400 font-medium">ยอดปัจจุบัน</th>
                        <th className="text-center py-3 px-4 text-slate-400 font-medium">สถานะ</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">หมายเหตุ</th>
                        <th className="text-center py-3 px-4 text-slate-400 font-medium">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blockedNumbers.map((item) => {
                        const status = getStatus(item);
                        return (
                          <tr 
                            key={item.id}
                            className={cn(
                              "border-b border-white/5 transition-colors",
                              status === 'full' && "bg-red-500/10",
                              status === 'warning' && "bg-orange-500/10",
                              status === 'blocked' && "bg-slate-500/10"
                            )}
                          >
                            <td className="py-3 px-4">
                              <span className="font-mono text-xl font-bold text-white">{item.number}</span>
                            </td>
                            <td className="py-3 px-4 text-slate-300">{getEntryTypeLabel(item.entry_type)}</td>
                            <td className="py-3 px-4 text-right text-slate-300">
                              {item.limit_amount ? item.limit_amount.toLocaleString() : '-'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className={cn(
                                "font-bold",
                                status === 'full' && "text-red-400",
                                status === 'warning' && "text-orange-400",
                                status === 'normal' && "text-emerald-400",
                                status === 'blocked' && "text-slate-400"
                              )}>
                                {item.current_amount?.toLocaleString() || '0'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Badge className={cn(
                                "text-xs cursor-pointer",
                                status === 'full' && "bg-red-500/20 text-red-400 border-red-500/30",
                                status === 'warning' && "bg-orange-500/20 text-orange-400 border-orange-500/30",
                                status === 'normal' && "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                                status === 'blocked' && "bg-slate-500/20 text-slate-400 border-slate-500/30"
                              )} onClick={() => handleToggleBlocked(item)}>
                                {status === 'full' ? 'เต็ม' : 
                                 status === 'warning' ? 'ใกล้เต็ม' : 
                                 status === 'blocked' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-slate-400 text-sm max-w-[150px] truncate">
                              {item.note || '-'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-amber-400 hover:text-amber-300"
                                  onClick={() => openEditModal(item)}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-red-400 hover:text-red-300"
                                  onClick={() => item.id && handleDelete(item.id)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
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

      {/* Add Blocked Number Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="bg-slate-900 border-amber-500/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-amber-400">เพิ่มเลขอั้นใหม่</DialogTitle>
            <DialogDescription className="text-slate-400">
              กรอกข้อมูลเลขที่ต้องการอั้นและวงเงินสูงสุด
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>เลขที่ต้องการอั้น *</Label>
              <Input
                placeholder="เช่น 123, 45, 7"
                value={formData.number}
                onChange={(e) => setFormData(prev => ({ ...prev, number: e.target.value }))}
                className="bg-black/40 border-slate-700"
              />
            </div>

            <div className="space-y-2">
              <Label>ประเภทเลข *</Label>
              <Select
                value={formData.entry_type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, entry_type: value }))}
              >
                <SelectTrigger className="bg-black/40 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {entryTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>วงเงินสูงสุด (บาท)</Label>
              <Input
                type="number"
                placeholder="เช่น 50000"
                value={formData.limit_amount}
                onChange={(e) => setFormData(prev => ({ ...prev, limit_amount: e.target.value }))}
                className="bg-black/40 border-slate-700"
              />
              <p className="text-xs text-slate-500">เว้นว่างถ้าต้องการบล็อกเลขโดยไม่จำกัดวงเงิน</p>
            </div>

            <div className="flex items-center justify-between">
              <Label>สถานะ</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">
                  {formData.is_blocked ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                </span>
                <Switch
                  checked={!formData.is_blocked}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_blocked: !checked }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>หมายเหตุ</Label>
              <Textarea
                placeholder="ระบุเหตุผลหรือหมายเหตุ (ไม่บังคับ)"
                value={formData.note}
                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                className="bg-black/40 border-slate-700 resize-none"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="border-slate-600">
              ยกเลิก
            </Button>
            <Button 
              onClick={handleAdd}
              disabled={submitting}
              className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold"
            >
              {submitting ? <Loader2 className="size-4 animate-spin mr-2" /> : <Plus className="size-4 mr-2" />}
              เพิ่มเลขอั้น
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Blocked Number Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="bg-slate-900 border-amber-500/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-amber-400">แก้ไขเลขอั้น</DialogTitle>
            <DialogDescription className="text-slate-400">
              แก้ไขข้อมูลเลขอั้น: {editingNumber?.number}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>เลขที่ต้องการอั้น *</Label>
              <Input
                placeholder="เช่น 123, 45, 7"
                value={formData.number}
                onChange={(e) => setFormData(prev => ({ ...prev, number: e.target.value }))}
                className="bg-black/40 border-slate-700"
              />
            </div>

            <div className="space-y-2">
              <Label>ประเภทเลข *</Label>
              <Select
                value={formData.entry_type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, entry_type: value }))}
              >
                <SelectTrigger className="bg-black/40 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {entryTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>วงเงินสูงสุด (บาท)</Label>
              <Input
                type="number"
                placeholder="เช่น 50000"
                value={formData.limit_amount}
                onChange={(e) => setFormData(prev => ({ ...prev, limit_amount: e.target.value }))}
                className="bg-black/40 border-slate-700"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>สถานะ</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">
                  {formData.is_blocked ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                </span>
                <Switch
                  checked={!formData.is_blocked}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_blocked: !checked }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>หมายเหตุ</Label>
              <Textarea
                placeholder="ระบุเหตุผลหรือหมายเหตุ (ไม่บังคับ)"
                value={formData.note}
                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                className="bg-black/40 border-slate-700 resize-none"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="border-slate-600">
              ยกเลิก
            </Button>
            <Button 
              onClick={handleUpdate}
              disabled={submitting}
              className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold"
            >
              {submitting ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
              บันทึกการแก้ไข
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
