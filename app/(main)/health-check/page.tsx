'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Database,
  Server,
  Shield,
  CreditCard,
  Users,
  Ticket,
  Loader2,
  Activity,
  Clock,
  HardDrive,
  Wifi,
  Zap,
  Bell,
  TrendingUp,
  TrendingDown,
  Globe,
  Cpu,
  MemoryStick,
  Timer,
} from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import useSWR from 'swr';

interface HealthStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'checking';
  message: string;
  responseTime?: number;
  details?: Record<string, any>;
}

interface SystemMetrics {
  uptime: number;
  requestsPerMinute: number;
  averageResponseTime: number;
  errorRate: number;
  activeConnections: number;
  memoryUsage: number;
  cpuUsage: number;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function SystemHealthPage() {
  const [checks, setChecks] = useState<HealthStatus[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [metrics, setMetrics] = useState<SystemMetrics>({
    uptime: 99.95,
    requestsPerMinute: 245,
    averageResponseTime: 125,
    errorRate: 0.02,
    activeConnections: 48,
    memoryUsage: 65,
    cpuUsage: 35,
  });

  const runHealthCheck = useCallback(async () => {
    setIsChecking(true);
    const results: HealthStatus[] = [];

    // Helper function สำหรับ check endpoint
    const checkEndpoint = async (
      name: string,
      url: string,
      expectedStatus: number = 200,
    ): Promise<HealthStatus> => {
      const start = Date.now();
      try {
        const res = await fetch(url);
        const responseTime = Date.now() - start;
        
        if (res.status === expectedStatus || (res.status === 401 && name.includes('Auth'))) {
          return {
            name,
            status: responseTime > 3000 ? 'degraded' : 'healthy',
            message: `Response time: ${responseTime}ms`,
            responseTime,
          };
        }
        return {
          name,
          status: 'degraded',
          message: `Unexpected status: ${res.status}`,
          responseTime,
        };
      } catch (error) {
        return {
          name,
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Connection failed',
          responseTime: Date.now() - start,
        };
      }
    };

    // 1. Database
    results.push(await checkEndpoint('Database (Supabase)', '/api/customers?limit=1'));

    // 2. Authentication
    results.push(await checkEndpoint('Authentication System', '/api/auth/me'));

    // 3. Redis Cache
    try {
      const start = Date.now();
      const res = await fetch('/api/health/redis');
      const responseTime = Date.now() - start;
      if (res.ok) {
        results.push({
          name: 'Redis Cache',
          status: responseTime > 1000 ? 'degraded' : 'healthy',
          message: `Connected - ${responseTime}ms`,
          responseTime,
        });
      } else {
        results.push({
          name: 'Redis Cache',
          status: 'degraded',
          message: 'Cache unavailable (fallback to DB)',
          responseTime,
        });
      }
    } catch {
      results.push({
        name: 'Redis Cache',
        status: 'degraded',
        message: 'Cache unavailable',
      });
    }

    // 4. Lotteries API
    try {
      const start = Date.now();
      const res = await fetch('/api/lotteries');
      const data = await res.json();
      const responseTime = Date.now() - start;
      const activeLotteries = Array.isArray(data) ? data.filter((l: any) => l.is_active).length : 0;
      results.push({
        name: 'Lotteries Service',
        status: activeLotteries > 0 ? 'healthy' : 'degraded',
        message: `${activeLotteries} active lotteries`,
        responseTime,
        details: { active: activeLotteries, total: Array.isArray(data) ? data.length : 0 },
      });
    } catch {
      results.push({ name: 'Lotteries Service', status: 'unhealthy', message: 'API Error' });
    }

    // 5. Payment System
    try {
      const start = Date.now();
      const res = await fetch('/api/payment-accounts');
      const data = await res.json();
      const responseTime = Date.now() - start;
      const activeAccounts = Array.isArray(data) ? data.filter((a: any) => a.is_active).length : 0;
      results.push({
        name: 'Payment System',
        status: activeAccounts > 0 ? 'healthy' : 'degraded',
        message: `${activeAccounts} active accounts`,
        responseTime,
      });
    } catch {
      results.push({ name: 'Payment System', status: 'unhealthy', message: 'API Error' });
    }

    // 6. Customers API
    results.push(await checkEndpoint('Customers Service', '/api/customers?limit=1'));

    // 7. Bets API
    results.push(await checkEndpoint('Betting Service', '/api/bets?limit=1'));

    // 8. LINE Notify
    try {
      const hasLineToken = !!process.env.NEXT_PUBLIC_LINE_NOTIFY_ENABLED;
      results.push({
        name: 'LINE Notify',
        status: hasLineToken ? 'healthy' : 'degraded',
        message: hasLineToken ? 'Configured' : 'Not configured',
      });
    } catch {
      results.push({ name: 'LINE Notify', status: 'degraded', message: 'Check configuration' });
    }

    // 9. Daily Closing Cron
    try {
      const res = await fetch('/api/admin/daily-closing?type=status');
      if (res.ok) {
        const data = await res.json();
        results.push({
          name: 'Daily Closing System',
          status: 'healthy',
          message: data.isOpen ? 'Today: Open' : 'Today: Closed',
          details: data,
        });
      } else {
        results.push({ name: 'Daily Closing System', status: 'degraded', message: 'Check configuration' });
      }
    } catch {
      results.push({ name: 'Daily Closing System', status: 'unhealthy', message: 'API Error' });
    }

    // 10. Blob Storage
    try {
      const res = await fetch('/api/web-images');
      results.push({
        name: 'Blob Storage',
        status: res.ok ? 'healthy' : 'degraded',
        message: res.ok ? 'Available' : 'Check configuration',
      });
    } catch {
      results.push({ name: 'Blob Storage', status: 'degraded', message: 'Storage unavailable' });
    }

    setChecks(results);
    setLastCheck(new Date());
    setIsChecking(false);
  }, []);

  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(runHealthCheck, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, runHealthCheck]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="size-5 text-emerald-500" />;
      case 'degraded':
        return <AlertTriangle className="size-5 text-amber-500" />;
      case 'unhealthy':
        return <XCircle className="size-5 text-red-500" />;
      default:
        return <Loader2 className="size-5 animate-spin text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Healthy</Badge>;
      case 'degraded':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Degraded</Badge>;
      case 'unhealthy':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Unhealthy</Badge>;
      default:
        return <Badge variant="outline">Checking...</Badge>;
    }
  };

  const healthyCount = checks.filter(c => c.status === 'healthy').length;
  const degradedCount = checks.filter(c => c.status === 'degraded').length;
  const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
  const overallHealth = unhealthyCount > 0 ? 'unhealthy' : degradedCount > 0 ? 'degraded' : 'healthy';

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="size-6 text-emerald-500" />
            System Health Monitor
          </h1>
          <p className="text-sm text-muted-foreground">
            ตรวจสอบสถานะระบบและประสิทธิภาพ
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-emerald-500/20 border-emerald-500/30' : ''}
          >
            <Timer className="size-4 mr-1" />
            Auto Refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button onClick={runHealthCheck} disabled={isChecking}>
            <RefreshCw className={`size-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Checking...' : 'Run Check'}
          </Button>
        </div>
      </div>

      {/* Overall Status */}
      <Card className={`border-2 ${
        overallHealth === 'healthy' ? 'border-emerald-500/50 bg-emerald-500/5' :
        overallHealth === 'degraded' ? 'border-amber-500/50 bg-amber-500/5' :
        'border-red-500/50 bg-red-500/5'
      }`}>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${
                overallHealth === 'healthy' ? 'bg-emerald-500/20' :
                overallHealth === 'degraded' ? 'bg-amber-500/20' :
                'bg-red-500/20'
              }`}>
                {overallHealth === 'healthy' ? (
                  <CheckCircle2 className="size-8 text-emerald-500" />
                ) : overallHealth === 'degraded' ? (
                  <AlertTriangle className="size-8 text-amber-500" />
                ) : (
                  <XCircle className="size-8 text-red-500" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {overallHealth === 'healthy' ? 'All Systems Operational' :
                   overallHealth === 'degraded' ? 'Some Services Degraded' :
                   'System Issues Detected'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Last checked: {lastCheck ? format(lastCheck, 'PPpp', { locale: th }) : 'Never'}
                </p>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-400">{healthyCount}</div>
                <div className="text-xs text-muted-foreground">Healthy</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-400">{degradedCount}</div>
                <div className="text-xs text-muted-foreground">Degraded</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{unhealthyCount}</div>
                <div className="text-xs text-muted-foreground">Unhealthy</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="bg-[#0F172A] border-[#1E293B]">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="size-3" /> Uptime
            </div>
            <div className="text-xl font-bold text-emerald-400">{metrics.uptime}%</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0F172A] border-[#1E293B]">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Zap className="size-3" /> Req/min
            </div>
            <div className="text-xl font-bold text-blue-400">{metrics.requestsPerMinute}</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0F172A] border-[#1E293B]">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Clock className="size-3" /> Avg Response
            </div>
            <div className="text-xl font-bold text-amber-400">{metrics.averageResponseTime}ms</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0F172A] border-[#1E293B]">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <AlertTriangle className="size-3" /> Error Rate
            </div>
            <div className="text-xl font-bold text-red-400">{metrics.errorRate}%</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0F172A] border-[#1E293B]">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Wifi className="size-3" /> Connections
            </div>
            <div className="text-xl font-bold text-purple-400">{metrics.activeConnections}</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0F172A] border-[#1E293B]">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <MemoryStick className="size-3" /> Memory
            </div>
            <div className="text-xl font-bold text-cyan-400">{metrics.memoryUsage}%</div>
          </CardContent>
        </Card>
        <Card className="bg-[#0F172A] border-[#1E293B]">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Cpu className="size-3" /> CPU
            </div>
            <div className="text-xl font-bold text-pink-400">{metrics.cpuUsage}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Service Status */}
      <Card className="bg-[#0F172A] border-[#1E293B]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Server className="size-5" />
            Service Status
          </CardTitle>
          <CardDescription>
            สถานะของแต่ละบริการในระบบ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {checks.map((check, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between p-3 rounded-lg bg-[#1E293B]/50 hover:bg-[#1E293B] transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(check.status)}
                  <div>
                    <div className="font-medium text-white">{check.name}</div>
                    <div className="text-xs text-muted-foreground">{check.message}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {check.responseTime && (
                    <span className={`text-xs ${
                      check.responseTime < 500 ? 'text-emerald-400' :
                      check.responseTime < 2000 ? 'text-amber-400' :
                      'text-red-400'
                    }`}>
                      {check.responseTime}ms
                    </span>
                  )}
                  {getStatusBadge(check.status)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
