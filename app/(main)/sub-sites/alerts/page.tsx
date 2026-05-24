'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  XCircle,
  RefreshCw,
  Check,
  Bell,
  BellOff,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface Alert {
  id: string;
  tenant_id: string;
  alert_type: 'error' | 'warning' | 'info' | 'critical';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  resolved_at: string | null;
  tenants: {
    name: string;
    slug: string;
  };
}

const alertTypeConfig = {
  critical: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  error: { icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
};

export default function AlertsPage() {
  const { data: alerts = [], mutate, isLoading } = useSWR<Alert[]>('/api/error-report', fetcher, {
    refreshInterval: 10000, // Refresh every 10 seconds
  });
  const [markingRead, setMarkingRead] = useState<string | null>(null);

  const handleMarkRead = async (alertId: string) => {
    setMarkingRead(alertId);
    try {
      await fetch(`/api/tenants/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true }),
      });
      toast.success('ทำเครื่องหมายอ่านแล้ว');
      mutate();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setMarkingRead(null);
    }
  };

  const criticalCount = alerts.filter(a => a.alert_type === 'critical').length;
  const errorCount = alerts.filter(a => a.alert_type === 'error').length;
  const warningCount = alerts.filter(a => a.alert_type === 'warning').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/sub-sites">
            <Button variant="outline" size="sm" className="border-slate-700">
              <ArrowLeft className="size-4 mr-2" />
              กลับ
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="size-6 text-amber-400" />
              ศูนย์แจ้งเตือน
            </h1>
            <p className="text-sm text-slate-400">Error Alerts จากทุกเว็บลูก</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => mutate()} className="border-amber-500/30 text-amber-400">
          <RefreshCw className="size-4 mr-2" />
          รีเฟรช
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <XCircle className="size-6 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{criticalCount}</p>
              <p className="text-xs text-red-300">Critical</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/10 border-orange-500/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-12 rounded-full bg-orange-500/20 flex items-center justify-center">
              <AlertCircle className="size-6 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-400">{errorCount}</p>
              <p className="text-xs text-orange-300">Errors</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-12 rounded-full bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="size-6 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-400">{warningCount}</p>
              <p className="text-xs text-amber-300">Warnings</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="size-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <BellOff className="size-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-400">{alerts.filter(a => a.is_read).length}</p>
              <p className="text-xs text-green-300">อ่านแล้ว</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts List */}
      <Card className="bg-black/40 border-amber-500/20">
        <CardHeader>
          <CardTitle className="text-amber-400">รายการแจ้งเตือนล่าสุด</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-amber-400" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-12">
              <Check className="size-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium text-green-400">ไม่มีการแจ้งเตือน</p>
              <p className="text-sm text-slate-400">ระบบทำงานปกติ</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => {
                const config = alertTypeConfig[alert.alert_type];
                const Icon = config.icon;
                const parsedMessage = (() => {
                  try {
                    return JSON.parse(alert.message);
                  } catch {
                    return { message: alert.message };
                  }
                })();

                return (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-xl ${config.bg} border ${config.border} ${alert.is_read ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`size-10 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`size-5 ${config.color}`} />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-white">{alert.title}</h4>
                            <Badge variant="outline" className={`${config.border} ${config.color} text-xs`}>
                              {alert.alert_type}
                            </Badge>
                            {alert.tenants && (
                              <Badge variant="outline" className="border-slate-600 text-slate-400 text-xs">
                                {alert.tenants.name}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-400">{parsedMessage.message}</p>
                          {parsedMessage.path && (
                            <p className="text-xs text-slate-500 font-mono">{parsedMessage.path}</p>
                          )}
                          <p className="text-xs text-slate-500">
                            {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: th })}
                          </p>
                        </div>
                      </div>
                      {!alert.is_read && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkRead(alert.id)}
                          disabled={markingRead === alert.id}
                          className="border-slate-600 text-slate-300 hover:bg-slate-800"
                        >
                          {markingRead === alert.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Check className="size-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
