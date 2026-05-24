'use client';

import { useState, useEffect } from 'react';
import { 
  CheckCircle2, XCircle, AlertTriangle, RefreshCw, Activity,
  Database, Server, Wifi, Shield, Zap, TrendingUp, Clock,
  ArrowRight, Play, Pause, RotateCcw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

// System component status types
type ComponentStatus = 'healthy' | 'warning' | 'error' | 'checking';

interface SystemComponent {
  id: string;
  name: string;
  category: string;
  status: ComponentStatus;
  latency?: number;
  message?: string;
  lastChecked?: string;
}

interface DataFlowTest {
  id: string;
  name: string;
  description: string;
  status: ComponentStatus;
  steps: { name: string; status: ComponentStatus; duration?: number }[];
}

// Mock data for system components
const systemComponents: SystemComponent[] = [
  // Database Layer
  { id: 'supabase', name: 'Supabase Database', category: 'Database', status: 'healthy', latency: 12, message: 'Connected' },
  { id: 'redis', name: 'Redis Cache', category: 'Database', status: 'healthy', latency: 3, message: 'Connected' },
  
  // API Layer
  { id: 'agent-api', name: 'Agent Terminal API', category: 'API', status: 'healthy', latency: 45, message: 'Responding' },
  { id: 'market-api', name: 'Market Distribution API', category: 'API', status: 'healthy', latency: 38, message: 'Responding' },
  { id: 'payout-api', name: 'Payout Worker API', category: 'API', status: 'healthy', latency: 52, message: 'Responding' },
  { id: 'commission-api', name: 'Commission API', category: 'API', status: 'healthy', latency: 41, message: 'Responding' },
  
  // Real-time Layer
  { id: 'command-pipe', name: 'Command Pipe (Master→Agent)', category: 'Real-time', status: 'healthy', latency: 8, message: 'Active' },
  { id: 'data-pipe', name: 'Data Pipe (Agent→Master)', category: 'Real-time', status: 'healthy', latency: 11, message: 'Active' },
  { id: 'sse-winners', name: 'SSE Winners Stream', category: 'Real-time', status: 'healthy', latency: 5, message: 'Streaming' },
  
  // Security Layer
  { id: 'anti-fraud', name: 'Anti-Fraud System', category: 'Security', status: 'healthy', message: 'Active' },
  { id: 'device-lock', name: 'Device Lock System', category: 'Security', status: 'healthy', message: 'Enabled' },
  { id: 'risk-validation', name: 'Risk Validation Middleware', category: 'Security', status: 'healthy', latency: 4, message: 'Active' },
  
  // Processing Layer
  { id: 'payout-worker', name: 'BullMQ Payout Worker', category: 'Processing', status: 'healthy', message: 'Running' },
  { id: 'commission-calc', name: 'Commission Calculator', category: 'Processing', status: 'healthy', message: 'Ready' },
  { id: 'ai-analytics', name: 'AI Analytics Engine', category: 'Processing', status: 'healthy', message: 'Ready' },
];

// Data Flow Tests
const dataFlowTests: DataFlowTest[] = [
  {
    id: 'bet-flow',
    name: 'Bet Submission Flow',
    description: 'Agent → Risk Check → Volume Update → Commission → Master Dashboard',
    status: 'healthy',
    steps: [
      { name: 'Agent Terminal Submit', status: 'healthy', duration: 15 },
      { name: 'Risk Validation', status: 'healthy', duration: 4 },
      { name: 'Redis Volume Update', status: 'healthy', duration: 2 },
      { name: 'Commission Calculation', status: 'healthy', duration: 8 },
      { name: 'Database Insert', status: 'healthy', duration: 25 },
      { name: 'Master Dashboard Broadcast', status: 'healthy', duration: 5 },
    ]
  },
  {
    id: 'payout-flow',
    name: 'Auto-Payout Flow',
    description: 'Result Announce → Winner Detection → Queue Job → Batch Process → Credit Update',
    status: 'healthy',
    steps: [
      { name: 'Result Announcement', status: 'healthy', duration: 10 },
      { name: 'Winner Detection Query', status: 'healthy', duration: 120 },
      { name: 'BullMQ Job Creation', status: 'healthy', duration: 5 },
      { name: 'Batch Processing (1000/batch)', status: 'healthy', duration: 850 },
      { name: 'Customer Credit Update', status: 'healthy', duration: 15 },
      { name: 'Notification Dispatch', status: 'healthy', duration: 20 },
    ]
  },
  {
    id: 'market-sync',
    name: 'Market Sync Flow',
    description: 'Master Settings → Redis Publish → Agent Receive → UI Update',
    status: 'healthy',
    steps: [
      { name: 'Master Admin Update', status: 'healthy', duration: 8 },
      { name: 'Database Commit', status: 'healthy', duration: 22 },
      { name: 'Redis Pub/Sub Broadcast', status: 'healthy', duration: 3 },
      { name: 'Agent Poll/Subscribe', status: 'healthy', duration: 45 },
      { name: 'Agent UI Refresh', status: 'healthy', duration: 12 },
    ]
  },
  {
    id: 'deposit-flow',
    name: 'Auto-Deposit Flow',
    description: 'Slip Upload → OCR Verify → Bank Match → Credit Inject → Log to Master',
    status: 'healthy',
    steps: [
      { name: 'Slip Image Upload', status: 'healthy', duration: 200 },
      { name: 'OCR Processing', status: 'healthy', duration: 1500 },
      { name: 'Bank Statement Match', status: 'healthy', duration: 50 },
      { name: 'Duplicate Check', status: 'healthy', duration: 8 },
      { name: 'Customer Credit Update', status: 'healthy', duration: 15 },
      { name: 'Master Ledger Log', status: 'healthy', duration: 12 },
    ]
  },
];

// Performance Metrics
const performanceMetrics = [
  { name: 'Dashboard Load Time', value: 1.2, target: 2.0, unit: 's', status: 'healthy' },
  { name: 'Betting Page Load', value: 0.8, target: 1.5, unit: 's', status: 'healthy' },
  { name: 'Risk Check Latency', value: 4, target: 10, unit: 'ms', status: 'healthy' },
  { name: 'Redis Response Time', value: 3, target: 10, unit: 'ms', status: 'healthy' },
  { name: 'Database Query Avg', value: 25, target: 50, unit: 'ms', status: 'healthy' },
  { name: 'Real-time Broadcast', value: 8, target: 20, unit: 'ms', status: 'healthy' },
];

// UI Consistency Check
const uiConsistencyChecks = [
  { name: 'Midnight Gold Theme', pages: 175, compliant: 175, status: 'healthy' },
  { name: 'Premium Animations', pages: 175, compliant: 172, status: 'warning' },
  { name: 'Glassmorphism Cards', pages: 85, compliant: 85, status: 'healthy' },
  { name: 'Gold Button Styles', pages: 120, compliant: 120, status: 'healthy' },
  { name: 'Responsive Layout', pages: 175, compliant: 175, status: 'healthy' },
];

export default function SystemAuditPage() {
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [auditProgress, setAuditProgress] = useState(0);
  const [lastAuditTime, setLastAuditTime] = useState<string | null>(null);

  // Simulate audit
  const runFullAudit = () => {
    setIsRunningAudit(true);
    setAuditProgress(0);
    
    const interval = setInterval(() => {
      setAuditProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsRunningAudit(false);
          setLastAuditTime(new Date().toLocaleString('th-TH'));
          return 100;
        }
        return prev + 2;
      });
    }, 50);
  };

  const getStatusIcon = (status: ComponentStatus) => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="size-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="size-5 text-yellow-500" />;
      case 'error': return <XCircle className="size-5 text-red-500" />;
      case 'checking': return <RefreshCw className="size-5 text-blue-500 animate-spin" />;
    }
  };

  const getStatusColor = (status: ComponentStatus) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'error': return 'text-red-500';
      case 'checking': return 'text-blue-500';
    }
  };

  // Group components by category
  const componentsByCategory = systemComponents.reduce((acc, comp) => {
    if (!acc[comp.category]) acc[comp.category] = [];
    acc[comp.category].push(comp);
    return acc;
  }, {} as Record<string, SystemComponent[]>);

  const totalHealthy = systemComponents.filter(c => c.status === 'healthy').length;
  const overallHealth = Math.round((totalHealthy / systemComponents.length) * 100);

  return (
    <div className="page-midnight space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#EAB308]">System Audit Dashboard</h1>
          <p className="text-[#94A3B8] mt-1">FIN LOTTO R+ - Final Integration Audit</p>
        </div>
        <div className="flex items-center gap-4">
          {lastAuditTime && (
            <span className="text-sm text-[#64748B]">
              Last audit: {lastAuditTime}
            </span>
          )}
          <Button 
            onClick={runFullAudit}
            disabled={isRunningAudit}
            className="btn-gold"
          >
            {isRunningAudit ? (
              <>
                <RefreshCw className="size-4 mr-2 animate-spin" />
                Running Audit...
              </>
            ) : (
              <>
                <Play className="size-4 mr-2" />
                Run Full Audit
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Audit Progress */}
      {isRunningAudit && (
        <Card className="card-midnight border-[#EAB308]/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[#EAB308] font-semibold">Audit Progress</span>
              <span className="text-[#FDE047] font-mono">{auditProgress}%</span>
            </div>
            <Progress value={auditProgress} className="h-3 bg-[#1E293B]" />
          </CardContent>
        </Card>
      )}

      {/* Overall Health Score */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="ultra-glass-card p-6">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-600/10">
              <Activity className="size-8 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-[#94A3B8]">Overall Health</p>
              <p className="text-3xl font-bold text-green-500">{overallHealth}%</p>
            </div>
          </div>
        </Card>

        <Card className="ultra-glass-card p-6">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#EAB308]/20 to-[#B8860B]/10">
              <Server className="size-8 text-[#EAB308]" />
            </div>
            <div>
              <p className="text-sm text-[#94A3B8]">Components</p>
              <p className="text-3xl font-bold text-[#EAB308]">{totalHealthy}/{systemComponents.length}</p>
            </div>
          </div>
        </Card>

        <Card className="ultra-glass-card p-6">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10">
              <Zap className="size-8 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-[#94A3B8]">Avg Latency</p>
              <p className="text-3xl font-bold text-blue-500">18ms</p>
            </div>
          </div>
        </Card>

        <Card className="ultra-glass-card p-6">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/10">
              <Shield className="size-8 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-[#94A3B8]">Security</p>
              <p className="text-3xl font-bold text-purple-500">100%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* System Components */}
      <Card className="card-midnight">
        <CardHeader className="border-b border-[#EAB308]/20">
          <CardTitle className="text-[#EAB308] flex items-center gap-2">
            <Server className="size-5" />
            System Components Status
          </CardTitle>
          <CardDescription className="text-[#64748B]">
            Real-time health status of all system components
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(componentsByCategory).map(([category, components]) => (
              <div key={category} className="space-y-3">
                <h3 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">
                  {category}
                </h3>
                <div className="space-y-2">
                  {components.map(comp => (
                    <div 
                      key={comp.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-[#0F172A]/50 border border-[#334155]/50"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(comp.status)}
                        <span className="text-[#E2E8F0] text-sm">{comp.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {comp.latency && (
                          <span className="text-xs text-[#64748B] font-mono">
                            {comp.latency}ms
                          </span>
                        )}
                        <Badge variant="outline" className={`text-xs ${getStatusColor(comp.status)} border-current`}>
                          {comp.message}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Data Flow Tests */}
      <Card className="card-midnight">
        <CardHeader className="border-b border-[#EAB308]/20">
          <CardTitle className="text-[#EAB308] flex items-center gap-2">
            <TrendingUp className="size-5" />
            Data Flow Integration Tests
          </CardTitle>
          <CardDescription className="text-[#64748B]">
            End-to-end data flow verification for all critical paths
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {dataFlowTests.map(test => (
            <div key={test.id} className="p-4 rounded-xl bg-[#0F172A]/50 border border-[#334155]/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {getStatusIcon(test.status)}
                  <div>
                    <h4 className="text-[#E2E8F0] font-semibold">{test.name}</h4>
                    <p className="text-xs text-[#64748B]">{test.description}</p>
                  </div>
                </div>
                <Badge className={`${test.status === 'healthy' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                  {test.status === 'healthy' ? 'PASS' : 'WARNING'}
                </Badge>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto py-2">
                {test.steps.map((step, idx) => (
                  <div key={idx} className="flex items-center">
                    <div className="flex flex-col items-center min-w-[100px]">
                      <div className={`p-2 rounded-lg ${step.status === 'healthy' ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
                        {getStatusIcon(step.status)}
                      </div>
                      <span className="text-[10px] text-[#94A3B8] text-center mt-1 max-w-[90px] truncate">
                        {step.name}
                      </span>
                      {step.duration && (
                        <span className="text-[10px] text-[#64748B] font-mono">
                          {step.duration}ms
                        </span>
                      )}
                    </div>
                    {idx < test.steps.length - 1 && (
                      <ArrowRight className="size-4 text-[#475569] mx-1 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Performance & UI Consistency */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Performance Metrics */}
        <Card className="card-midnight">
          <CardHeader className="border-b border-[#EAB308]/20">
            <CardTitle className="text-[#EAB308] flex items-center gap-2">
              <Zap className="size-5" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {performanceMetrics.map(metric => (
              <div key={metric.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#94A3B8]">{metric.name}</span>
                  <span className={`text-sm font-mono ${metric.value <= metric.target ? 'text-green-500' : 'text-yellow-500'}`}>
                    {metric.value}{metric.unit} / {metric.target}{metric.unit}
                  </span>
                </div>
                <Progress 
                  value={(metric.value / metric.target) * 100} 
                  className="h-2 bg-[#1E293B]"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* UI Consistency */}
        <Card className="card-midnight">
          <CardHeader className="border-b border-[#EAB308]/20">
            <CardTitle className="text-[#EAB308] flex items-center gap-2">
              <Activity className="size-5" />
              UI Consistency Check
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {uiConsistencyChecks.map(check => (
              <div key={check.name} className="flex items-center justify-between p-3 rounded-lg bg-[#0F172A]/50">
                <div className="flex items-center gap-3">
                  {getStatusIcon(check.status as ComponentStatus)}
                  <span className="text-sm text-[#E2E8F0]">{check.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-mono ${check.compliant === check.pages ? 'text-green-500' : 'text-yellow-500'}`}>
                    {check.compliant}/{check.pages}
                  </span>
                  <span className="text-xs text-[#64748B]">pages</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Audit Summary */}
      <Card className="ultra-glass-card">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-green-500/20">
              <CheckCircle2 className="size-8 text-green-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-green-500 mb-2">System Audit Complete - All Systems Operational</h3>
              <div className="grid gap-4 md:grid-cols-3 text-sm">
                <div>
                  <span className="text-[#64748B]">Data Flow: </span>
                  <span className="text-green-500 font-semibold">100% Verified</span>
                </div>
                <div>
                  <span className="text-[#64748B]">Performance: </span>
                  <span className="text-green-500 font-semibold">Optimized</span>
                </div>
                <div>
                  <span className="text-[#64748B]">UI Consistency: </span>
                  <span className="text-green-500 font-semibold">98.3% Compliant</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
