'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  RefreshCw, 
  Server,
  TrendingUp,
  Zap,
  XCircle,
  Database,
  Gauge,
} from 'lucide-react';
import { fetcher } from '@/lib/fetcher';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

interface RealtimeMetrics {
  total_requests: number;
  success_count: number;
  error_count: number;
  avg_duration_ms: number;
  p95_duration_ms: number;
  requests_per_minute: number;
  error_rate: number;
  top_endpoints: Array<{ path: string; count: number; avg_ms: number }>;
  recent_errors: Array<{ path: string; status: number; message: string; time: string }>;
}

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Array<{ name: string; status: string; latency_ms: number }>;
}

interface HistoricalData {
  hourly: Array<{ hour: string; requests: number; errors: number; avg_ms: number }>;
  slowest: Array<{ path: string; duration_ms: number; time: string }>;
  errorsByPath: Array<{ path: string; count: number }>;
}

export default function MonitoringDashboardPage() {
  const { isSuperAdmin } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Real-time metrics (refresh every 10 seconds)
  const { data: realtimeData, mutate: mutateRealtime } = useSWR<{ success: boolean; data: RealtimeMetrics }>(
    '/api/monitoring?type=realtime',
    fetcher,
    { refreshInterval: 10000 }
  );

  // Health check (refresh every 30 seconds)
  const { data: healthData, mutate: mutateHealth } = useSWR<{ success: boolean; data: HealthCheck }>(
    '/api/monitoring?type=health',
    fetcher,
    { refreshInterval: 30000 }
  );

  // Historical data (refresh every 60 seconds)
  const { data: historicalData, mutate: mutateHistorical } = useSWR<{ success: boolean; data: HistoricalData }>(
    '/api/monitoring?type=historical&hours=24',
    fetcher,
    { refreshInterval: 60000 }
  );

  const metrics = realtimeData?.data;
  const health = healthData?.data;
  const historical = historicalData?.data;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([mutateRealtime(), mutateHealth(), mutateHistorical()]);
    setIsRefreshing(false);
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <XCircle className="h-12 w-12 text-destructive" />
              <h2 className="text-xl font-semibold">Access Denied</h2>
              <p className="text-muted-foreground">
                You need Super Admin privileges to view this page.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Monitoring</h1>
          <p className="text-muted-foreground">Real-time system health and performance metrics</p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline">
          <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Health Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              System Health
            </CardTitle>
            {health && (
              <Badge 
                variant={health.status === 'healthy' ? 'default' : health.status === 'degraded' ? 'secondary' : 'destructive'}
                className={cn(
                  health.status === 'healthy' && 'bg-green-500',
                  health.status === 'degraded' && 'bg-yellow-500',
                )}
              >
                {health.status === 'healthy' && <CheckCircle className="h-3 w-3 mr-1" />}
                {health.status === 'degraded' && <AlertTriangle className="h-3 w-3 mr-1" />}
                {health.status === 'unhealthy' && <XCircle className="h-3 w-3 mr-1" />}
                {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {health?.checks.map((check) => (
              <div key={check.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                {check.status === 'ok' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <p className="font-medium">{check.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {check.latency_ms >= 0 ? `${check.latency_ms}ms` : 'Error'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Requests"
          value={metrics?.total_requests?.toLocaleString() || '0'}
          subtitle="Today"
          icon={<Activity className="h-4 w-4" />}
        />
        <MetricCard
          title="Error Rate"
          value={`${metrics?.error_rate || 0}%`}
          subtitle={`${metrics?.error_count || 0} errors`}
          icon={<AlertTriangle className="h-4 w-4" />}
          alert={metrics?.error_rate ? metrics.error_rate > 5 : false}
        />
        <MetricCard
          title="Avg Response"
          value={`${metrics?.avg_duration_ms || 0}ms`}
          subtitle={`P95: ${metrics?.p95_duration_ms || 0}ms`}
          icon={<Clock className="h-4 w-4" />}
          alert={metrics?.avg_duration_ms ? metrics.avg_duration_ms > 1000 : false}
        />
        <MetricCard
          title="Requests/min"
          value={metrics?.requests_per_minute?.toString() || '0'}
          subtitle="Current rate"
          icon={<Zap className="h-4 w-4" />}
        />
      </div>

      {/* Tabs for detailed views */}
      <Tabs defaultValue="endpoints" className="w-full">
        <TabsList>
          <TabsTrigger value="endpoints">Top Endpoints</TabsTrigger>
          <TabsTrigger value="errors">Recent Errors</TabsTrigger>
          <TabsTrigger value="slow">Slow Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="endpoints" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Top Endpoints
              </CardTitle>
              <CardDescription>Most accessed API endpoints today</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metrics?.top_endpoints && metrics.top_endpoints.length > 0 ? (
                  metrics.top_endpoints.map((endpoint, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground w-6">#{i + 1}</span>
                        <code className="text-sm font-mono">{endpoint.path}</code>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="secondary">{endpoint.count} requests</Badge>
                        <span className="text-sm text-muted-foreground">{endpoint.avg_ms}ms avg</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">No endpoint data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Recent Errors
              </CardTitle>
              <CardDescription>Latest API errors</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metrics?.recent_errors && metrics.recent_errors.length > 0 ? (
                  metrics.recent_errors.map((error, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                      <div className="flex items-center gap-3">
                        <Badge variant="destructive">{error.status}</Badge>
                        <code className="text-sm font-mono">{error.path}</code>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {error.message}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(error.time).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">No recent errors</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="slow" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                Slowest Requests
              </CardTitle>
              <CardDescription>Requests with highest response time (24h)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {historical?.slowest && historical.slowest.length > 0 ? (
                  historical.slowest.map((req, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground w-6">#{i + 1}</span>
                        <code className="text-sm font-mono">{req.path}</code>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant={req.duration_ms > 2000 ? 'destructive' : 'secondary'}>
                          {req.duration_ms}ms
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(req.time).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">No slow request data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Metric Card Component
function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon,
  alert = false,
}: { 
  title: string; 
  value: string; 
  subtitle: string; 
  icon: React.ReactNode;
  alert?: boolean;
}) {
  return (
    <Card className={cn(alert && 'border-red-500')}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={cn("text-2xl font-bold", alert && "text-red-500")}>{value}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className={cn("p-3 rounded-full bg-muted", alert && "bg-red-100 text-red-500")}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
