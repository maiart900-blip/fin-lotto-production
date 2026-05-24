'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { 
  Palette, Upload, Eye, Save, RotateCcw, Globe,
  Monitor, Smartphone, Sun, Moon, Type, Image,
  Layout, Paintbrush, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Default brand settings
const defaultBranding = {
  logo: '/logos/default.png',
  favicon: '/favicons/default.ico',
  siteName: 'LottoKing',
  tagline: 'แทงหวยออนไลน์อันดับ 1',
  colors: {
    primary: '#F59E0B',
    secondary: '#D97706',
    accent: '#FBBF24',
    background: '#030712',
    surface: '#0a0f1a',
    text: '#FFFFFF',
    textMuted: '#94A3B8',
  },
  fonts: {
    heading: 'Kanit',
    body: 'Sarabun',
  },
  layout: {
    sidebarPosition: 'left',
    headerStyle: 'fixed',
    cardStyle: 'glassmorphism',
  },
  features: {
    darkMode: true,
    animations: true,
    soundEffects: false,
  }
};

export default function BrandingPage() {
  // ดึงข้อมูล sites จาก API
  const { data: sitesData, isLoading } = useSWR('/api/sites', fetcher);
  
  // Map sites from API - ถ้าไม่มีข้อมูลจะเป็น empty array
  const sites = (sitesData?.sites || sitesData || []).map((s: any) => ({
    id: s.id,
    name: s.name || s.site_name || 'Unknown',
    domain: s.domain || '-',
  }));

  const [selectedSite, setSelectedSite] = useState<{ id: string; name: string; domain: string } | null>(null);
  const [branding, setBranding] = useState(defaultBranding);
  const [hasChanges, setHasChanges] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Set default selected site when data loads
  useEffect(() => {
    if (sites.length > 0 && !selectedSite) {
      setSelectedSite(sites[0]);
    }
  }, [sites, selectedSite]);

  const updateColor = (key: keyof typeof defaultBranding.colors, value: string) => {
    setBranding(prev => ({
      ...prev,
      colors: { ...prev.colors, [key]: value }
    }));
    setHasChanges(true);
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
            <Palette className="size-8 text-amber-400" />
            Brand Settings
          </h1>
          <p className="text-slate-400 mt-1">ตั้งค่า Branding สำหรับเว็บลูก (White Label)</p>
        </div>
        
        <div className="flex gap-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="size-4 animate-spin" />
              กำลังโหลด...
            </div>
          ) : sites.length === 0 ? (
            <div className="text-slate-400">ไม่พบข้อมูลเว็บลูก</div>
          ) : (
            <Select 
              value={selectedSite?.id || ''} 
              onValueChange={(id) => setSelectedSite(sites.find((s: any) => s.id === id) || sites[0])}
            >
              <SelectTrigger className="w-[200px] bg-black/40 border-amber-500/30">
                <Globe className="size-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0a0f1a] border-amber-500/30">
                {sites.map((site: any) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <Button variant="outline" className="border-slate-600" onClick={() => setBranding(defaultBranding)}>
            <RotateCcw className="size-4 mr-2" />
            รีเซ็ต
          </Button>
          <Button 
            className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold"
            disabled={!hasChanges}
          >
            <Save className="size-4 mr-2" />
            บันทึก
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Settings Panel */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="identity" className="space-y-6">
            <TabsList className="bg-black/40 border border-amber-500/20 p-1">
              <TabsTrigger value="identity" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                <Image className="size-4 mr-2" />
                Identity
              </TabsTrigger>
              <TabsTrigger value="colors" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                <Paintbrush className="size-4 mr-2" />
                Colors
              </TabsTrigger>
              <TabsTrigger value="typography" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                <Type className="size-4 mr-2" />
                Typography
              </TabsTrigger>
              <TabsTrigger value="layout" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                <Layout className="size-4 mr-2" />
                Layout
              </TabsTrigger>
            </TabsList>

            {/* Identity Tab */}
            <TabsContent value="identity">
              <Card className="bg-gradient-to-br from-black/60 to-black/40 border-amber-500/30 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-amber-400">Brand Identity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Logo Upload */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-slate-300">โลโก้หลัก</Label>
                      <div className="border-2 border-dashed border-amber-500/30 rounded-xl p-6 text-center hover:border-amber-400/50 transition-colors cursor-pointer">
                        <div className="size-24 mx-auto rounded-xl bg-black/40 flex items-center justify-center mb-3">
                          <Upload className="size-8 text-amber-500/50" />
                        </div>
                        <p className="text-sm text-slate-400">คลิกเพื่ออัปโหลด</p>
                        <p className="text-xs text-slate-500">PNG, SVG (400x100px)</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <Label className="text-slate-300">Favicon</Label>
                      <div className="border-2 border-dashed border-amber-500/30 rounded-xl p-6 text-center hover:border-amber-400/50 transition-colors cursor-pointer">
                        <div className="size-16 mx-auto rounded-lg bg-black/40 flex items-center justify-center mb-3">
                          <Upload className="size-6 text-amber-500/50" />
                        </div>
                        <p className="text-sm text-slate-400">คลิกเพื่ออัปโหลด</p>
                        <p className="text-xs text-slate-500">ICO, PNG (32x32px)</p>
                      </div>
                    </div>
                  </div>

                  {/* Site Name & Tagline */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">ชื่อเว็บ</Label>
                      <Input 
                        value={branding.siteName}
                        onChange={(e) => {
                          setBranding({ ...branding, siteName: e.target.value });
                          setHasChanges(true);
                        }}
                        className="bg-black/40 border-amber-500/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Tagline</Label>
                      <Input 
                        value={branding.tagline}
                        onChange={(e) => {
                          setBranding({ ...branding, tagline: e.target.value });
                          setHasChanges(true);
                        }}
                        className="bg-black/40 border-amber-500/30"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Colors Tab */}
            <TabsContent value="colors">
              <Card className="bg-gradient-to-br from-black/60 to-black/40 border-amber-500/30 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-amber-400">Color Palette</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(branding.colors).map(([key, value]) => (
                      <div key={key} className="space-y-2">
                        <Label className="text-slate-300 capitalize">{key}</Label>
                        <div className="flex gap-2">
                          <div 
                            className="size-10 rounded-lg border border-white/20 cursor-pointer"
                            style={{ backgroundColor: value }}
                          />
                          <Input 
                            type="text"
                            value={value}
                            onChange={(e) => updateColor(key as keyof typeof defaultBranding.colors, e.target.value)}
                            className="bg-black/40 border-amber-500/30 font-mono text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Preset Themes */}
                  <div className="space-y-3">
                    <Label className="text-slate-300">Preset Themes</Label>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { name: 'Gold', primary: '#F59E0B', secondary: '#D97706' },
                        { name: 'Blue', primary: '#3B82F6', secondary: '#1E40AF' },
                        { name: 'Green', primary: '#10B981', secondary: '#059669' },
                        { name: 'Purple', primary: '#8B5CF6', secondary: '#7C3AED' },
                      ].map((theme) => (
                        <button
                          key={theme.name}
                          onClick={() => {
                            setBranding({
                              ...branding,
                              colors: {
                                ...branding.colors,
                                primary: theme.primary,
                                secondary: theme.secondary,
                              }
                            });
                            setHasChanges(true);
                          }}
                          className={cn(
                            "p-3 rounded-xl border transition-all",
                            branding.colors.primary === theme.primary
                              ? "border-amber-400 bg-amber-500/10"
                              : "border-white/10 hover:border-white/30"
                          )}
                        >
                          <div className="flex gap-1 mb-2">
                            <div className="size-6 rounded" style={{ backgroundColor: theme.primary }} />
                            <div className="size-6 rounded" style={{ backgroundColor: theme.secondary }} />
                          </div>
                          <p className="text-xs text-slate-400">{theme.name}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Typography Tab */}
            <TabsContent value="typography">
              <Card className="bg-gradient-to-br from-black/60 to-black/40 border-amber-500/30 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-amber-400">Typography</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Heading Font</Label>
                      <Select value={branding.fonts.heading} onValueChange={(v) => setBranding({ ...branding, fonts: { ...branding.fonts, heading: v } })}>
                        <SelectTrigger className="bg-black/40 border-amber-500/30">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0a0f1a] border-amber-500/30">
                          <SelectItem value="Kanit">Kanit</SelectItem>
                          <SelectItem value="Prompt">Prompt</SelectItem>
                          <SelectItem value="Sarabun">Sarabun</SelectItem>
                          <SelectItem value="IBM Plex Sans Thai">IBM Plex Sans Thai</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Body Font</Label>
                      <Select value={branding.fonts.body} onValueChange={(v) => setBranding({ ...branding, fonts: { ...branding.fonts, body: v } })}>
                        <SelectTrigger className="bg-black/40 border-amber-500/30">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0a0f1a] border-amber-500/30">
                          <SelectItem value="Sarabun">Sarabun</SelectItem>
                          <SelectItem value="Prompt">Prompt</SelectItem>
                          <SelectItem value="Kanit">Kanit</SelectItem>
                          <SelectItem value="IBM Plex Sans Thai">IBM Plex Sans Thai</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Font Preview */}
                  <div className="p-4 rounded-xl bg-black/40 border border-white/10">
                    <p className="text-2xl font-bold mb-2" style={{ fontFamily: branding.fonts.heading }}>
                      หัวข้อตัวอย่าง - Heading Preview
                    </p>
                    <p className="text-slate-300" style={{ fontFamily: branding.fonts.body }}>
                      ข้อความตัวอย่าง - This is a body text preview. แทงหวยออนไลน์อันดับ 1 ของประเทศไทย
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Layout Tab */}
            <TabsContent value="layout">
              <Card className="bg-gradient-to-br from-black/60 to-black/40 border-amber-500/30 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-amber-400">Layout & Features</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Sidebar Position</Label>
                      <Select value={branding.layout.sidebarPosition}>
                        <SelectTrigger className="bg-black/40 border-amber-500/30">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0a0f1a] border-amber-500/30">
                          <SelectItem value="left">ซ้าย (Left)</SelectItem>
                          <SelectItem value="right">ขวา (Right)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Card Style</Label>
                      <Select value={branding.layout.cardStyle}>
                        <SelectTrigger className="bg-black/40 border-amber-500/30">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0a0f1a] border-amber-500/30">
                          <SelectItem value="glassmorphism">Glassmorphism</SelectItem>
                          <SelectItem value="solid">Solid</SelectItem>
                          <SelectItem value="outline">Outline</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Feature Toggles */}
                  <div className="space-y-4">
                    <Label className="text-slate-300">Features</Label>
                    
                    <div className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-white/10">
                      <div className="flex items-center gap-3">
                        <Moon className="size-5 text-slate-400" />
                        <div>
                          <p className="font-medium text-white">Dark Mode</p>
                          <p className="text-sm text-slate-400">เปิดใช้งานธีมมืด</p>
                        </div>
                      </div>
                      <Switch checked={branding.features.darkMode} />
                    </div>
                    
                    <div className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-white/10">
                      <div className="flex items-center gap-3">
                        <Paintbrush className="size-5 text-slate-400" />
                        <div>
                          <p className="font-medium text-white">Animations</p>
                          <p className="text-sm text-slate-400">เปิดใช้งาน Animation ต่างๆ</p>
                        </div>
                      </div>
                      <Switch checked={branding.features.animations} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview Panel */}
        <div className="space-y-4">
          <Card className="bg-gradient-to-br from-black/60 to-black/40 border-amber-500/30 backdrop-blur-xl sticky top-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-amber-400 flex items-center gap-2">
                <Eye className="size-5" />
                Preview
              </CardTitle>
              <div className="flex gap-1">
                <Button 
                  variant={previewMode === 'desktop' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={() => setPreviewMode('desktop')}
                  className={previewMode === 'desktop' ? 'bg-amber-500/20 text-amber-400' : ''}
                >
                  <Monitor className="size-4" />
                </Button>
                <Button 
                  variant={previewMode === 'mobile' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={() => setPreviewMode('mobile')}
                  className={previewMode === 'mobile' ? 'bg-amber-500/20 text-amber-400' : ''}
                >
                  <Smartphone className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Mock Preview */}
              <div 
                className={cn(
                  "rounded-xl overflow-hidden border border-white/10 transition-all",
                  previewMode === 'mobile' ? "w-[280px] mx-auto" : "w-full"
                )}
                style={{ backgroundColor: branding.colors.background }}
              >
                {/* Header Preview */}
                <div 
                  className="p-4 flex items-center justify-between"
                  style={{ backgroundColor: branding.colors.surface }}
                >
                  <div className="flex items-center gap-2">
                    <div 
                      className="size-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: branding.colors.primary }}
                    >
                      {branding.siteName.substring(0, 2)}
                    </div>
                    <span 
                      className="font-bold text-sm"
                      style={{ color: branding.colors.text, fontFamily: branding.fonts.heading }}
                    >
                      {branding.siteName}
                    </span>
                  </div>
                  <div 
                    className="text-xs px-2 py-1 rounded"
                    style={{ backgroundColor: branding.colors.primary, color: '#000' }}
                  >
                    ฿1,250.00
                  </div>
                </div>

                {/* Content Preview */}
                <div className="p-4 space-y-3">
                  <p 
                    className="text-xs"
                    style={{ color: branding.colors.textMuted }}
                  >
                    {branding.tagline}
                  </p>
                  
                  <div 
                    className="p-3 rounded-lg"
                    style={{ 
                      backgroundColor: branding.colors.surface,
                      border: `1px solid ${branding.colors.primary}40`
                    }}
                  >
                    <p 
                      className="text-sm font-bold mb-2"
                      style={{ color: branding.colors.text, fontFamily: branding.fonts.heading }}
                    >
                      หวยรัฐบาลไทย
                    </p>
                    <p 
                      className="text-xs"
                      style={{ color: branding.colors.textMuted }}
                    >
                      งวดวันที่ 16 พ.ค. 2567
                    </p>
                  </div>
                  
                  <button 
                    className="w-full py-2 rounded-lg text-sm font-bold"
                    style={{ 
                      backgroundColor: branding.colors.primary,
                      color: '#000'
                    }}
                  >
                    แทงเลย
                  </button>
                </div>
              </div>

              {/* Status */}
              <div className="mt-4 flex items-center gap-2">
                {hasChanges ? (
                  <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                    <AlertCircle className="size-3 mr-1" />
                    มีการเปลี่ยนแปลง
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    <CheckCircle2 className="size-3 mr-1" />
                    บันทึกแล้ว
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
