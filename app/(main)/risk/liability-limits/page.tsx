'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  Plus,
  Trash2,
  Edit,
  Globe,
  AlertTriangle,
  Check,
  RefreshCw,
  Settings,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const BET_TYPES = [
  { value: '3top', label: '3 ตัวบน' },
  { value: '3tod', label: '3 ตัวโต๊ด' },
  { value: '2top', label: '2 ตัวบน' },
  { value: '2bot', label: '2 ตัวล่าง' },
  { value: 'run_top', label: 'วิ่งบน' },
  { value: 'run_bot', label: 'วิ่งล่าง' },
];

interface LiabilityLimit {
  id: string;
  number: string;
  bet_type: string;
  max_amount: number;
  is_active: boolean;
  updated_at: string;
}

export default function LiabilityLimitsPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingLimit, setEditingLimit] = useState<LiabilityLimit | null>(null);
  const [filterBetType, setFilterBetType] = useState<string>('all');
  const [broadcastToNetwork, setBroadcastToNetwork] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formNumber, setFormNumber] = useState('');
  const [formBetType, setFormBetType] = useState('');
  const [formMaxAmount, setFormMaxAmount] = useState('');

  const { data, mutate, isLoading } = useSWR('/api/liability-limits', fetcher, {
    refreshInterval: 10000,
  });

  const limits: LiabilityLimit[] = data?.limits || [];
  const globalDefault = data?.global_default || 100000;

  const filteredLimits = filterBetType === 'all' 
    ? limits 
    : limits.filter(l => l.bet_type === filterBetType);

  const handleSaveLimit = async () => {
    if (!formNumber || !formBetType || !formMaxAmount) {
      toast.error('กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/liability-limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: formNumber,
          bet_type: formBetType,
          max_amount: parseFloat(formMaxAmount),
          is_active: true,
          broadcast_to_network: broadcastToNetwork,
        }),
      });

      const result = await res.json();
      
      if (result.success) {
        toast.success(`บันทึกวงเงินสำเร็จ${result.synced_sites > 0 ? ` (Sync ${result.synced_sites} sites)` : ''}`);
        setShowAddDialog(false);
        setFormNumber('');
        setFormBetType('');
        setFormMaxAmount('');
        mutate();
      } else {
        toast.error(result.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLimit = async (limit: LiabilityLimit) => {
    if (!confirm(`ลบวงเงินเลข ${limit.number} (${limit.bet_type})?`)) return;

    try {
      const res = await fetch(
        `/api/liability-limits?number=${limit.number}&bet_type=${limit.bet_type}&broadcast=${broadcastToNetwork}`,
        { method: 'DELETE' }
      );

      const result = await res.json();
      if (result.success) {
        toast.success('ลบวงเงินสำเร็จ');
        mutate();
      } else {
        toast.error(result.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการลบ');
    }
  };

  const handleUpdateGlobalDefault = async (newDefault: number) => {
    try {
      const res = await fetch('/api/liability-limits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          global_default: newDefault,
          broadcast_to_network: broadcastToNetwork,
        }),
      });

      const result = await res.json();
      if (result.success) {
        toast.success(`อัปเดตวงเงินเริ่มต้นเป็น ${newDefault.toLocaleString()} บาท`);
        mutate();
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  return (
    <div className="live-midnight-canvas p-6 -m-6 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] shadow-lg shadow-[rgba(234,179,8,0.3)]">
              <Shield className="size-5 text-white" />
            </div>
            <span className="text-gold-gradient">Liability Limits</span>
          </h1>
          <p className="text-[#94A3B8] mt-1">จัดการวงเงินรับแทงสูงสุดต่อเลข</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Broadcast Toggle */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1E293B] border border-[rgba(234,179,8,0.2)]">
            <Globe className="size-4 text-[#EAB308]" />
            <span className="text-sm text-[#94A3B8]">Sync Network</span>
            <Switch
              checked={broadcastToNetwork}
              onCheckedChange={setBroadcastToNetwork}
              className="data-[state=checked]:bg-[#EAB308]"
            />
          </div>

          <Button
            onClick={() => mutate()}
            variant="outline"
            className="border-[#EAB308] text-[#EAB308] hover:bg-[rgba(234,179,8,0.1)]"
          >
            <RefreshCw className="size-4 mr-2" />
            รีเฟรช
          </Button>

          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-[#EAB308] to-[#B8860B] text-[#0F172A] hover:opacity-90">
                <Plus className="size-4 mr-2" />
                เพิ่มวงเงิน
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#1E293B] border-[rgba(234,179,8,0.3)]">
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  <Shield className="size-5 text-[#EAB308]" />
                  เพิ่มวงเงินรับแทง
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-[#94A3B8]">เลข</Label>
                  <Input
                    placeholder="เช่น 123, 45, * (ทุกเลข)"
                    value={formNumber}
                    onChange={(e) => setFormNumber(e.target.value)}
                    className="bg-[#0F172A] border-[rgba(234,179,8,0.2)] text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[#94A3B8]">ประเภท</Label>
                  <Select value={formBetType} onValueChange={setFormBetType}>
                    <SelectTrigger className="bg-[#0F172A] border-[rgba(234,179,8,0.2)] text-white">
                      <SelectValue placeholder="เลือกประเภท" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1E293B] border-[rgba(234,179,8,0.2)]">
                      {BET_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value} className="text-white hover:bg-[rgba(234,179,8,0.1)]">
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[#94A3B8]">วงเงินสูงสุด (บาท)</Label>
                  <Input
                    type="number"
                    placeholder="100000"
                    value={formMaxAmount}
                    onChange={(e) => setFormMaxAmount(e.target.value)}
                    className="bg-[#0F172A] border-[rgba(234,179,8,0.2)] text-white"
                  />
                </div>

                <div className="flex items-center gap-2 p-3 rounded-lg bg-[rgba(234,179,8,0.1)] border border-[rgba(234,179,8,0.2)]">
                  <Globe className="size-4 text-[#EAB308]" />
                  <span className="text-sm text-[#94A3B8]">Broadcast ไปยังเครือข่าย</span>
                  <Switch
                    checked={broadcastToNetwork}
                    onCheckedChange={setBroadcastToNetwork}
                    className="ml-auto data-[state=checked]:bg-[#EAB308]"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowAddDialog(false)}
                  className="border-[#94A3B8] text-[#94A3B8]"
                >
                  ยกเลิก
                </Button>
                <Button
                  onClick={handleSaveLimit}
                  disabled={saving}
                  className="bg-gradient-to-r from-[#EAB308] to-[#B8860B] text-[#0F172A]"
                >
                  {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Check className="size-4 mr-2" />}
                  บันทึก
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Global Default Card */}
      <Card className="gold-stats-card mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B]">
                <Settings className="size-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-[#94A3B8]">วงเงินเริ่มต้น (Default)</p>
                <p className="text-2xl font-bold text-[#EAB308]">
                  {globalDefault.toLocaleString()} บาท
                </p>
                <p className="text-xs text-[#64748B]">ใช้กับเลขที่ไม่ได้กำหนดวงเงินเฉพาะ</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {[50000, 100000, 200000, 500000].map(amount => (
                <Button
                  key={amount}
                  size="sm"
                  variant={globalDefault === amount ? 'default' : 'outline'}
                  onClick={() => handleUpdateGlobalDefault(amount)}
                  className={globalDefault === amount 
                    ? 'bg-[#EAB308] text-[#0F172A]' 
                    : 'border-[rgba(234,179,8,0.3)] text-[#94A3B8] hover:bg-[rgba(234,179,8,0.1)]'
                  }
                >
                  {(amount / 1000)}K
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter */}
      <div className="flex items-center gap-4 mb-4">
        <span className="text-[#94A3B8]">กรอง:</span>
        <Select value={filterBetType} onValueChange={setFilterBetType}>
          <SelectTrigger className="w-48 bg-[#1E293B] border-[rgba(234,179,8,0.2)] text-white">
            <SelectValue placeholder="ทั้งหมด" />
          </SelectTrigger>
          <SelectContent className="bg-[#1E293B] border-[rgba(234,179,8,0.2)]">
            <SelectItem value="all" className="text-white">ทั้งหมด</SelectItem>
            {BET_TYPES.map(type => (
              <SelectItem key={type.value} value={type.value} className="text-white">
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Limits Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="size-8 animate-spin text-[#EAB308]" />
        </div>
      ) : filteredLimits.length === 0 ? (
        <Card className="gold-stats-card">
          <CardContent className="p-12 text-center">
            <Shield className="size-12 mx-auto text-[#64748B] mb-4" />
            <p className="text-[#94A3B8]">ยังไม่มีวงเงินเฉพาะ</p>
            <p className="text-sm text-[#64748B]">ระบบจะใช้วงเงินเริ่มต้น {globalDefault.toLocaleString()} บาท</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredLimits.map(limit => (
            <Card 
              key={limit.id} 
              className={`gold-stats-card hover-lift ${!limit.is_active ? 'opacity-50' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl font-bold font-mono text-[#EAB308]">
                        {limit.number === '*' ? 'ALL' : limit.number}
                      </span>
                      {limit.number === '*' && (
                        <Badge className="bg-[rgba(234,179,8,0.2)] text-[#EAB308] text-xs">
                          Default
                        </Badge>
                      )}
                    </div>
                    <Badge className="bg-[#1E293B] text-[#94A3B8]">
                      {BET_TYPES.find(t => t.value === limit.bet_type)?.label || limit.bet_type}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteLimit(limit)}
                      className="text-[#EF4444] hover:bg-[rgba(239,68,68,0.1)]"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                <Separator className="bg-[rgba(234,179,8,0.1)] my-3" />

                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#64748B]">วงเงินสูงสุด</span>
                  <span className="text-lg font-bold text-white">
                    {limit.max_amount.toLocaleString()} <span className="text-sm text-[#94A3B8]">บาท</span>
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
