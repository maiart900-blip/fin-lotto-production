'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { 
  Globe, Plus, Search, Settings, Key, 
  MoreHorizontal, ExternalLink, Power, PowerOff,
  Copy, Check, Building2, Users, Wallet, TrendingUp,
  Upload, Trash2, Edit3, Eye, Loader2, AlertTriangle, RefreshCw
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function SiteManagerPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Fetch real sites from API
  const { data, error, isLoading, mutate } = useSWR('/api/sites', fetcher, {
    refreshInterval: 30000,
  });
  
  const sites = data?.sites || [];
  
  // New site form
  const [newSite, setNewSite] = useState({
    name: '',
    domain: '',
    primaryColor: '#F59E0B',
    commission: 20,
    useGlobalRates: true,
    useGlobalLimits: true,
  });

  const filteredSites = sites.filter((site: any) => {
    const matchesSearch = site.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          site.domain?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || site.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalStats = sites.reduce((acc: any, site: any) => ({
    members: acc.members + (site.stats?.members || 0),
    todayVolume: acc.todayVolume + (site.stats?.todayVolume || 0),
    monthlyVolume: acc.monthlyVolume + (site.stats?.monthlyVolume || 0),
    balance: acc.balance + (site.stats?.balance || 0),
  }), { members: 0, todayVolume: 0, monthlyVolume: 0, balance: 0 });

  const copyApiKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateSite = async () => {
    if (!newSite.name || !newSite.domain) {
      return;
    }
    
    setIsCreating(true);
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSite),
      });
      
      const result = await res.json();
      
      if (result.success) {
        setIsCreateDialogOpen(false);
        setNewSite({
          name: '',
          domain: '',
          primaryColor: '#F59E0B',
          commission: 20,
          useGlobalRates: true,
          useGlobalLimits: true,
        });
        mutate(); // Refresh sites list
      } else {
        alert(result.error || 'เกิดข้อผิดพลาด');
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการสร้างเว็บลูก');
    } finally {
      setIsCreating(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="size-12 animate-spin text-amber-400 mx-auto mb-4" />
          <p className="text-amber-400">กำลังโหลดข้อมูลเว็บลูก...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="size-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
          <Button onClick={() => mutate()} className="bg-amber-500 text-black">
            <RefreshCw className="size-4 mr-2" />
            ลองใหม่
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#030712] via-[#0a0f1a] to-[#030712] p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 
            className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300"
            style={{ textShadow: '0 0 30px rgba(255,215,0,0.3)' }}
          >
            Site Manager
          </h1>
          <p className="text-slate-400 mt-1">จัดการเว็บลูก (White Label) ทั้งหมดในระบบ</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold shadow-lg shadow-amber-500/25">
              <Plus className="size-4 mr-2" />
              สร้างเว็บลูกใหม่
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#0a0f1a] border-amber-500/30 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-amber-400 flex items-center gap-2">
                <Globe className="size-5" />
                สร้างเว็บลูกใหม่
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                กรอกข้อมูลเพื่อสร้างเว็บลูก White Label ใหม่
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="basic" className="mt-4">
              <TabsList className="bg-black/40 border border-amber-500/20">
                <TabsTrigger value="basic" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                  ข้อมูลพื้นฐาน
                </TabsTrigger>
                <TabsTrigger value="branding" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                  Branding
                </TabsTrigger>
                <TabsTrigger value="settings" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                  ตั้งค่า
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">ชื่อเว็บ</Label>
                    <Input 
                      placeholder="เช่น LottoStar"
                      value={newSite.name}
                      onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                      className="bg-black/40 border-amber-500/30 focus:border-amber-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Domain</Label>
                    <Input 
                      placeholder="เช่น lottostar.com"
                      value={newSite.domain}
                      onChange={(e) => setNewSite({ ...newSite, domain: e.target.value })}
                      className="bg-black/40 border-amber-500/30 focus:border-amber-400"
                    />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="branding" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">โลโก้เว็บ</Label>
                  <div className="border-2 border-dashed border-amber-500/30 rounded-xl p-8 text-center hover:border-amber-400/50 transition-colors cursor-pointer">
                    <Upload className="size-8 mx-auto text-amber-500/50 mb-2" />
                    <p className="text-sm text-slate-400">คลิกเพื่ออัปโหลดโลโก้</p>
                    <p className="text-xs text-slate-500">PNG, JPG ขนาดไม่เกิน 2MB</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">สีหลัก (Primary Color)</Label>
                    <div className="flex gap-2">
                      <Input 
                        type="color"
                        value={newSite.primaryColor}
                        onChange={(e) => setNewSite({ ...newSite, primaryColor: e.target.value })}
                        className="w-16 h-10 p-1 bg-black/40 border-amber-500/30"
                      />
                      <Input 
                        value={newSite.primaryColor}
                        onChange={(e) => setNewSite({ ...newSite, primaryColor: e.target.value })}
                        className="bg-black/40 border-amber-500/30 font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">ตัวอย่าง Theme</Label>
                    <div 
                      className="h-10 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: newSite.primaryColor }}
                    >
                      {newSite.name || 'Preview'}
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="settings" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-amber-500/20">
                    <div>
                      <p className="font-medium text-white">ใช้เรทจ่ายกลาง</p>
                      <p className="text-sm text-slate-400">ใช้อัตราจ่ายเดียวกับเว็บแม่</p>
                    </div>
                    <Switch 
                      checked={newSite.useGlobalRates}
                      onCheckedChange={(checked) => setNewSite({ ...newSite, useGlobalRates: checked })}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 rounded-xl bg-black/40 border border-amber-500/20">
                    <div>
                      <p className="font-medium text-white">ใช้เลขอั้นกลาง</p>
                      <p className="text-sm text-slate-400">ใช้รายการเลขอั้นเดียวกับเว็บแม่</p>
                    </div>
                    <Switch 
                      checked={newSite.useGlobalLimits}
                      onCheckedChange={(checked) => setNewSite({ ...newSite, useGlobalLimits: checked })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-slate-300">ค่าคอมมิชชัน (%)</Label>
                    <Input 
                      type="number"
                      min={0}
                      max={50}
                      value={newSite.commission}
                      onChange={(e) => setNewSite({ ...newSite, commission: parseInt(e.target.value) || 0 })}
                      className="bg-black/40 border-amber-500/30"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="border-slate-600">
                ยกเลิก
              </Button>
              <Button 
                onClick={handleCreateSite}
                disabled={isCreating || !newSite.name || !newSite.domain}
                className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    กำลังสร้าง...
                  </>
                ) : (
                  <>
                    <Plus className="size-4 mr-2" />
                    สร้างเว็บลูก
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Global Stats - Master View */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-black/60 to-black/40 border-amber-500/30 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center">
                <Globe className="size-6 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">เว็บลูกทั้งหมด</p>
                <p className="text-2xl font-bold text-white">{sites.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-black/60 to-black/40 border-blue-500/30 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center">
                <Users className="size-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">สมาชิกรวม</p>
                <p className="text-2xl font-bold text-white">{totalStats.members.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-black/60 to-black/40 border-emerald-500/30 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center">
                <TrendingUp className="size-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">ยอดวันนี้</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {totalStats.todayVolume > 0 ? (totalStats.todayVolume / 1000000).toFixed(1) + 'M' : '0'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-black/60 to-black/40 border-purple-500/30 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center">
                <Wallet className="size-6 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Central Wallet</p>
                <p className="text-2xl font-bold text-purple-400">
                  {totalStats.balance > 0 ? (totalStats.balance / 1000000).toFixed(1) + 'M' : '0'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input 
            placeholder="ค้นหาเว็บลูก..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-black/40 border-amber-500/30 focus:border-amber-400"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-black/40 border-amber-500/30">
            <SelectValue placeholder="สถานะ" />
          </SelectTrigger>
          <SelectContent className="bg-[#0a0f1a] border-amber-500/30">
            <SelectItem value="all">ทั้งหมด</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => mutate()} className="border-amber-500/30 text-amber-400">
          <RefreshCw className="size-4 mr-2" />
          รีเฟรช
        </Button>
      </div>

      {/* Site List or Empty State */}
      {filteredSites.length > 0 ? (
        <div className="grid gap-4">
          {filteredSites.map((site: any) => (
            <Card 
              key={site.id}
              className={cn(
                "bg-gradient-to-br from-black/60 to-black/40 backdrop-blur-xl transition-all duration-300 hover:scale-[1.01]",
                site.status === 'active' ? "border-amber-500/30 hover:border-amber-400/50" : "border-red-500/30"
              )}
            >
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                  {/* Site Info */}
                  <div className="flex items-center gap-4 flex-1">
                    <div 
                      className="size-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-lg"
                      style={{ 
                        background: `linear-gradient(135deg, ${site.theme?.primary || '#F59E0B'}, ${site.theme?.secondary || '#D97706'})`,
                        boxShadow: `0 0 20px ${site.theme?.primary || '#F59E0B'}40`
                      }}
                    >
                      {site.name.substring(0, 2).toUpperCase()}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-white">{site.name}</h3>
                        <Badge className={cn(
                          "text-xs",
                          site.status === 'active' 
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                            : "bg-red-500/20 text-red-400 border-red-500/30"
                        )}>
                          {site.status === 'active' ? 'Active' : 'Suspended'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <a 
                          href={`https://${site.domain}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          <Globe className="size-3" />
                          {site.domain}
                          <ExternalLink className="size-3" />
                        </a>
                        <span className="text-sm text-slate-500">|</span>
                        <span className="text-sm text-slate-400">
                          สร้างเมื่อ {new Date(site.created_at).toLocaleDateString('th-TH')}
                        </span>
                      </div>
                      
                      {/* API Key */}
                      {site.api_key && (
                        <div className="flex items-center gap-2 mt-2">
                          <Key className="size-3 text-slate-500" />
                          <code className="text-xs text-slate-500 font-mono">
                            {site.api_key.substring(0, 20)}...
                          </code>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-5 px-1"
                            onClick={() => copyApiKey(site.api_key)}
                          >
                            {copiedKey === site.api_key ? (
                              <Check className="size-3 text-green-400" />
                            ) : (
                              <Copy className="size-3 text-slate-500" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-xs text-slate-400">สมาชิก</p>
                      <p className="text-lg font-bold text-white">{site.stats?.members?.toLocaleString() || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">ยอดวันนี้</p>
                      <p className="text-lg font-bold text-emerald-400">
                        {site.stats?.todayVolume ? (site.stats.todayVolume / 1000000).toFixed(1) + 'M' : '0'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">ยอดเดือนนี้</p>
                      <p className="text-lg font-bold text-blue-400">
                        {site.stats?.monthlyVolume ? (site.stats.monthlyVolume / 1000000).toFixed(1) + 'M' : '0'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Balance</p>
                      <p className="text-lg font-bold text-purple-400">
                        {site.stats?.balance ? (site.stats.balance / 1000000).toFixed(1) + 'M' : '0'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-slate-400 hover:text-amber-400">
                        <MoreHorizontal className="size-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[#0a0f1a] border-amber-500/30">
                      <DropdownMenuItem className="text-slate-300 hover:text-white">
                        <Eye className="size-4 mr-2" />
                        ดูรายละเอียด
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-slate-300 hover:text-white">
                        <Edit3 className="size-4 mr-2" />
                        แก้ไข
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-slate-300 hover:text-white">
                        <Settings className="size-4 mr-2" />
                        ตั้งค่า
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-amber-500/20" />
                      {site.status === 'active' ? (
                        <DropdownMenuItem className="text-orange-400 hover:text-orange-300">
                          <PowerOff className="size-4 mr-2" />
                          ระงับเว็บ
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem className="text-green-400 hover:text-green-300">
                          <Power className="size-4 mr-2" />
                          เปิดใช้งาน
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="text-red-400 hover:text-red-300">
                        <Trash2 className="size-4 mr-2" />
                        ลบเว็บ
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        // Empty State
        <Card className="bg-gradient-to-br from-black/60 to-black/40 border-amber-500/30 backdrop-blur-xl">
          <CardContent className="p-12 text-center">
            <Building2 className="size-16 mx-auto text-amber-500/50 mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">ยังไม่มีเว็บลูกในระบบ</h3>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              เริ่มต้นสร้างเว็บลูก White Label แรกของคุณเพื่อขยายธุรกิจ
            </p>
            <Button 
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold shadow-lg shadow-amber-500/25"
            >
              <Plus className="size-4 mr-2" />
              สร้างเว็บลูกใหม่
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
