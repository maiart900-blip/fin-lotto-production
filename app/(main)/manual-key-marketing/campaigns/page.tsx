'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Megaphone, Plus, Search, RefreshCw, ArrowLeft, Eye, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function ManualKeyMarketingCampaignsPage() {
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: '', description: '', budget: '' });
  const { data, mutate, isLoading } = useSWR('/api/marketing/campaigns?type=manual', fetcher);
  const campaigns = data?.campaigns || [];
  
  const filteredCampaigns = campaigns.filter((c: any) => c.name?.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = () => {
    toast.success('สร้างแคมเปญสำเร็จ');
    setShowDialog(false);
    setNewCampaign({ name: '', description: '', budget: '' });
    mutate();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/manual-key-marketing"><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Megaphone className="size-6 text-[#D4AF37]" />แคมเปญคีย์หวย</h1>
            <p className="text-slate-400 mt-1">สร้างและจัดการแคมเปญการตลาด</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}><RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />รีเฟรช</Button>
          <Button onClick={() => setShowDialog(true)} className="bg-[#D4AF37] text-black hover:bg-[#B4941F]"><Plus className="size-4 mr-2" />สร้างแคมเปญ</Button>
        </div>
      </div>

      <Card className="bg-black/40 border-[#D4AF37]/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white">แคมเปญทั้งหมด ({campaigns.length})</CardTitle>
          <div className="relative w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" /><Input placeholder="ค้นหาแคมเปญ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-slate-800 border-slate-700" /></div>
        </CardHeader>
        <CardContent>
          {filteredCampaigns.length === 0 ? (
            <div className="text-center py-12 text-slate-500"><Megaphone className="size-12 mx-auto mb-4 opacity-50" /><p>ยังไม่มีแคมเปญ</p><p className="text-sm mt-1">กดปุ่ม "สร้างแคมเปญ" เพื่อเริ่มต้น</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCampaigns.map((c: any) => (
                <Card key={c.id} className="bg-slate-800/50 border-slate-700">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-white">{c.name}</h3>
                      <Badge variant={c.is_active ? 'default' : 'secondary'}>{c.is_active ? 'ใช้งาน' : 'หยุด'}</Badge>
                    </div>
                    <p className="text-sm text-slate-400 mb-4">{c.description || 'ไม่มีคำอธิบาย'}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline"><Eye className="size-4" /></Button>
                      <Button size="sm" variant="outline"><Edit className="size-4" /></Button>
                      <Button size="sm" variant="destructive"><Trash2 className="size-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader><DialogTitle className="text-white">สร้างแคมเปญใหม่</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label className="text-slate-300">ชื่อแคมเปญ</Label><Input value={newCampaign.name} onChange={(e) => setNewCampaign({...newCampaign, name: e.target.value})} placeholder="เช่น โปรโมชั่นลูกค้าใหม่" className="mt-2 bg-slate-800 border-slate-700" /></div>
            <div><Label className="text-slate-300">คำอธิบาย</Label><Textarea value={newCampaign.description} onChange={(e) => setNewCampaign({...newCampaign, description: e.target.value})} placeholder="รายละเอียดแคมเปญ" className="mt-2 bg-slate-800 border-slate-700" /></div>
            <div><Label className="text-slate-300">งบประมาณ (บาท)</Label><Input type="number" value={newCampaign.budget} onChange={(e) => setNewCampaign({...newCampaign, budget: e.target.value})} placeholder="0" className="mt-2 bg-slate-800 border-slate-700" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowDialog(false)}>ยกเลิก</Button><Button onClick={handleCreate} className="bg-[#D4AF37] text-black hover:bg-[#B4941F]">สร้างแคมเปญ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
