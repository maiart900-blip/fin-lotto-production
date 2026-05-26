'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, Users, DollarSign, TrendingUp, AlertTriangle, Clock, Activity, Shield } from 'lucide-react'

interface KPIData {
  activeUsers: number
  bettingVolume: number
  payoutTotal: number
  currentExposure: number
  avgSettlementMs: number
  failedJobs: number
  recentActivity: number
  uptime: number
  systemHealth: 'healthy' | 'degraded' | 'critical'
  disabledControls: string[]
}

export default function KPIDashboardPage() {
  const [kpis, setKpis] = useState<KPIData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchKPIs = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/operations/kpi')
      const data = await res.json()
      if (data.success) {
        setKpis(data.kpis)
        setLastUpdate(new Date())
      }
    } catch (e) {
      console.error('Failed to fetch KPIs:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKPIs()
    const interval = setInterval(fetchKPIs, 30000) // Auto-refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const formatNumber = (n: number) => new Intl.NumberFormat('th-TH').format(n)
  const formatCurrency = (n: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(n)

  const healthColors = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    critical: 'bg-red-500',
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Operational KPI Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time business metrics and system health
            {lastUpdate && ` - Updated ${lastUpdate.toLocaleTimeString('th-TH')}`}
          </p>
        </div>
        <Button onClick={fetchKPIs} disabled={loading} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* System Health Banner */}
      {kpis && (
        <Card className={`border-2 ${kpis.systemHealth === 'healthy' ? 'border-green-500' : kpis.systemHealth === 'degraded' ? 'border-yellow-500' : 'border-red-500'}`}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${healthColors[kpis.systemHealth]} animate-pulse`} />
              <span className="font-semibold">
                System Status: {kpis.systemHealth === 'healthy' ? 'All Systems Operational' : 
                              kpis.systemHealth === 'degraded' ? 'Some Features Disabled' : 'Critical Issues'}
              </span>
            </div>
            <Badge variant={kpis.systemHealth === 'healthy' ? 'default' : 'destructive'}>
              {kpis.uptime}% Uptime
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Main KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="w-4 h-4" /> Active Users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{kpis ? formatNumber(kpis.activeUsers) : '-'}</div>
            <p className="text-sm text-muted-foreground">Total registered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Betting Volume
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{kpis ? formatCurrency(kpis.bettingVolume) : '-'}</div>
            <p className="text-sm text-muted-foreground">Today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Payouts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{kpis ? formatCurrency(kpis.payoutTotal) : '-'}</div>
            <p className="text-sm text-muted-foreground">Today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Current Exposure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${kpis && kpis.currentExposure > 50000 ? 'text-red-600' : 'text-orange-600'}`}>
              {kpis ? formatCurrency(kpis.currentExposure) : '-'}
            </div>
            <p className="text-sm text-muted-foreground">Pending bets</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="w-4 h-4" /> Settlement Speed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpis ? (kpis.avgSettlementMs / 1000).toFixed(1) + 's' : '-'}
            </div>
            <p className="text-sm text-muted-foreground">Avg processing time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Activity className="w-4 h-4" /> Recent Activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis ? formatNumber(kpis.recentActivity) : '-'}</div>
            <p className="text-sm text-muted-foreground">Entries last hour</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Shield className="w-4 h-4" /> Failed Jobs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${kpis && kpis.failedJobs > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {kpis ? kpis.failedJobs : '-'}
            </div>
            <p className="text-sm text-muted-foreground">Last hour</p>
          </CardContent>
        </Card>
      </div>

      {/* Disabled Controls Warning */}
      {kpis && kpis.disabledControls.length > 0 && (
        <Card className="border-yellow-500">
          <CardHeader>
            <CardTitle className="text-yellow-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Disabled Controls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {kpis.disabledControls.map(control => (
                <Badge key={control} variant="outline" className="border-yellow-500 text-yellow-600">
                  {control}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              These controls are currently disabled. Enable via Master Control panel.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
