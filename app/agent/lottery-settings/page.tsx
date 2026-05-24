'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Settings, Clock, DollarSign, AlertCircle, Check, X } from 'lucide-react';

// Demo agent ID - ในระบบจริงจะดึงจาก session
const DEMO_AGENT_ID = '7cf23d72-858d-4395-9b94-67e7a7ca821f';

interface LotterySetting {
  lottery_id: string;
  lottery_name: string;
  lottery_type: string;
  master_status: string;
  master_close_time: string;
  agent_status: string;
  agent_close_time: string;
  custom_payout_rate: any;
  max_per_number: number | null;
}

export default function LotterySettingsPage() {
  const [settings, setSettings] = useState<LotterySetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLottery, setSelectedLottery] = useState<LotterySetting | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [formStatus, setFormStatus] = useState('active');
  const [formCloseTime, setFormCloseTime] = useState('');
  const [formMaxPerNumber, setFormMaxPerNumber] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`/api/agent/lottery-settings?agent_id=${DEMO_AGENT_ID}`);
      const data = await res.json();
      setSettings(data.settings || []);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (lottery: LotterySetting) => {
    setSelectedLottery(lottery);
    setFormStatus(lottery.agent_status);
    setFormCloseTime(lottery.agent_close_time || '');
    setFormMaxPerNumber(lottery.max_per_number?.toString() || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedLottery) return;

    try {
      const res = await fetch('/api/agent/lottery-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: DEMO_AGENT_ID,
          lottery_id: selectedLottery.lottery_id,
          status: formStatus,
          close_time: formCloseTime || null,
          max_per_number: formMaxPerNumber ? Number(formMaxPerNumber) : null,
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        setDialogOpen(false);
        fetchSettings();
      } else {
        alert(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  const toggleStatus = async (lottery: LotterySetting) => {
    const newStatus = lottery.agent_status === 'active' ? 'paused' : 'active';
    
    try {
      const res = await fetch('/api/agent/lottery-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: DEMO_AGENT_ID,
          lottery_id: lottery.lottery_id,
          status: newStatus,
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        fetchSettings();
      }
    } catch (error) {
      console.error('Error toggling:', error);
    }
  };

  const getStatusBadge = (status: string, isMaster = false) => {
    if (status === 'active') {
      return <Badge variant="default" className="bg-green-500">เปิดรับ</Badge>;
    } else if (status === 'paused') {
      return <Badge variant="secondary" className="bg-yellow-500 text-black">พักชั่วคราว</Badge>;
    } else {
      return <Badge variant="destructive">ปิด</Badge>;
    }
  };

  if (loading) {
    return <div className="p-6">กำลังโหลด...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">จัดการหวย</h1>
          <p className="text-muted-foreground">เปิด/ปิดรับหวย และตั้งค่าต่างๆ</p>
        </div>
      </div>

      {/* สถานะรวม */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">เปิดรับ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {settings.filter(s => s.agent_status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">พักชั่วคราว</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {settings.filter(s => s.agent_status === 'paused').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ปิด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {settings.filter(s => s.agent_status === 'closed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ตารางหวย */}
      <Card>
        <CardHeader>
          <CardTitle>รายการหวยทั้งหมด</CardTitle>
          <CardDescription>
            สถานะจากเว็บแม่มีผลเหนือการตั้งค่าของคุณ - ถ้าแม่ปิดคุณจะเปิดไม่ได้
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>หวย</TableHead>
                <TableHead>สถานะแม่</TableHead>
                <TableHead>สถานะร้าน</TableHead>
                <TableHead>เปิด/ปิด</TableHead>
                <TableHead>เวลาปิดร้าน</TableHead>
                <TableHead>จำกัดยอด/เลข</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.map((lottery) => (
                <TableRow key={lottery.lottery_id}>
                  <TableCell className="font-medium">{lottery.lottery_name}</TableCell>
                  <TableCell>{getStatusBadge(lottery.master_status, true)}</TableCell>
                  <TableCell>{getStatusBadge(lottery.agent_status)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={lottery.agent_status === 'active'}
                      onCheckedChange={() => toggleStatus(lottery)}
                      disabled={lottery.master_status === 'closed'}
                    />
                  </TableCell>
                  <TableCell>
                    {lottery.agent_close_time || lottery.master_close_time || '-'}
                  </TableCell>
                  <TableCell>
                    {lottery.max_per_number 
                      ? `${lottery.max_per_number.toLocaleString()} บาท`
                      : 'ไม่จำกัด'
                    }
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEdit(lottery)}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      ตั้งค่า
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog ตั้งค่า */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ตั้งค่า {selectedLottery?.lottery_name}</DialogTitle>
            <DialogDescription>
              ปรับแต่งการตั้งค่าสำหรับร้านของคุณ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>สถานะ</Label>
              <div className="flex gap-2">
                <Button
                  variant={formStatus === 'active' ? 'default' : 'outline'}
                  onClick={() => setFormStatus('active')}
                  className="flex-1"
                >
                  <Check className="h-4 w-4 mr-1" />
                  เปิดรับ
                </Button>
                <Button
                  variant={formStatus === 'paused' ? 'secondary' : 'outline'}
                  onClick={() => setFormStatus('paused')}
                  className="flex-1"
                >
                  <Clock className="h-4 w-4 mr-1" />
                  พัก
                </Button>
                <Button
                  variant={formStatus === 'closed' ? 'destructive' : 'outline'}
                  onClick={() => setFormStatus('closed')}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-1" />
                  ปิด
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="closeTime">เวลาปิดรับ (ของร้านคุณ)</Label>
              <Input
                id="closeTime"
                type="time"
                value={formCloseTime}
                onChange={(e) => setFormCloseTime(e.target.value)}
                placeholder="เว้นว่างใช้ตามแม่"
              />
              <p className="text-xs text-muted-foreground">
                เวลาปิดจากแม่: {selectedLottery?.master_close_time || 'ไม่กำหนด'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxPerNumber">จำกัดยอดสูงสุดต่อเลข (บาท)</Label>
              <Input
                id="maxPerNumber"
                type="number"
                value={formMaxPerNumber}
                onChange={(e) => setFormMaxPerNumber(e.target.value)}
                placeholder="เว้นว่าง = ไม่จำกัด"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave}>
              บันทึก
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
