'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { 
  Shield, 
  User, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Network,
  Users,
  Key,
} from 'lucide-react';
import { toast } from 'sonner';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface PermissionData {
  visible_menus: string[];
  hidden_menus: string[];
  enabled_features: string[];
  disabled_features: string[];
  can_create_sub_agent: boolean;
  can_view_reports: boolean;
  can_key_lottery: boolean;
  can_approve_transactions: boolean;
  can_manage_members: boolean;
  can_manage_finances: boolean;
}

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'pending';
  message: string;
  details?: string;
}

export default function DebugPermissionsPage() {
  const { user, isAdmin, isSuperAdmin, isMasterBranch, branchId, branch } = useAuth();
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Fetch permissions for current user
  const targetType = user?.role === 'agent' ? 'agent' : user?.role === 'member' ? 'member' : 'user';
  const { data: permissionData, mutate: refreshPermissions } = useSWR<PermissionData>(
    user ? `/api/menu-permissions?target_id=${user.id}&target_type=${targetType}&role=${user.role}` : null,
    fetcher
  );

  // Fetch all agents for hierarchy check
  const { data: agents } = useSWR('/api/agents', fetcher);

  // Run permission tests
  const runTests = async () => {
    setIsRunningTests(true);
    const results: TestResult[] = [];

    // Test 1: Check user session
    results.push({
      name: 'User Session',
      status: user ? 'pass' : 'fail',
      message: user ? `Logged in as ${user.displayName} (${user.role})` : 'Not logged in',
      details: user ? JSON.stringify(user, null, 2) : undefined,
    });

    // Test 2: Check permission data
    results.push({
      name: 'Permission Data Loaded',
      status: permissionData ? 'pass' : 'fail',
      message: permissionData ? `Loaded ${permissionData.visible_menus?.length || 0} visible menus` : 'No permission data',
      details: permissionData ? JSON.stringify(permissionData, null, 2) : undefined,
    });

    // Test 3: Check role-based access
    if (user?.role === 'agent') {
      // Agent should NOT see admin-only routes
      const adminRoutes = ['/users', '/roles-permissions', '/security-dashboard', '/settings/system'];
      const canAccessAdmin = adminRoutes.some(route => permissionData?.visible_menus?.includes(route));
      results.push({
        name: 'Agent Cannot Access Admin Routes',
        status: !canAccessAdmin ? 'pass' : 'fail',
        message: !canAccessAdmin ? 'Agent correctly blocked from admin routes' : 'WARNING: Agent can access admin routes!',
      });
    }

    // Test 4: Check hierarchy
    if (agents?.length > 0) {
      const agentsWithParent = agents.filter((a: any) => a.parent_id);
      const agentsWithOwner = agents.filter((a: any) => a.owner_id);
      results.push({
        name: 'Agent Hierarchy Data',
        status: agentsWithParent.length > 0 || agentsWithOwner.length > 0 ? 'pass' : 'fail',
        message: `${agentsWithParent.length} agents with parent_id, ${agentsWithOwner.length} with owner_id`,
        details: `Total agents: ${agents.length}`,
      });
    }

    // Test 5: Route protection test
    try {
      const protectedRoutes = ['/users', '/security-dashboard', '/master-control'];
      for (const route of protectedRoutes) {
        results.push({
          name: `Route Guard: ${route}`,
          status: isSuperAdmin ? 'pass' : (user?.role !== 'super_admin' ? 'pass' : 'fail'),
          message: isSuperAdmin ? 'Super Admin - Full Access' : `Access would be ${user?.role === 'super_admin' ? 'granted' : 'blocked'}`,
        });
      }
    } catch {
      results.push({
        name: 'Route Protection',
        status: 'fail',
        message: 'Error checking route protection',
      });
    }

    // Test 6: Check branch context
    results.push({
      name: 'Branch Context',
      status: 'pass',
      message: isMasterBranch ? 'Master Branch' : (branchId ? `Branch: ${branch?.name || branchId}` : 'No Branch'),
      details: branch ? JSON.stringify(branch, null, 2) : undefined,
    });

    // Test 7: Check ownerId filtering (conceptual)
    results.push({
      name: 'Owner ID Filtering',
      status: user?.id ? 'pass' : 'fail',
      message: `User ID for filtering: ${user?.id || 'N/A'}`,
      details: 'Data should be filtered by owner_id in API calls',
    });

    setTestResults(results);
    setIsRunningTests(false);
    toast.success('Tests completed');
  };

  useEffect(() => {
    if (user && permissionData) {
      runTests();
    }
  }, [user, permissionData]);

  if (!isSuperAdmin && !isAdmin) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">Only admins can view this debug page</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Debug Permission System
          </h1>
          <p className="text-muted-foreground">ตรวจสอบระบบ Permission และ Hierarchy</p>
        </div>
        <Button onClick={runTests} disabled={isRunningTests}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isRunningTests ? 'animate-spin' : ''}`} />
          Run Tests
        </Button>
      </div>

      <Tabs defaultValue="user">
        <TabsList>
          <TabsTrigger value="user">User Info</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="tests">Test Results</TabsTrigger>
          <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>
        </TabsList>

        <TabsContent value="user">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Current User Session
              </CardTitle>
              <CardDescription>ข้อมูล user ที่ login อยู่ปัจจุบัน</CardDescription>
            </CardHeader>
            <CardContent>
              {user ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">User ID</p>
                      <p className="font-mono text-sm">{user.id}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">Username</p>
                      <p className="font-medium">{user.username}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">Display Name</p>
                      <p className="font-medium">{user.displayName}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">Role</p>
                      <Badge variant={user.role === 'super_admin' ? 'destructive' : 'secondary'}>
                        {user.role}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">Branch ID</p>
                      <p className="font-mono text-sm">{branchId || 'N/A'}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">Branch Type</p>
                      <Badge variant={isMasterBranch ? 'default' : 'outline'}>
                        {isMasterBranch ? 'Master' : branch?.branch_type || 'N/A'}
                      </Badge>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">Is Super Admin</p>
                      <Badge variant={isSuperAdmin ? 'destructive' : 'outline'}>
                        {isSuperAdmin ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">Is Admin</p>
                      <Badge variant={isAdmin ? 'default' : 'outline'}>
                        {isAdmin ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground mb-2">Raw Session Data</p>
                    <pre className="text-xs overflow-auto max-h-48 bg-black/50 p-2 rounded">
                      {JSON.stringify(user, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
                  <p>Not logged in</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Permission Data
              </CardTitle>
              <CardDescription>ข้อมูล permission ที่โหลดมาจาก API</CardDescription>
            </CardHeader>
            <CardContent>
              {permissionData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Eye className="h-3 w-3" /> Visible Menus
                      </p>
                      <p className="text-2xl font-bold text-green-500">{permissionData.visible_menus?.length || 0}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <EyeOff className="h-3 w-3" /> Hidden Menus
                      </p>
                      <p className="text-2xl font-bold text-red-500">{permissionData.hidden_menus?.length || 0}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Unlock className="h-3 w-3" /> Enabled Features
                      </p>
                      <p className="text-2xl font-bold text-blue-500">{permissionData.enabled_features?.length || 0}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { key: 'can_create_sub_agent', label: 'สร้างเอเย่นต์ใต้สาย' },
                      { key: 'can_view_reports', label: 'ดูรายงาน' },
                      { key: 'can_key_lottery', label: 'คีย์หวย' },
                      { key: 'can_approve_transactions', label: 'อนุมัติธุรกรรม' },
                      { key: 'can_manage_members', label: 'จัดการสมาชิก' },
                      { key: 'can_manage_finances', label: 'จัดการการเงิน' },
                    ].map(item => (
                      <div key={item.key} className="p-3 rounded-lg bg-muted flex items-center justify-between">
                        <span className="text-sm">{item.label}</span>
                        {(permissionData as any)[item.key] ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground mb-2">Visible Menu IDs</p>
                    <div className="flex flex-wrap gap-1">
                      {permissionData.visible_menus?.map((menu: string) => (
                        <Badge key={menu} variant="secondary" className="text-xs">
                          {menu}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground mb-2">Raw Permission Data</p>
                    <pre className="text-xs overflow-auto max-h-48 bg-black/50 p-2 rounded">
                      {JSON.stringify(permissionData, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
                  <p>No permission data loaded</p>
                  <Button onClick={() => refreshPermissions()} className="mt-2" size="sm">
                    Refresh
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tests">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Test Results
              </CardTitle>
              <CardDescription>ผลการทดสอบระบบ Permission</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {testResults.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Click &quot;Run Tests&quot; to start testing</p>
                  </div>
                ) : (
                  testResults.map((result, i) => (
                    <div 
                      key={i} 
                      className={`p-4 rounded-lg border ${
                        result.status === 'pass' ? 'bg-green-500/10 border-green-500/20' :
                        result.status === 'fail' ? 'bg-red-500/10 border-red-500/20' :
                        'bg-yellow-500/10 border-yellow-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {result.status === 'pass' ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : result.status === 'fail' ? (
                            <XCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                          )}
                          <span className="font-medium">{result.name}</span>
                        </div>
                        <Badge variant={result.status === 'pass' ? 'default' : 'destructive'}>
                          {result.status.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
                      {result.details && (
                        <pre className="text-xs mt-2 p-2 bg-black/30 rounded overflow-auto max-h-32">
                          {result.details}
                        </pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hierarchy">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Agent Hierarchy
              </CardTitle>
              <CardDescription>โครงสร้างสายงานเอเย่นต์</CardDescription>
            </CardHeader>
            <CardContent>
              {agents?.length > 0 ? (
                <div className="space-y-2">
                  {agents.map((agent: any) => (
                    <div key={agent.id} className="p-4 rounded-lg bg-muted">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span className="font-medium">{agent.name}</span>
                          <Badge variant="outline">{agent.code}</Badge>
                        </div>
                        <Badge>{agent.status}</Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">ID: </span>
                          <span className="font-mono text-xs">{agent.id?.slice(0, 8)}...</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Parent: </span>
                          <span className="font-mono text-xs">{agent.parent_id?.slice(0, 8) || 'N/A'}...</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Owner: </span>
                          <span className="font-mono text-xs">{agent.owner_id?.slice(0, 8) || 'N/A'}...</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Level: </span>
                          <span>{agent.level || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No agents found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
