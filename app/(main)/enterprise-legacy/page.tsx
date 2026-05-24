"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { 
  Archive, 
  BookOpen, 
  FileText, 
  Shield, 
  History,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Plus,
  Play,
  Eye
} from "lucide-react"

interface Handbook {
  id: string
  handbook_type: string
  title: string
  content: string
  version: string
  is_published: boolean
  created_at: string
  updated_at: string
}

interface ChangeRequest {
  id: string
  change_type: string
  change_scope: string
  title: string
  description: string
  impact_level: string
  status: string
  requested_at: string
  approved_at: string | null
  rejected_at: string | null
  rejection_reason: string | null
  rollback_plan: string | null
}

interface AuditArchive {
  id: string
  archive_type: string
  archive_period: string
  archive_year: number
  archive_month: number | null
  record_count: number
  total_amount: number
  is_verified: boolean
  archived_at: string
}

interface IntegrityCheck {
  id: string
  check_date: string
  check_type: string
  expected_value: number
  actual_value: number
  difference: number
  is_consistent: boolean
  notes: string | null
  resolved_at: string | null
}

interface PermissionHistory {
  id: string
  user_id: string
  user_type: string
  permission_type: string
  old_permissions: Record<string, unknown>
  new_permissions: Record<string, unknown>
  changed_at: string
  reason: string | null
}

export default function EnterpriseLegacyPage() {
  const [handbooks, setHandbooks] = useState<Handbook[]>([])
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([])
  const [archives, setArchives] = useState<AuditArchive[]>([])
  const [integrityChecks, setIntegrityChecks] = useState<IntegrityCheck[]>([])
  const [permissionHistory, setPermissionHistory] = useState<PermissionHistory[]>([])
  const [pendingChangesCount, setPendingChangesCount] = useState(0)
  const [inconsistentCount, setInconsistentCount] = useState(0)
  const [totalArchives, setTotalArchives] = useState(0)
  const [totalHandbooks, setTotalHandbooks] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("handbooks")
  const [selectedHandbook, setSelectedHandbook] = useState<Handbook | null>(null)
  const [showChangeDialog, setShowChangeDialog] = useState(false)
  const [runningCheck, setRunningCheck] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/enterprise-legacy")
      const data = await res.json()
      setHandbooks(data.handbooks || [])
      setChangeRequests(data.changeRequests || [])
      setArchives(data.archives || [])
      setIntegrityChecks(data.integrityChecks || [])
      setPermissionHistory(data.permissionHistory || [])
      setPendingChangesCount(data.pendingChangesCount || 0)
      setInconsistentCount(data.inconsistentCount || 0)
      setTotalArchives(data.totalArchives || 0)
      setTotalHandbooks(data.totalHandbooks || 0)
    } catch (error) {
      console.error("Failed to fetch:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleApproveChange = async (id: string) => {
    try {
      await fetch("/api/admin/enterprise-legacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_change", id, approved_by: "owner" }),
      })
      fetchData()
    } catch (error) {
      console.error("Failed to approve:", error)
    }
  }

  const handleRejectChange = async (id: string, reason: string) => {
    try {
      await fetch("/api/admin/enterprise-legacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject_change", id, rejected_by: "owner", reason }),
      })
      fetchData()
    } catch (error) {
      console.error("Failed to reject:", error)
    }
  }

  const handleRunIntegrityCheck = async () => {
    setRunningCheck(true)
    try {
      const res = await fetch("/api/admin/enterprise-legacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_integrity_check", checked_by: "owner" }),
      })
      const result = await res.json()
      if (result.success) {
        alert(result.isConsistent 
          ? "Financial integrity check passed!" 
          : `Inconsistency detected: Difference of ${result.difference.toLocaleString()}`)
      }
      fetchData()
    } catch (error) {
      console.error("Failed to run check:", error)
    } finally {
      setRunningCheck(false)
    }
  }

  const getImpactBadge = (level: string) => {
    switch (level) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>
      case "high":
        return <Badge className="bg-orange-500">High</Badge>
      case "medium":
        return <Badge className="bg-yellow-500">Medium</Badge>
      default:
        return <Badge variant="secondary">Low</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500">Approved</Badge>
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>
      case "implemented":
        return <Badge className="bg-blue-500">Implemented</Badge>
      default:
        return <Badge variant="outline">Pending</Badge>
    }
  }

  const getHandbookIcon = (type: string) => {
    switch (type) {
      case "owner":
        return <Shield className="h-5 w-5 text-purple-500" />
      case "technical":
        return <FileText className="h-5 w-5 text-blue-500" />
      case "finance":
        return <Archive className="h-5 w-5 text-green-500" />
      case "emergency":
        return <AlertTriangle className="h-5 w-5 text-red-500" />
      default:
        return <BookOpen className="h-5 w-5 text-gray-500" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Enterprise Legacy</h1>
          <p className="text-muted-foreground">Long-term ownership protection and documentation</p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Handbooks</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHandbooks}</div>
            <p className="text-xs text-muted-foreground">Published documents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Changes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingChangesCount}</div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Archives</CardTitle>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalArchives}</div>
            <p className="text-xs text-muted-foreground">Audit archives</p>
          </CardContent>
        </Card>

        <Card className={inconsistentCount > 0 ? "border-red-500" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Integrity Issues</CardTitle>
            {inconsistentCount > 0 ? (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inconsistentCount}</div>
            <p className="text-xs text-muted-foreground">Unresolved</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="handbooks">Handbooks</TabsTrigger>
          <TabsTrigger value="changes">Changes</TabsTrigger>
          <TabsTrigger value="archives">Archives</TabsTrigger>
          <TabsTrigger value="integrity">Integrity</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        {/* Handbooks Tab */}
        <TabsContent value="handbooks" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {handbooks.map((handbook) => (
              <Card key={handbook.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => setSelectedHandbook(handbook)}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    {getHandbookIcon(handbook.handbook_type)}
                    <div>
                      <CardTitle className="text-lg">{handbook.title}</CardTitle>
                      <CardDescription>v{handbook.version}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {handbook.content.substring(0, 150)}...
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <Badge variant="outline">{handbook.handbook_type}</Badge>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Handbook Dialog */}
          <Dialog open={!!selectedHandbook} onOpenChange={() => setSelectedHandbook(null)}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              {selectedHandbook && (
                <>
                  <DialogHeader>
                    <div className="flex items-center gap-3">
                      {getHandbookIcon(selectedHandbook.handbook_type)}
                      <div>
                        <DialogTitle>{selectedHandbook.title}</DialogTitle>
                        <DialogDescription>Version {selectedHandbook.version}</DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm">
                      {selectedHandbook.content}
                    </pre>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Change Requests Tab */}
        <TabsContent value="changes" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showChangeDialog} onOpenChange={setShowChangeDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Change Request
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Change Request</DialogTitle>
                  <DialogDescription>Submit a change request for approval</DialogDescription>
                </DialogHeader>
                <form onSubmit={async (e) => {
                  e.preventDefault()
                  const formData = new FormData(e.currentTarget)
                  await fetch("/api/admin/enterprise-legacy", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "create_change_request",
                      change_type: formData.get("change_type"),
                      change_scope: formData.get("change_scope"),
                      title: formData.get("title"),
                      description: formData.get("description"),
                      impact_level: formData.get("impact_level"),
                      rollback_plan: formData.get("rollback_plan"),
                      requested_by: "admin",
                    }),
                  })
                  setShowChangeDialog(false)
                  fetchData()
                }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select name="change_type" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="feature">Feature</SelectItem>
                          <SelectItem value="config">Config</SelectItem>
                          <SelectItem value="database">Database</SelectItem>
                          <SelectItem value="security">Security</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Scope</Label>
                      <Select name="change_scope" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select scope" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="system">System</SelectItem>
                          <SelectItem value="branch">Branch</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input name="title" required placeholder="Change title" />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea name="description" placeholder="Describe the change" />
                  </div>
                  <div className="space-y-2">
                    <Label>Impact Level</Label>
                    <Select name="impact_level" defaultValue="low">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Rollback Plan</Label>
                    <Textarea name="rollback_plan" placeholder="How to rollback if needed" />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Submit Request</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {changeRequests.map((request) => (
              <Card key={request.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{request.title}</h4>
                        {getStatusBadge(request.status)}
                        {getImpactBadge(request.impact_level)}
                      </div>
                      <p className="text-sm text-muted-foreground">{request.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Type: {request.change_type}</span>
                        <span>Scope: {request.change_scope}</span>
                        <span>Requested: {new Date(request.requested_at).toLocaleDateString("th-TH")}</span>
                      </div>
                    </div>
                    {request.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleApproveChange(request.id)}>
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600" onClick={() => {
                          const reason = prompt("Rejection reason:")
                          if (reason) handleRejectChange(request.id, reason)
                        }}>
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {changeRequests.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No change requests found
              </div>
            )}
          </div>
        </TabsContent>

        {/* Archives Tab */}
        <TabsContent value="archives" className="space-y-4">
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium">Type</th>
                  <th className="p-3 text-left font-medium">Period</th>
                  <th className="p-3 text-right font-medium">Records</th>
                  <th className="p-3 text-right font-medium">Amount</th>
                  <th className="p-3 text-center font-medium">Verified</th>
                  <th className="p-3 text-left font-medium">Archived</th>
                </tr>
              </thead>
              <tbody>
                {archives.map((archive) => (
                  <tr key={archive.id} className="border-b">
                    <td className="p-3">{archive.archive_type}</td>
                    <td className="p-3">
                      {archive.archive_month 
                        ? `${archive.archive_month}/${archive.archive_year}`
                        : archive.archive_year}
                    </td>
                    <td className="p-3 text-right">{archive.record_count.toLocaleString()}</td>
                    <td className="p-3 text-right">{archive.total_amount.toLocaleString()}</td>
                    <td className="p-3 text-center">
                      {archive.is_verified ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <Clock className="h-4 w-4 text-yellow-500 mx-auto" />
                      )}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {new Date(archive.archived_at).toLocaleDateString("th-TH")}
                    </td>
                  </tr>
                ))}
                {archives.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No archives found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Integrity Tab */}
        <TabsContent value="integrity" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleRunIntegrityCheck} disabled={runningCheck}>
              {runningCheck ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Run Integrity Check
            </Button>
          </div>

          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium">Date</th>
                  <th className="p-3 text-left font-medium">Type</th>
                  <th className="p-3 text-right font-medium">Expected</th>
                  <th className="p-3 text-right font-medium">Actual</th>
                  <th className="p-3 text-right font-medium">Difference</th>
                  <th className="p-3 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {integrityChecks.map((check) => (
                  <tr key={check.id} className="border-b">
                    <td className="p-3">{new Date(check.check_date).toLocaleDateString("th-TH")}</td>
                    <td className="p-3">{check.check_type}</td>
                    <td className="p-3 text-right">{check.expected_value?.toLocaleString() || "-"}</td>
                    <td className="p-3 text-right">{check.actual_value?.toLocaleString() || "-"}</td>
                    <td className={`p-3 text-right ${check.difference > 0 ? "text-red-500 font-medium" : ""}`}>
                      {check.difference?.toLocaleString() || "0"}
                    </td>
                    <td className="p-3 text-center">
                      {check.is_consistent ? (
                        <Badge className="bg-green-500">Consistent</Badge>
                      ) : check.resolved_at ? (
                        <Badge variant="secondary">Resolved</Badge>
                      ) : (
                        <Badge variant="destructive">Inconsistent</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {integrityChecks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No integrity checks found. Click {"\"Run Integrity Check\""} to start.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="space-y-4">
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium">Date</th>
                  <th className="p-3 text-left font-medium">User Type</th>
                  <th className="p-3 text-left font-medium">Permission</th>
                  <th className="p-3 text-left font-medium">Change</th>
                  <th className="p-3 text-left font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {permissionHistory.map((history) => (
                  <tr key={history.id} className="border-b">
                    <td className="p-3 text-sm">
                      {new Date(history.changed_at).toLocaleDateString("th-TH")}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline">{history.user_type}</Badge>
                    </td>
                    <td className="p-3">{history.permission_type}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-red-500 line-through">
                          {JSON.stringify(history.old_permissions).substring(0, 30)}...
                        </span>
                        <span className="text-green-500">
                          {JSON.stringify(history.new_permissions).substring(0, 30)}...
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {history.reason || "-"}
                    </td>
                  </tr>
                ))}
                {permissionHistory.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No permission changes recorded
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
