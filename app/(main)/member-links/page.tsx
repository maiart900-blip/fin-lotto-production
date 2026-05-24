'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { 
  Link as LinkIcon, 
  Copy, 
  ExternalLink, 
  UserPlus, 
  LogIn, 
  ShoppingCart, 
  Handshake,
  Users,
  QrCode,
  Check,
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Customer {
  id: string;
  username: string;
  name: string;
  referral_code: string;
  referred_by: string | null;
  created_at: string;
}

export default function MemberLinksPage() {
  const { canAccess } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrData, setQrData] = useState<{ url: string; username: string; qrImage: string } | null>(null);
  
  const { data: customersData } = useSWR('/api/customers', fetcher);
  const customers = customersData?.customers || [];

  // Get base URL
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // Static links
  const staticLinks = [
    {
      title: 'ลิงก์สมัครสมาชิก',
      description: 'ลิงก์สำหรับสมัครสมาชิกใหม่',
      path: '/c/register',
      icon: UserPlus,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'ลิงก์ Login',
      description: 'ลิงก์สำหรับเข้าสู่ระบบ',
      path: '/c/login',
      icon: LogIn,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'ลิงก์หน้าแทงหวย',
      description: 'ลิงก์ไปยังหน้าซื้อหวย',
      path: '/c/buy',
      icon: ShoppingCart,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
    {
      title: 'ลิงก์พาร์ทเนอร์',
      description: 'ลิงก์หน้าพาร์ทเนอร์',
      path: '/c/partner',
      icon: Handshake,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
  ];

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success('คัดลอกลิงก์แล้ว');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('ไม่สามารถคัดลอกได้');
    }
  };

  const openLink = (path: string) => {
    window.open(path, '_blank');
  };

  const generateQR = async (url: string, username: string) => {
    try {
      const qrImage = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrData({ url, username, qrImage });
      setQrDialogOpen(true);
    } catch {
      toast.error('ไม่สามารถสร้าง QR Code ได้');
    }
  };

  // Filter customers
  const filteredCustomers = customers.filter((c: Customer) =>
    c.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.referral_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Count referrals for each customer
  const getReferralCount = (referralCode: string) => {
    return customers.filter((c: Customer) => c.referred_by === referralCode).length;
  };

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">ไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LinkIcon className="h-6 w-6 text-red-500" />
          ลิงก์สมาชิก
        </h1>
        <p className="text-muted-foreground">จัดการลิงก์สำหรับสมาชิกทั้งหมด</p>
      </div>

      {/* Static Links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {staticLinks.map((link) => (
          <Card key={link.path} className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${link.bgColor}`}>
                  <link.icon className={`h-5 w-5 ${link.color}`} />
                </div>
                <div>
                  <CardTitle className="text-base">{link.title}</CardTitle>
                  <CardDescription className="text-xs">{link.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                <code className="text-xs flex-1 truncate">{baseUrl}{link.path}</code>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => copyToClipboard(`${baseUrl}${link.path}`, link.path)}
                >
                  {copiedId === link.path ? (
                    <Check className="h-4 w-4 mr-1 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4 mr-1" />
                  )}
                  คัดลอก
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openLink(link.path)}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Referral Links Table */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <Users className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <CardTitle>ลิงก์แนะนำเพื่อนรายยูส</CardTitle>
                <CardDescription>รายการลิงก์แนะนำเพื่อนของสมาชิกแต่ละคน</CardDescription>
              </div>
            </div>
            <Badge variant="secondary">{filteredCustomers.length} รายการ</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหา username, ชื่อ, หรือ referral code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Table */}
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Username</TableHead>
                  <TableHead>Referral Code</TableHead>
                  <TableHead>ลิงก์แนะนำเพื่อน</TableHead>
                  <TableHead>ลิงก์พาร์ทเนอร์</TableHead>
                  <TableHead className="text-center">ลูกทีม</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Users className="h-8 w-8" />
                        <p>ไม่พบข้อมูลสมาชิก</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer: Customer) => {
                    const referralLink = `${baseUrl}/c/register?ref=${customer.referral_code}`;
                    const partnerLink = `${baseUrl}/c/partner?ref=${customer.referral_code}`;
                    const referralCount = getReferralCount(customer.referral_code);

                    return (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{customer.username}</div>
                            <div className="text-xs text-muted-foreground">{customer.name || '-'}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {customer.referral_code || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded truncate block max-w-[200px]">
                            {referralLink}
                          </code>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded truncate block max-w-[200px]">
                            {partnerLink}
                          </code>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={referralCount > 0 ? 'default' : 'secondary'}>
                            {referralCount}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(referralLink, `ref-${customer.id}`)}
                            >
                              {copiedId === `ref-${customer.id}` ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => generateQR(referralLink, customer.username)}
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openLink(`/c/register?ref=${customer.referral_code}`)}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* QR Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-red-500" />
              QR Code - {qrData?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrData?.qrImage && (
              <img
                src={qrData.qrImage}
                alt="QR Code"
                className="w-64 h-64 rounded-lg border"
              />
            )}
            <code className="text-xs bg-muted px-3 py-2 rounded break-all max-w-full">
              {qrData?.url}
            </code>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => qrData && copyToClipboard(qrData.url, 'qr-copy')}
              >
                <Copy className="h-4 w-4 mr-2" />
                คัดลอกลิงก์
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (qrData?.qrImage) {
                    const link = document.createElement('a');
                    link.download = `qr-${qrData.username}.png`;
                    link.href = qrData.qrImage;
                    link.click();
                  }
                }}
              >
                ดาวน์โหลด QR
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
