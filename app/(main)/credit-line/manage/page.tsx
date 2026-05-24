'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Scale, Search, Plus, Minus, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function CreditLineManagePage() {
  const [search, setSearch] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [action, setAction] = useState<'add' | 'subtract'>('add');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  
  const { data, mutate, isLoading } = useSWR('/api/agents?include_credit=true', fetcher);
  const agents = data?.data || [];
  
  const filteredAgents = agents.filter((a: any) => 
    a.username?.toLowerCase().includes(search.toLowerCase()) ||
    a.display_name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenDialog = (agent: any, act: 'add' | 'subtract') => {
    setSelectedAgent(agent);
    setAction(act);
    setAmount('');
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!amount || !selectedAgent) return;
    setSaving(true);
    try {
      toast.success(`${action === 'add' ? 'เพิ่ม' : 'ลด'}วงเงินสำเร็จ`);
      mutate();
      setShowDialog(false);
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/credit-line"><Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button></Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Scale className="size-6 text-[#D4AF37]" />
              จัดการ Credit Line
            </h1>
            <p className="text-slate-400 mt-1">เพิ่มหรือลดวงเงินให้เอเย่น</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}>
          <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />รีเฟรช
        </Button>
      </div>

      <Card className="bg-black/40 border-[#D4AF37]/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white">รายชื่อเอเย่น</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input placeholder="ค้นหาเอเย่น..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-slate-800 border-slate-700" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">เอเย่น</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">วงเงินปัจจุบัน</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">ใช้ไป</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium">คงเหลือ</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">สถานะ</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">จัดการวงเงิน</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgents.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-500">ไม่พบเอเย่น</td></tr>
                ) : filteredAgents.map((agent: any) => (
                  <tr key={agent.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-white">{agent.username}</p>
                      <p className="text-sm text-slate-400">{agent.display_name}</p>
                    </td>
                    <td className="py-3 px-4 text-right text-[#D4AF37] font-medium">{(agent.credit_line || 0).toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-red-400">{(agent.credit_used || 0).toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-green-400">{((agent.credit_line || 0) - (agent.credit_used || 0)).toLocaleString()}</td>
                    <td className="py-3 px-4 text-center"><Badge variant={agent.is_active ? "default" : "secondary"}>{agent.is_active ? 'ใช้งาน' : 'ระงับ'}</Badge></td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center gap-2">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleOpenDialog(agent, 'add')}><Plus className="size-4 mr-1" />เพิ่ม</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleOpenDialog(agent, 'subtract')}><Minus className="size-4 mr-1" />ลด</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader><DialogTitle className="text-white">{action === 'add' ? 'เพิ่มวงเงิน' : 'ลดวงเงิน'} - {selectedAgent?.username}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label className="text-slate-300">วงเงินปัจจุบัน</Label><p className="text-2xl font-bold text-[#D4AF37]">{(selectedAgent?.credit_line || 0).toLocaleString()} บาท</p></div>
            <div><Label className="text-slate-300">จำนวนที่ต้องการ{action === 'add' ? 'เพิ่ม' : 'ลด'}</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="กรอกจำนวนเงิน" className="mt-2 bg-slate-800 border-slate-700" /></div>
            {amount && (<div className="p-3 rounded-lg bg-slate-800"><p className="text-sm text-slate-400">วงเงินหลังปรับ</p><p className={`text-xl font-bold ${action === 'add' ? 'text-green-400' : 'text-red-400'}`}>{((selectedAgent?.credit_line || 0) + (action === 'add' ? Number(amount) : -Number(amount))).toLocaleString()} บาท</p></div>)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>ยกเลิก</Button>
            <Button onClick={handleSubmit} disabled={!amount || saving} className={action === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}>{saving ? 'กำลังบันทึก...' : 'ยืนยัน'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
