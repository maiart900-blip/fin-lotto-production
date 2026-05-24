"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Power, 
  AlertTriangle, 
  RefreshCw, 
  Activity, 
  Users, 
  CreditCard,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  CheckCircle,
  XCircle,
  Shield,
  Settings,
  Bell
} from "lucide-react"

interface GlobalControl {
  id: string
  control_key: string
  control_value: { enabled?: boolean; message?: string }
  is_enabled: boolean
  description: string
}

interface QueueStatus {
  queue_type: string
  pending_count: number
  pending_amount: number
  processing_count: number
  failed_count: number
}

interface Incident {
  id: string
  incident_type: string
  severity: string
  title: string
  message: string
  is_resolved: boolean
  created_at: string
}

interface Stats {
  totalBetToday: number
  pendingDepositCount: number
  pendingDepositAmount: number
  pendingWithdrawCount: number
  pendingWithdrawAmount: number
  activeCustomers: number
  unresolvedIncidents: number
}

const controlLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  betting_enabled: { label: "รับแทง", icon: <Activity className="h-4 w-4" />, color: "bg-green-500" },
  deposit_enabled: { label: "รับฝาก", icon: <ArrowDownToLine className="h-4 w-4" />, color: "bg-blue-500" },
  withdraw_enabled: { label: "ถอนเงิน", icon: <ArrowUpFromLine className="h-4 w-4" />, color: "bg-purple-500" },
  registration_enabled: { label: "สมัครสมาชิก", icon: <Users className="h-4 w-4" />, color: "bg-amber-500" },
  auto_payout_enabled: { label: "Auto Payout", icon: <CreditCard className="h-4 w-4" />, color: "bg-cyan-500" },
  maintenance_mode: { label: "โหมดซ่อมบำรุง", icon: <Settings className="h-4 w-4" />, color: "bg-red-500" },
}

const queueLabels: Record<string, string> = {
  pending_deposits: "รอฝาก",
  pending_withdrawals: "รอถอน",
  payout_queue: "รอจ่ายรางวัล",
  risk_review: "ตรวจสอบความเสี่ยง",
  support_tickets: "Support",
  manual_key: "คีย์หวย",
}

export default function MasterControlPage() {
  const [controls, setControls] = useState<GlobalControl[]>([])
  const [queues, setQueues] = useState<QueueStatus[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/master-control")
      const data = await res.json()
      setControls(data.controls || [])
      setQueues(data.queues || [])
      setIncidents(data.incidents || [])
      setStats(data.stats || null)
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // refresh every 30 seconds
    return () => clearInterval(interval)
  }, [fetchData])

  const toggleControl = async (controlKey: string, currentEnabled: boolean) => {
    setUpdating(controlKey)
    try {
      const newValue = controlKey === "maintenance_mode" 
        ? { enabled: !currentEnabled, message: currentEnabled ? "" : "ระบบกำลังปรับปรุง กรุณารอสักครู่" }
        : { enabled: !currentEnabled }

      await fetch("/api/admin/master-control", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ control_key: controlKey, control_value: newValue }),
      })
      await fetchData()
    } finally {
      setUpdating(null)
    }
  }

  const resolveIncident = async (incidentId: string) => {
    try {
      await fetch("/api/admin/master-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", incident_id: incidentId }),
      })
      await fetchData()
    } catch (error) {
      console.error("Error resolving incident:", error)
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-amber-500" />
            Master Control Center
          </h1>
          <p className="text-muted-foreground">ศูนย์ควบคุมระบบทั้งหมด</p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          รีเฟรช
        </Button>
      </div>

      {/* Real-time Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <Activity className="h-4 w-4" />
              <span className="text-xs">ยอดแทงวันนี้</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(stats?.totalBetToday || 0)}</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <ArrowDownToLine className="h-4 w-4" />
              <span className="text-xs">รอฝาก</span>
            </div>
            <p className="text-xl font-bold">{stats?.pendingDepositCount || 0}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(stats?.pendingDepositAmount || 0)}</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <ArrowUpFromLine className="h-4 w-4" />
              <span className="text-xs">รอถอน</span>
            </div>
            <p className="text-xl font-bold">{stats?.pendingWithdrawCount || 0}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(stats?.pendingWithdrawAmount || 0)}</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs">ลูกค้า Active</span>
            </div>
            <p className="text-xl font-bold">{formatNumber(stats?.activeCustomers || 0)}</p>
          </CardContent>
        </Card>

        <Card className={`${(stats?.unresolvedIncidents || 0) > 0 ? "border-red-200 bg-red-50 dark:bg-red-950/20" : "border-gray-200"}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs">Incidents</span>
            </div>
            <p className="text-xl font-bold">{stats?.unresolvedIncidents || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-cyan-200 bg-cyan-50 dark:bg-cyan-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-cyan-600 mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs">อัปเดตล่าสุด</span>
            </div>
            <p className="text-sm font-medium">{new Date().toLocaleTimeString("th-TH")}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="controls" className="space-y-4">
        <TabsList>
          <TabsTrigger value="controls">
            <Power className="h-4 w-4 mr-2" />
            ควบคุมระบบ
          </TabsTrigger>
          <TabsTrigger value="queues">
            <Clock className="h-4 w-4 mr-2" />
            Queue Status
          </TabsTrigger>
          <TabsTrigger value="incidents">
            <Bell className="h-4 w-4 mr-2" />
            Incidents {(stats?.unresolvedIncidents || 0) > 0 && (
              <Badge variant="destructive" className="ml-2">{stats?.unresolvedIncidents}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Controls Tab */}
        <TabsContent value="controls">
          <Card>
            <CardHeader>
              <CardTitle>ควบคุมระบบ</CardTitle>
              <CardDescription>เปิด/ปิดฟังก์ชันหลักของระบบ</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {controls.map((control) => {
                  const config = controlLabels[control.control_key]
                  const isEnabled = control.control_value?.enabled ?? control.is_enabled
                  const isMaintenanceMode = control.control_key === "maintenance_mode"
                  
                  return (
                    <div
                      key={control.id}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        isMaintenanceMode
                          ? isEnabled
                            ? "border-red-500 bg-red-50 dark:bg-red-950/20"
                            : "border-gray-200"
                          : isEnabled
                            ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                            : "border-gray-200 bg-gray-50 dark:bg-gray-900"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${config?.color || "bg-gray-500"} text-white`}>
                            {config?.icon || <Settings className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="font-medium">{config?.label || control.control_key}</p>
                            <p className="text-xs text-muted-foreground">{control.description}</p>
                          </div>
                        </div>
                        <Switch
                          checked={isMaintenanceMode ? isEnabled : isEnabled}
                          onCheckedChange={() => toggleControl(control.control_key, isEnabled)}
                          disabled={updating === control.control_key}
                        />
                      </div>
                      {isMaintenanceMode && isEnabled && (
                        <p className="mt-2 text-xs text-red-600">
                          ระบบอยู่ในโหมดซ่อมบำรุง - ลูกค้าจะเห็นข้อความแจ้งเตือน
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Queue Status Tab */}
        <TabsContent value="queues">
          <Card>
            <CardHeader>
              <CardTitle>Queue Status</CardTitle>
              <CardDescription>สถานะคิวงานทั้งหมดในระบบ</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {queues.map((queue) => (
                  <div key={queue.queue_type} className="p-4 rounded-lg border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium">{queueLabels[queue.queue_type] || queue.queue_type}</span>
                      {queue.pending_count > 0 && (
                        <Badge variant="secondary">{queue.pending_count} รายการ</Badge>
                      )}
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">รอดำเนินการ</span>
                        <span className="font-medium">{queue.pending_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">กำลังประมวลผล</span>
                        <span className="font-medium">{queue.processing_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ล้มเหลว</span>
                        <span className={`font-medium ${queue.failed_count > 0 ? "text-red-500" : ""}`}>
                          {queue.failed_count}
                        </span>
                      </div>
                      {queue.pending_amount > 0 && (
                        <div className="flex justify-between pt-2 border-t">
                          <span className="text-muted-foreground">ยอดรวม</span>
                          <span className="font-bold">{formatCurrency(queue.pending_amount)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Incidents Tab */}
        <TabsContent value="incidents">
          <Card>
            <CardHeader>
              <CardTitle>System Incidents</CardTitle>
              <CardDescription>เหตุการณ์ผิดปกติที่ยังไม่ได้แก้ไข</CardDescription>
            </CardHeader>
            <CardContent>
              {incidents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>ไม่มีเหตุการณ์ผิดปกติ</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {incidents.map((incident) => (
                    <div
                      key={incident.id}
                      className={`p-4 rounded-lg border-l-4 ${
                        incident.severity === "critical"
                          ? "border-l-red-500 bg-red-50 dark:bg-red-950/20"
                          : incident.severity === "warning"
                          ? "border-l-amber-500 bg-amber-50 dark:bg-amber-950/20"
                          : "border-l-blue-500 bg-blue-50 dark:bg-blue-950/20"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {incident.severity === "critical" ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            )}
                            <span className="font-medium">{incident.title}</span>
                            <Badge variant={incident.severity === "critical" ? "destructive" : "secondary"}>
                              {incident.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{incident.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(incident.created_at).toLocaleString("th-TH")}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resolveIncident(incident.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          แก้ไขแล้ว
                        </Button>
                      </div>
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
