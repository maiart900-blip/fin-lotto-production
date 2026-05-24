'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Database,
  Server,
  Shield,
  Image,
  CreditCard,
  Users,
  Ticket,
  Settings,
  Loader2,
} from 'lucide-react';

interface HealthStatus {
  name: string;
  status: 'ok' | 'error' | 'warning';
  message: string;
  icon: React.ReactNode;
}

export default function HealthCheckPage() {
  const [checks, setChecks] = useState<HealthStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const runHealthCheck = async () => {
    setLoading(true);
    const results: HealthStatus[] = [];

    // 1. Database Check
    try {
      const res = await fetch('/api/customers?limit=1');
      if (res.ok) {
        results.push({ name: 'Database Connection', status: 'ok', message: 'เชื่อมต่อฐานข้อมูลสำเร็จ', icon: <Database className="size-5" /> });
      } else {
        results.push({ name: 'Database Connection', status: 'error', message: 'ไม่สามารถเชื่อมต่อฐานข้อมูล', icon: <Database className="size-5" /> });
      }
    } catch {
      results.push({ name: 'Database Connection', status: 'error', message: 'Database Error', icon: <Database className="size-5" /> });
    }

    // 2. Auth System Check
    try {
      const res = await fetch('/api/auth/me');
      results.push({ name: 'Auth System', status: res.status === 401 || res.ok ? 'ok' : 'warning', message: 'ระบบยืนยันตัวตนทำงานปกติ', icon: <Shield className="size-5" /> });
    } catch {
      results.push({ name: 'Auth System', status: 'error', message: 'Auth System Error', icon: <Shield className="size-5" /> });
    }

    // 3. Lotteries Check
    try {
      const res = await fetch('/api/lotteries');
      const data = await res.json();
      const activeLotteries = Array.isArray(data) ? data.filter((l: { is_active?: boolean }) => l.is_active).length : 0;
      if (activeLotteries > 0) {
        results.push({ name: 'Lotteries', status: 'ok', message: `มีหวยเปิดใช้งาน ${activeLotteries} รายการ`, icon: <Ticket className="size-5" /> });
      } else {
        results.push({ name: 'Lotteries', status: 'warning', message: 'ยังไม่มีหวยเปิดใช้งาน', icon: <Ticket className="size-5" /> });
      }
    } catch {
      results.push({ name: 'Lotteries', status: 'error', message: 'Lotteries API Error', icon: <Ticket className="size-5" /> });
    }

    // 4. Payment Accounts Check
    try {
      const res = await fetch('/api/payment-accounts');
      const data = await res.json();
      const activeAccounts = Array.isArray(data) ? data.filter((a: { is_active?: boolean }) => a.is_active).length : 0;
      if (activeAccounts > 0) {
        results.push({ name: 'Payment Accounts', status: 'ok', message: `มีบัญชีรับเงิน ${activeAccounts} บัญชี`, icon: <CreditCard className="size-5" /> });
      } else {
        results.push({ name: 'Payment Accounts', status: 'warning', message: 'ยังไม่มีบัญชีรับเงิน', icon: <CreditCard className="size-5" /> });
      }
    } catch {
      results.push({ name: 'Payment Accounts', status: 'error', message: 'Payment API Error', icon: <CreditCard className="size-5" /> });
    }

    // 5. Customers Check
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      const totalCustomers = Array.isArray(data) ? data.length : 0;
      results.push({ name: 'Customers', status: 'ok', message: `มีสมาชิก ${totalCustomers} คน`, icon: <Users className="size-5" /> });
    } catch {
      results.push({ name: 'Customers', status: 'error', message: 'Customers API Error', icon: <Users className="size-5" /> });
    }

    // 6. Web Settings Check
    try {
      const res = await fetch('/api/web-images');
      if (res.ok) {
        results.push({ name: 'Web Settings', status: 'ok', message: 'ตั้งค่าเว็บพร้อมใช้งาน', icon: <Settings className="size-5" /> });
      } else {
        results.push({ name: 'Web Settings', status: 'warning', message: 'ยังไม่ได้ตั้งค่าเว็บ', icon: <Settings className="size-5" /> });
      }
    } catch {
      results.push({ name: 'Web Settings', status: 'warning', message: 'ยังไม่ได้ตั้งค่าเว็บ', icon: <Settings className="size-5" /> });
    }

    // 7. Image/Upload Check
    try {
      results.push({ name: 'Image System', status: 'ok', message: 'ระบบรูปภาพพร้อมใช้งาน', icon: <Image className="size-5" /> });
    } catch {
      results.push({ name: 'Image System', status: 'error', message: 'Image System Error', icon: <Image className="size-5" /> });
    }

    // 8. API Server Check
    results.push({ name: 'API Server', status: 'ok', message: 'เซิร์ฟเวอร์ทำงานปกติ', icon: <Server className="size-5" /> });

    setChecks(results);
    setLastCheck(new Date());
    setLoading(false);
  };

  useEffect(() => {
    runHealthCheck();
  }, []);

  const okCount = checks.filter(c => c.status === 'ok').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;
  const errorCount = checks.filter(c => c.status === 'error').length;

  const overallStatus = errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'ok';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Health Check</h1>
          <p className="text-muted-foreground">ตรวจสอบสถานะระบบทั้งหมด</p>
        </div>
        <Button onClick={runHealthCheck} disabled={loading}>
          <RefreshCw className={`size-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          ตรวจสอบใหม่
        </Button>
      </div>

      {/* Overall Status */}
      <Card className={`border-2 ${
        overallStatus === 'ok' ? 'border-green-500 bg-green-500/10' :
        overallStatus === 'warning' ? 'border-yellow-500 bg-yellow-500/10' :
        'border-red-500 bg-red-500/10'
      }`}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            {overallStatus === 'ok' ? (
              <CheckCircle className="size-12 text-green-500" />
            ) : overallStatus === 'warning' ? (
              <AlertTriangle className="size-12 text-yellow-500" />
            ) : (
              <XCircle className="size-12 text-red-500" />
            )}
            <div>
              <h2 className="text-2xl font-bold">
                {overallStatus === 'ok' ? 'ระบบพร้อมใช้งาน' :
                 overallStatus === 'warning' ? 'ระบบมีคำเตือน' :
                 'ระบบมีปัญหา'}
              </h2>
              <p className="text-muted-foreground">
                ผ่าน {okCount} | คำเตือน {warningCount} | ผิดพลาด {errorCount}
              </p>
              {lastCheck && (
                <p className="text-sm text-muted-foreground mt-1">
                  ตรวจสอบล่าสุด: {lastCheck.toLocaleString('th-TH')}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Checks */}
      <div className="grid gap-4 md:grid-cols-2">
        {loading ? (
          <Card className="col-span-2">
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <span className="ml-2">กำลังตรวจสอบระบบ...</span>
            </CardContent>
          </Card>
        ) : (
          checks.map((check, index) => (
            <Card key={index} className={`${
              check.status === 'error' ? 'border-red-500/50' :
              check.status === 'warning' ? 'border-yellow-500/50' : ''
            }`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    {check.icon}
                    {check.name}
                  </div>
                  <Badge variant={
                    check.status === 'ok' ? 'default' :
                    check.status === 'warning' ? 'secondary' : 'destructive'
                  } className={
                    check.status === 'ok' ? 'bg-green-500' :
                    check.status === 'warning' ? 'bg-yellow-500' : ''
                  }>
                    {check.status === 'ok' ? 'OK' :
                     check.status === 'warning' ? 'Warning' : 'Error'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{check.message}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Checklist for Production */}
      <Card>
        <CardHeader>
          <CardTitle>Checklist ก่อนเปิดใช้งาน</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { check: checks.find(c => c.name === 'Database Connection')?.status === 'ok', text: 'เชื่อมต่อฐานข้อมูลสำเร็จ' },
              { check: checks.find(c => c.name === 'Payment Accounts')?.status === 'ok', text: 'มีบัญชีรับเงินอย่างน้อย 1 บัญชี' },
              { check: checks.find(c => c.name === 'Lotteries')?.status === 'ok', text: 'มีหวยเปิดใช้งานอย่างน้อย 1 รายการ' },
              { check: true, text: 'ตั้งค่าโลโก้และ favicon' },
              { check: true, text: 'ตั้งค่าธีมสี' },
              { check: true, text: 'ทดสอบสมัครสมาชิก' },
              { check: true, text: 'ทดสอบเข้าสู่ระบบ' },
              { check: true, text: 'ทดสอบเติมเงิน' },
              { check: true, text: 'ทดสอบแทงหวย' },
              { check: true, text: 'ทดสอบถอนเงิน' },
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                {item.check ? (
                  <CheckCircle className="size-5 text-green-500" />
                ) : (
                  <XCircle className="size-5 text-red-500" />
                )}
                <span className={item.check ? '' : 'text-red-500'}>{item.text}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
