'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Play, 
  RefreshCw,
  Database,
  Users,
  Ticket,
  CreditCard,
  Shield,
  Settings,
  FileText,
  Gamepad2,
} from 'lucide-react';

interface TestResult {
  status: string;
  message: string;
  data?: unknown;
}

interface TestResponse {
  success: boolean;
  summary: {
    total: number;
    passed: number;
    failed: number;
    percentage: number;
  };
  results: Record<string, TestResult>;
  timestamp: string;
}

const CHECKLIST_ITEMS = [
  { id: 'auth', label: 'ระบบ Login/Register/Logout', icon: Users },
  { id: 'customer', label: 'หน้า Player ครบทุกหน้า', icon: Users },
  { id: 'admin', label: 'หน้า Admin ครบทุกหน้า', icon: Settings },
  { id: 'topup', label: 'ระบบเติมเงิน + Wallet Ledger', icon: CreditCard },
  { id: 'withdraw', label: 'ระบบถอนเงิน + Turnover Check', icon: CreditCard },
  { id: 'lottery', label: 'ระบบหวย + แทง + ผลรางวัล', icon: Ticket },
  { id: 'blocked', label: 'เลขอั้น + ปิดรับอัตโนมัติ', icon: Ticket },
  { id: 'promo', label: 'โปรโมชั่น + Free Credit', icon: FileText },
  { id: 'games', label: 'ระบบเกม/คาสิโน', icon: Gamepad2 },
  { id: 'report', label: 'รายงาน + Export CSV', icon: FileText },
  { id: 'audit', label: 'Audit Log ทุก Action', icon: FileText },
  { id: 'security', label: '2FA + Security Protection', icon: Shield },
  { id: 'backup', label: 'Backup/Restore', icon: Database },
  { id: 'storage', label: 'อัปโหลดรูป/สลิป', icon: Settings },
  { id: 'permission', label: 'Role/Permission Admin', icon: Shield },
];

export default function FinalChecklistPage() {
  const [testResults, setTestResults] = useState<TestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualChecks, setManualChecks] = useState<Record<string, boolean>>({});

  const runSystemTest = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/test-flow', { method: 'POST' });
      const data = await res.json();
      setTestResults(data);
    } catch (error) {
      console.error('Test error:', error);
    }
    setLoading(false);
  };

  const toggleCheck = (id: string) => {
    setManualChecks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const checkedCount = Object.values(manualChecks).filter(Boolean).length;
  const totalChecks = CHECKLIST_ITEMS.length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Final Checklist - FIN LOTTO R+</h1>
          <p className="text-muted-foreground">ตรวจสอบระบบทั้งหมดก่อน Production</p>
        </div>
        <Button onClick={runSystemTest} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          Run System Test
        </Button>
      </div>

      {/* System Test Results */}
      {testResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database & API Test Results
              <Badge variant={testResults.success ? 'default' : 'destructive'} className="ml-2">
                {testResults.summary.percentage}% Passed
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{testResults.summary.total}</div>
                <div className="text-sm text-muted-foreground">Total Tests</div>
              </div>
              <div className="text-center p-3 bg-green-500/10 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{testResults.summary.passed}</div>
                <div className="text-sm text-muted-foreground">Passed</div>
              </div>
              <div className="text-center p-3 bg-red-500/10 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{testResults.summary.failed}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{testResults.summary.percentage}%</div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </div>
            </div>

            <div className="space-y-2">
              {Object.entries(testResults.results).map(([key, result]) => (
                <div key={key} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    {result.status === 'ok' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="font-medium">{key}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{result.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Manual Checklist ({checkedCount}/{totalChecks})</span>
            <Badge variant={checkedCount === totalChecks ? 'default' : 'secondary'}>
              {Math.round((checkedCount / totalChecks) * 100)}%
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {CHECKLIST_ITEMS.map((item) => {
              const Icon = item.icon;
              const checked = manualChecks[item.id];
              return (
                <div
                  key={item.id}
                  onClick={() => toggleCheck(item.id)}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    checked ? 'bg-green-500/10 border-green-500/50' : 'hover:bg-muted'
                  }`}
                >
                  {checked ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <div className="h-5 w-5 border-2 rounded-full" />
                  )}
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className={checked ? 'line-through text-muted-foreground' : ''}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Production Ready */}
      {testResults?.success && checkedCount === totalChecks && (
        <Card className="border-green-500 bg-green-500/10">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-green-600 mb-2">Production Ready!</h2>
            <p className="text-muted-foreground">
              FIN LOTTO R+ ผ่านการทดสอบทั้งหมดแล้ว พร้อม Deploy Production
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
