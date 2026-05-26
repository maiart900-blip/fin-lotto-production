'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, AlertCircle, Info, RefreshCw, Clock, Bug, Zap } from 'lucide-react'

type LogEntry = {
  id: string
  level: string
  category: string
  message: string
  duration_ms?: number
  metadata?: Record<string, unknown>
  error_message?: string
  endpoint?: string
  created_at: string
}

type LogsData = {
  logs: LogEntry[]
  stats: {
    total_errors: number
    total_warnings: number
    slow_requests: number
    time_range_hours: number
  }
  slow_requests: LogEntry[]
}

export default function ProductionLogsPage() {
  const [data, setData] = useState<LogsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [level, setLevel] = useState<string>('all')
  const [category, setCategory] = useState<string>('all')
  const [hours, setHours] = useState<string>('24')
  const [autoRefresh, setAutoRefresh] = useState(false)

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (level !== 'all') params.set('level', level)
      if (category !== 'all') params.set('category', category)
      params.set('hours', hours)
      
      const res = await fetch(`/api/operations/logs?${params}`)
      if (res.ok) {
        const result = await res.json()
        setData(result)
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    } finally {
      setLoading(false)
    }
  }, [level, category, hours])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchLogs, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchLogs])

  const getLevelIcon = (lvl: string) => {
    switch (lvl) {
      case 'critical': return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'warn': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'info': return <Info className="h-4 w-4 text-blue-500" />
      default: return <Bug className="h-4 w-4 text-gray-500" />
    }
  }

  const getLevelBadge = (lvl: string) => {
    const variants: Record<string, string> = {
      critical: 'bg-red-600 text-white',
      error: 'bg-red-500 text-white',
      warn: 'bg-yellow-500 text-black',
      info: 'bg-blue-500 text-white',
      debug: 'bg-gray-500 text-white',
    }
    return <Badge className={variants[lvl] || 'bg-gray-500'}>{lvl}</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Production Logs</h1>
        <div className="flex items-center gap-4">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold text-red-500">{data?.stats.total_errors || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <span className="text-2xl font-bold text-yellow-500">{data?.stats.total_warnings || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Slow Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <span className="text-2xl font-bold text-orange-500">{data?.stats.slow_requests || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Time Range</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{data?.stats.time_range_hours || 24}h</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warn">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="api">API</SelectItem>
                <SelectItem value="auth">Auth</SelectItem>
                <SelectItem value="settlement">Settlement</SelectItem>
                <SelectItem value="payout">Payout</SelectItem>
                <SelectItem value="worker">Worker</SelectItem>
                <SelectItem value="betting">Betting</SelectItem>
                <SelectItem value="performance">Performance</SelectItem>
                <SelectItem value="security">Security</SelectItem>
              </SelectContent>
            </Select>
            <Select value={hours} onValueChange={setHours}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 1 hour</SelectItem>
                <SelectItem value="6">Last 6 hours</SelectItem>
                <SelectItem value="24">Last 24 hours</SelectItem>
                <SelectItem value="48">Last 48 hours</SelectItem>
                <SelectItem value="168">Last 7 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Slow Requests */}
      {(data?.slow_requests?.length || 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-orange-500">Slow Requests ({'>'}1s)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data?.slow_requests.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-950 rounded">
                  <span className="font-mono text-sm">{log.endpoint || log.message}</span>
                  <Badge variant="outline" className="text-orange-600">{log.duration_ms}ms</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Log Entries ({data?.logs.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {data?.logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No logs found for the selected filters
              </div>
            ) : (
              data?.logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 border rounded hover:bg-muted/50">
                  {getLevelIcon(log.level)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getLevelBadge(log.level)}
                      <Badge variant="outline">{log.category}</Badge>
                      {log.duration_ms && (
                        <Badge variant="secondary">{log.duration_ms}ms</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString('th-TH')}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{log.message}</p>
                    {log.error_message && (
                      <p className="mt-1 text-xs text-red-500 font-mono">{log.error_message}</p>
                    )}
                    {log.endpoint && (
                      <p className="mt-1 text-xs text-muted-foreground font-mono">{log.endpoint}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
