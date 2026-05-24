'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  Palette, 
  Save, 
  RotateCcw,
  Loader2,
  Check,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const THEME_PRESETS = [
  { 
    key: 'dark_blue', 
    name: 'น้ำเงินเข้ม', 
    colors: {
      primary_color: '#1D9BF0',
      secondary_color: '#10B981',
      accent_color: '#FFD700',
      background_color: '#060B14',
      card_color: '#0a1628',
      text_color: '#FFFFFF',
    }
  },
  { 
    key: 'dark_gold', 
    name: 'ดำทอง', 
    colors: {
      primary_color: '#FFD700',
      secondary_color: '#FFA500',
      accent_color: '#1D9BF0',
      background_color: '#0a0a0a',
      card_color: '#1a1a1a',
      text_color: '#FFFFFF',
    }
  },
  { 
    key: 'red_gold', 
    name: 'แดงทอง', 
    colors: {
      primary_color: '#DC2626',
      secondary_color: '#FFD700',
      accent_color: '#F59E0B',
      background_color: '#0f0505',
      card_color: '#1a0a0a',
      text_color: '#FFFFFF',
    }
  },
  { 
    key: 'green_premium', 
    name: 'เขียวพรีเมียม', 
    colors: {
      primary_color: '#10B981',
      secondary_color: '#06B6D4',
      accent_color: '#FFD700',
      background_color: '#051209',
      card_color: '#0a1f14',
      text_color: '#FFFFFF',
    }
  },
];

interface ThemeSetting {
  id: string;
  key: string;
  value: string;
  default_value: string;
  category: string;
  description: string;
}

export default function WebThemePage() {
  const { data, error, mutate } = useSWR<{ settings: ThemeSetting[]; theme: Record<string, string> }>('/api/web-theme', fetcher);
  const [localTheme, setLocalTheme] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const theme = { ...data?.theme, ...localTheme };

  const updateValue = (key: string, value: string) => {
    setLocalTheme(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const applyPreset = (preset: typeof THEME_PRESETS[0]) => {
    setLocalTheme(preset.colors);
    updateValue('theme_preset', preset.key);
    setHasChanges(true);
    toast.success(`ใช้ธีม "${preset.name}"`);
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    
    setSaving(true);
    try {
      const settings = Object.entries(localTheme).map(([key, value]) => ({ key, value }));
      
      const response = await fetch('/api/web-theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      
      if (!response.ok) throw new Error('Failed to save');
      
      toast.success('บันทึกธีมสำเร็จ');
      mutate();
      setLocalTheme({});
      setHasChanges(false);
    } catch {
      toast.error('ไม่สามารถบันทึกได้');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setLocalTheme({});
    setHasChanges(false);
    toast.info('ยกเลิกการเปลี่ยนแปลง');
  };

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center text-destructive">
            เกิดข้อผิดพลาดในการโหลดข้อมูล
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Palette className="size-6" />
            ตั้งค่าธีมเว็บ
          </h1>
          <p className="text-muted-foreground">ปรับแต่งสีและสไตล์ของเว็บไซต์</p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="size-4 mr-2" />
              ยกเลิก
            </Button>
          )}
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
            บันทึก
          </Button>
        </div>
      </div>

      {/* Theme Presets */}
      <Card>
        <CardHeader>
          <CardTitle>เลือกธีมสำเร็จรูป</CardTitle>
          <CardDescription>คลิกเพื่อใช้ธีมที่ต้องการ</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {THEME_PRESETS.map(preset => (
              <button
                key={preset.key}
                onClick={() => applyPreset(preset)}
                className={`relative p-4 rounded-lg border-2 transition-all hover:scale-105 ${
                  theme.theme_preset === preset.key 
                    ? 'border-primary ring-2 ring-primary/20' 
                    : 'border-border hover:border-primary/50'
                }`}
                style={{ backgroundColor: preset.colors.background_color }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div 
                    className="size-4 rounded-full" 
                    style={{ backgroundColor: preset.colors.primary_color }}
                  />
                  <div 
                    className="size-4 rounded-full" 
                    style={{ backgroundColor: preset.colors.secondary_color }}
                  />
                  <div 
                    className="size-4 rounded-full" 
                    style={{ backgroundColor: preset.colors.accent_color }}
                  />
                </div>
                <p className="text-sm font-medium" style={{ color: preset.colors.text_color }}>
                  {preset.name}
                </p>
                {theme.theme_preset === preset.key && (
                  <div className="absolute top-2 right-2">
                    <Check className="size-4 text-primary" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Color Settings */}
      <Card>
        <CardHeader>
          <CardTitle>ปรับแต่งสี</CardTitle>
          <CardDescription>คลิกที่ช่องสีเพื่อเลือกสีที่ต้องการ</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>สีหลัก (Primary)</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={theme.primary_color || '#1D9BF0'}
                  onChange={(e) => updateValue('primary_color', e.target.value)}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={theme.primary_color || '#1D9BF0'}
                  onChange={(e) => updateValue('primary_color', e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>สีรอง (Secondary)</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={theme.secondary_color || '#10B981'}
                  onChange={(e) => updateValue('secondary_color', e.target.value)}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={theme.secondary_color || '#10B981'}
                  onChange={(e) => updateValue('secondary_color', e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>สี Accent</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={theme.accent_color || '#FFD700'}
                  onChange={(e) => updateValue('accent_color', e.target.value)}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={theme.accent_color || '#FFD700'}
                  onChange={(e) => updateValue('accent_color', e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>สีพื้นหลัง</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={theme.background_color || '#060B14'}
                  onChange={(e) => updateValue('background_color', e.target.value)}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={theme.background_color || '#060B14'}
                  onChange={(e) => updateValue('background_color', e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>สีการ์ด</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={theme.card_color || '#0a1628'}
                  onChange={(e) => updateValue('card_color', e.target.value)}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={theme.card_color || '#0a1628'}
                  onChange={(e) => updateValue('card_color', e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>สีตัวอักษร</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={theme.text_color || '#FFFFFF'}
                  onChange={(e) => updateValue('text_color', e.target.value)}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={theme.text_color || '#FFFFFF'}
                  onChange={(e) => updateValue('text_color', e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Style Settings */}
      <Card>
        <CardHeader>
          <CardTitle>การตั้งค่าสไตล์</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>ความโค้งมุม (Border Radius)</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="range"
                  min="0"
                  max="24"
                  value={theme.border_radius || '12'}
                  onChange={(e) => updateValue('border_radius', e.target.value)}
                  className="flex-1"
                />
                <span className="w-12 text-center font-mono">{theme.border_radius || '12'}px</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>เปิด Glow Effect</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={theme.glow_enabled === 'true'}
                  onCheckedChange={(checked) => updateValue('glow_enabled', checked ? 'true' : 'false')}
                />
                <span className="text-sm text-muted-foreground">
                  {theme.glow_enabled === 'true' ? 'เปิด' : 'ปิด'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>ตัวอย่าง</CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            className="p-6 rounded-lg"
            style={{ 
              backgroundColor: theme.background_color,
              borderRadius: `${theme.border_radius}px`,
            }}
          >
            <div 
              className="p-4 rounded-lg mb-4"
              style={{ 
                backgroundColor: theme.card_color,
                borderRadius: `${theme.border_radius}px`,
                boxShadow: theme.glow_enabled === 'true' 
                  ? `0 0 20px ${theme.primary_color}30` 
                  : 'none',
              }}
            >
              <h3 
                className="font-bold mb-2"
                style={{ color: theme.text_color }}
              >
                ตัวอย่างการ์ด
              </h3>
              <p 
                className="text-sm opacity-70"
                style={{ color: theme.text_color }}
              >
                นี่คือตัวอย่างข้อความในการ์ด
              </p>
              <div className="flex gap-2 mt-3">
                <button 
                  className="px-4 py-2 rounded text-white text-sm"
                  style={{ 
                    backgroundColor: theme.primary_color,
                    borderRadius: `${Number(theme.border_radius) / 2}px`,
                  }}
                >
                  ปุ่มหลัก
                </button>
                <button 
                  className="px-4 py-2 rounded text-white text-sm"
                  style={{ 
                    backgroundColor: theme.secondary_color,
                    borderRadius: `${Number(theme.border_radius) / 2}px`,
                  }}
                >
                  ปุ่มรอง
                </button>
                <button 
                  className="px-4 py-2 rounded text-black text-sm"
                  style={{ 
                    backgroundColor: theme.accent_color,
                    borderRadius: `${Number(theme.border_radius) / 2}px`,
                  }}
                >
                  Accent
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
