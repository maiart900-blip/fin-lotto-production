'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, ShieldAlert, ShieldOff, ShieldCheck,
  Lock, Unlock, Ban, RefreshCw, AlertTriangle,
  Activity, Wifi, WifiOff, Users, Clock,
  CheckCircle, XCircle, Eye, Trash2, Power
} from 'lucide-react';
import { toast } from 'sonner';

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  description: string;
  ip_address: string;
  created_at: string;
  is_resolved: boolean;
}

interface BlockedIP {
  id: string;
  ip_address: string;
  reason: string;
  blocked_until: string;
  created_at: string;
}

interface LockedAccount {
  id: string;
  reason: string;
  locked_until: string;
  users?: { username: string; name: string };
  customers?: { username: string; name: string; phone: string };
}

export default function SecurityDashboardPage() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [lockedAccounts, setLockedAccounts] = useState<LockedAccount[]>([]);
  const [safeMode, setSafeMode] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [eventsRes, ipsRes, accountsRes, safeModeRes, settingsRes] = await Promise.all([
        fetch('/api/security/events?limit=50'),
        fetch('/api/security/blocked-ips'),
        fetch('/api/security/locked-accounts'),
        fetch('/api/security/safe-mode'),
        fetch('/api/security/settings'),
      ]);

      setEvents(await eventsRes.json());
      setBlockedIPs(await ipsRes.json());
      setLockedAccounts(await accountsRes.json());
      const safeModeData = await safeModeRes.json();
      setSafeMode(safeModeData.enabled);
      setSettings(await settingsRes.json());
    } catch (error) {
      console.error('Error fetching security data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const unblockIP = async (ip: string) => {
    setActionLoading(ip);
    try {
      await fetch(`/api/security/blocked-ips?ip=${ip}`, { method: 'DELETE' });
      toast.success(`ปลดบล็อค IP ${ip} แล้ว`);
      fetchData();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setActionLoading(null);
    }
  };

  const unlockAccount = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch(`/api/security/locked-accounts?id=${id}`, { method: 'DELETE' });
      toast.success('ปลดล็อคบัญชีแล้ว');
      fetchData();
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleSafeMode = async () => {
    setActionLoading('safe-mode');
    try {
      await fetch('/api/security/safe-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enable: !safeMode,
          reason: safeMode ? 'ปิด Safe Mode โดย Admin' : 'เปิด Safe Mode โดย Admin',
        }),
      });
      setSafeMode(!safeMode);
      toast.success(safeMode ? 'ปิด Safe Mode แล้ว' : 'เปิด Safe Mode แล้ว');
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setActionLoading(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const criticalEvents = events.filter(e => e.severity === 'critical');
  const highEvents = events.filter(e => e.severity === 'high');

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <RefreshCw className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="size-6" />
            Security Dashboard
          </h1>
          <p className="text-muted-foreground">ตรวจสอบและจัดการความปลอดภัยระบบ</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="size-4 mr-2" />
            รีเฟรช
          </Button>
          <Button 
            variant={safeMode ? 'destructive' : 'outline'}
            onClick={toggleSafeMode}
            disabled={actionLoading === 'safe-mode'}
          >
            <Power className="size-4 mr-2" />
            {safeMode ? 'ปิด Safe Mode' : 'เปิด Safe Mode'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={safeMode ? 'border-red-500 bg-red-500/10' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {safeMode ? (
                <ShieldAlert className="size-10 text-red-500" />
              ) : (
                <ShieldCheck className="size-10 text-green-500" />
              )}
              <div>
                <p className="text-sm text-muted-foreground">Safe Mode</p>
                <p className="text-xl font-bold">{safeMode ? 'เปิด' : 'ปิด'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={criticalEvents.length > 0 ? 'border-red-500' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`size-10 ${criticalEvents.length > 0 ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`} />
              <div>
                <p className="text-sm text-muted-foreground">Critical Events</p>
                <p className="text-xl font-bold">{criticalEvents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <WifiOff className="size-10 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">IP ถูกบล็อค</p>
                <p className="text-xl font-bold">{blockedIPs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Lock className="size-10 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">บัญชีถูกล็อค</p>
                <p className="text-xl font-bold">{lockedAccounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events" className="gap-2">
            <Activity className="size-4" />
            Security Events ({events.length})
          </TabsTrigger>
          <TabsTrigger value="blocked" className="gap-2">
            <Ban className="size-4" />
            IP ถูกบล็อค ({blockedIPs.length})
          </TabsTrigger>
          <TabsTrigger value="locked" className="gap-2">
            <Lock className="size-4" />
            บัญชีถูกล็อค ({lockedAccounts.length})
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Shield className="size-4" />
            ตั้งค่า
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Events ล่าสุด</CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShieldCheck className="size-12 mx-auto mb-2 text-green-500" />
                  <p>ไม่พบเหตุการณ์ความปลอดภัย</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {events.map(event => (
                    <div key={event.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge className={getSeverityColor(event.severity)}>
                          {event.severity.toUpperCase()}
                        </Badge>
                        <div>
                          <p className="font-medium">{event.event_type}</p>
                          <p className="text-sm text-muted-foreground">{event.description}</p>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-mono">{event.ip_address || '-'}</p>
                        <p className="text-muted-foreground">
                          {new Date(event.created_at).toLocaleString('th-TH')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocked" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>IP ที่ถูกบล็อค</CardTitle>
            </CardHeader>
            <CardContent>
              {blockedIPs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Wifi className="size-12 mx-auto mb-2 text-green-500" />
                  <p>ไม่มี IP ถูกบล็อค</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {blockedIPs.map(ip => (
                    <div key={ip.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-mono font-medium">{ip.ip_address}</p>
                        <p className="text-sm text-muted-foreground">{ip.reason}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right text-sm">
                          <p className="text-muted-foreground">
                            หมดเวลา: {ip.blocked_until ? new Date(ip.blocked_until).toLocaleString('th-TH') : 'ถาวร'}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => unblockIP(ip.ip_address)}
                          disabled={actionLoading === ip.ip_address}
                        >
                          <Unlock className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locked" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>บัญชีที่ถูกล็อค</CardTitle>
            </CardHeader>
            <CardContent>
              {lockedAccounts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="size-12 mx-auto mb-2 text-green-500" />
                  <p>ไม่มีบัญชีถูกล็อค</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {lockedAccounts.map(account => (
                    <div key={account.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">
                          {account.users?.name || account.customers?.name || '-'}
                          <span className="text-muted-foreground ml-2">
                            ({account.users?.username || account.customers?.phone || '-'})
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground">{account.reason}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right text-sm">
                          <p className="text-muted-foreground">
                            หมดเวลา: {account.locked_until ? new Date(account.locked_until).toLocaleString('th-TH') : 'ถาวร'}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => unlockAccount(account.id)}
                          disabled={actionLoading === account.id}
                        >
                          <Unlock className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>ตั้งค่าความปลอดภัย</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {Object.entries(settings).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{key.replace(/_/g, ' ').toUpperCase()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{value}</Badge>
                    </div>
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
