"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Shield,
  Lock,
  Unlock,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Crown,
  Activity,
  Settings,
  LogOut,
  Eye,
} from "lucide-react"

interface Summary {
  pendingApprovals: number
  activeLocks: number
  activeSessions: number
  suspiciousSessions: number
}

interface Policy {
  id: string
  policy_key: string
  policy_name: string
  policy_type: string
  threshold_amount: number
  requires_approval: boolean
  approval_levels: number
  owner_approval_required: boolean
  is_active: boolean
  description: string
}

interface ExecutiveLock {
  id: string
  lock_key: string
  lock_name: string
  lock_type: string
  is_locked: boolean
  locked_by: string | null
  locked_at: string | null
  reason: string | null
  affected_routes: string[]
}

interface Approval {
  id: string
  request_type: string
  entity_type: string
  entity_id: string
  amount: number
  reason: string
  requested_at: string
  level1_status: string
  level2_status: string | null
  owner_status: string | null
  final_status: string
}

interface Session {
  id: string
  user_id: string
  ip_address: string
  device_info: Record<string, string>
  login_at: string
  last_active_at: string
  is_suspicious: boolean
  suspicious_reason: string | null
}

interface OwnerAction {
  id: string
  action_type: string
  action_target: string
  action_detail: string
  performed_at: string
  reason: string | null
}

export default function OwnerControlPage() {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [policies, setPolicies] = useState<Policy[]>([])
  const [locks, setLocks] = useState<ExecutiveLock[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [suspiciousSessions, setSuspiciousSessions] = useState<Session[]>([])
  const [ownerActions, setOwnerActions] = useState<OwnerAction[]>([])

  // Dialogs
  const [lockDialog, setLockDialog] = useState<{ open: boolean; lock: ExecutiveLock | null }>({
    open: false,
    lock: null,
  })
  const [approvalDialog, setApprovalDialog] = useState<{
    open: boolean
    approval: Approval | null
    action: "approve" | "reject"
  }>({ open: false, approval: null, action: "approve" })
  const [sessionDialog, setSessionDialog] = useState<{ open: boolean; session: Session | null }>({
    open: false,
    session: null,
  })
  const [policyDialog, setPolicyDialog] = useState<{ open: boolean; policy: Policy | null }>({
    open: false,
    policy: null,
  })

  const [actionReason, setActionReason] = useState("")
  const [policyThreshold, setPolicyThreshold] = useState("")

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/owner-control")
      const data = await res.json()

      setSummary(data.summary)
      setPolicies(data.policies || [])
      setLocks(data.locks || [])
      setApprovals(data.approvals || [])
      setSessions(data.sessions || [])
      setSuspiciousSessions(data.suspiciousSessions || [])
      setOwnerActions(data.ownerActions || [])
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

  const handleToggleLock = async () => {
    if (!lockDialog.lock) return

    try {
      await fetch("/api/admin/owner-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_lock",
          lockKey: lockDialog.lock.lock_key,
          isLocked: !lockDialog.lock.is_locked,
          reason: actionReason,
          userId: "owner-user-id",
        }),
      })

      setLockDialog({ open: false, lock: null })
      setActionReason("")
      fetchData()
    } catch (error) {
      console.error("Toggle lock error:", error)
    }
  }

  const handleApprovalAction = async () => {
    if (!approvalDialog.approval) return

    try {
      await fetch("/api/admin/owner-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: approvalDialog.action === "approve" ? "approve_request" : "reject_request",
          requestId: approvalDialog.approval.id,
          level: "owner",
          note: actionReason,
          userId: "owner-user-id",
        }),
      })

      setApprovalDialog({ open: false, approval: null, action: "approve" })
      setActionReason("")
      fetchData()
    } catch (error) {
      console.error("Approval action error:", error)
    }
  }

  const handleForceLogout = async () => {
    if (!sessionDialog.session) return

    try {
      await fetch("/api/admin/owner-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "force_logout",
          sessionId: sessionDialog.session.id,
          reason: actionReason,
          userId: "owner-user-id",
        }),
      })

      setSessionDialog({ open: false, session: null })
      setActionReason("")
      fetchData()
    } catch (error) {
      console.error("Force logout error:", error)
    }
  }

  const handleUpdatePolicy = async () => {
    if (!policyDialog.policy) return

    try {
      await fetch("/api/admin/owner-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_policy",
          policyKey: policyDialog.policy.policy_key,
          thresholdAmount: parseFloat(policyThreshold),
          isActive: policyDialog.policy.is_active,
          userId: "owner-user-id",
        }),
      })

      setPolicyDialog({ open: false, policy: null })
      setPolicyThreshold("")
      fetchData()
    } catch (error) {
      console.error("Update policy error:", error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("th-TH")
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("th-TH").format(num)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" />
            Owner Control Center
          </h1>
          <p className="text-muted-foreground">ศูนย์ควบคุมระดับ Owner - Enterprise Governance</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          รีเฟรช
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">รอ Owner อนุมัติ</CardTitle>
            <Shield className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.pendingApprovals || 0}</div>
            <p className="text-xs text-muted-foreground">คำขอที่รอดำเนินการ</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Executive Locks</CardTitle>
            <Lock className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary?.activeLocks || 0}</div>
            <p className="text-xs text-muted-foreground">ล็อกที่ active อยู่</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.activeSessions || 0}</div>
            <p className="text-xs text-muted-foreground">Sessions ออนไลน์</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Suspicious</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {summary?.suspiciousSessions || 0}
            </div>
            <p className="text-xs text-muted-foreground">Sessions น่าสงสัย</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="approvals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="approvals">
            รออนุมัติ ({approvals.length})
          </TabsTrigger>
          <TabsTrigger value="locks">
            Executive Locks ({locks.filter((l) => l.is_locked).length})
          </TabsTrigger>
          <TabsTrigger value="policies">นโยบาย ({policies.length})</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="actions">ประวัติ Owner</TabsTrigger>
        </TabsList>

        {/* Pending Approvals Tab */}
        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle>คำขออนุมัติรอ Owner</CardTitle>
              <CardDescription>รายการที่ต้องการการอนุมัติจาก Owner</CardDescription>
            </CardHeader>
            <CardContent>
              {approvals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  ไม่มีคำขอที่รออนุมัติ
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ประเภท</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead className="text-right">จำนวน</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead>วันที่ขอ</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvals.map((approval) => (
                      <TableRow key={approval.id}>
                        <TableCell>
                          <Badge variant="outline">{approval.request_type}</Badge>
                        </TableCell>
                        <TableCell>{approval.entity_type}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatNumber(approval.amount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Badge
                              variant={
                                approval.level1_status === "approved"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              L1: {approval.level1_status}
                            </Badge>
                            {approval.level2_status && (
                              <Badge
                                variant={
                                  approval.level2_status === "approved"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                L2: {approval.level2_status}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(approval.requested_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() =>
                                setApprovalDialog({
                                  open: true,
                                  approval,
                                  action: "approve",
                                })
                              }
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              อนุมัติ
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                setApprovalDialog({
                                  open: true,
                                  approval,
                                  action: "reject",
                                })
                              }
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              ปฏิเสธ
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Executive Locks Tab */}
        <TabsContent value="locks">
          <Card>
            <CardHeader>
              <CardTitle>Executive Locks</CardTitle>
              <CardDescription>ล็อกการเข้าถึง routes และ actions ที่มีความเสี่ยงสูง</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ Lock</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>Routes ที่ได้รับผลกระทบ</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locks.map((lock) => (
                    <TableRow key={lock.id}>
                      <TableCell className="font-medium">{lock.lock_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{lock.lock_type}</Badge>
                      </TableCell>
                      <TableCell>
                        {lock.is_locked ? (
                          <Badge variant="destructive">
                            <Lock className="h-3 w-3 mr-1" />
                            Locked
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <Unlock className="h-3 w-3 mr-1" />
                            Unlocked
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">
                          {lock.affected_routes?.slice(0, 2).join(", ")}
                          {lock.affected_routes?.length > 2 && "..."}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={lock.is_locked ? "default" : "destructive"}
                          onClick={() => setLockDialog({ open: true, lock })}
                        >
                          {lock.is_locked ? (
                            <>
                              <Unlock className="h-4 w-4 mr-1" />
                              Unlock
                            </>
                          ) : (
                            <>
                              <Lock className="h-4 w-4 mr-1" />
                              Lock
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Policies Tab */}
        <TabsContent value="policies">
          <Card>
            <CardHeader>
              <CardTitle>Governance Policies</CardTitle>
              <CardDescription>นโยบายกำกับดูแลและ thresholds</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>นโยบาย</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead className="text-right">Threshold</TableHead>
                    <TableHead>Levels</TableHead>
                    <TableHead>Owner Required</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{policy.policy_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {policy.description}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{policy.policy_type}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(policy.threshold_amount)}
                      </TableCell>
                      <TableCell>{policy.approval_levels} levels</TableCell>
                      <TableCell>
                        {policy.owner_approval_required ? (
                          <Badge variant="default">Required</Badge>
                        ) : (
                          <Badge variant="secondary">Optional</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch checked={policy.is_active} disabled />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPolicyDialog({ open: true, policy })
                            setPolicyThreshold(policy.threshold_amount.toString())
                          }}
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          แก้ไข
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions">
          <div className="space-y-4">
            {/* Suspicious Sessions */}
            {suspiciousSessions.length > 0 && (
              <Card className="border-orange-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-600">
                    <AlertTriangle className="h-5 w-5" />
                    Sessions น่าสงสัย
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User ID</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>เหตุผล</TableHead>
                        <TableHead>Login</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suspiciousSessions.map((session) => (
                        <TableRow key={session.id}>
                          <TableCell className="font-medium">
                            {session.user_id.slice(0, 8)}...
                          </TableCell>
                          <TableCell>{session.ip_address}</TableCell>
                          <TableCell>
                            <Badge variant="destructive">
                              {session.suspicious_reason || "Unknown"}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(session.login_at)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setSessionDialog({ open: true, session })}
                            >
                              <LogOut className="h-4 w-4 mr-1" />
                              Force Logout
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Active Sessions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-500" />
                  Active Sessions
                </CardTitle>
                <CardDescription>Sessions ที่ออนไลน์อยู่ทั้งหมด</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Login</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.slice(0, 20).map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">
                          {session.user_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>{session.ip_address}</TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {session.device_info?.browser || "Unknown"}
                          </span>
                        </TableCell>
                        <TableCell>{formatDate(session.login_at)}</TableCell>
                        <TableCell>{formatDate(session.last_active_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="ghost">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSessionDialog({ open: true, session })}
                            >
                              <LogOut className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Owner Actions Tab */}
        <TabsContent value="actions">
          <Card>
            <CardHeader>
              <CardTitle>ประวัติการกระทำของ Owner</CardTitle>
              <CardDescription>Actions ที่ Owner ดำเนินการ</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>รายละเอียด</TableHead>
                    <TableHead>เหตุผล</TableHead>
                    <TableHead>วันที่</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ownerActions.map((action) => (
                    <TableRow key={action.id}>
                      <TableCell>
                        <Badge variant="outline">{action.action_type}</Badge>
                      </TableCell>
                      <TableCell>{action.action_target}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {action.action_detail}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {action.reason || "-"}
                      </TableCell>
                      <TableCell>{formatDate(action.performed_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Lock Dialog */}
      <Dialog open={lockDialog.open} onOpenChange={(open) => setLockDialog({ open, lock: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {lockDialog.lock?.is_locked ? "Unlock" : "Lock"} - {lockDialog.lock?.lock_name}
            </DialogTitle>
            <DialogDescription>
              {lockDialog.lock?.is_locked
                ? "ปลดล็อก routes ที่ถูกบล็อก"
                : "ล็อก routes เพื่อป้องกันการเข้าถึง"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">เหตุผล</label>
              <Textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="ระบุเหตุผล..."
                rows={3}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <strong>Routes ที่ได้รับผลกระทบ:</strong>
              <ul className="list-disc list-inside mt-1">
                {lockDialog.lock?.affected_routes?.map((route) => (
                  <li key={route}>{route}</li>
                ))}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLockDialog({ open: false, lock: null })}>
              ยกเลิก
            </Button>
            <Button
              variant={lockDialog.lock?.is_locked ? "default" : "destructive"}
              onClick={handleToggleLock}
            >
              {lockDialog.lock?.is_locked ? "Unlock" : "Lock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog
        open={approvalDialog.open}
        onOpenChange={(open) =>
          setApprovalDialog({ open, approval: null, action: "approve" })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalDialog.action === "approve" ? "อนุมัติ" : "ปฏิเสธ"} คำขอ
            </DialogTitle>
            <DialogDescription>
              {approvalDialog.approval?.request_type} - จำนวน{" "}
              {formatNumber(approvalDialog.approval?.amount || 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">หมายเหตุ</label>
              <Textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="ระบุหมายเหตุ..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setApprovalDialog({ open: false, approval: null, action: "approve" })
              }
            >
              ยกเลิก
            </Button>
            <Button
              variant={approvalDialog.action === "approve" ? "default" : "destructive"}
              onClick={handleApprovalAction}
            >
              {approvalDialog.action === "approve" ? "อนุมัติ" : "ปฏิเสธ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session Dialog */}
      <Dialog
        open={sessionDialog.open}
        onOpenChange={(open) => setSessionDialog({ open, session: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force Logout Session</DialogTitle>
            <DialogDescription>
              บังคับ logout session นี้ออกจากระบบ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-md text-sm">
              <p>
                <strong>User ID:</strong> {sessionDialog.session?.user_id}
              </p>
              <p>
                <strong>IP:</strong> {sessionDialog.session?.ip_address}
              </p>
              <p>
                <strong>Login:</strong>{" "}
                {sessionDialog.session && formatDate(sessionDialog.session.login_at)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">เหตุผล</label>
              <Textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="ระบุเหตุผลในการ force logout..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSessionDialog({ open: false, session: null })}
            >
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={handleForceLogout}>
              Force Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Policy Dialog */}
      <Dialog
        open={policyDialog.open}
        onOpenChange={(open) => setPolicyDialog({ open, policy: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขนโยบาย - {policyDialog.policy?.policy_name}</DialogTitle>
            <DialogDescription>{policyDialog.policy?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Threshold Amount</label>
              <Input
                type="number"
                value={policyThreshold}
                onChange={(e) => setPolicyThreshold(e.target.value)}
                placeholder="ระบุ threshold..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPolicyDialog({ open: false, policy: null })}
            >
              ยกเลิก
            </Button>
            <Button onClick={handleUpdatePolicy}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
