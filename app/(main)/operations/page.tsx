"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { 
  Activity, 
  Server, 
  Database, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Plus,
  RefreshCw,
  Calendar,
  Rocket,
  BookOpen,
  TrendingUp,
  BarChart3,
  Wrench,
  RotateCcw
} from "lucide-react"

interface HealthCheck {
  id: string
  check_type: string
  check_name: string
  status: "healthy" | "warning" | "critical"
  last_check_at: string
  check_interval_minutes: number
  error_count: number
  last_error: string | null
}

interface MaintenanceWindow {
  id: string
  title: string
  description: string
  maintenance_type: string
  scheduled_start: string
  scheduled_end: string
  status: string
  affected_services: string[]
}

interface Deployment {
  id: string
  feature_name: string
  version: string
  description: string
  deployed_at: string
  status: string
  rollback_reason: string | null
}

interface KnowledgeArticle {
  id: string
  category: string
  title: string
  content: string
  tags: string[]
  view_count: number
  helpful_count: number
}

export default function OperationsPage() {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([])
  const [healthSummary, setHealthSummary] = useState({ healthy: 0, warning: 0, critical: 0, total: 0 })
  const [maintenance, setMaintenance] = useState<MaintenanceWindow[]>([])
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false)
  const [showDeployDialog, setShowDeployDialog] = useState(false)
  const [showArticleDialog, setShowArticleDialog] = useState(false)

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/operations")
      const data = await res.json()
      setHealthChecks(data.healthChecks || [])
      setHealthSummary(data.healthSummary || { healthy: 0, warning: 0, critical: 0, total: 0 })
      setMaintenance(data.maintenance || [])
      setDeployments(data.deployments || [])
      setKnowledgeBase(data.knowledgeBase || [])
    } catch (error) {
      console.error("Failed to fetch operations data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy": return <CheckCircle className="h-5 w-5 text-green-500" />
      case "warning": return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case "critical": return <XCircle className="h-5 w-5 text-red-500" />
      default: return <Activity className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      healthy: "default",
      warning: "secondary",
      critical: "destructive",
      scheduled: "outline",
      in_progress: "secondary",
      completed: "default",
      deployed: "default",
      rolled_back: "destructive"
    }
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>
  }

  const handleCreateMaintenance = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    try {
      const res = await fetch("/api/admin/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_maintenance",
          title: formData.get("title"),
          description: formData.get("description"),
          maintenance_type: formData.get("maintenance_type"),
          scheduled_start: formData.get("scheduled_start"),
          scheduled_end: formData.get("scheduled_end"),
          affected_services: formData.get("affected_services")?.toString().split(",").map(s => s.trim())
        })
      })
      
      if (res.ok) {
        setShowMaintenanceDialog(false)
        fetchData()
      }
    } catch (error) {
      console.error("Failed to create maintenance:", error)
    }
  }

  const handleCreateDeployment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    try {
      const res = await fetch("/api/admin/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_deployment",
          feature_name: formData.get("feature_name"),
          version: formData.get("version"),
          description: formData.get("description")
        })
      })
      
      if (res.ok) {
        setShowDeployDialog(false)
        fetchData()
      }
    } catch (error) {
      console.error("Failed to create deployment:", error)
    }
  }

  const handleRollback = async (id: string) => {
    const reason = prompt("เหตุผลในการ Rollback:")
    if (!reason) return

    try {
      const res = await fetch("/api/admin/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rollback_deployment",
          id,
          rollback_reason: reason
        })
      })
      
      if (res.ok) {
        fetchData()
      }
    } catch (error) {
      console.error("Failed to rollback:", error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Operations Dashboard</h1>
          <p className="text-muted-foreground">ระบบติดตามและจัดการ Production</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          รีเฟรช
        </Button>
      </div>

      {/* Health Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Healthy</p>
                <p className="text-3xl font-bold text-green-600">{healthSummary.healthy}</p>
              </div>
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Warning</p>
                <p className="text-3xl font-bold text-yellow-600">{healthSummary.warning}</p>
              </div>
              <AlertTriangle className="h-10 w-10 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-3xl font-bold text-red-600">{healthSummary.critical}</p>
              </div>
              <XCircle className="h-10 w-10 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Checks</p>
                <p className="text-3xl font-bold">{healthSummary.total}</p>
              </div>
              <Activity className="h-10 w-10 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="health" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="health" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Health
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Maintenance
          </TabsTrigger>
          <TabsTrigger value="deployments" className="flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            Deployments
          </TabsTrigger>
          <TabsTrigger value="kpis" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            KPIs
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Knowledge
          </TabsTrigger>
        </TabsList>

        {/* Health Checks Tab */}
        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Production Health Checks
              </CardTitle>
              <CardDescription>สถานะระบบ Production ทั้งหมด</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {healthChecks.map((check) => (
                  <div key={check.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      {getStatusIcon(check.status)}
                      <div>
                        <p className="font-medium">{check.check_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Type: {check.check_type} | Interval: {check.check_interval_minutes} นาที
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(check.status)}
                      <p className="text-xs text-muted-foreground mt-1">
                        ตรวจล่าสุด: {new Date(check.last_check_at).toLocaleString("th-TH")}
                      </p>
                      {check.error_count > 0 && (
                        <p className="text-xs text-red-500">Errors: {check.error_count}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Maintenance Windows
                  </CardTitle>
                  <CardDescription>กำหนดการซ่อมบำรุงระบบ</CardDescription>
                </div>
                <Dialog open={showMaintenanceDialog} onOpenChange={setShowMaintenanceDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      เพิ่ม Maintenance
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>สร้าง Maintenance Window</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateMaintenance} className="space-y-4">
                      <div className="space-y-2">
                        <Label>ชื่องาน</Label>
                        <Input name="title" required />
                      </div>
                      <div className="space-y-2">
                        <Label>รายละเอียด</Label>
                        <Textarea name="description" />
                      </div>
                      <div className="space-y-2">
                        <Label>ประเภท</Label>
                        <Select name="maintenance_type" defaultValue="scheduled">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="emergency">Emergency</SelectItem>
                            <SelectItem value="hotfix">Hotfix</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>เริ่ม</Label>
                          <Input name="scheduled_start" type="datetime-local" required />
                        </div>
                        <div className="space-y-2">
                          <Label>สิ้นสุด</Label>
                          <Input name="scheduled_end" type="datetime-local" required />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Services ที่ได้รับผลกระทบ (คั่นด้วย comma)</Label>
                        <Input name="affected_services" placeholder="api, database, queue" />
                      </div>
                      <Button type="submit" className="w-full">สร้าง</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {maintenance.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">ไม่มี Maintenance ที่กำหนด</p>
                ) : (
                  maintenance.map((m) => (
                    <div key={m.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">{m.title}</h3>
                        {getStatusBadge(m.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{m.description}</p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(m.scheduled_start).toLocaleString("th-TH")} - {new Date(m.scheduled_end).toLocaleString("th-TH")}
                        </span>
                      </div>
                      {m.affected_services?.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {m.affected_services.map((s, i) => (
                            <Badge key={i} variant="outline">{s}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deployments Tab */}
        <TabsContent value="deployments" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Rocket className="h-5 w-5" />
                    Feature Deployments
                  </CardTitle>
                  <CardDescription>ประวัติการ deploy feature</CardDescription>
                </div>
                <Dialog open={showDeployDialog} onOpenChange={setShowDeployDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Record Deployment
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>บันทึกการ Deploy</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateDeployment} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Feature Name</Label>
                        <Input name="feature_name" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Version</Label>
                        <Input name="version" placeholder="v1.0.0" />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea name="description" />
                      </div>
                      <Button type="submit" className="w-full">บันทึก</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {deployments.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{d.feature_name}</p>
                        {d.version && <Badge variant="outline">{d.version}</Badge>}
                        {getStatusBadge(d.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">{d.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Deployed: {new Date(d.deployed_at).toLocaleString("th-TH")}
                      </p>
                      {d.rollback_reason && (
                        <p className="text-xs text-red-500">Rollback: {d.rollback_reason}</p>
                      )}
                    </div>
                    {d.status === "deployed" && (
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleRollback(d.id)}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Rollback
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* KPIs Tab */}
        <TabsContent value="kpis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Business KPIs
              </CardTitle>
              <CardDescription>ตัวชี้วัดผลงานธุรกิจ</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                <p>KPIs จะแสดงเมื่อมีการบันทึกข้อมูล</p>
                <p className="text-sm">ใช้ API เพื่อบันทึก KPIs รายวัน</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Knowledge Base Tab */}
        <TabsContent value="knowledge" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Knowledge Base
                  </CardTitle>
                  <CardDescription>คู่มือและ FAQ สำหรับทีม</CardDescription>
                </div>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  เพิ่มบทความ
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {knowledgeBase.map((article) => (
                  <div key={article.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{article.title}</h3>
                      <Badge variant="outline">{article.category}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{article.content}</p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex gap-2">
                        {article.tags?.map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Views: {article.view_count} | Helpful: {article.helpful_count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
