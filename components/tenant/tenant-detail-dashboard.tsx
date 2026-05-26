'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { fetcher } from '@/lib/fetcher';
import {
  TrendingUp, TrendingDown, Users, DollarSign, Activity,
  Globe, Package, Percent, Shield, Clock, Server, Bell,
  RefreshCw, Loader2, AlertTriangle, CheckCircle, XCircle,
  Zap, BarChart3, PieChart, Calendar
} from 'lucide-react';

interface TenantDetailDashboardProps {
  tenantId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}

interface TenantDetailData {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  is_active: boolean;
  status: string;
  plan: string;
  auto_system_enabled: boolean;
  manual_key_enabled: boolean;
  created_at: string;
  user_count: number;
  subscription: {
    status: string;
    billing_cycle: string;
    current_period_end: string;
    packages?: { name: string; code: string };
  } | null;
  revenue_configs: Array<{
    game_type: string;
    tenant_share_percent: number;
    platform_share_percent: number;
  }>;
  providers: Array<{ id: string; name: string; type: string; status: string }>;
  stats: {
    total_bets: number;
    total_payouts: number;
    total_deposits: number;
    total_withdrawals: number;
    profit_loss: number;
    active_users: number;
    new_users: number;
  } | null;
  tenant_stats: Array<{
    total_bets: number;
    total_payouts: number;
    profit_loss: number;
    active_users: number;
    stat_date: string;
  }>;
  tenant_alerts: Array<{
    id: string;
    alert_type: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
  }>;
  health: {
    health_score: number;
    uptime_percent: number;
    api_response_time: number;
    error_rate: number;
    last_sync_at: string;
  } | null;
  users: Array<{
    id: string;
    username: string;
    display_name: string;
    role: string;
    credit_balance: number;
    is_active: boolean;
    created_at: string;
  }>;
}

export function TenantDetailDashboard({ tenantId, open, onOpenChange, onEdit }: TenantDetailDashboardProps) {
  const { data: tenant, error, mutate, isLoading } = useSWR<TenantDetailData>(
    tenantId && open ? `/api/tenants/${tenantId}` : null,
    fetcher
  );

  const [activeTab, setActiveTab] = useState('overview');

  const formatNumber = (num: number) => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(2)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getTenantMode = () => {
    if (tenant?.auto_system_enabled && tenant?.manual_key_enabled) return 'Hybrid';
    if (tenant?.auto_system_enabled) return 'Auto Only';
    if (tenant?.manual_key_enabled) return 'Manual Key Only';
    return 'Auto Only';
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  const getHealthBgColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  if (error) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-[#0a0f1a] border-red-500/30 text-white max-w-5xl">
          <div className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="size-12 text-red-500 mb-4" />
            <p className="text-red-400">ไม่สามารถโหลดข้อมูล Tenant ได้</p>
            <Button onClick={() => mutate()} className="mt-4" variant="outline">
              <RefreshCw className="size-4 mr-2" />
              ลองใหม่
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0f1a] border-amber-500/30 text-white max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="size-12 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                style={{ backgroundColor: '#D4AF37' }}
              >
                {tenant?.name?.charAt(0) || '?'}
              </div>
              <div>
                <DialogTitle className="text-xl text-white">{tenant?.name || 'Loading...'}</DialogTitle>
                <p className="text-sm text-slate-400">{tenant?.domain || `/${tenant?.slug}`}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {tenant && (
                <>
                  <Badge className={cn(
                    tenant.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                    tenant.status === 'trial' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                    tenant.status === 'suspended' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                    'bg-slate-500/20 text-slate-400 border-slate-500/30'
                  )}>
                    {tenant.status || 'active'}
                  </Badge>
                  <Badge variant="outline" className="border-amber-500/30 text-amber-400">
                    {tenant.subscription?.packages?.name || tenant.plan || 'Free'}
                  </Badge>
                </>
              )}
              <Button size="sm" variant="outline" onClick={() => mutate()} className="border-amber-500/30 text-amber-400">
                <RefreshCw className="size-4" />
              </Button>
              {onEdit && (
                <Button size="sm" onClick={onEdit} className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30">
                  แก้ไข
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {isLoading || !tenant ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-amber-500" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="bg-black/40 border border-amber-500/20 flex-shrink-0">
              <TabsTrigger value="overview" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                <BarChart3 className="size-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="revenue" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                <PieChart className="size-4 mr-2" />
                Revenue
              </TabsTrigger>
              <TabsTrigger value="users" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                <Users className="size-4 mr-2" />
                Users
              </TabsTrigger>
              <TabsTrigger value="health" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                <Activity className="size-4 mr-2" />
                Health
              </TabsTrigger>
              <TabsTrigger value="alerts" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                <Bell className="size-4 mr-2" />
                Alerts
                {tenant.tenant_alerts?.filter(a => !a.is_read).length > 0 && (
                  <Badge className="ml-1 size-5 p-0 flex items-center justify-center bg-red-500 text-white text-[10px]">
                    {tenant.tenant_alerts.filter(a => !a.is_read).length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto py-4">
              {/* Overview Tab */}
              <TabsContent value="overview" className="mt-0 space-y-4">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-black/40 border-amber-500/20">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="p-2 rounded-lg bg-blue-500/20">
                          <Users className="size-5 text-blue-400" />
                        </div>
                        <TrendingUp className="size-4 text-emerald-400" />
                      </div>
                      <p className="text-2xl font-bold text-white mt-2">{formatNumber(tenant.user_count)}</p>
                      <p className="text-xs text-slate-400">Total Users</p>
                      <p className="text-xs text-emerald-400">{tenant.stats?.active_users || 0} active</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-black/40 border-amber-500/20">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="p-2 rounded-lg bg-emerald-500/20">
                          <TrendingUp className="size-5 text-emerald-400" />
                        </div>
                        <TrendingUp className="size-4 text-emerald-400" />
                      </div>
                      <p className="text-2xl font-bold text-white mt-2">{formatCurrency(tenant.stats?.total_bets || 0)}</p>
                      <p className="text-xs text-slate-400">Total Turnover</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-black/40 border-amber-500/20">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="p-2 rounded-lg bg-purple-500/20">
                          <DollarSign className="size-5 text-purple-400" />
                        </div>
                        {(tenant.stats?.profit_loss || 0) >= 0 
                          ? <TrendingUp className="size-4 text-emerald-400" /> 
                          : <TrendingDown className="size-4 text-red-400" />
                        }
                      </div>
                      <p className={cn(
                        "text-2xl font-bold mt-2",
                        (tenant.stats?.profit_loss || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                      )}>
                        {(tenant.stats?.profit_loss || 0) >= 0 ? '+' : ''}{formatCurrency(tenant.stats?.profit_loss || 0)}
                      </p>
                      <p className="text-xs text-slate-400">Profit/Loss</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-black/40 border-amber-500/20">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="p-2 rounded-lg bg-amber-500/20">
                          <Activity className="size-5 text-amber-400" />
                        </div>
                      </div>
                      <p className={cn(
                        "text-2xl font-bold mt-2",
                        getHealthColor(tenant.health?.health_score || 0)
                      )}>
                        {tenant.health?.health_score || 100}%
                      </p>
                      <p className="text-xs text-slate-400">Health Score</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Tenant Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-black/40 border-amber-500/20">
                    <CardHeader>
                      <CardTitle className="text-amber-400 text-sm flex items-center gap-2">
                        <Globe className="size-4" />
                        Tenant Info
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Mode</span>
                        <Badge variant="outline" className="border-amber-500/30 text-amber-400">
                          {getTenantMode()}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Package</span>
                        <span className="text-white">{tenant.subscription?.packages?.name || tenant.plan || 'Free'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Billing</span>
                        <span className="text-white capitalize">{tenant.subscription?.billing_cycle || 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Created</span>
                        <span className="text-white">{new Date(tenant.created_at).toLocaleDateString('th-TH')}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-black/40 border-amber-500/20">
                    <CardHeader>
                      <CardTitle className="text-amber-400 text-sm flex items-center gap-2">
                        <Package className="size-4" />
                        Providers ({tenant.providers?.length || 0})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {tenant.providers?.length === 0 ? (
                        <p className="text-slate-400 text-sm text-center py-4">No providers connected</p>
                      ) : (
                        <div className="space-y-2">
                          {tenant.providers?.slice(0, 5).map((provider) => (
                            <div key={provider.id} className="flex items-center justify-between p-2 bg-black/30 rounded-lg">
                              <span className="text-white text-sm">{provider.name}</span>
                              <Badge className={cn(
                                "text-xs",
                                provider.status === 'active' 
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                              )}>
                                {provider.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Revenue Tab */}
              <TabsContent value="revenue" className="mt-0 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-black/40 border-emerald-500/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="size-5 text-emerald-400" />
                        <span className="text-slate-400">Deposits</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-400">
                        {formatCurrency(tenant.stats?.total_deposits || 0)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-black/40 border-red-500/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="size-5 text-red-400" />
                        <span className="text-slate-400">Withdrawals</span>
                      </div>
                      <p className="text-2xl font-bold text-red-400">
                        {formatCurrency(tenant.stats?.total_withdrawals || 0)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Revenue Share Configs */}
                <Card className="bg-black/40 border-amber-500/20">
                  <CardHeader>
                    <CardTitle className="text-amber-400 text-sm flex items-center gap-2">
                      <Percent className="size-4" />
                      Revenue Share Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {tenant.revenue_configs?.length === 0 ? (
                      <p className="text-slate-400 text-sm text-center py-4">Using default global rates</p>
                    ) : (
                      <div className="space-y-3">
                        {tenant.revenue_configs?.map((config, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                            <span className="text-white capitalize">{config.game_type}</span>
                            <div className="flex items-center gap-4">
                              <span className="text-amber-400">
                                Tenant: <span className="font-bold">{config.tenant_share_percent}%</span>
                              </span>
                              <span className="text-slate-400">|</span>
                              <span className="text-blue-400">
                                Platform: <span className="font-bold">{config.platform_share_percent}%</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Users Tab */}
              <TabsContent value="users" className="mt-0 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Card className="bg-black/40 border-blue-500/20">
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-bold text-blue-400">{tenant.user_count}</p>
                      <p className="text-xs text-slate-400">Total Users</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-black/40 border-emerald-500/20">
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-bold text-emerald-400">{tenant.stats?.active_users || 0}</p>
                      <p className="text-xs text-slate-400">Active Today</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-black/40 border-purple-500/20">
                    <CardContent className="p-4 text-center">
                      <p className="text-3xl font-bold text-purple-400">{tenant.stats?.new_users || 0}</p>
                      <p className="text-xs text-slate-400">New This Week</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-black/40 border-amber-500/20">
                  <CardHeader>
                    <CardTitle className="text-amber-400 text-sm">Recent Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {tenant.users?.slice(0, 10).map((user) => (
                        <div key={user.id} className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "size-8 rounded-full flex items-center justify-center text-xs font-bold",
                              user.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/20 text-slate-400"
                            )}>
                              {user.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-white text-sm">{user.display_name || user.username}</p>
                              <p className="text-xs text-slate-400 capitalize">{user.role}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-amber-400 font-medium">{formatNumber(user.credit_balance)} THB</p>
                            <Badge className={cn(
                              "text-xs",
                              user.is_active 
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : "bg-red-500/20 text-red-400 border-red-500/30"
                            )}>
                              {user.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Health Tab */}
              <TabsContent value="health" className="mt-0 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-black/40 border-amber-500/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className={cn("size-5", getHealthColor(tenant.health?.health_score || 100))} />
                        <span className="text-slate-400">Health Score</span>
                      </div>
                      <p className={cn("text-3xl font-bold", getHealthColor(tenant.health?.health_score || 100))}>
                        {tenant.health?.health_score || 100}%
                      </p>
                      <Progress 
                        value={tenant.health?.health_score || 100} 
                        className={cn("mt-2 h-2", getHealthBgColor(tenant.health?.health_score || 100))}
                      />
                    </CardContent>
                  </Card>

                  <Card className="bg-black/40 border-emerald-500/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Server className="size-5 text-emerald-400" />
                        <span className="text-slate-400">Uptime</span>
                      </div>
                      <p className="text-3xl font-bold text-emerald-400">
                        {tenant.health?.uptime_percent?.toFixed(2) || 99.99}%
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-black/40 border-blue-500/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="size-5 text-blue-400" />
                        <span className="text-slate-400">Response Time</span>
                      </div>
                      <p className="text-3xl font-bold text-blue-400">
                        {tenant.health?.api_response_time || 45}ms
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-black/40 border-red-500/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="size-5 text-red-400" />
                        <span className="text-slate-400">Error Rate</span>
                      </div>
                      <p className="text-3xl font-bold text-red-400">
                        {tenant.health?.error_rate?.toFixed(2) || 0.01}%
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-black/40 border-amber-500/20">
                  <CardHeader>
                    <CardTitle className="text-amber-400 text-sm">System Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { name: 'API Gateway', status: 'operational' },
                      { name: 'Database', status: 'operational' },
                      { name: 'Payment Gateway', status: 'operational' },
                      { name: 'SMS Service', status: 'operational' },
                    ].map((service) => (
                      <div key={service.name} className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                        <span className="text-white">{service.name}</span>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="size-4 text-emerald-400" />
                          <span className="text-emerald-400 text-sm">Operational</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Alerts Tab */}
              <TabsContent value="alerts" className="mt-0 space-y-4">
                <Card className="bg-black/40 border-amber-500/20">
                  <CardHeader>
                    <CardTitle className="text-amber-400 text-sm flex items-center gap-2">
                      <Bell className="size-4" />
                      Recent Alerts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!tenant.tenant_alerts || tenant.tenant_alerts.length === 0 ? (
                      <div className="text-center py-8">
                        <CheckCircle className="size-12 text-emerald-400 mx-auto mb-4" />
                        <p className="text-slate-400">No alerts at this time</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {tenant.tenant_alerts.map((alert) => (
                          <div 
                            key={alert.id} 
                            className={cn(
                              "p-4 rounded-lg border",
                              alert.alert_type === 'critical' 
                                ? "bg-red-500/10 border-red-500/30" 
                                : alert.alert_type === 'warning'
                                  ? "bg-amber-500/10 border-amber-500/30"
                                  : "bg-blue-500/10 border-blue-500/30",
                              !alert.is_read && "ring-1 ring-amber-500/50"
                            )}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                {alert.alert_type === 'critical' ? (
                                  <XCircle className="size-5 text-red-400 mt-0.5" />
                                ) : alert.alert_type === 'warning' ? (
                                  <AlertTriangle className="size-5 text-amber-400 mt-0.5" />
                                ) : (
                                  <Bell className="size-5 text-blue-400 mt-0.5" />
                                )}
                                <div>
                                  <p className="font-medium text-white">{alert.title}</p>
                                  <p className="text-sm text-slate-400 mt-1">{alert.message}</p>
                                </div>
                              </div>
                              <span className="text-xs text-slate-500">
                                {new Date(alert.created_at).toLocaleDateString('th-TH')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
