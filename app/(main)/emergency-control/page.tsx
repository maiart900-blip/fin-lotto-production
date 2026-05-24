"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { 
  AlertTriangle, 
  Shield, 
  Bell, 
  Radio, 
  Clock, 
  CheckCircle2, 
  XCircle,
  RefreshCw,
  Megaphone,
  Activity,
  Eye,
  Loader2
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { th } from "date-fns/locale"

interface EmergencyControl {
  id: string
  control_key: string
  is_active: boolean
  activated_by: string | null
  activated_at: string | null
  reason: string | null
}

interface Broadcast {
  id: string
  title: string
  message: string
  broadcast_type: string
  priority: string
  is_active: boolean
  created_at: string
}

interface Notification {
  id: string
  notification_type: string
  severity: string
  title: string
  message: string
  is_read: boolean
  is_acknowledged: boolean
  created_at: string
}

interface TimelineItem {
  id: string
  action_type: string
  action_detail: string
  performed_at: string
  note: string | null
}

const controlLabels: Record<string, { label: string; description: string; icon: React.ReactNode }> = {
  pause_betting: { label: "หยุดรับแทง", description: "หยุดรับแทงหวยทั้งระบบ", icon: <XCircle className="h-5 w-5" /> },
  pause_deposits: { label: "หยุดรับฝาก", description: "หยุดรับฝากเงินทั้งระบบ", icon: <XCircle className="h-5 w-5" /> },
  pause_withdrawals: { label: "หยุดถอน", description: "หยุดถอนเงินทั้งระบบ", icon: <XCircle className="h-5 w-5" /> },
  disable_live_draw: { label: "ปิดถ่ายทอดสด", description: "ปิดการถ่ายทอดผลหวย", icon: <Radio className="h-5 w-5" /> },
  financial_safety_mode: { label: "โหมดปลอดภัยการเงิน", description: "จำกัดธุรกรรมการเงิน", icon: <Shield className="h-5 w-5" /> },
  queue_protection: { label: "ป้องกัน Queue Overload", description: "จำกัดจำนวน request", icon: <Activity className="h-5 w-5" /> },
  emergency_maintenance: { label: "ซ่อมบำรุงฉุกเฉิน", description: "ปิดระบบเพื่อซ่อมบำรุง", icon: <AlertTriangle className="h-5 w-5" /> },
}

const severityColors: Record<string, string> = {
  info: "bg-blue-500",
  warning: "bg-yellow-500",
  critical: "bg-red-500",
}

export default function EmergencyControlPage() {
  const [controls, setControls] = useState<EmergencyControl[]>([])
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [activeIncidents, setActiveIncidents] = useState(0)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [showBroadcastDialog, setShowBroadcastDialog] = useState(false)
  const [broadcastForm, setBroadcastForm] = useState({
    title: "",
    message: "",
    broadcast_type: "all",
    priority: "normal",
  })

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/emergency-control")
      const data = await res.json()
      setControls(data.controls || [])
      setBroadcasts(data.broadcasts || [])
      setNotifications(data.notifications || [])
      setTimeline(data.timeline || [])
      setActiveIncidents(data.activeIncidents || 0)
    } catch (error) {
      console.error("Failed to fetch emergency data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleToggleControl = async (control_key: string, is_active: boolean) => {
    setToggling(control_key)
    try {
      const res = await fetch("/api/admin/emergency-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_control",
          control_key,
          is_active,
          user_id: "owner",
          reason: is_active ? "เปิดใช้งานโดย Owner" : "ปิดใช้งานโดย Owner",
        }),
      })
      if (res.ok) {
        fetchData()
      }
    } catch (error) {
      console.error("Failed to toggle control:", error)
    } finally {
      setToggling(null)
    }
  }

  const handleCreateBroadcast = async () => {
    try {
      const res = await fetch("/api/admin/emergency-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_broadcast",
          ...broadcastForm,
          user_id: "owner",
        }),
      })
      if (res.ok) {
        setShowBroadcastDialog(false)
        setBroadcastForm({ title: "", message: "", broadcast_type: "all", priority: "normal" })
        fetchData()
      }
    } catch (error) {
      console.error("Failed to create broadcast:", error)
    }
  }

  const handleDeleteBroadcast = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/emergency-control?broadcast_id=${id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        fetchData()
      }
    } catch (error) {
      console.error("Failed to delete broadcast:", error)
    }
  }

  const activeControls = controls.filter((c) => c.is_active).length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-red-600">Emergency Control Center</h1>
          <p className="text-muted-foreground">ศูนย์ควบคุมฉุกเฉินสำหรับ Owner</p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="mr-2 h-4 w-4" />
          รีเฟรช
        </Button>
      </div>

      {/* Alert if any control is active */}
      {activeControls > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>มีการควบคุมฉุกเฉินที่เปิดใช้งานอยู่!</AlertTitle>
          <AlertDescription>
            มี {activeControls} รายการที่เปิดใช้งาน กรุณาตรวจสอบและปิดเมื่อสถานการณ์กลับสู่ปกติ
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className={activeControls > 0 ? "border-red-500" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ควบคุมฉุกเฉิน</CardTitle>
            <Shield className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeControls} / {controls.length}</div>
            <p className="text-xs text-muted-foreground">รายการที่เปิดใช้งาน</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ประกาศ Active</CardTitle>
            <Megaphone className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{broadcasts.length}</div>
            <p className="text-xs text-muted-foreground">ประกาศที่ยังแสดงอยู่</p>
          </CardContent>
        </Card>

        <Card className={notifications.length > 0 ? "border-yellow-500" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">แจ้งเตือนยังไม่อ่าน</CardTitle>
            <Bell className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications.length}</div>
            <p className="text-xs text-muted-foreground">รอการตรวจสอบ</p>
          </CardContent>
        </Card>

        <Card className={activeIncidents > 0 ? "border-red-500" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">เหตุการณ์ Active</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeIncidents}</div>
            <p className="text-xs text-muted-foreground">ยังไม่ได้แก้ไข</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="controls" className="space-y-4">
        <TabsList>
          <TabsTrigger value="controls">ควบคุมฉุกเฉิน</TabsTrigger>
          <TabsTrigger value="broadcasts">ประกาศ</TabsTrigger>
          <TabsTrigger value="notifications">แจ้งเตือน ({notifications.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* Emergency Controls Tab */}
        <TabsContent value="controls" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {controls.map((control) => {
              const config = controlLabels[control.control_key] || {
                label: control.control_key,
                description: "",
                icon: <Shield className="h-5 w-5" />,
              }

              return (
                <Card
                  key={control.id}
                  className={control.is_active ? "border-red-500 bg-red-50 dark:bg-red-950/20" : ""}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={control.is_active ? "text-red-500" : "text-muted-foreground"}>
                          {config.icon}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{config.label}</CardTitle>
                          <CardDescription>{config.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {toggling === control.control_key ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Switch
                            checked={control.is_active}
                            onCheckedChange={(checked) =>
                              handleToggleControl(control.control_key, checked)
                            }
                          />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {control.is_active && control.activated_at && (
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        เปิดใช้งานเมื่อ:{" "}
                        {formatDistanceToNow(new Date(control.activated_at), {
                          addSuffix: true,
                          locale: th,
                        })}
                      </div>
                      {control.reason && (
                        <div className="text-sm mt-1">เหตุผล: {control.reason}</div>
                      )}
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Broadcasts Tab */}
        <TabsContent value="broadcasts" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showBroadcastDialog} onOpenChange={setShowBroadcastDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Megaphone className="mr-2 h-4 w-4" />
                  สร้างประกาศ
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>สร้างประกาศฉุกเฉิน</DialogTitle>
                  <DialogDescription>
                    ประกาศจะแสดงให้ผู้ใช้งานทั้งหมดเห็น
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>หัวข้อ</Label>
                    <Input
                      value={broadcastForm.title}
                      onChange={(e) =>
                        setBroadcastForm({ ...broadcastForm, title: e.target.value })
                      }
                      placeholder="หัวข้อประกาศ"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ข้อความ</Label>
                    <Textarea
                      value={broadcastForm.message}
                      onChange={(e) =>
                        setBroadcastForm({ ...broadcastForm, message: e.target.value })
                      }
                      placeholder="รายละเอียดประกาศ"
                      rows={4}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>ประเภท</Label>
                      <Select
                        value={broadcastForm.broadcast_type}
                        onValueChange={(value) =>
                          setBroadcastForm({ ...broadcastForm, broadcast_type: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">ทั้งหมด</SelectItem>
                          <SelectItem value="admin">Admin เท่านั้น</SelectItem>
                          <SelectItem value="agent">Agent เท่านั้น</SelectItem>
                          <SelectItem value="customer">ลูกค้าเท่านั้น</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>ความสำคัญ</Label>
                      <Select
                        value={broadcastForm.priority}
                        onValueChange={(value) =>
                          setBroadcastForm({ ...broadcastForm, priority: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">ปกติ</SelectItem>
                          <SelectItem value="high">สูง</SelectItem>
                          <SelectItem value="critical">ฉุกเฉิน</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowBroadcastDialog(false)}>
                    ยกเลิก
                  </Button>
                  <Button onClick={handleCreateBroadcast}>สร้างประกาศ</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-4">
            {broadcasts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  ไม่มีประกาศที่ active
                </CardContent>
              </Card>
            ) : (
              broadcasts.map((broadcast) => (
                <Card key={broadcast.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={broadcast.priority === "critical" ? "destructive" : "secondary"}
                        >
                          {broadcast.priority}
                        </Badge>
                        <CardTitle>{broadcast.title}</CardTitle>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteBroadcast(broadcast.id)}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p>{broadcast.message}</p>
                    <div className="mt-2 text-sm text-muted-foreground">
                      สร้างเมื่อ:{" "}
                      {formatDistanceToNow(new Date(broadcast.created_at), {
                        addSuffix: true,
                        locale: th,
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <div className="space-y-4">
            {notifications.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  ไม่มีแจ้งเตือนที่ยังไม่อ่าน
                </CardContent>
              </Card>
            ) : (
              notifications.map((notification) => (
                <Card key={notification.id} className="border-l-4 border-l-yellow-500">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            severityColors[notification.severity] || "bg-gray-500"
                          }`}
                        />
                        <CardTitle className="text-base">{notification.title}</CardTitle>
                      </div>
                      <Badge variant="outline">{notification.notification_type}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{notification.message}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: th,
                        })}
                      </span>
                      <Button size="sm" variant="outline">
                        <Eye className="mr-2 h-4 w-4" />
                        รับทราบ
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Emergency Timeline</CardTitle>
              <CardDescription>ประวัติการดำเนินการทั้งหมด</CardDescription>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  ยังไม่มีประวัติการดำเนินการ
                </div>
              ) : (
                <div className="space-y-4">
                  {timeline.map((item) => (
                    <div key={item.id} className="flex items-start gap-4 border-l-2 pl-4 pb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(item.performed_at), {
                              addSuffix: true,
                              locale: th,
                            })}
                          </span>
                        </div>
                        <div className="mt-1 font-medium">{item.action_type}</div>
                        <div className="text-sm">{item.action_detail}</div>
                        {item.note && (
                          <div className="text-sm text-muted-foreground mt-1">
                            หมายเหตุ: {item.note}
                          </div>
                        )}
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
