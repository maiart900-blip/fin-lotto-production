'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft,
  User,
  Lock,
  Phone,
  Percent,
  CreditCard,
  Building2,
  Keyboard,
  Zap,
  Users,
  Info,
  Save,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { toast } from 'sonner';

type AgentType = 'agent_key' | 'agent_auto' | 'hybrid';

interface FormData {
  agentType: AgentType;
  name: string;
  username: string;
  password: string;
  confirmPassword: string;
  phone: string;
  level: string;
  sharePercent: number;
  commissionPercent: number;
  creditLimit: number;
  parentAgentId: string;
  isActive: boolean;
  enableManualKey: boolean;
  enableAuto: boolean;
}

const agentTypes = [
  {
    value: 'agent_key' as AgentType,
    label: 'Agent Key',
    description: 'เอเย่นต์คีย์หวย - สำหรับระบบคีย์โพยแบบ manual',
    icon: Keyboard,
    color: 'amber',
  },
  {
    value: 'agent_auto' as AgentType,
    label: 'Agent Auto',
    description: 'เอเย่นต์ออโต้ - สำหรับระบบอัตโนมัติ',
    icon: Zap,
    color: 'emerald',
  },
  {
    value: 'hybrid' as AgentType,
    label: 'Hybrid Agent',
    description: 'เอเย่นต์ผสม - รองรับทั้งระบบคีย์และออโต้',
    icon: Users,
    color: 'purple',
  },
];

const levelOptions = [
  { value: 'master', label: 'Master Agent' },
  { value: 'agent', label: 'Agent' },
  { value: 'sub_agent', label: 'Sub Agent' },
];

export default function AddAgentPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    agentType: 'agent_key',
    name: '',
    username: '',
    password: '',
    confirmPassword: '',
    phone: '',
    level: 'agent',
    sharePercent: 70,
    commissionPercent: 5,
    creditLimit: 100000,
    parentAgentId: '',
    isActive: true,
    enableManualKey: true,
    enableAuto: false,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'กรุณากรอกชื่อเอเย่นต์';
    }

    if (!formData.username.trim()) {
      newErrors.username = 'กรุณากรอก username';
    } else if (formData.username.length < 4) {
      newErrors.username = 'username ต้องมีอย่างน้อย 4 ตัวอักษร';
    }

    if (!formData.password) {
      newErrors.password = 'กรุณากรอกรหัสผ่าน';
    } else if (formData.password.length < 6) {
      newErrors.password = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'รหัสผ่านไม่ตรงกัน';
    }

    // Phone is optional for Agent Key
    if (formData.agentType !== 'agent_key' && formData.phone && !/^0[0-9]{8,9}$/.test(formData.phone)) {
      newErrors.phone = 'เบอร์โทรไม่ถูกต้อง';
    }

    if (formData.sharePercent < 0 || formData.sharePercent > 100) {
      newErrors.sharePercent = 'ส่วนแบ่งต้องอยู่ระหว่าง 0-100%';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAgentTypeChange = (type: AgentType) => {
    setFormData(prev => ({
      ...prev,
      agentType: type,
      enableManualKey: type === 'agent_key' || type === 'hybrid',
      enableAuto: type === 'agent_auto' || type === 'hybrid',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('กรุณาตรวจสอบข้อมูลให้ครบถ้วน');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/agents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          username: formData.username,
          password: formData.password,
          phone: formData.phone || null,
          level: formData.level,
          share_percent: formData.sharePercent,
          commission_rate: formData.commissionPercent,
          credit_limit: formData.creditLimit,
          parent_agent_id: formData.parentAgentId || null,
          status: formData.isActive ? 'active' : 'inactive',
          system_type: formData.agentType === 'agent_key' ? 'manual_key' : 
                       formData.agentType === 'agent_auto' ? 'auto' : 'hybrid',
          enable_manual_key: formData.enableManualKey,
          enable_auto: formData.enableAuto,
          role: 'agent_key',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'ไม่สามารถสร้างเอเย่นต์ได้');
      }

      toast.success('สร้างเอเย่นต์สำเร็จ!');
      router.push('/manual-downline');
    } catch (error) {
      console.error('Create agent error:', error);
      toast.error(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedType = agentTypes.find(t => t.value === formData.agentType);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6">
      {/* Header */}
      <div className="mb-8">
        <Link href="/manual-downline">
          <Button variant="ghost" className="text-slate-400 hover:text-white mb-4">
            <ArrowLeft className="size-4 mr-2" />
            กลับ
          </Button>
        </Link>
        <h1 
          className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
          style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
        >
          เพิ่มเอเย่นต์ใหม่
        </h1>
        <p className="text-slate-400 mt-2">สร้างเอเย่นต์และกำหนดสิทธิ์การใช้งาน</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl space-y-8">
        {/* Agent Type Selection */}
        <div className="p-6 rounded-xl bg-black/40 backdrop-blur-sm border border-amber-500/20">
          <h2 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
            <Building2 className="size-5" />
            ประเภทเอเย่นต์
          </h2>
          
          <RadioGroup 
            value={formData.agentType} 
            onValueChange={(v) => handleAgentTypeChange(v as AgentType)}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {agentTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = formData.agentType === type.value;
              
              return (
                <label
                  key={type.value}
                  className={cn(
                    "relative flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all",
                    isSelected 
                      ? `border-${type.color}-500 bg-${type.color}-500/10` 
                      : "border-slate-700 hover:border-slate-600 bg-black/20"
                  )}
                >
                  <RadioGroupItem value={type.value} className="sr-only" />
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn(
                      "size-10 rounded-full flex items-center justify-center",
                      `bg-${type.color}-500/20 text-${type.color}-400`
                    )}>
                      <Icon className="size-5" />
                    </div>
                    <span className="font-bold text-white">{type.label}</span>
                  </div>
                  <p className="text-sm text-slate-400">{type.description}</p>
                  {isSelected && (
                    <CheckCircle2 className={`absolute top-3 right-3 size-5 text-${type.color}-400`} />
                  )}
                </label>
              );
            })}
          </RadioGroup>
        </div>

        {/* Basic Info */}
        <div className="p-6 rounded-xl bg-black/40 backdrop-blur-sm border border-amber-500/20">
          <h2 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
            <User className="size-5" />
            ข้อมูลเอเย่นต์
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Name */}
            <div className="space-y-2">
              <Label className="text-slate-300">
                ชื่อเอเย่นต์ / ชื่อคีย์ <span className="text-red-400">*</span>
              </Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="ชื่อที่แสดง"
                className={cn(
                  "bg-black/40 border-amber-500/30 text-white",
                  errors.name && "border-red-500"
                )}
              />
              {errors.name && <p className="text-sm text-red-400">{errors.name}</p>}
            </div>

            {/* Username */}
            <div className="space-y-2">
              <Label className="text-slate-300">
                Username <span className="text-red-400">*</span>
              </Label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value.toLowerCase() }))}
                placeholder="ชื่อผู้ใช้สำหรับ login"
                className={cn(
                  "bg-black/40 border-amber-500/30 text-white",
                  errors.username && "border-red-500"
                )}
              />
              {errors.username && <p className="text-sm text-red-400">{errors.username}</p>}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label className="text-slate-300">
                รหัสผ่าน <span className="text-red-400">*</span>
              </Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                className={cn(
                  "bg-black/40 border-amber-500/30 text-white",
                  errors.password && "border-red-500"
                )}
              />
              {errors.password && <p className="text-sm text-red-400">{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label className="text-slate-300">
                ยืนยันรหัสผ่าน <span className="text-red-400">*</span>
              </Label>
              <Input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="กรอกรหัสผ่านอีกครั้ง"
                className={cn(
                  "bg-black/40 border-amber-500/30 text-white",
                  errors.confirmPassword && "border-red-500"
                )}
              />
              {errors.confirmPassword && <p className="text-sm text-red-400">{errors.confirmPassword}</p>}
            </div>

            {/* Phone - Optional for Agent Key */}
            <div className="space-y-2">
              <Label className="text-slate-300 flex items-center gap-2">
                <Phone className="size-4" />
                เบอร์โทรศัพท์
                {formData.agentType === 'agent_key' && (
                  <span className="text-xs text-slate-500">(ไม่บังคับ)</span>
                )}
              </Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="0812345678"
                className={cn(
                  "bg-black/40 border-amber-500/30 text-white",
                  errors.phone && "border-red-500"
                )}
              />
              {errors.phone && <p className="text-sm text-red-400">{errors.phone}</p>}
              {formData.agentType === 'agent_key' && (
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Info className="size-3" />
                  Agent Key ใช้ username/password ในการ login ไม่จำเป็นต้องมีเบอร์โทร
                </p>
              )}
            </div>

            {/* Level */}
            <div className="space-y-2">
              <Label className="text-slate-300">ระดับเอเย่นต์</Label>
              <Select 
                value={formData.level} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, level: v }))}
              >
                <SelectTrigger className="bg-black/40 border-amber-500/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0f1a] border-amber-500/30">
                  {levelOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Financial Settings */}
        <div className="p-6 rounded-xl bg-black/40 backdrop-blur-sm border border-amber-500/20">
          <h2 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
            <CreditCard className="size-5" />
            ตั้งค่าการเงิน
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Share Percent */}
            <div className="space-y-2">
              <Label className="text-slate-300 flex items-center gap-2">
                <Percent className="size-4" />
                ส่วนแบ่ง (%)
              </Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={formData.sharePercent}
                onChange={(e) => setFormData(prev => ({ ...prev, sharePercent: Number(e.target.value) }))}
                className={cn(
                  "bg-black/40 border-amber-500/30 text-white",
                  errors.sharePercent && "border-red-500"
                )}
              />
              {errors.sharePercent && <p className="text-sm text-red-400">{errors.sharePercent}</p>}
            </div>

            {/* Commission */}
            <div className="space-y-2">
              <Label className="text-slate-300">คอมมิชชัน (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={formData.commissionPercent}
                onChange={(e) => setFormData(prev => ({ ...prev, commissionPercent: Number(e.target.value) }))}
                className="bg-black/40 border-amber-500/30 text-white"
              />
            </div>

            {/* Credit Limit */}
            <div className="space-y-2">
              <Label className="text-slate-300">วงเงินเครดิต</Label>
              <Input
                type="number"
                min={0}
                value={formData.creditLimit}
                onChange={(e) => setFormData(prev => ({ ...prev, creditLimit: Number(e.target.value) }))}
                className="bg-black/40 border-amber-500/30 text-white"
              />
            </div>
          </div>
        </div>

        {/* System Access */}
        <div className="p-6 rounded-xl bg-black/40 backdrop-blur-sm border border-amber-500/20">
          <h2 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
            <Lock className="size-5" />
            สิทธิ์การใช้งานระบบ
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-black/20 border border-slate-700">
              <div className="flex items-center gap-3">
                <Keyboard className="size-5 text-amber-400" />
                <div>
                  <p className="font-medium text-white">ระบบคีย์หวย (Manual Key)</p>
                  <p className="text-sm text-slate-400">คีย์โพย, รายการคีย์, ลูกค้าคีย์หวย</p>
                </div>
              </div>
              <Switch
                checked={formData.enableManualKey}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enableManualKey: checked }))}
                disabled={formData.agentType === 'agent_key'}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-black/20 border border-slate-700">
              <div className="flex items-center gap-3">
                <Zap className="size-5 text-emerald-400" />
                <div>
                  <p className="font-medium text-white">ระบบออโต้ (Auto)</p>
                  <p className="text-sm text-slate-400">ระบบออโต้, ลูกค้าออโต้, รายการออโต้</p>
                </div>
              </div>
              <Switch
                checked={formData.enableAuto}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enableAuto: checked }))}
                disabled={formData.agentType === 'agent_auto'}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-black/20 border border-slate-700">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-blue-400" />
                <div>
                  <p className="font-medium text-white">สถานะเปิดใช้งาน</p>
                  <p className="text-sm text-slate-400">เอเย่นต์สามารถ login และใช้งานระบบได้</p>
                </div>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
            </div>
          </div>

          {/* Info Box */}
          {formData.agentType === 'agent_key' && (
            <div className="mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <div className="flex gap-3">
                <AlertTriangle className="size-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-400 mb-1">Agent Key จะมีสิทธิ์เฉพาะ:</p>
                  <ul className="text-slate-300 space-y-1 list-disc list-inside">
                    <li>ระบบคีย์หวย / คีย์โพย</li>
                    <li>รายการคีย์หวย</li>
                    <li>ลูกค้าคีย์หวย</li>
                  </ul>
                  <p className="text-slate-400 mt-2">
                    ไม่สามารถเข้าถึง: ระบบออโต้, Master Control, Super Admin, ตั้งค่าระบบ
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Link href="/manual-downline">
            <Button type="button" variant="outline" className="border-slate-600 text-slate-400">
              ยกเลิก
            </Button>
          </Link>
          <Button 
            type="submit"
            disabled={isSubmitting}
            className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold hover:from-amber-400 hover:to-amber-500"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                กำลังสร้าง...
              </>
            ) : (
              <>
                <Save className="size-4 mr-2" />
                สร้างเอเย่นต์
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
