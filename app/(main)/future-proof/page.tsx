"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Activity,
  Database,
  Server,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Play,
  RefreshCw,
  Loader2,
  Archive,
  Trash2,
  Zap,
  Shield
} from "lucide-react"

interface CapacityForecast {
  id: string
  forecast_type: string
  forecast_date: string
  current_value: number
  forecast_7d: number
  forecast_30d: number
  forecast_90d: number
  growth_rate_percent: number
  status: string
}

interface DataLifecycle {
  id: string
  data_type: string
  active_retention_days: number
  archive_retention_days: number
  delete_retention_days: number
  is_auto_cleanup: boolean
  last_cleanup_at: string | null
  records_active: number
  records_archived: number
}

interface QueueHealth {
  id: string
  queue_name: string
  status: string
  pending_count: number
  processing_count: number
  failed_count: number
  stuck_count: number
  avg_processing_time_ms: number
  alert_threshold: number
}

interface RecoverySimulation {
  id: string
  simulation_type: string
  title: string
  status: string
  result: string | null
  duration_seconds: number | null
  started_at: string | null
  completed_at: string | null
}

interface DependencyHealth {
  id: string
  dependency_type: string
  dependency_name: string
  status: string
  response_time_ms: number | null
  is_critical: boolean
  last_check_at: string
}

interface Summary {
  queues_healthy: number
  queues_warning: number
  queues_critical: number
  deps_healthy: number
  deps_critical_down: number
}

export default function FutureProofPage() {
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [capacity, setCapacity] = useState<CapacityForecast[]>([])
  const [lifecycle, setLifecycle] = useState<DataLifecycle[]>([])
  const [queues, setQueues] = useState<QueueHealth[]>([])
  const [simulations, setSimulations] = useState<RecoverySimulation[]>([])
  const [dependencies, setDependencies] = useState<DependencyHealth[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/future-proof")
      const data = await res.json()
      setCapacity(data.capacity || [])
      setLifecycle(data.lifecycle || [])
      setQueues(data.queues || [])
      setSimulations(data.simulations || [])
      setDependencies(data.dependencies || [])
      setSummary(data.summary || null)
    } catch (error) {
      console.error("Fetch error:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleAction = async (action: string, params: Record<string, unknown>) => {
    const key = `${action}-${JSON.stringify(params)}`
    setActionLoading(key)
    try {
      await fetch("/api/admin/future-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...params })
      })
      await fetchData()
    } catch (error) {
      console.error("Action error:", error)
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
      case "normal":
      case "passed":
      case "completed":
        return <Badge className="bg-green-500/10 text-green-500">Healthy</Badge>
      case "warning":
      case "running":
        return <Badge className="bg-yellow-500/10 text-yellow-500">Warning</Badge>
      case "critical":
      case "failed":
        return <Badge className="bg-red-500/10 text-red-500">Critical</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("th-TH").format(num)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Future-Proof Operations</h1>
          <p className="text-muted-foreground">Enterprise Continuity & Long-Term Planning</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.queues_healthy}</p>
                  <p className="text-xs text-muted-foreground">Queues Healthy</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.queues_warning}</p>
                  <p className="text-xs text-muted-foreground">Queues Warning</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <Zap className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.queues_critical}</p>
                  <p className="text-xs text-muted-foreground">Queues Critical</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Server className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.deps_healthy}</p>
                  <p className="text-xs text-muted-foreground">Dependencies OK</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Shield className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.deps_critical_down}</p>
                  <p className="text-xs text-muted-foreground">Critical Down</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="queues" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="queues">Queue Health</TabsTrigger>
          <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          <TabsTrigger value="lifecycle">Data Lifecycle</TabsTrigger>
          <TabsTrigger value="capacity">Capacity</TabsTrigger>
          <TabsTrigger value="simulations">Simulations</TabsTrigger>
        </TabsList>

        {/* Queue Health Tab */}
        <TabsContent value="queues" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Queue Health Monitor
              </CardTitle>
              <CardDescription>Real-time queue status and performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {queues.map((queue) => (
                  <div key={queue.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-muted">
                        <Database className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">{queue.queue_name}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Pending: {queue.pending_count}</span>
                          <span>Processing: {queue.processing_count}</span>
                          <span>Failed: {queue.failed_count}</span>
                          <span>Avg: {queue.avg_processing_time_ms}ms</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getStatusBadge(queue.status)}
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Threshold:</Label>
                        <Input
                          type="number"
                          className="w-20 h-8"
                          defaultValue={queue.alert_threshold}
                          onBlur={(e) => {
                            const value = parseInt(e.target.value)
                            if (value !== queue.alert_threshold) {
                              handleAction("update_queue", {
                                queue_name: queue.queue_name,
                                alert_threshold: value
                              })
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dependencies Tab */}
        <TabsContent value="dependencies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Dependency Health
              </CardTitle>
              <CardDescription>External services and infrastructure status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dependencies.map((dep) => (
                  <div key={dep.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${dep.is_critical ? "bg-red-500/10" : "bg-muted"}`}>
                        <Server className={`h-5 w-5 ${dep.is_critical ? "text-red-500" : ""}`} />
                      </div>
                      <div>
                        <p className="font-medium">
                          {dep.dependency_name}
                          {dep.is_critical && (
                            <Badge variant="outline" className="ml-2 text-red-500">
                              Critical
                            </Badge>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Type: {dep.dependency_type} | Response: {dep.response_time_ms || "N/A"}ms
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(dep.status)}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading !== null}
                        onClick={() => handleAction("check_dependency", {
                          dependency_type: dep.dependency_type,
                          dependency_name: dep.dependency_name
                        })}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Check
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Lifecycle Tab */}
        <TabsContent value="lifecycle" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5" />
                Data Lifecycle Management
              </CardTitle>
              <CardDescription>Retention policies and cleanup schedules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {lifecycle.map((item) => (
                  <div key={item.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Database className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{item.data_type}</p>
                          <p className="text-sm text-muted-foreground">
                            Active: {formatNumber(item.records_active)} | Archived: {formatNumber(item.records_archived)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={item.is_auto_cleanup}
                            onCheckedChange={(checked) => handleAction("update_lifecycle", {
                              id: item.id,
                              active_retention_days: item.active_retention_days,
                              archive_retention_days: item.archive_retention_days,
                              delete_retention_days: item.delete_retention_days,
                              is_auto_cleanup: checked
                            })}
                          />
                          <Label className="text-sm">Auto Cleanup</Label>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionLoading !== null}
                          onClick={() => handleAction("run_cleanup", { data_type: item.data_type })}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Run Cleanup
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="p-2 bg-muted rounded">
                        <p className="text-muted-foreground">Active Retention</p>
                        <p className="font-medium">{item.active_retention_days} days</p>
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <p className="text-muted-foreground">Archive Retention</p>
                        <p className="font-medium">{item.archive_retention_days} days</p>
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <p className="text-muted-foreground">Delete After</p>
                        <p className="font-medium">{item.delete_retention_days} days</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Capacity Tab */}
        <TabsContent value="capacity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Capacity Forecasts
              </CardTitle>
              <CardDescription>Growth projections and capacity planning</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                {["users", "transactions", "storage", "bandwidth"].map((type) => (
                  <Button
                    key={type}
                    size="sm"
                    variant="outline"
                    disabled={actionLoading !== null}
                    onClick={() => handleAction("calculate_forecast", { forecast_type: type })}
                  >
                    <TrendingUp className="h-4 w-4 mr-1" />
                    Forecast {type}
                  </Button>
                ))}
              </div>
              <div className="space-y-4">
                {capacity.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No forecasts yet. Click buttons above to generate.
                  </p>
                ) : (
                  capacity.map((item) => (
                    <div key={item.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-medium capitalize">{item.forecast_type}</p>
                          <p className="text-sm text-muted-foreground">Date: {item.forecast_date}</p>
                        </div>
                        {getStatusBadge(item.status)}
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div className="p-2 bg-muted rounded text-center">
                          <p className="text-muted-foreground">Current</p>
                          <p className="font-bold">{formatNumber(item.current_value)}</p>
                        </div>
                        <div className="p-2 bg-blue-500/10 rounded text-center">
                          <p className="text-muted-foreground">7 Days</p>
                          <p className="font-bold text-blue-500">{formatNumber(item.forecast_7d)}</p>
                        </div>
                        <div className="p-2 bg-purple-500/10 rounded text-center">
                          <p className="text-muted-foreground">30 Days</p>
                          <p className="font-bold text-purple-500">{formatNumber(item.forecast_30d)}</p>
                        </div>
                        <div className="p-2 bg-green-500/10 rounded text-center">
                          <p className="text-muted-foreground">90 Days</p>
                          <p className="font-bold text-green-500">{formatNumber(item.forecast_90d)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Simulations Tab */}
        <TabsContent value="simulations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recovery Simulations
              </CardTitle>
              <CardDescription>Disaster recovery testing and validation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Button
                  size="sm"
                  onClick={() => handleAction("create_simulation", {
                    simulation_type: "database_recovery",
                    title: "Database Recovery Test",
                    description: "Test database failover and recovery",
                    performed_by: null
                  })}
                  disabled={actionLoading !== null}
                >
                  <Play className="h-4 w-4 mr-1" />
                  New DB Recovery Test
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction("create_simulation", {
                    simulation_type: "full_failover",
                    title: "Full Failover Test",
                    description: "Test complete system failover",
                    performed_by: null
                  })}
                  disabled={actionLoading !== null}
                >
                  <Play className="h-4 w-4 mr-1" />
                  New Full Failover
                </Button>
              </div>
              <div className="space-y-4">
                {simulations.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No simulations yet. Create one to test recovery procedures.
                  </p>
                ) : (
                  simulations.map((sim) => (
                    <div key={sim.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-muted">
                          <Clock className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">{sim.title}</p>
                          <p className="text-sm text-muted-foreground">
                            Type: {sim.simulation_type}
                            {sim.duration_seconds && ` | Duration: ${sim.duration_seconds}s`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(sim.status === "completed" ? (sim.result || "completed") : sim.status)}
                        {sim.status === "pending" && (
                          <Button
                            size="sm"
                            onClick={() => handleAction("run_simulation", { id: sim.id })}
                            disabled={actionLoading !== null}
                          >
                            {actionLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-1" />
                                Run
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
