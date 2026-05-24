"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Shield, 
  Crown, 
  Scale, 
  RefreshCw, 
  Activity, 
  CheckCircle,
  AlertTriangle,
  Play,
  Zap,
  Lock,
  Award,
  TrendingUp
} from "lucide-react"

interface PreservationSeal {
  id: string
  seal_type: string
  seal_name: string
  seal_status: string
  seal_score: number
  last_verified_at: string
  pass_count: number
  fail_count: number
}

interface OwnerAuthority {
  id: string
  authority_type: string
  authority_name: string
  is_active: boolean
  authority_level: string
  description: string
  last_exercised_at: string
  exercise_count: number
}

interface GovernanceCheck {
  id: string
  check_type: string
  check_name: string
  status: string
  last_checked_at: string
  integrity_score: number
}

interface RecoveryReadiness {
  id: string
  recovery_type: string
  recovery_name: string
  status: string
  readiness_score: number
  last_tested_at: string
}

interface OperationalContinuity {
  id: string
  continuity_type: string
  continuity_name: string
  status: string
  uptime_percent: number
  last_checked_at: string
  incident_count: number
}

interface PreservationScore {
  id: string
  score_date: string
  eternal_preservation_score: number
  owner_authority_score: number
  governance_integrity_score: number
  financial_integrity_score: number
  operational_continuity_score: number
  recovery_readiness_score: number
  overall_score: number
}

export default function PreservationSealPage() {
  const [seals, setSeals] = useState<PreservationSeal[]>([])
  const [authority, setAuthority] = useState<OwnerAuthority[]>([])
  const [governance, setGovernance] = useState<GovernanceCheck[]>([])
  const [recovery, setRecovery] = useState<RecoveryReadiness[]>([])
  const [continuity, setContinuity] = useState<OperationalContinuity[]>([])
  const [scores, setScores] = useState<PreservationScore[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/preservation-seal")
      const data = await res.json()
      setSeals(data.seals || [])
      setAuthority(data.authority || [])
      setGovernance(data.governance || [])
      setRecovery(data.recovery || [])
      setContinuity(data.continuity || [])
      setScores(data.scores || [])
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (action: string, params: Record<string, string> = {}) => {
    setActionLoading(action)
    try {
      const res = await fetch("/api/admin/preservation-seal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...params })
      })
      if (res.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error("Error performing action:", error)
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "passed":
      case "ready":
      case "operational":
        return "bg-green-500/20 text-green-400 border-green-500/30"
      case "warning":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
      case "failed":
      case "error":
        return "bg-red-500/20 text-red-400 border-red-500/30"
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30"
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-400"
    if (score >= 70) return "text-yellow-400"
    return "text-red-400"
  }

  const latestScore = scores[0]
  const overallScore = latestScore?.overall_score || 100

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Shield className="h-8 w-8 text-amber-500" />
              Preservation Seal Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Eternal Owner Authority and Enterprise Preservation
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => handleAction("verify_all_seals")}
              disabled={actionLoading === "verify_all_seals"}
            >
              {actionLoading === "verify_all_seals" ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Verify All Seals
            </Button>
            <Button 
              onClick={() => handleAction("calculate_scores")}
              disabled={actionLoading === "calculate_scores"}
            >
              {actionLoading === "calculate_scores" ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Calculate Scores
            </Button>
          </div>
        </div>

        {/* Overall Score Card */}
        <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Overall Preservation Score</p>
                <p className={`text-5xl font-bold ${getScoreColor(overallScore)}`}>
                  {overallScore}%
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Last calculated: {latestScore?.score_date || "Never"}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-400">{latestScore?.eternal_preservation_score || 100}%</p>
                  <p className="text-xs text-muted-foreground">Preservation</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-400">{latestScore?.governance_integrity_score || 100}%</p>
                  <p className="text-xs text-muted-foreground">Governance</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-400">{latestScore?.recovery_readiness_score || 100}%</p>
                  <p className="text-xs text-muted-foreground">Recovery</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="seals" className="space-y-4">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="seals" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Seals
            </TabsTrigger>
            <TabsTrigger value="authority" className="flex items-center gap-2">
              <Crown className="h-4 w-4" />
              Authority
            </TabsTrigger>
            <TabsTrigger value="governance" className="flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Governance
            </TabsTrigger>
            <TabsTrigger value="recovery" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Recovery
            </TabsTrigger>
            <TabsTrigger value="continuity" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Continuity
            </TabsTrigger>
          </TabsList>

          {/* Preservation Seals Tab */}
          <TabsContent value="seals" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {seals.map((seal) => (
                <Card key={seal.id} className="bg-card/50 border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Award className="h-5 w-5 text-amber-500" />
                        {seal.seal_name}
                      </CardTitle>
                      <Badge className={getStatusColor(seal.seal_status)}>
                        {seal.seal_status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Seal Score</span>
                        <span className={getScoreColor(seal.seal_score)}>{seal.seal_score}%</span>
                      </div>
                      <Progress value={seal.seal_score} className="h-2" />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pass/Fail</span>
                      <span className="text-foreground">{seal.pass_count}/{seal.fail_count}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Last verified: {seal.last_verified_at ? new Date(seal.last_verified_at).toLocaleString() : "Never"}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => handleAction("verify_seal", { sealId: seal.id })}
                      disabled={actionLoading === "verify_seal"}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Verify Seal
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Owner Authority Tab */}
          <TabsContent value="authority" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {authority.map((auth) => (
                <Card key={auth.id} className="bg-card/50 border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Crown className="h-5 w-5 text-amber-500" />
                        {auth.authority_name}
                      </CardTitle>
                      <Badge className={auth.is_active ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"}>
                        {auth.authority_level}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{auth.description}</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Exercise Count</span>
                      <span className="text-foreground">{auth.exercise_count}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Last exercised: {auth.last_exercised_at ? new Date(auth.last_exercised_at).toLocaleString() : "Never"}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => handleAction("exercise_authority", { authorityId: auth.id, reason: "Manual exercise" })}
                      disabled={actionLoading === "exercise_authority"}
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Exercise Authority
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Governance Tab */}
          <TabsContent value="governance" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {governance.map((check) => (
                <Card key={check.id} className="bg-card/50 border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Scale className="h-5 w-5 text-blue-500" />
                        {check.check_name}
                      </CardTitle>
                      <Badge className={getStatusColor(check.status)}>
                        {check.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Integrity Score</span>
                        <span className={getScoreColor(check.integrity_score)}>{check.integrity_score}%</span>
                      </div>
                      <Progress value={check.integrity_score} className="h-2" />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Last checked: {check.last_checked_at ? new Date(check.last_checked_at).toLocaleString() : "Never"}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => handleAction("run_governance_check", { checkId: check.id })}
                      disabled={actionLoading === "run_governance_check"}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Run Check
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Recovery Tab */}
          <TabsContent value="recovery" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recovery.map((rec) => (
                <Card key={rec.id} className="bg-card/50 border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <RefreshCw className="h-5 w-5 text-purple-500" />
                        {rec.recovery_name}
                      </CardTitle>
                      <Badge className={getStatusColor(rec.status)}>
                        {rec.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Readiness Score</span>
                        <span className={getScoreColor(rec.readiness_score)}>{rec.readiness_score}%</span>
                      </div>
                      <Progress value={rec.readiness_score} className="h-2" />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Last tested: {rec.last_tested_at ? new Date(rec.last_tested_at).toLocaleString() : "Never"}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => handleAction("test_recovery", { recoveryId: rec.id })}
                      disabled={actionLoading === "test_recovery"}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Test Recovery
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Continuity Tab */}
          <TabsContent value="continuity" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {continuity.map((cont) => (
                <Card key={cont.id} className="bg-card/50 border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Activity className="h-5 w-5 text-green-500" />
                        {cont.continuity_name}
                      </CardTitle>
                      <Badge className={getStatusColor(cont.status)}>
                        {cont.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Uptime</span>
                        <span className={getScoreColor(Number(cont.uptime_percent))}>{cont.uptime_percent}%</span>
                      </div>
                      <Progress value={Number(cont.uptime_percent)} className="h-2" />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Incidents</span>
                      <span className="text-foreground">{cont.incident_count}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Last checked: {cont.last_checked_at ? new Date(cont.last_checked_at).toLocaleString() : "Never"}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => handleAction("check_continuity", { continuityId: cont.id })}
                      disabled={actionLoading === "check_continuity"}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Check Status
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Score History */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Preservation Score History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-4">Date</th>
                    <th className="text-center py-2 px-4">Preservation</th>
                    <th className="text-center py-2 px-4">Authority</th>
                    <th className="text-center py-2 px-4">Governance</th>
                    <th className="text-center py-2 px-4">Financial</th>
                    <th className="text-center py-2 px-4">Continuity</th>
                    <th className="text-center py-2 px-4">Recovery</th>
                    <th className="text-center py-2 px-4">Overall</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.slice(0, 7).map((score) => (
                    <tr key={score.id} className="border-b border-border/50">
                      <td className="py-2 px-4">{score.score_date}</td>
                      <td className={`text-center py-2 px-4 ${getScoreColor(score.eternal_preservation_score)}`}>
                        {score.eternal_preservation_score}%
                      </td>
                      <td className={`text-center py-2 px-4 ${getScoreColor(score.owner_authority_score)}`}>
                        {score.owner_authority_score}%
                      </td>
                      <td className={`text-center py-2 px-4 ${getScoreColor(score.governance_integrity_score)}`}>
                        {score.governance_integrity_score}%
                      </td>
                      <td className={`text-center py-2 px-4 ${getScoreColor(score.financial_integrity_score)}`}>
                        {score.financial_integrity_score}%
                      </td>
                      <td className={`text-center py-2 px-4 ${getScoreColor(score.operational_continuity_score)}`}>
                        {score.operational_continuity_score}%
                      </td>
                      <td className={`text-center py-2 px-4 ${getScoreColor(score.recovery_readiness_score)}`}>
                        {score.recovery_readiness_score}%
                      </td>
                      <td className={`text-center py-2 px-4 font-bold ${getScoreColor(score.overall_score)}`}>
                        {score.overall_score}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
