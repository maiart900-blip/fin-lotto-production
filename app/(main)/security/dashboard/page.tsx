'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { 
  Shield, ShieldAlert, ShieldCheck, ShieldX, Lock, Unlock,
  Key, KeyRound, Users, UserCheck, UserX, Activity,
  AlertTriangle, AlertCircle, CheckCircle, XCircle,
  Globe, Ban, Clock, RefreshCw, Eye, Search, Filter,
  Smartphone, Laptop, Monitor, MapPin, Fingerprint
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { fetcher } from '@/lib/fetcher';
import { toast } from 'sonner';

export default function SecurityDashboardPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [incidentFilter, setIncidentFilter] = useState<string>('all');
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  
  const { data: stats, mutate: mutateStats } = useSWR('/api/security/stats', fetcher);
  const { data: incidents, mutate: mutateIncidents } = useSWR('/api/security/incidents', fetcher);
  const { data: loginAttempts } = useSWR('/api/security/login-attempts?limit=50', fetcher);
  const { data: activeSessions } = useSWR('/api/security/sessions', fetcher);
  const { data: ipRules } = useSWR('/api/security/ip-rules', fetcher);
  
  const severityColors = {
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    critical: 'bg-red-500/20 text-red-400 border-red-500/30'
  };
  
  const statusColors = {
    open: 'bg-red-500/20 text-red-400 border-red-500/30',
    investigating: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    contained: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    resolved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    false_positive: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  };
  
  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const handleUpdateIncidentStatus = async (incidentId: string, status: string) => {
    try {
      await fetch(`/api/security/incidents/${incidentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      mutateIncidents();
      toast.success('อัพเดทสถานะสำเร็จ');
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1a] via-[#0d1425] to-[#0a0f1a] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Shield className="size-7 text-emerald-400" />
              Security Dashboard
            </h1>
            <p className="text-slate-400 mt-1">Enterprise Security Monitoring & Management</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="border-slate-700 text-slate-300"
              onClick={() => {
                mutateStats();
                mutateIncidents();
              }}
            >
              <RefreshCw className="size-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-black/40 border-emerald-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Security Score</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {stats?.security_score || 95}%
                  </p>
                </div>
                <div className="size-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <ShieldCheck className="size-6 text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-black/40 border-red-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Active Incidents</p>
                  <p className="text-2xl font-bold text-red-400">
                    {stats?.active_incidents || incidents?.filter((i: any) => i.status === 'open').length || 0}
                  </p>
                </div>
                <div className="size-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <ShieldAlert className="size-6 text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-black/40 border-amber-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Failed Logins (24h)</p>
                  <p className="text-2xl font-bold text-amber-400">
                    {stats?.failed_logins_24h || loginAttempts?.filter((l: any) => !l.is_successful).length || 0}
                  </p>
                </div>
                <div className="size-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <UserX className="size-6 text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-black/40 border-blue-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Active Sessions</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {stats?.active_sessions || activeSessions?.length || 0}
                  </p>
                </div>
                <div className="size-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Users className="size-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-black/40 border border-slate-700">
            <TabsTrigger value="overview" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
              Overview
            </TabsTrigger>
            <TabsTrigger value="incidents" className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400">
              Incidents
            </TabsTrigger>
            <TabsTrigger value="logins" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
              Login Activity
            </TabsTrigger>
            <TabsTrigger value="sessions" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
              Sessions
            </TabsTrigger>
            <TabsTrigger value="ip-rules" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
              IP Rules
            </TabsTrigger>
          </TabsList>
          
          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Incidents */}
              <Card className="bg-black/40 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <AlertTriangle className="size-5 text-amber-400" />
                    Recent Incidents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(incidents || []).slice(0, 5).map((incident: any) => (
                      <div 
                        key={incident.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-slate-700/50"
                      >
                        <div className="flex items-center gap-3">
                          <Badge className={cn('text-xs', severityColors[incident.severity as keyof typeof severityColors])}>
                            {incident.severity}
                          </Badge>
                          <div>
                            <p className="text-sm text-white">{incident.title}</p>
                            <p className="text-xs text-slate-500">{formatDate(incident.created_at)}</p>
                          </div>
                        </div>
                        <Badge className={cn('text-xs', statusColors[incident.status as keyof typeof statusColors])}>
                          {incident.status}
                        </Badge>
                      </div>
                    ))}
                    {(!incidents || incidents.length === 0) && (
                      <div className="text-center py-8 text-slate-500">
                        <ShieldCheck className="size-12 mx-auto mb-2 opacity-50" />
                        <p>No incidents reported</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Security Policies */}
              <Card className="bg-black/40 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Lock className="size-5 text-emerald-400" />
                    Security Policies
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { name: 'Password Policy', status: 'active', icon: Key, config: 'Min 8 chars, uppercase, number, special' },
                      { name: '2FA Policy', status: 'active', icon: Smartphone, config: 'Required for admin/staff' },
                      { name: 'Session Policy', status: 'active', icon: Clock, config: '30 min idle, 24h max' },
                      { name: 'Login Policy', status: 'active', icon: UserCheck, config: '5 attempts, 30 min lockout' },
                      { name: 'Withdrawal Policy', status: 'active', icon: ShieldAlert, config: '2FA required, 100k approval' },
                    ].map((policy, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-slate-700/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                            <policy.icon className="size-4 text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-sm text-white">{policy.name}</p>
                            <p className="text-xs text-slate-500">{policy.config}</p>
                          </div>
                        </div>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          Active
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Incidents Tab */}
          <TabsContent value="incidents" className="mt-4">
            <Card className="bg-black/40 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">Security Incidents</CardTitle>
                  <Select value={incidentFilter} onValueChange={setIncidentFilter}>
                    <SelectTrigger className="w-[180px] bg-black/40 border-slate-700 text-white">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0a0f1a] border-slate-700">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="investigating">Investigating</SelectItem>
                      <SelectItem value="contained">Contained</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 hover:bg-transparent">
                      <TableHead className="text-slate-400">Severity</TableHead>
                      <TableHead className="text-slate-400">Type</TableHead>
                      <TableHead className="text-slate-400">Title</TableHead>
                      <TableHead className="text-slate-400">Source IP</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-400">Created</TableHead>
                      <TableHead className="text-slate-400 text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(incidents || [])
                      .filter((i: any) => incidentFilter === 'all' || i.status === incidentFilter)
                      .map((incident: any) => (
                        <TableRow key={incident.id} className="border-slate-700/50 hover:bg-white/5">
                          <TableCell>
                            <Badge className={cn('text-xs', severityColors[incident.severity as keyof typeof severityColors])}>
                              {incident.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-300">{incident.incident_type}</TableCell>
                          <TableCell className="text-white font-medium">{incident.title}</TableCell>
                          <TableCell className="text-slate-400 font-mono text-sm">{incident.source_ip}</TableCell>
                          <TableCell>
                            <Badge className={cn('text-xs', statusColors[incident.status as keyof typeof statusColors])}>
                              {incident.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-400 text-sm">{formatDate(incident.created_at)}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-slate-400 hover:text-white"
                                onClick={() => setSelectedIncident(incident)}
                              >
                                <Eye className="size-4" />
                              </Button>
                              {incident.status === 'open' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-amber-400 hover:text-amber-300"
                                  onClick={() => handleUpdateIncidentStatus(incident.id, 'investigating')}
                                >
                                  <Activity className="size-4" />
                                </Button>
                              )}
                              {incident.status !== 'resolved' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-emerald-400 hover:text-emerald-300"
                                  onClick={() => handleUpdateIncidentStatus(incident.id, 'resolved')}
                                >
                                  <CheckCircle className="size-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                {(!incidents || incidents.length === 0) && (
                  <div className="text-center py-12 text-slate-500">
                    <ShieldCheck className="size-16 mx-auto mb-3 opacity-50" />
                    <p>No security incidents</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Login Activity Tab */}
          <TabsContent value="logins" className="mt-4">
            <Card className="bg-black/40 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Login Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 hover:bg-transparent">
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-400">Username</TableHead>
                      <TableHead className="text-slate-400">IP Address</TableHead>
                      <TableHead className="text-slate-400">Type</TableHead>
                      <TableHead className="text-slate-400">User Agent</TableHead>
                      <TableHead className="text-slate-400">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(loginAttempts || []).map((attempt: any) => (
                      <TableRow key={attempt.id} className="border-slate-700/50 hover:bg-white/5">
                        <TableCell>
                          {attempt.is_successful ? (
                            <div className="flex items-center gap-2 text-emerald-400">
                              <CheckCircle className="size-4" />
                              <span className="text-sm">Success</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-red-400">
                              <XCircle className="size-4" />
                              <span className="text-sm">Failed</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-white">{attempt.username || 'N/A'}</TableCell>
                        <TableCell className="text-slate-400 font-mono text-sm">{attempt.ip_address}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-slate-300 border-slate-600">
                            {attempt.attempt_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-500 text-xs max-w-[200px] truncate">
                          {attempt.user_agent}
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm">{formatDate(attempt.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Sessions Tab */}
          <TabsContent value="sessions" className="mt-4">
            <Card className="bg-black/40 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Active Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 hover:bg-transparent">
                      <TableHead className="text-slate-400">User</TableHead>
                      <TableHead className="text-slate-400">Type</TableHead>
                      <TableHead className="text-slate-400">IP Address</TableHead>
                      <TableHead className="text-slate-400">2FA</TableHead>
                      <TableHead className="text-slate-400">Last Activity</TableHead>
                      <TableHead className="text-slate-400">Expires</TableHead>
                      <TableHead className="text-slate-400 text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(activeSessions || []).map((session: any) => (
                      <TableRow key={session.id} className="border-slate-700/50 hover:bg-white/5">
                        <TableCell className="text-white">{session.user_id?.substring(0, 8)}...</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-slate-300 border-slate-600">
                            {session.user_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-400 font-mono text-sm">{session.ip_address}</TableCell>
                        <TableCell>
                          {session.is_2fa_verified ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                              Verified
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm">{formatDate(session.last_activity_at)}</TableCell>
                        <TableCell className="text-slate-400 text-sm">{formatDate(session.expires_at)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <Ban className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {(!activeSessions || activeSessions.length === 0) && (
                  <div className="text-center py-12 text-slate-500">
                    <Users className="size-16 mx-auto mb-3 opacity-50" />
                    <p>No active sessions</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* IP Rules Tab */}
          <TabsContent value="ip-rules" className="mt-4">
            <Card className="bg-black/40 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">IP Access Rules</CardTitle>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Add Rule
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 hover:bg-transparent">
                      <TableHead className="text-slate-400">Type</TableHead>
                      <TableHead className="text-slate-400">IP Address</TableHead>
                      <TableHead className="text-slate-400">Applies To</TableHead>
                      <TableHead className="text-slate-400">Description</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-400">Expires</TableHead>
                      <TableHead className="text-slate-400 text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ipRules || []).map((rule: any) => (
                      <TableRow key={rule.id} className="border-slate-700/50 hover:bg-white/5">
                        <TableCell>
                          <Badge className={cn(
                            'text-xs',
                            rule.rule_type === 'whitelist' 
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : rule.rule_type === 'blacklist'
                              ? 'bg-red-500/20 text-red-400 border-red-500/30'
                              : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          )}>
                            {rule.rule_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white font-mono">{rule.ip_address || rule.cidr}</TableCell>
                        <TableCell className="text-slate-400">{rule.applies_to}</TableCell>
                        <TableCell className="text-slate-400 max-w-[200px] truncate">{rule.description}</TableCell>
                        <TableCell>
                          {rule.is_active ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Active</Badge>
                          ) : (
                            <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm">
                          {rule.expires_at ? formatDate(rule.expires_at) : 'Never'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button variant="ghost" size="icon" className="size-8 text-slate-400 hover:text-white">
                              <Eye className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-8 text-red-400 hover:text-red-300">
                              <XCircle className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {(!ipRules || ipRules.length === 0) && (
                  <div className="text-center py-12 text-slate-500">
                    <Globe className="size-16 mx-auto mb-3 opacity-50" />
                    <p>No IP rules configured</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Incident Detail Dialog */}
      <Dialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}>
        <DialogContent className="bg-[#0a0f1a] border-slate-700 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-red-400" />
              Incident Details
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedIncident?.title}
            </DialogDescription>
          </DialogHeader>
          
          {selectedIncident && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge className={cn('text-xs', severityColors[selectedIncident.severity as keyof typeof severityColors])}>
                  {selectedIncident.severity}
                </Badge>
                <Badge className={cn('text-xs', statusColors[selectedIncident.status as keyof typeof statusColors])}>
                  {selectedIncident.status}
                </Badge>
                <span className="text-sm text-slate-400">{selectedIncident.incident_type}</span>
              </div>
              
              <div className="p-4 rounded-lg bg-black/40 border border-slate-700">
                <h4 className="text-sm font-medium text-slate-400 mb-2">Description</h4>
                <p className="text-white">{selectedIncident.description}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-black/40 border border-slate-700">
                  <h4 className="text-sm font-medium text-slate-400 mb-2">Source IP</h4>
                  <p className="text-white font-mono">{selectedIncident.source_ip}</p>
                </div>
                <div className="p-4 rounded-lg bg-black/40 border border-slate-700">
                  <h4 className="text-sm font-medium text-slate-400 mb-2">Created</h4>
                  <p className="text-white">{formatDate(selectedIncident.created_at)}</p>
                </div>
              </div>
              
              {selectedIncident.evidence && Object.keys(selectedIncident.evidence).length > 0 && (
                <div className="p-4 rounded-lg bg-black/40 border border-slate-700">
                  <h4 className="text-sm font-medium text-slate-400 mb-2">Evidence</h4>
                  <pre className="text-xs text-slate-300 overflow-auto">
                    {JSON.stringify(selectedIncident.evidence, null, 2)}
                  </pre>
                </div>
              )}
              
              <div className="flex justify-end gap-2">
                {selectedIncident.status !== 'resolved' && (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      handleUpdateIncidentStatus(selectedIncident.id, 'resolved');
                      setSelectedIncident(null);
                    }}
                  >
                    <CheckCircle className="size-4 mr-2" />
                    Mark Resolved
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="border-slate-700"
                  onClick={() => setSelectedIncident(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
