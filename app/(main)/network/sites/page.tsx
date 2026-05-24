'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Globe, 
  Plus, 
  RefreshCw, 
  Server, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Clock,
  Zap,
  Settings,
  Trash2,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface ChildSite {
  id: string;
  name: string;
  api_url: string;
  api_key: string;
  status: 'active' | 'inactive' | 'maintenance';
  last_sync: string | null;
  sync_status: 'success' | 'error' | null;
  last_error: string | null;
  created_at: string;
}

export default function NetworkSitesPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [newSite, setNewSite] = useState({
    name: '',
    api_url: '',
    api_key: '',
    status: 'active' as const,
  });

  const { data, mutate, isValidating } = useSWR<{
    sites: ChildSite[];
    stats: { total: number; active: number; inactive: number; maintenance: number };
  }>('/api/network/sync', fetcher, {
    refreshInterval: 30000,
  });

  const sites = data?.sites || [];
  const stats = data?.stats || { total: 0, active: 0, inactive: 0, maintenance: 0 };

  const handleAddSite = async () => {
    try {
      const res = await fetch('/api/network/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', site: newSite }),
      });

      if (!res.ok) throw new Error('Failed to add site');

      toast.success('เพิ่มเว็บลูกสำเร็จ');
      setShowAddDialog(false);
      setNewSite({ name: '', api_url: '', api_key: '', status: 'active' });
      mutate();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
  };

  const handleSyncAll = async (type: string) => {
    setSyncing(true);
    try {
      const res = await fetch('/api/network/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data: {} }),
      });

      const result = await res.json();
      
      if (result.success) {
        toast.success(`Sync สำเร็จ ${result.synced}/${stats.active} เว็บ`);
      } else {
        toast.error(result.error || 'Sync ล้มเหลว');
      }
      mutate();
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setSyncing(false);
    }
  };

  const getStatusBadge = (site: ChildSite) => {
    if (site.status === 'inactive') {
      return <Badge variant="secondary"><XCircle className="size-3 mr-1" />Inactive</Badge>;
    }
    if (site.status === 'maintenance') {
      return <Badge className="bg-[#EAB308] text-white"><AlertTriangle className="size-3 mr-1" />ปิดปรับปรุง</Badge>;
    }
    if (site.sync_status === 'error') {
      return <Badge variant="destructive"><AlertTriangle className="size-3 mr-1" />Sync Error</Badge>;
    }
    return <Badge className="bg-[#10B981] text-white"><CheckCircle className="size-3 mr-1" />Active</Badge>;
  };

  return (
    <div className="space-y-6 bg-[#F8FAFC] min-h-screen p-6 -m-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] shadow-lg shadow-[rgba(234,179,8,0.3)]">
              <Globe className="size-6 text-white" />
            </div>
            จัดการเว็บเครือข่าย
          </h1>
          <p className="text-[#64748B] mt-1">เว็บแม่ควบคุมเว็บลูกทั้งหมดในเครือข่าย</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => mutate()}
            disabled={isValidating}
            className="border-[#EAB308] text-[#B8860B] hover:bg-[rgba(234,179,8,0.1)]"
          >
            <RefreshCw className={`size-4 mr-1 ${isValidating ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-[#EAB308] to-[#B8860B] text-white">
                <Plus className="size-4 mr-1" />
                เพิ่มเว็บลูก
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>เพิ่มเว็บลูกใหม่</DialogTitle>
                <DialogDescription>
                  กรอกข้อมูล API ของเว็บลูกที่ต้องการเชื่อมต่อ
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>ชื่อเว็บ</Label>
                  <Input
                    placeholder="เช่น เว็บลูก A"
                    value={newSite.name}
                    onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>API URL</Label>
                  <Input
                    placeholder="https://example.com"
                    value={newSite.api_url}
                    onChange={(e) => setNewSite({ ...newSite, api_url: e.target.value })}
                  />
                </div>
                <div>
                  <Label>API Key</Label>
                  <Input
                    placeholder="api-key-xxx"
                    value={newSite.api_key}
                    onChange={(e) => setNewSite({ ...newSite, api_key: e.target.value })}
                  />
                </div>
                <Button onClick={handleAddSite} className="w-full bg-[#EAB308] text-white">
                  เพิ่มเว็บลูก
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card-gold hover-lift">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#EAB308] to-[#B8860B] shadow-lg">
                <Server className="size-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-[#64748B]">เว็บทั้งหมด</p>
                <p className="text-2xl font-bold text-[#0F172A]">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-gold hover-lift">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-[#10B981] shadow-lg">
                <CheckCircle className="size-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-[#64748B]">Active</p>
                <p className="text-2xl font-bold text-[#10B981]">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-gold hover-lift">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-[#94A3B8] shadow-lg">
                <XCircle className="size-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-[#64748B]">Inactive</p>
                <p className="text-2xl font-bold text-[#64748B]">{stats.inactive}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-gold hover-lift">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-[#EAB308] shadow-lg">
                <AlertTriangle className="size-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-[#64748B]">ปิดปรับปรุง</p>
                <p className="text-2xl font-bold text-[#B8860B]">{stats.maintenance}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Sync Actions */}
      <Card className="midnight-section">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="size-5 text-[#EAB308]" />
            Push ข้อมูลไปเว็บลูกทั้งหมด
          </CardTitle>
          <CardDescription className="text-[#94A3B8]">
            เลือกประเภทข้อมูลที่ต้องการ Sync ไปยังเว็บลูกทั้งหมดแบบ Real-time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <Button
              onClick={() => handleSyncAll('lottery_status')}
              disabled={syncing}
              className="bg-[#EAB308] hover:bg-[#B8860B] text-[#0F172A]"
            >
              <Send className="size-4 mr-2" />
              Sync สถานะหวย
            </Button>
            <Button
              onClick={() => handleSyncAll('payout_rates')}
              disabled={syncing}
              className="bg-[#EAB308] hover:bg-[#B8860B] text-[#0F172A]"
            >
              <Send className="size-4 mr-2" />
              Sync เรทจ่าย
            </Button>
            <Button
              onClick={() => handleSyncAll('blocked_numbers')}
              disabled={syncing}
              className="bg-[#EAB308] hover:bg-[#B8860B] text-[#0F172A]"
            >
              <Send className="size-4 mr-2" />
              Sync เลขอั้น
            </Button>
            <Button
              onClick={() => handleSyncAll('market_close')}
              disabled={syncing}
              variant="destructive"
            >
              <AlertTriangle className="size-4 mr-2" />
              สั่งปิดรับทันที
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sites List */}
      <Card className="glass-card-gold">
        <CardHeader>
          <CardTitle className="text-[#0F172A]">รายชื่อเว็บลูก</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sites.map((site) => (
              <div
                key={site.id}
                className="flex items-center justify-between p-4 rounded-xl bg-white border border-[rgba(234,179,8,0.1)] hover:border-[#EAB308]/30 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-[#EAB308]/10">
                    <Server className="size-5 text-[#B8860B]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#0F172A]">{site.name}</p>
                    <p className="text-sm text-[#64748B]">{site.api_url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(site)}
                  {site.last_sync && (
                    <span className="text-xs text-[#94A3B8] flex items-center gap-1">
                      <Clock className="size-3" />
                      {new Date(site.last_sync).toLocaleString('th-TH')}
                    </span>
                  )}
                  <Button variant="ghost" size="icon">
                    <Settings className="size-4 text-[#64748B]" />
                  </Button>
                </div>
              </div>
            ))}

            {sites.length === 0 && (
              <div className="text-center py-12 text-[#94A3B8]">
                <Globe className="size-12 mx-auto mb-4 opacity-30" />
                <p>ยังไม่มีเว็บลูกในเครือข่าย</p>
                <p className="text-sm">คลิก "เพิ่มเว็บลูก" เพื่อเริ่มต้น</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
