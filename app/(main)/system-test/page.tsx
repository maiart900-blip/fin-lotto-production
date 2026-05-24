'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Database, 
  CreditCard, 
  UserPlus, 
  Ticket,
  RefreshCw,
  Play,
  AlertTriangle
} from 'lucide-react';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  duration?: number;
}

export default function SystemTestPage() {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [testAmount, setTestAmount] = useState('100');

  const runAllTests = async () => {
    setIsRunning(true);
    const testList: TestResult[] = [
      { name: 'เชื่อมต่อฐานข้อมูล', status: 'pending' },
      { name: 'ระบบสมัครสมาชิก', status: 'pending' },
      { name: 'ระบบเข้าสู่ระบบ', status: 'pending' },
      { name: 'ระบบฝากเงิน', status: 'pending' },
      { name: 'ระบบถอนเงิน', status: 'pending' },
      { name: 'ระบบแทงหวย', status: 'pending' },
      { name: 'ระบบออกผล', status: 'pending' },
      { name: 'ระบบคอมมิชชั่น', status: 'pending' },
    ];
    setTests(testList);

    for (let i = 0; i < testList.length; i++) {
      // Update to running
      setTests(prev => prev.map((t, idx) => 
        idx === i ? { ...t, status: 'running' } : t
      ));

      const startTime = Date.now();
      
      try {
        // Simulate API test
        const response = await fetch(`/api/system-test?test=${encodeURIComponent(testList[i].name)}`);
        const data = await response.json();
        const duration = Date.now() - startTime;

        setTests(prev => prev.map((t, idx) => 
          idx === i ? { 
            ...t, 
            status: data.success ? 'success' : 'error',
            message: data.message,
            duration 
          } : t
        ));
      } catch (error) {
        const duration = Date.now() - startTime;
        setTests(prev => prev.map((t, idx) => 
          idx === i ? { 
            ...t, 
            status: 'error',
            message: 'Connection failed',
            duration 
          } : t
        ));
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsRunning(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-5 h-5 rounded-full border-2 border-muted" />;
      case 'running':
        return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">รอทดสอบ</Badge>;
      case 'running':
        return <Badge className="bg-blue-500">กำลังทดสอบ</Badge>;
      case 'success':
        return <Badge className="bg-green-500">สำเร็จ</Badge>;
      case 'error':
        return <Badge variant="destructive">ล้มเหลว</Badge>;
    }
  };

  const passedTests = tests.filter(t => t.status === 'success').length;
  const failedTests = tests.filter(t => t.status === 'error').length;
  const totalTests = tests.length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ทดสอบระบบ</h1>
          <p className="text-muted-foreground">ตรวจสอบความพร้อมของระบบก่อนเปิดใช้งาน</p>
        </div>
        <Button onClick={runAllTests} disabled={isRunning}>
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              กำลังทดสอบ...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              เริ่มทดสอบทั้งหมด
            </>
          )}
        </Button>
      </div>

      {/* Summary Cards */}
      {tests.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">ทั้งหมด</p>
                  <p className="text-2xl font-bold">{totalTests}</p>
                </div>
                <Database className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">สำเร็จ</p>
                  <p className="text-2xl font-bold text-green-500">{passedTests}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">ล้มเหลว</p>
                  <p className="text-2xl font-bold text-red-500">{failedTests}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">ความพร้อม</p>
                  <p className="text-2xl font-bold">
                    {totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0}%
                  </p>
                </div>
                <RefreshCw className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="auto" className="space-y-4">
        <TabsList>
          <TabsTrigger value="auto">ทดสอบอัตโนมัติ</TabsTrigger>
          <TabsTrigger value="manual">ทดสอบด้วยตนเอง</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
        </TabsList>

        <TabsContent value="auto" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>ผลการทดสอบอัตโนมัติ</CardTitle>
              <CardDescription>ระบบจะทดสอบทุกส่วนโดยอัตโนมัติ</CardDescription>
            </CardHeader>
            <CardContent>
              {tests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>กดปุ่ม &quot;เริ่มทดสอบทั้งหมด&quot; เพื่อเริ่มทดสอบระบบ</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tests.map((test, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(test.status)}
                        <div>
                          <p className="font-medium">{test.name}</p>
                          {test.message && (
                            <p className="text-sm text-muted-foreground">{test.message}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {test.duration && (
                          <span className="text-sm text-muted-foreground">
                            {test.duration}ms
                          </span>
                        )}
                        {getStatusBadge(test.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ทดสอบฝากเงิน */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  ทดสอบฝากเงิน
                </CardTitle>
                <CardDescription>ทดสอบระบบฝากเงินอัตโนมัติ</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>จำนวนเงิน (บาท)</Label>
                  <Input 
                    type="number" 
                    value={testAmount}
                    onChange={(e) => setTestAmount(e.target.value)}
                    placeholder="100"
                  />
                </div>
                <Button className="w-full">
                  <Play className="mr-2 h-4 w-4" />
                  ทดสอบฝากเงิน
                </Button>
              </CardContent>
            </Card>

            {/* ทดสอบถอนเงิน */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  ทดสอบถอนเงิน
                </CardTitle>
                <CardDescription>ทดสอบระบบถอนเงินอัตโนมัติ</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>จำนวนเงิน (บาท)</Label>
                  <Input 
                    type="number" 
                    value={testAmount}
                    onChange={(e) => setTestAmount(e.target.value)}
                    placeholder="100"
                  />
                </div>
                <Button className="w-full" variant="outline">
                  <Play className="mr-2 h-4 w-4" />
                  ทดสอบถอนเงิน
                </Button>
              </CardContent>
            </Card>

            {/* ทดสอบสมัครสมาชิก */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  ทดสอบสมัครสมาชิก
                </CardTitle>
                <CardDescription>ทดสอบระบบสมัครสมาชิกใหม่</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>เบอร์โทรศัพท์ทดสอบ</Label>
                  <Input placeholder="0812345678" />
                </div>
                <Button className="w-full" variant="outline">
                  <Play className="mr-2 h-4 w-4" />
                  ทดสอบสมัคร
                </Button>
              </CardContent>
            </Card>

            {/* ทดสอบแทงหวย */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ticket className="h-5 w-5" />
                  ทดสอบแทงหวย
                </CardTitle>
                <CardDescription>ทดสอบระบบรับแทงหวย</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>เลขที่ต้องการแทง</Label>
                  <Input placeholder="123" />
                </div>
                <Button className="w-full" variant="outline">
                  <Play className="mr-2 h-4 w-4" />
                  ทดสอบแทง
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="checklist" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Checklist ก่อนเปิดรับลูกค้า</CardTitle>
              <CardDescription>ตรวจสอบรายการต่อไปนี้ให้ครบถ้วน</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: 'ตั้งค่าหวยและอัตราจ่ายครบถ้วน', done: true },
                  { name: 'ตั้งค่าบัญชีธนาคารสำหรับฝาก-ถอน', done: true },
                  { name: 'ทดสอบระบบสมัครสมาชิก', done: false },
                  { name: 'ทดสอบระบบฝากเงินอัตโนมัติ', done: false },
                  { name: 'ทดสอบระบบถอนเงินอัตโนมัติ', done: false },
                  { name: 'ทดสอบระบบแทงหวย', done: false },
                  { name: 'ทดสอบระบบออกผลหวย', done: false },
                  { name: 'ตั้งค่าโดเมนและ SSL', done: false },
                  { name: 'ตั้งค่า Line Notify สำหรับแจ้งเตือน', done: false },
                  { name: 'สำรองข้อมูลก่อนเปิดใช้งาน', done: false },
                ].map((item, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                  >
                    {item.done ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    )}
                    <span className={item.done ? 'text-muted-foreground line-through' : ''}>
                      {item.name}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
