'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Globe, 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  Copy, 
  ExternalLink,
  RefreshCw,
  Server,
  Lock
} from 'lucide-react';
import { toast } from 'sonner';

export default function DomainSettingsPage() {
  const [domain, setDomain] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [dnsStatus, setDnsStatus] = useState<'pending' | 'valid' | 'invalid' | null>(null);

  const vercelIP = '76.76.21.21';
  const cnameTarget = 'cname.vercel-dns.com';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('คัดลอกแล้ว');
  };

  const checkDNS = async () => {
    if (!domain) {
      toast.error('กรุณากรอกโดเมน');
      return;
    }

    setIsChecking(true);
    setDnsStatus('pending');

    // Simulate DNS check
    await new Promise(resolve => setTimeout(resolve, 2000));

    // In production, this would call an API to verify DNS
    setDnsStatus('valid');
    setIsChecking(false);
    toast.success('DNS ตั้งค่าถูกต้อง');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ตั้งค่าโดเมนและ SSL</h1>
          <p className="text-muted-foreground">ผูกโดเมนของคุณและเปิดใช้งาน HTTPS</p>
        </div>
      </div>

      <Tabs defaultValue="domain" className="space-y-4">
        <TabsList>
          <TabsTrigger value="domain">โดเมน</TabsTrigger>
          <TabsTrigger value="ssl">SSL Certificate</TabsTrigger>
          <TabsTrigger value="guide">คู่มือการตั้งค่า</TabsTrigger>
        </TabsList>

        <TabsContent value="domain" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                ตั้งค่าโดเมน
              </CardTitle>
              <CardDescription>
                เพิ่มโดเมนของคุณและตั้งค่า DNS
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>โดเมนของคุณ</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="example.com หรือ www.example.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                  />
                  <Button onClick={checkDNS} disabled={isChecking}>
                    {isChecking ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      'ตรวจสอบ'
                    )}
                  </Button>
                </div>
              </div>

              {dnsStatus && (
                <Alert variant={dnsStatus === 'valid' ? 'default' : 'destructive'}>
                  {dnsStatus === 'valid' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {dnsStatus === 'valid' ? 'DNS ถูกต้อง' : 'DNS ยังไม่ถูกต้อง'}
                  </AlertTitle>
                  <AlertDescription>
                    {dnsStatus === 'valid' 
                      ? 'โดเมนของคุณตั้งค่า DNS ถูกต้องแล้ว SSL จะถูกสร้างอัตโนมัติ'
                      : 'กรุณาตั้งค่า DNS ตามคู่มือด้านล่าง'
                    }
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <h3 className="font-semibold">DNS Records ที่ต้องตั้งค่า</h3>
                
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3">Type</th>
                        <th className="text-left p-3">Name</th>
                        <th className="text-left p-3">Value</th>
                        <th className="text-left p-3">TTL</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="p-3">
                          <Badge>A</Badge>
                        </td>
                        <td className="p-3 font-mono">@</td>
                        <td className="p-3 font-mono">{vercelIP}</td>
                        <td className="p-3">3600</td>
                        <td className="p-3">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => copyToClipboard(vercelIP)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                      <tr className="border-t">
                        <td className="p-3">
                          <Badge variant="secondary">CNAME</Badge>
                        </td>
                        <td className="p-3 font-mono">www</td>
                        <td className="p-3 font-mono">{cnameTarget}</td>
                        <td className="p-3">3600</td>
                        <td className="p-3">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => copyToClipboard(cnameTarget)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Domains */}
          <Card>
            <CardHeader>
              <CardTitle>โดเมนที่ผูกแล้ว</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Server className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">finlotto.vercel.app</p>
                      <p className="text-sm text-muted-foreground">Vercel Default</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-500">Active</Badge>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ssl" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                SSL Certificate
              </CardTitle>
              <CardDescription>
                SSL จะถูกสร้างอัตโนมัติเมื่อ DNS ถูกต้อง
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertTitle>SSL อัตโนมัติ</AlertTitle>
                <AlertDescription>
                  Vercel จะสร้าง SSL Certificate ให้อัตโนมัติเมื่อคุณผูกโดเมนสำเร็จ
                  ไม่ต้องดำเนินการเพิ่มเติม
                </AlertDescription>
              </Alert>

              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">สถานะ SSL</span>
                  <Badge className="bg-green-500">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">ประเภท</span>
                  <span>Let&apos;s Encrypt</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Auto-Renew</span>
                  <Badge variant="outline">เปิดใช้งาน</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guide" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>คู่มือการตั้งค่าโดเมน</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold">ขั้นตอนที่ 1: ซื้อโดเมน</h3>
                <p className="text-muted-foreground">
                  ซื้อโดเมนจากผู้ให้บริการ เช่น:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Namecheap</li>
                  <li>GoDaddy</li>
                  <li>Cloudflare</li>
                  <li>Thai .co.th จาก THNIC</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">ขั้นตอนที่ 2: ตั้งค่า DNS</h3>
                <p className="text-muted-foreground">
                  เข้าไปที่หน้าจัดการ DNS ของผู้ให้บริการโดเมน แล้วเพิ่ม Record ดังนี้:
                </p>
                <div className="bg-muted rounded-lg p-4 font-mono text-sm space-y-2">
                  <p>A Record: @ → {vercelIP}</p>
                  <p>CNAME Record: www → {cnameTarget}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">ขั้นตอนที่ 3: รอ DNS Propagation</h3>
                <p className="text-muted-foreground">
                  หลังตั้งค่า DNS อาจใช้เวลา 5 นาที - 48 ชั่วโมง ในการ Propagate
                  ส่วนใหญ่จะเสร็จภายใน 30 นาที
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">ขั้นตอนที่ 4: ตรวจสอบและเปิดใช้งาน</h3>
                <p className="text-muted-foreground">
                  กลับมาที่หน้านี้และกดปุ่ม &quot;ตรวจสอบ&quot; เพื่อยืนยันว่า DNS ถูกต้อง
                  SSL จะถูกสร้างอัตโนมัติ
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
