'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ClipboardCheck,
  CreditCard,
  ArrowDownToLine,
  AlertTriangle,
  Shield,
  Eye,
  TrendingUp,
  Clock,
  AlertCircle,
  Users,
  RefreshCw,
  Zap,
  DollarSign,
  Copy,
} from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

interface RiskAlert {
  id: string;
  type: 'frequent_deposit' | 'large_amount' | 'duplicate_slip' | 'rapid_withdrawal' | 'new_account_large_tx';
  severity: 'low' | 'medium' | 'high' | 'critical';
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  description: string;
  amount?: number;
  count?: number;
  created_at: string;
  status: 'pending' | 'reviewed' | 'dismissed';
}

// Risk type configurations
const riskTypeConfig = {
  frequent_deposit: { label: 'ฝากบ่อยผิดปกติ', icon: RefreshCw, color: 'text-amber-500' },
  large_amount: { label: 'ยอดสูงผิดปกติ', icon: DollarSign, color: 'text-red-500' },
  duplicate_slip: { label: 'สลิปซ้ำ', icon: Copy, color: 'text-red-600' },
  rapid_withdrawal: { label: 'ถอนเร็วผิดปกติ', icon: Zap, color: 'text-orange-500' },
  new_account_large_tx: { label: 'บัญชีใหม่ยอดสูง', icon: Users, color: 'text-purple-500' },
};

const severityConfig = {
  low: { label: 'ต่ำ', color: 'bg-blue-500/20 text-blue-600' },
  medium: { label: 'ปานกลาง', color: 'bg-amber-500/20 text-amber-600' },
  high: { label: 'สูง', color: 'bg-orange-500/20 text-orange-600' },
  critical: { label: 'วิกฤต', color: 'bg-red-500/20 text-red-600' },
};

export default function PendingReviewPage() {
  const [activeTab, setActiveTab] = useState('pending');
  
  const { data: pendingCounts } = useSWR('/api/admin/pending-counts', fetcher, {
    refreshInterval: 5000,
  });

  // Fetch risk alerts
  const { data: riskData, mutate: mutateRisk } = useSWR<{ alerts: RiskAlert[], summary: { critical: number, high: number, medium: number, low: number } }>(
    '/api/admin/risk-alerts',
    fetcher,
    { refreshInterval: 10000 }
  );

  const riskAlerts = riskData?.alerts || [];
  const riskSummary = riskData?.summary || { critical: 0, high: 0, medium: 0, low: 0 };
  const totalRiskAlerts = riskSummary.critical + riskSummary.high + riskSummary.medium + riskSummary.low;

  const items = [
    {
      title: 'คำขอเติมเงิน',
      href: '/topup-requests',
      icon: CreditCard,
      count: pendingCounts?.topupPending || 0,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: 'คำขอถอนเงิน',
      href: '/withdraw-requests',
      icon: ArrowDownToLine,
      count: pendingCounts?.withdrawPending || 0,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      title: 'แจ้งปัญหาฝากเงิน',
      href: '/deposit-issues',
      icon: AlertTriangle,
      count: pendingCounts?.depositIssuesPending || 0,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: 'ความเสี่ยง',
      href: '#risk',
      icon: Shield,
      count: totalRiskAlerts,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
  ];

  const totalPending = pendingCounts?.totalPending || 0;

  const handleDismissAlert = async (alertId: string) => {
    try {
      await fetch('/api/admin/risk-alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alertId, status: 'dismissed' }),
      });
      mutateRisk();
    } catch {
      // Silent fail
    }
  };

  const handleReviewAlert = async (alertId: string) => {
    try {
      await fetch('/api/admin/risk-alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alertId, status: 'reviewed' }),
      });
      mutateRisk();
    } catch {
      // Silent fail
    }
  };

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen -m-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <ClipboardCheck className="size-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">รายการรอตรวจสอบ</h1>
            <p className="text-gray-600">
              รวมรายการที่ต้องดำเนินการทั้งหมด {totalPending + totalRiskAlerts} รายการ
            </p>
          </div>
        </div>
        {riskSummary.critical > 0 && (
          <Badge className="bg-red-500 text-white animate-pulse">
            <AlertCircle className="size-3 mr-1" />
            {riskSummary.critical} รายการวิกฤต
          </Badge>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {items.map((item) => (
          <Link key={item.title} href={item.href}>
            <Card className={`cursor-pointer bg-white border-gray-200 shadow-sm hover:border-blue-400 transition-colors ${item.count > 0 ? 'border-red-300' : ''}`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-gray-900">
                  <div className={`p-2 rounded-lg ${item.bgColor}`}>
                    <item.icon className={`size-5 ${item.color}`} />
                  </div>
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-sm">รอดำเนินการ</span>
                  <span className={`text-3xl font-bold ${item.count > 0 ? item.color : 'text-gray-400'}`}>
                    {item.count}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Risk Detection Dashboard */}
      <Card className="bg-white border-gray-200 shadow-sm" id="risk">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <Shield className="size-5 text-purple-600" />
            ระบบตรวจจับความเสี่ยง (Risk Detection)
          </CardTitle>
          <CardDescription>
            ตรวจสอบรายการที่มีพฤติกรรมผิดปกติ
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Risk Summary Badges */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <Badge className="bg-red-100 text-red-700">
              วิกฤต: {riskSummary.critical}
            </Badge>
            <Badge className="bg-orange-100 text-orange-700">
              สูง: {riskSummary.high}
            </Badge>
            <Badge className="bg-amber-100 text-amber-700">
              ปานกลาง: {riskSummary.medium}
            </Badge>
            <Badge className="bg-blue-100 text-blue-700">
              ต่ำ: {riskSummary.low}
            </Badge>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">
                รอตรวจสอบ
                {riskAlerts.filter(a => a.status === 'pending').length > 0 && (
                  <Badge className="ml-2 bg-red-500 text-white text-xs">
                    {riskAlerts.filter(a => a.status === 'pending').length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="reviewed">ตรวจสอบแล้ว</TabsTrigger>
              <TabsTrigger value="dismissed">ยกเลิกแล้ว</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4">
              {riskAlerts.filter(a => a.status === 'pending').length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Shield className="size-12 mx-auto mb-2 opacity-50 text-green-500" />
                  <p>ไม่พบรายการเสี่ยงที่รอตรวจสอบ</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ระดับ</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead>ลูกค้า</TableHead>
                      <TableHead>รายละเอียด</TableHead>
                      <TableHead>เวลา</TableHead>
                      <TableHead className="text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {riskAlerts
                      .filter(a => a.status === 'pending')
                      .sort((a, b) => {
                        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                        return severityOrder[a.severity] - severityOrder[b.severity];
                      })
                      .map((alert) => {
                        const typeConfig = riskTypeConfig[alert.type];
                        const TypeIcon = typeConfig?.icon || AlertCircle;
                        const sevConfig = severityConfig[alert.severity];

                        return (
                          <TableRow key={alert.id} className={alert.severity === 'critical' ? 'bg-red-50' : ''}>
                            <TableCell>
                              <Badge className={sevConfig.color}>
                                {sevConfig.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <TypeIcon className={`size-4 ${typeConfig?.color || 'text-gray-500'}`} />
                                <span className="text-sm">{typeConfig?.label || alert.type}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{alert.customer_name}</p>
                                <p className="text-xs text-gray-500">{alert.customer_phone}</p>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <p className="text-sm truncate">{alert.description}</p>
                              {alert.amount && (
                                <p className="text-xs text-amber-600 font-mono">
                                  {formatMoney(alert.amount)} บาท
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                              {formatDate(alert.created_at)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReviewAlert(alert.id)}
                                >
                                  <Eye className="size-3 mr-1" />
                                  ตรวจสอบ
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDismissAlert(alert.id)}
                                >
                                  ยกเลิก
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="reviewed" className="mt-4">
              {riskAlerts.filter(a => a.status === 'reviewed').length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>ไม่มีรายการที่ตรวจสอบแล้ว</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ระดับ</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead>ลูกค้า</TableHead>
                      <TableHead>รายละเอียด</TableHead>
                      <TableHead>เวลา</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {riskAlerts
                      .filter(a => a.status === 'reviewed')
                      .map((alert) => {
                        const typeConfig = riskTypeConfig[alert.type];
                        const TypeIcon = typeConfig?.icon || AlertCircle;
                        const sevConfig = severityConfig[alert.severity];

                        return (
                          <TableRow key={alert.id}>
                            <TableCell>
                              <Badge className={sevConfig.color}>{sevConfig.label}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <TypeIcon className={`size-4 ${typeConfig?.color}`} />
                                <span className="text-sm">{typeConfig?.label}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="font-medium">{alert.customer_name}</p>
                            </TableCell>
                            <TableCell className="max-w-[200px] text-sm truncate">
                              {alert.description}
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {formatDate(alert.created_at)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="dismissed" className="mt-4">
              {riskAlerts.filter(a => a.status === 'dismissed').length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>ไม่มีรายการที่ยกเลิกแล้ว</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ประเภท</TableHead>
                      <TableHead>ลูกค้า</TableHead>
                      <TableHead>รายละเอียด</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {riskAlerts
                      .filter(a => a.status === 'dismissed')
                      .slice(0, 10)
                      .map((alert) => {
                        const typeConfig = riskTypeConfig[alert.type];

                        return (
                          <TableRow key={alert.id} className="opacity-60">
                            <TableCell>{typeConfig?.label}</TableCell>
                            <TableCell>{alert.customer_name}</TableCell>
                            <TableCell className="text-sm">{alert.description}</TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Empty State */}
      {totalPending === 0 && totalRiskAlerts === 0 && (
        <Card className="border-dashed bg-white border-gray-300">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="size-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <ClipboardCheck className="size-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-green-600">ไม่มีรายการรอตรวจสอบ</h3>
            <p className="text-sm text-gray-500 mt-1">ทุกรายการได้รับการดำเนินการแล้ว</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
