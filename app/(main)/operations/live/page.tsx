"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Activity, 
  Users, 
  AlertTriangle,
  TrendingUp,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Bell,
  Shield,
  Zap,
  Database,
  Server,
  AlertCircle
} from "lucide-react"

interface LiveMetrics {
  activeCustomers: number
  activeAgents: number
  betsPerMinute: number
  totalExposure: number
  pendingSettlements: number
  payoutQueue: { count: number; amount: number }
  failedPayouts: number
  depositStats: {
    pending: number
    pendingAmount: number
    completed: number
    completedAmount: number
    failed: number
  }
  withdrawStats: {
    pending: number
    pendingAmount: number
    completed: number
    completedAmount: number
    failed: number
  }
  topRiskNumbers: Array<{ number: string; exposure: number }>
  systemHealth: {
    status: "healthy" | "degraded" | "unhealthy"
    redis: { latency_ms: number; status: string }
    database: { latency_ms: number; status: string }
  }
}

interface Alert {
  id: string
  alert_type: string
  severity: "info" | "warning" | "critical"
  title: string
  message: string
  data: Record<string, unknown>
  is_acknowledged: boolean
  created_at: string
}

const alertTypeLabels: Record<string, string> = {
  payout_spike: "Payout Spike",
  high_exposure: "High Exposure",
  failed_payouts: "Failed Payouts",
  failed_deposits: "Failed Deposits",
  failed_withdrawals: "Failed Withdrawals",
  rapid_betting: "Rapid Betting",
  settlement_failure: "Settlement Failure",
}

export default function LiveOperationsPage() {
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchMetrics = useCallback(async () => {
    try {
      const [metricsRes, alertsRes] = await Promise.all([
        fetch("/api/operations/live"),
        fetch("/api/operations/alerts"),
      ])
      
      const metricsData = await metricsRes.json()
      const alertsData = await alertsRes.json()
      
      if (metricsData.success) {
        setMetrics(metricsData.metrics)
      }
      if (alertsData.success) {
        setAlerts(alertsData.alerts || [])
      }
      setLastUpdate(new Date())
    } catch (error) {
      console.error("Error fetching metrics:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 15000) // refresh every 15 seconds
    return () => clearInterval(interval)
  }, [fetchMetrics])

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await fetch("/api/operations/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge", alert_id: alertId }),
      })
      setAlerts(prev => prev.filter(a => a.id !== alertId))
    } catch (error) {
      console.error("Error acknowledging alert:", error)
    }
  }

  const runAlertCheck = async () => {
    try {
      await fetch("/api/operations/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check" }),
      })
      await fetchMetrics()
    } catch (error) {
      console.error("Error running alert check:", error)
    }
  }

  const formatNumber = (n: number) => n.toLocaleString("th-TH")
  const formatCurrency = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2 })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const criticalAlerts = alerts.filter(a => a.severity === "critical")
  const warningAlerts = alerts.filter(a => a.severity === "warning")

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Live Operations</h1>
          <p className="text-muted-foreground">
            Real-time monitoring dashboard
            {lastUpdate && ` - Updated ${lastUpdate.toLocaleTimeString("th-TH")}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={runAlertCheck}>
            <Bell className="h-4 w-4 mr-2" />
            Check Alerts
          </Button>
          <Button variant="outline" size="sm" onClick={fetchMetrics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
          <div className="flex items-center gap-2 text-destructive font-semibold mb-2">
            <AlertTriangle className="h-5 w-5" />
            {criticalAlerts.length} Critical Alert{criticalAlerts.length > 1 ? "s" : ""}
          </div>
          <div className="space-y-2">
            {criticalAlerts.map(alert => (
              <div key={alert.id} className="flex items-center justify-between bg-background rounded p-2">
                <div>
                  <span className="font-medium">{alert.title}</span>
                  <span className="text-muted-foreground ml-2">{alert.message}</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => acknowledgeAlert(alert.id)}>
                  Acknowledge
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Health */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${
                metrics?.systemHealth.status === "healthy" ? "bg-green-500" :
                metrics?.systemHealth.status === "degraded" ? "bg-yellow-500" : "bg-red-500"
              }`} />
              <span className="font-medium capitalize">{metrics?.systemHealth.status}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span>DB: {metrics?.systemHealth.database.latency_ms}ms</span>
                {metrics?.systemHealth.database.status === "ok" ? 
                  <CheckCircle className="h-4 w-4 text-green-500" /> : 
                  <XCircle className="h-4 w-4 text-red-500" />
                }
              </div>
              <div className="flex items-center gap-1">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span>Redis: {metrics?.systemHealth.redis.latency_ms}ms</span>
                {metrics?.systemHealth.redis.status === "ok" ? 
                  <CheckCircle className="h-4 w-4 text-green-500" /> : 
                  <XCircle className="h-4 w-4 text-red-500" />
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Users className="h-4 w-4" />
              Active Customers
            </div>
            <div className="text-2xl font-bold mt-1">{formatNumber(metrics?.activeCustomers || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Users className="h-4 w-4" />
              Active Agents
            </div>
            <div className="text-2xl font-bold mt-1">{formatNumber(metrics?.activeAgents || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Zap className="h-4 w-4" />
              Bets/Min
            </div>
            <div className="text-2xl font-bold mt-1">{metrics?.betsPerMinute || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingUp className="h-4 w-4" />
              Total Exposure
            </div>
            <div className="text-2xl font-bold mt-1">{formatCurrency(metrics?.totalExposure || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="h-4 w-4" />
              Pending Settlements
            </div>
            <div className="text-2xl font-bold mt-1">{formatNumber(metrics?.pendingSettlements || 0)}</div>
          </CardContent>
        </Card>
        <Card className={metrics?.failedPayouts ? "border-destructive" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertCircle className="h-4 w-4" />
              Failed Payouts
            </div>
            <div className={`text-2xl font-bold mt-1 ${metrics?.failedPayouts ? "text-destructive" : ""}`}>
              {formatNumber(metrics?.failedPayouts || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="exposure" className="space-y-4">
        <TabsList>
          <TabsTrigger value="exposure">Risk Exposure</TabsTrigger>
          <TabsTrigger value="payout">Payout Queue</TabsTrigger>
          <TabsTrigger value="financial">Deposit/Withdraw</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts
            {alerts.length > 0 && (
              <Badge variant="destructive" className="ml-2">{alerts.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="exposure" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Risk Numbers</CardTitle>
              <CardDescription>Numbers with highest exposure today</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(metrics?.topRiskNumbers || []).map((item, i) => {
                  const maxExposure = metrics?.topRiskNumbers[0]?.exposure || 1
                  const percentage = (item.exposure / maxExposure) * 100
                  return (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-16 font-mono font-bold">{item.number}</div>
                      <div className="flex-1">
                        <Progress value={percentage} className="h-2" />
                      </div>
                      <div className="w-32 text-right font-medium">
                        {formatCurrency(item.exposure)}
                      </div>
                    </div>
                  )
                })}
                {(metrics?.topRiskNumbers || []).length === 0 && (
                  <p className="text-muted-foreground text-center py-4">No exposure data yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payout" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payout Queue</CardTitle>
              <CardDescription>Pending payouts waiting to be processed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-3xl font-bold">{formatNumber(metrics?.payoutQueue.count || 0)}</div>
                  <div className="text-muted-foreground">Pending Payouts</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-3xl font-bold">{formatCurrency(metrics?.payoutQueue.amount || 0)}</div>
                  <div className="text-muted-foreground">Total Amount</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowDownToLine className="h-5 w-5 text-green-500" />
                  Deposits Today
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pending</span>
                    <span>{metrics?.depositStats.pending || 0} ({formatCurrency(metrics?.depositStats.pendingAmount || 0)})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completed</span>
                    <span className="text-green-600">{metrics?.depositStats.completed || 0} ({formatCurrency(metrics?.depositStats.completedAmount || 0)})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Failed</span>
                    <span className="text-red-600">{metrics?.depositStats.failed || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowUpFromLine className="h-5 w-5 text-purple-500" />
                  Withdrawals Today
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pending</span>
                    <span>{metrics?.withdrawStats.pending || 0} ({formatCurrency(metrics?.withdrawStats.pendingAmount || 0)})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completed</span>
                    <span className="text-green-600">{metrics?.withdrawStats.completed || 0} ({formatCurrency(metrics?.withdrawStats.completedAmount || 0)})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Failed</span>
                    <span className="text-red-600">{metrics?.withdrawStats.failed || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Alerts</CardTitle>
              <CardDescription>Unacknowledged operational alerts</CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No active alerts</p>
              ) : (
                <div className="space-y-2">
                  {alerts.map(alert => (
                    <div key={alert.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                      alert.severity === "critical" ? "border-destructive bg-destructive/5" :
                      alert.severity === "warning" ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10" :
                      "border-border"
                    }`}>
                      <div className="flex items-center gap-3">
                        <Badge variant={
                          alert.severity === "critical" ? "destructive" :
                          alert.severity === "warning" ? "default" : "secondary"
                        }>
                          {alertTypeLabels[alert.alert_type] || alert.alert_type}
                        </Badge>
                        <div>
                          <div className="font-medium">{alert.title}</div>
                          <div className="text-sm text-muted-foreground">{alert.message}</div>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => acknowledgeAlert(alert.id)}>
                        Acknowledge
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
