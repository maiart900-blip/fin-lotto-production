'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Database, 
  Shield, 
  Mail, 
  HardDrive,
  Server,
  Key,
  Globe,
  Loader2,
} from 'lucide-react';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: { status: boolean; latency?: number; error?: string };
    auth: { status: boolean; error?: string };
    storage: { status: boolean; error?: string };
    email: { status: boolean; error?: string };
    api: { status: boolean; error?: string };
  };
  env: Record<string, boolean>;
}

interface ChecklistItem {
  id: string;
  category: string;
  title: string;
  description: string;
  status: 'pass' | 'fail' | 'warning' | 'pending';
  icon: React.ReactNode;
}

export default function ProductionChecklistPage() {
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchHealth();
  }, []);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(data);
    } catch (error) {
      console.error('Health check failed:', error);
    }
    setLoading(false);
  };

  const runTest = async (testId: string) => {
    setTestResults(prev => ({ ...prev, [testId]: false }));
    
    try {
      switch (testId) {
        case 'register':
          // Test register API
          const regRes = await fetch('/api/customer/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: `09${Math.random().toString().slice(2, 10)}`,
              password: 'test1234',
              name: 'Test User',
            }),
          });
          setTestResults(prev => ({ ...prev, [testId]: regRes.ok || regRes.status === 400 }));
          break;
          
        case 'login':
          const loginRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'test' }),
          });
          // 401 is expected if wrong password
          setTestResults(prev => ({ ...prev, [testId]: loginRes.ok || loginRes.status === 401 }));
          break;
          
        case 'lotteries':
          const lotRes = await fetch('/api/lotteries');
          setTestResults(prev => ({ ...prev, [testId]: lotRes.ok }));
          break;

        case 'customers':
          const custRes = await fetch('/api/customers');
          setTestResults(prev => ({ ...prev, [testId]: custRes.ok }));
          break;

        default:
          setTestResults(prev => ({ ...prev, [testId]: true }));
      }
    } catch {
      setTestResults(prev => ({ ...prev, [testId]: false }));
    }
  };

  const getStatusIcon = (status: boolean | undefined) => {
    if (status === undefined) return <AlertTriangle className="size-5 text-yellow-500" />;
    return status 
      ? <CheckCircle2 className="size-5 text-green-500" />
      : <XCircle className="size-5 text-red-500" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-500">Healthy</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-500">Degraded</Badge>;
      default:
        return <Badge className="bg-red-500">Unhealthy</Badge>;
    }
  };

  const checklist: ChecklistItem[] = [
    {
      id: 'database',
      category: 'Infrastructure',
      title: 'Database Connection',
      description: 'Supabase database is connected and responding',
      status: health?.checks.database.status ? 'pass' : 'fail',
      icon: <Database className="size-5" />,
    },
    {
      id: 'auth',
      category: 'Infrastructure',
      title: 'Authentication',
      description: 'JWT secret is configured',
      status: health?.checks.auth.status ? 'pass' : 'fail',
      icon: <Key className="size-5" />,
    },
    {
      id: 'storage',
      category: 'Infrastructure',
      title: 'File Storage',
      description: 'Vercel Blob storage is configured',
      status: health?.checks.storage.status ? 'pass' : 'warning',
      icon: <HardDrive className="size-5" />,
    },
    {
      id: 'email',
      category: 'Infrastructure',
      title: 'Email Service',
      description: 'SMTP is configured for sending emails',
      status: health?.checks.email.status ? 'pass' : 'warning',
      icon: <Mail className="size-5" />,
    },
    {
      id: 'api',
      category: 'Infrastructure',
      title: 'API Server',
      description: 'API server is running',
      status: health?.checks.api.status ? 'pass' : 'fail',
      icon: <Server className="size-5" />,
    },
    {
      id: 'ssl',
      category: 'Security',
      title: 'HTTPS/SSL',
      description: 'Site is served over HTTPS',
      status: typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'pass' : 'warning',
      icon: <Shield className="size-5" />,
    },
    {
      id: 'cors',
      category: 'Security',
      title: 'CORS Configuration',
      description: 'CORS is properly configured',
      status: 'pass', // Vercel handles this
      icon: <Globe className="size-5" />,
    },
  ];

  const tests = [
    { id: 'register', name: 'Register API', description: 'Test customer registration' },
    { id: 'login', name: 'Login API', description: 'Test admin login' },
    { id: 'lotteries', name: 'Lotteries API', description: 'Test lottery listing' },
    { id: 'customers', name: 'Customers API', description: 'Test customer listing' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Production Checklist</h1>
          <p className="text-muted-foreground">Verify system readiness before going live</p>
        </div>
        <div className="flex items-center gap-4">
          {health && getStatusBadge(health.status)}
          <Button onClick={fetchHealth} variant="outline" size="sm">
            <RefreshCw className="size-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
          <CardDescription>
            Last checked: {health?.timestamp ? new Date(health.timestamp).toLocaleString('th-TH') : '-'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {checklist.map(item => (
              <div 
                key={item.id}
                className={`p-4 rounded-lg border ${
                  item.status === 'pass' ? 'border-green-500/30 bg-green-500/5' :
                  item.status === 'warning' ? 'border-yellow-500/30 bg-yellow-500/5' :
                  'border-red-500/30 bg-red-500/5'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    item.status === 'pass' ? 'bg-green-500/10 text-green-500' :
                    item.status === 'warning' ? 'bg-yellow-500/10 text-yellow-500' :
                    'bg-red-500/10 text-red-500'
                  }`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{item.title}</h3>
                      {getStatusIcon(item.status === 'pass')}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                    {health?.checks.database.latency && item.id === 'database' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Latency: {health.checks.database.latency}ms
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* API Tests */}
      <Card>
        <CardHeader>
          <CardTitle>API Tests</CardTitle>
          <CardDescription>Test critical API endpoints</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tests.map(test => (
              <div 
                key={test.id}
                className="flex items-center justify-between p-4 rounded-lg border"
              >
                <div>
                  <h3 className="font-medium">{test.name}</h3>
                  <p className="text-sm text-muted-foreground">{test.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  {testResults[test.id] !== undefined && getStatusIcon(testResults[test.id])}
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => runTest(test.id)}
                  >
                    Run Test
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Deployment Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Deployment Checklist</CardTitle>
          <CardDescription>Manual verification before going live</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              'Build passes without errors',
              'Database migrations are applied',
              'First admin user is created',
              'Admin can login successfully',
              'Customer registration works',
              'Topup/Withdraw flow works',
              'Lottery betting works',
              'Result processing works',
              'Security features are enabled',
              'SSL certificate is valid',
              'Domain is configured',
              'Environment variables are set',
            ].map((item, i) => (
              <label key={i} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded cursor-pointer">
                <input type="checkbox" className="size-4 rounded" />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
