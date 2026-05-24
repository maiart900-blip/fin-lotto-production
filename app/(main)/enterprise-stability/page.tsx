"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Shield, 
  Lock, 
  Unlock,
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Activity,
  RefreshCw,
  Play,
  Zap,
  TrendingUp,
  Server,
  Database,
  Heart
} from "lucide-react"

interface HealthScore {
  id: string
  score_date: string
  enterprise_health_score: number
  financial_integrity_score: number
  governance_integrity_score: number
  realtime_stability_score: number
  branch_trust_score: number
  queue_health_score: number
  audit_integrity_score: number
  recovery_readiness_score: number
  overall_score: number
  calculated_at: string
}

interface Validation {
  id: string
  validation_type: string
  validation_name: string
  status: string
  last_validated_at: string | null
  validation_interval_hours: number
  pass_count: number
  fail_count: number
}

interface SovereigntyLock {
  id: string
  lock_category: string
  lock_key: string
  lock_name: string
  is_locked: boolean
  lock_level: string
  locked_at: string | null
  unlock_requires: string
}

interface Restriction {
  id: string
  restriction_type: string
  restriction_key: string
  restriction_name: string
  is_active: boolean
  severity: string
  description: string
  violation_count: number
}

interface ScalabilityTest {
  id: string
  test_type: string
  test_name: string
  status: string
  target_load: number | null
  actual_load: number | null
  response_time_ms: number | null
  error_rate_percent: number | null
  passed: boolean | null
  tested_at: string | null
  findings: string | null
}

export default function EnterpriseStabilityPage() {
  const [healthScores, setHealthScores] = useState<HealthScore[]>([])
  const [validations, setValidations] = useState<Validation[]>([])
  const [locks, setLocks] = useState<SovereigntyLock[]>([])
  const [restrictions, setRestrictions] = useState<Restriction[]>([])
  const [scalabilityTests, setScalabilityTests] = useState<ScalabilityTest[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/enterprise-stability")
      const data = await res.json()
      setHealthScores(data.healthScores || [])
      setValidations(data.validations || [])
      setLocks(data.locks || [])
      setRestrictions(data.restrictions || [])
      setScalabilityTests(data.scalabilityTests || [])
    } catch (error) {
      console.error("Failed to fetch:", error)
    } finally {
      setLoading(false)
    }
  }

  const runValidation = async (validationId: string) => {
    setActionLoading(validationId)
    try {
      await fetch("/api/admin/enterprise-stability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_validation", validation_id: validationId })
      })
      await fetchData()
    } finally {
      setActionLoading(null)
    }
  }

  const toggleLock = async (lockId: string, currentLocked: boolean) => {
    setActionLoading(lockId)
    try {
      await fetch("/api/admin/enterprise-stability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "toggle_lock", 
          lock_id: lockId, 
          is_locked: !currentLocked,
          user_id: "owner"
        })
      })
      await fetchData()
    } finally {
      setActionLoading(null)
    }
  }

  const toggleRestriction = async (restrictionId: string, currentActive: boolean) => {
    setActionLoading(restrictionId)
    try {
      await fetch("/api/admin/enterprise-stability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "toggle_restriction", 
          restriction_id: restrictionId, 
          is_active: !currentActive 
        })
      })
      await fetchData()
    } finally {
      setActionLoading(null)
    }
  }

  const runScalabilityTest = async (testId: string) => {
    setActionLoading(testId)
    try {
      await fetch("/api/admin/enterprise-stability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_scalability_test", test_id: testId })
      })
      await fetchData()
    } finally {
      setActionLoading(null)
    }
  }

  const calculateHealthScores = async () => {
    setActionLoading("calculate")
    try {
      await fetch("/api/admin/enterprise-stability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "calculate_health_scores" })
      })
      await fetchData()
    } finally {
      setActionLoading(null)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600"
    if (score >= 70) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreBg = (score: number) => {
    if (score >= 90) return "bg-green-100"
    if (score >= 70) return "bg-yellow-100"
    return "bg-red-100"
  }

  const todayScore = healthScores[0]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Enterprise Stability
          </h1>
          <p className="text-muted-foreground">Infinite Enterprise Stability + Operational Sovereignty</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={calculateHealthScores} disabled={actionLoading === "calculate"}>
            <Activity className="h-4 w-4 mr-2" />
            Calculate Scores
          </Button>
        </div>
      </div>

      {/* Overall Health Score */}
      {todayScore && (
        <Card className={getScoreBg(todayScore.overall_score)}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overall Enterprise Health</p>
                <p className={`text-5xl font-bold ${getScoreColor(todayScore.overall_score)}`}>
                  {todayScore.overall_score}%
                </p>
              </div>
              <Heart className={`h-16 w-16 ${getScoreColor(todayScore.overall_score)}`} />
            </div>
            <div className="grid grid-cols-4 gap-4 mt-6">
              <ScoreItem label="Financial" score={todayScore.financial_integrity_score} />
              <ScoreItem label="Governance" score={todayScore.governance_integrity_score} />
              <ScoreItem label="Realtime" score={todayScore.realtime_stability_score} />
              <ScoreItem label="Queue" score={todayScore.queue_health_score} />
              <ScoreItem label="Branch Trust" score={todayScore.branch_trust_score} />
              <ScoreItem label="Audit" score={todayScore.audit_integrity_score} />
              <ScoreItem label="Recovery" score={todayScore.recovery_readiness_score} />
              <ScoreItem label="Enterprise" score={todayScore.enterprise_health_score} />
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="validations" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="validations">Validations</TabsTrigger>
          <TabsTrigger value="locks">Sovereignty Locks</TabsTrigger>
          <TabsTrigger value="restrictions">Restrictions</TabsTrigger>
          <TabsTrigger value="scalability">Scalability</TabsTrigger>
        </TabsList>

        {/* Validations Tab */}
        <TabsContent value="validations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Stability Validations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {validations.map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {v.status === "passed" ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : v.status === "failed" ? (
                        <XCircle className="h-5 w-5 text-red-500" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      )}
                      <div>
                        <p className="font-medium">{v.validation_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Type: {v.validation_type} | Interval: {v.validation_interval_hours}h
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-sm">
                        <p className="text-green-600">Pass: {v.pass_count}</p>
                        <p className="text-red-600">Fail: {v.fail_count}</p>
                      </div>
                      <Badge variant={v.status === "passed" ? "default" : v.status === "failed" ? "destructive" : "secondary"}>
                        {v.status}
                      </Badge>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => runValidation(v.id)}
                        disabled={actionLoading === v.id}
                      >
                        {actionLoading === v.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sovereignty Locks Tab */}
        <TabsContent value="locks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Production Sovereignty Locks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {locks.map((lock) => (
                  <div key={lock.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {lock.is_locked ? (
                        <Lock className="h-5 w-5 text-red-500" />
                      ) : (
                        <Unlock className="h-5 w-5 text-green-500" />
                      )}
                      <div>
                        <p className="font-medium">{lock.lock_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Category: {lock.lock_category} | Level: {lock.lock_level}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={lock.is_locked ? "destructive" : "secondary"}>
                        {lock.is_locked ? "Locked" : "Unlocked"}
                      </Badge>
                      <Badge variant="outline">{lock.unlock_requires}</Badge>
                      <Button 
                        size="sm" 
                        variant={lock.is_locked ? "outline" : "destructive"}
                        onClick={() => toggleLock(lock.id, lock.is_locked)}
                        disabled={actionLoading === lock.id}
                      >
                        {actionLoading === lock.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : lock.is_locked ? (
                          <Unlock className="h-4 w-4" />
                        ) : (
                          <Lock className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Restrictions Tab */}
        <TabsContent value="restrictions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Enterprise Restrictions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {restrictions.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className={`h-5 w-5 ${r.is_active ? "text-red-500" : "text-gray-400"}`} />
                      <div>
                        <p className="font-medium">{r.restriction_name}</p>
                        <p className="text-sm text-muted-foreground">{r.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={r.severity === "critical" ? "destructive" : "secondary"}>
                        {r.severity}
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        Violations: {r.violation_count}
                      </div>
                      <Button 
                        size="sm" 
                        variant={r.is_active ? "destructive" : "outline"}
                        onClick={() => toggleRestriction(r.id, r.is_active)}
                        disabled={actionLoading === r.id}
                      >
                        {actionLoading === r.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : r.is_active ? (
                          "Disable"
                        ) : (
                          "Enable"
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scalability Tab */}
        <TabsContent value="scalability" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Scalability Tests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scalabilityTests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No scalability tests yet</p>
              ) : (
                <div className="space-y-3">
                  {scalabilityTests.map((test) => (
                    <div key={test.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Zap className={`h-5 w-5 ${
                          test.passed === true ? "text-green-500" : 
                          test.passed === false ? "text-red-500" : "text-yellow-500"
                        }`} />
                        <div>
                          <p className="font-medium">{test.test_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Type: {test.test_type} | Target: {test.target_load || "-"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {test.status === "completed" && (
                          <div className="text-right text-sm">
                            <p>Load: {test.actual_load}</p>
                            <p>Response: {test.response_time_ms}ms</p>
                            <p>Error: {test.error_rate_percent?.toFixed(2)}%</p>
                          </div>
                        )}
                        <Badge variant={
                          test.passed === true ? "default" : 
                          test.passed === false ? "destructive" : "secondary"
                        }>
                          {test.status}
                        </Badge>
                        {test.status === "pending" && (
                          <Button 
                            size="sm"
                            onClick={() => runScalabilityTest(test.id)}
                            disabled={actionLoading === test.id}
                          >
                            {actionLoading === test.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Server className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{validations.filter(v => v.status === "passed").length}/{validations.length}</p>
                <p className="text-sm text-muted-foreground">Validations Passed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Lock className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{locks.filter(l => l.is_locked).length}/{locks.length}</p>
                <p className="text-sm text-muted-foreground">Locks Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{restrictions.filter(r => r.is_active).length}/{restrictions.length}</p>
                <p className="text-sm text-muted-foreground">Restrictions Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{scalabilityTests.filter(t => t.passed).length}</p>
                <p className="text-sm text-muted-foreground">Tests Passed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ScoreItem({ label, score }: { label: string; score: number }) {
  const getColor = (s: number) => {
    if (s >= 90) return "text-green-600"
    if (s >= 70) return "text-yellow-600"
    return "text-red-600"
  }
  
  return (
    <div className="text-center">
      <p className={`text-xl font-bold ${getColor(score)}`}>{score}%</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      <Progress value={score} className="h-1 mt-1" />
    </div>
  )
}
