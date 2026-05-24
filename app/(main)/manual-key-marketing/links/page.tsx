'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Link2, Plus, Search, RefreshCw, ArrowLeft, Copy, ExternalLink, Trash2 } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function ManualKeyMarketingLinksPage() {
  const [search, setSearch] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [newLink, setNewLink] = useState({ name: '', source: '' });
  const { data, mutate, isLoading } = useSWR('/api/marketing/links?type=manual', fetcher);
  const links = data?.links || [];
  
  const filteredLinks = links.filter((l: any) => l.name?.toLowerCase().includes(search.toLowerCase()) || l.source?.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = () => {
    toast.success('สร้างลิงก์สำเร็จ');
    setShowDialog(false);
    setNewLink({ name: '', source: '' });
    mutate();
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('คัดลอกลิงก์แล้ว');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/manual-key-marketing"><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Link2 className="size-6 text-[#D4AF37]" />ลิงก์สมัครคีย์หวย</h1>
            <p className="text-slate-400 mt-1">สร้างลิงก์ติดตาม source ลูกค้า</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}><RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />รีเฟรช</Button>
          <Button onClick={() => setShowDialog(true)} className="bg-[#D4AF37] text-black hover:bg-[#B4941F]"><Plus className="size-4 mr-2" />สร้างลิงก์</Button>
        </div>
      </div>

      <Card className="bg-black/40 border-[#D4AF37]/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white">ลิงก์ทั้งหมด ({links.length})</CardTitle>
          <div className="relative w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" /><Input placeholder="ค้นหาลิงก์..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-slate-800 border-slate-700" /></div>
        </CardHeader>
        <CardContent>
          {filteredLinks.length === 0 ? (
            <div className="text-center py-12 text-slate-500"><Link2 className="size-12 mx-auto mb-4 opacity-50" /><p>ยังไม่มีลิงก์สมัคร</p><p className="text-sm mt-1">กดปุ่ม "สร้างลิงก์" เพื่อเริ่มต้น</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-700"><th className="text-left py-3 px-4 text-slate-400 font-medium">ชื่อ</th><th className="text-left py-3 px-4 text-slate-400 font-medium">Source</th><th className="text-right py-3 px-4 text-slate-400 font-medium">คลิก</th><th className="text-right py-3 px-4 text-slate-400 font-medium">ลงทะเบียน</th><th className="text-center py-3 px-4 text-slate-400 font-medium">สถานะ</th><th className="text-center py-3 px-4 text-slate-400 font-medium">จัดการ</th></tr></thead>
                <tbody>
                  {filteredLinks.map((l: any) => (
                    <tr key={l.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="py-3 px-4 text-white font-medium">{l.name}</td>
                      <td className="py-3 px-4 text-slate-400">{l.source}</td>
                      <td className="py-3 px-4 text-right text-[#D4AF37]">{l.clicks?.toLocaleString() || 0}</td>
                      <td className="py-3 px-4 text-right text-green-400">{l.registrations || 0}</td>
                      <td className="py-3 px-4 text-center"><Badge variant={l.is_active ? 'default' : 'secondary'}>{l.is_active ? 'ใช้งาน' : 'ปิด'}</Badge></td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex justify-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => copyLink(l.url)}><Copy className="size-4" /></Button>
                          <Button size="sm" variant="ghost"><ExternalLink className="size-4" /></Button>
                          <Button size="sm" variant="ghost" className="text-red-400"><Trash2 className="size-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader><DialogTitle className="text-white">สร้างลิงก์ใหม่</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label className="text-slate-300">ชื่อลิงก์</Label><Input value={newLink.name} onChange={(e) => setNewLink({...newLink, name: e.target.value})} placeholder="เช่น Line OA" className="mt-2 bg-slate-800 border-slate-700" /></div>
            <div><Label className="text-slate-300">Source Code</Label><Input value={newLink.source} onChange={(e) => setNewLink({...newLink, source: e.target.value})} placeholder="เช่น line-oa-01" className="mt-2 bg-slate-800 border-slate-700" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowDialog(false)}>ยกเลิก</Button><Button onClick={handleCreate} className="bg-[#D4AF37] text-black hover:bg-[#B4941F]">สร้างลิงก์</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
