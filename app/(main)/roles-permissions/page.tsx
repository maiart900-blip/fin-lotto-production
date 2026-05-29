'use client';

import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  RefreshCw, 
  Settings, 
  Eye,
  Users, 
  Shield, 
  Save, 
  ChevronRight, 
  ChevronDown,
  Search,
  RotateCcw,
  CheckSquare,
  Square,
  Lock,
  AlertTriangle,
  Crown,
  Network,
  Keyboard,
  Plus,
  Edit,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  ALL_MENU_SECTIONS, 
  STANDALONE_ITEMS,
  getDefaultPermissions,
  isMenuRestricted,
  type MenuSection,
} from '@/lib/menu-config';
import { fetcher } from '@/lib/fetcher';
import { useAuth } from '@/hooks/use-auth';
import { 
  AGENT_TIER_CONFIG, 
  getTierConfig,
  type AgentTier 
} from '@/lib/agent-permissions.client';

// =====================================================
// CONSOLIDATED PERMISSIONS PAGE - SINGLE SOURCE OF TRUTH
// =====================================================
// This page manages ALL permission types:
// 1. Role-based permissions (Super Admin, Admin, Staff)
// 2. 4-Tier Agent Hierarchy (Master, Agent, Sub-Agent)
// 3. Staff/Member visibility settings
//
// STRICT DATA ISOLATION:
// - Each tier mirrors Mother Web menu structure
// - Tiers CANNOT see actual Mother Web data
// - Manual Key agents are completely separate from Auto
// =====================================================

interface Permission {
  id: string;
  role: string;
  permission_key: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface Agent {
  id: string;
  code: string;
  name: string;
  username?: string;
  display_name?: string;
  system_type: string;
  level: number;
  status: string;
  visible_menus: string[] | string;
  can_create_sub_agent: boolean;
  can_view_reports: boolean;
  agent_tier?: AgentTier;
  role?: string;
}

// Helper to get tier from level
function getTierFromLevel(level: number): AgentTier {
  if (level === 0) return 'mother_web';
  if (level === 1) return 'master';
  if (level === 2) return 'agent';
  return 'sub_agent';
}

// Helper to parse visible_menus
function parseVisibleMenus(menus: string[] | string | undefined): string[] {
  if (!menus) return [];
  if (typeof menus === 'string') {
    try {
      const parsed = JSON.parse(menus);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  if (Array.isArray(menus)) {
    return menus.filter(m => typeof m === 'string' && m.length > 1);
  }
  return [];
}

const ROLES = ['super_admin', 'admin', 'key_staff', 'staff'];
const PERMISSIONS = [
  'dashboard', 'entries', 'customers', 'lotteries', 'results',
  'topup', 'withdraw', 'credits', 'partners', 'reports',
  'settings', 'users', 'backup',
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin (Mother Web)',
  admin: 'Admin (แอดมิน)',
  key_staff: 'พนักงานคีย์หวย',
  staff: 'พนักงานทั่วไป',
};

const PERMISSION_LABELS: Record<string, string> = {
  dashboard: 'แดชบอร์ด',
  entries: 'โพยหวย',
  customers: 'ลูกค้า',
  lotteries: 'หวย',
  results: 'ผลหวย',
  topup: 'เติมเงิน',
  withdraw: 'ถอนเงิน',
  credits: 'เครดิต',
  partners: 'หุ้นส่วน',
  reports: 'รายงาน',
  settings: 'ตั้งค่า',
  users: 'ผู้ใช้',
  backup: 'สำรองข้อมูล',
};

export default function ConsolidatedPermissionsPage() {
  const { canAccess, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('internal');
  const [isSaving, setIsSaving] = useState(false);
  
  // Role permissions state
  const [rolePermissions, setRolePermissions] = useState<Record<string, Record<string, Permission>>>({});
  const { data: roleData, mutate: mutateRoles } = useSWR('/api/role-permissions', fetcher);
  
  // Agent visibility state
  const { data: agentData, mutate: mutateAgents, isLoading: isLoadingAgents } = useSWR(
    '/api/agents?include_visibility=true', 
    fetcher
  );
  const agents: Agent[] = agentData?.agents || [];
  
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [visibleMenus, setVisibleMenus] = useState<string[]>([]);
  const [canCreateSubAgent, setCanCreateSubAgent] = useState(false);
  const [canViewReports, setCanViewReports] = useState(true);
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterSystem, setFilterSystem] = useState<string>('all');
  const [searchMenu, setSearchMenu] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  // Initialize role permissions
  useEffect(() => {
    if (roleData?.permissions) {
      const permMap: Record<string, Record<string, Permission>> = {};
      ROLES.forEach(role => {
        permMap[role] = {};
        PERMISSIONS.forEach(perm => {
          const existing = roleData.permissions.find(
            (p: Permission) => p.role === role && p.permission_key === perm
          );
          permMap[role][perm] = existing || {
            role,
            permission_key: perm,
            can_view: false,
            can_create: false,
            can_edit: false,
            can_delete: false,
          };
        });
      });
      setRolePermissions(permMap);
    }
  }, [roleData]);

  // Filter agents by tier and system
  const filteredAgents = agents.filter(a => {
    const systemMatch = filterSystem === 'all' || a.system_type === filterSystem;
    const agentTier = a.agent_tier || getTierFromLevel(a.level || 2);
    const tierMatch = filterTier === 'all' || agentTier === filterTier;
    return systemMatch && tierMatch;
  });

  // Menu sections for agents
  const agentMenuSections = useMemo(() => {
    return ALL_MENU_SECTIONS.filter(section => !section.agentOnly);
  }, []);

  // Filter menu sections by search
  const filteredSections = useMemo(() => {
    if (!searchMenu.trim()) return agentMenuSections;
    const search = searchMenu.toLowerCase();
    return agentMenuSections.map(section => {
      const filteredItems = section.items.filter(item => 
        item.title.toLowerCase().includes(search) ||
        item.description?.toLowerCase().includes(search)
      );
      if (filteredItems.length > 0 || section.title.toLowerCase().includes(search)) {
        return { ...section, items: filteredItems.length > 0 ? filteredItems : section.items };
      }
      return null;
    }).filter(Boolean) as MenuSection[];
  }, [searchMenu, agentMenuSections]);

  // Count visible menus
  const visibleCount = visibleMenus.length;
  const totalCount = useMemo(() => {
    let count = STANDALONE_ITEMS.length;
    agentMenuSections.forEach(section => {
      count += 1 + section.items.length;
    });
    return count;
  }, [agentMenuSections]);

  // Permission denied
  if (!canAccess('super_admin')) {
    return (
      <div className="p-6">
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="p-6 text-center">
            <Shield className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-red-500">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-neutral-400 mt-2">เฉพาะ Super Admin เท่านั้น</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle role permission change
  const handleRolePermissionChange = (
    role: string, 
    permKey: string, 
    field: 'can_view' | 'can_create' | 'can_edit' | 'can_delete',
    value: boolean
  ) => {
    setRolePermissions(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permKey]: {
          ...prev[role][permKey],
          [field]: value,
        },
      },
    }));
  };

  // Save role permissions
  const handleSaveRolePermissions = async () => {
    setIsSaving(true);
    try {
      const allPerms = Object.values(rolePermissions).flatMap(rolePerms => 
        Object.values(rolePerms)
      );
      
      const res = await fetch('/api/role-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: allPerms }),
      });
      
      if (res.ok) {
        toast.success('บันทึกสิทธิ์สำเร็จ');
        mutateRoles();
      } else {
        toast.error('เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle agent selection
  const handleSelectAgent = async (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (agent) {
      setSelectedAgent(agentId);
      try {
        const res = await fetch(`/api/menu-permissions?target_id=${agentId}&target_type=agent`, {
          credentials: 'include',
        });
        const data = await res.json();
        
        if (data.permissions && data.permissions.length > 0) {
          setVisibleMenus(data.permissions);
        } else {
          const parsedMenus = parseVisibleMenus(agent.visible_menus);
          setVisibleMenus(parsedMenus.length > 0 ? parsedMenus : getDefaultPermissions('agent'));
        }
        
        setCanCreateSubAgent(data.canCreateSubAgent || agent.can_create_sub_agent || false);
        setCanViewReports(data.canViewReports ?? agent.can_view_reports ?? true);
      } catch {
        const parsedMenus = parseVisibleMenus(agent.visible_menus);
        setVisibleMenus(parsedMenus.length > 0 ? parsedMenus : getDefaultPermissions('agent'));
        setCanCreateSubAgent(agent.can_create_sub_agent || false);
        setCanViewReports(agent.can_view_reports !== false);
      }
    }
  };

  // Toggle menu visibility
  const toggleMenu = (menuId: string) => {
    if (isMenuRestricted(menuId)) {
      toast.error('เมนูนี้เป็นเมนู Restricted ไม่สามารถเปิดได้');
      return;
    }
    setVisibleMenus(prev => 
      prev.includes(menuId) 
        ? prev.filter(m => m !== menuId)
        : [...prev, menuId]
    );
  };

  // Toggle section
  const toggleSection = (section: MenuSection) => {
    if (section.restricted) {
      toast.error('หมวดนี้เป็นหมวด Restricted ไม่สามารถเปิดได้');
      return;
    }
    const sectionIds = [section.id, ...section.items.map(item => item.id)];
    const allSelected = sectionIds.every(id => visibleMenus.includes(id));
    
    if (allSelected) {
      setVisibleMenus(prev => prev.filter(id => !sectionIds.includes(id)));
    } else {
      const nonRestrictedIds = sectionIds.filter(id => !isMenuRestricted(id));
      setVisibleMenus(prev => [...new Set([...prev, ...nonRestrictedIds])]);
    }
  };

  const isSectionSelected = (section: MenuSection) => {
    const sectionIds = [section.id, ...section.items.map(item => item.id)];
    return sectionIds.every(id => visibleMenus.includes(id));
  };

  const isSectionPartial = (section: MenuSection) => {
    const sectionIds = [section.id, ...section.items.map(item => item.id)];
    const selected = sectionIds.filter(id => visibleMenus.includes(id));
    return selected.length > 0 && selected.length < sectionIds.length;
  };

  const selectAllMenus = () => {
    const allIds: string[] = [];
    STANDALONE_ITEMS.forEach(item => allIds.push(item.id));
    agentMenuSections.forEach(section => {
      if (!section.restricted) {
        allIds.push(section.id);
        section.items.forEach(item => {
          if (!isMenuRestricted(item.id)) allIds.push(item.id);
        });
      }
    });
    setVisibleMenus(allIds);
  };

  const deselectAllMenus = () => setVisibleMenus([]);

  const resetToDefault = () => {
    setVisibleMenus(getDefaultPermissions('agent'));
    toast.info('รีเซ็ตเป็นค่าเริ่มต้นแล้ว');
  };

  // Save agent visibility
  const handleSaveAgentVisibility = async () => {
    if (!selectedAgent) return;
    
    setIsSaving(true);
    try {
      const res = await fetch('/api/menu-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          target_id: selectedAgent,
          target_type: 'agent',
          visible_menus: visibleMenus,
          can_create_sub_agent: canCreateSubAgent,
          can_view_reports: canViewReports,
        }),
      });

      if (res.ok) {
        toast.success('บันทึกสิทธิ์สำเร็จ');
        mutateAgents();
      } else {
        const error = await res.json();
        toast.error(error.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSectionOpen = (sectionId: string) => {
    setOpenSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-amber-500" />
            สิทธิ์การใช้งาน (ศูนย์กลาง)
          </h1>
          <p className="text-gray-400 mt-1">จัดการสิทธิ์และการมองเห็นของทุกระดับ - รวมทุกหน้าไว้ที่นี่</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            mutateRoles();
            mutateAgents();
          }}
          className="border-slate-600"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          รีเฟรช
        </Button>
      </div>

      {/* 4-Tier Hierarchy Info */}
      <Alert className="bg-amber-500/10 border-amber-500/30">
        <Network className="h-4 w-4 text-amber-400" />
        <AlertDescription className="text-amber-200">
          <strong>ลำดับชั้นระบบ (4-Tier Hierarchy):</strong>{' '}
          <Badge className="bg-red-600 text-white ml-2">Mother Web</Badge>
          <ChevronRight className="inline h-4 w-4 mx-1" />
          <Badge className="bg-purple-600 text-white">Master</Badge>
          <ChevronRight className="inline h-4 w-4 mx-1" />
          <Badge className="bg-blue-600 text-white">Agent</Badge>
          <ChevronRight className="inline h-4 w-4 mx-1" />
          <Badge className="bg-green-600 text-white">Sub-Agent</Badge>
          <span className="text-xs block mt-1">
            Downlines รับโครงสร้างเมนูจาก Mother Web แต่ไม่สามารถเข้าถึงข้อมูลเว็บแม่ได้
          </span>
        </AlertDescription>
      </Alert>

      {/* Data Isolation Alert */}
      <Alert className="bg-purple-500/10 border-purple-500/30">
        <Lock className="h-4 w-4 text-purple-400" />
        <AlertDescription className="text-purple-200">
          <strong>Data Isolation:</strong> สายงานเอเย่นต์ (Manual Key) แยกจากระบบออโต้โดยสมบูรณ์ 
          - ทุก Tier จะเห็นเฉพาะข้อมูลในเครือข่ายของตัวเองเท่านั้น
        </AlertDescription>
      </Alert>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-800">
          <TabsTrigger value="internal" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            พนักงาน/แอดมิน
          </TabsTrigger>
          <TabsTrigger value="master" className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-purple-400" />
            Master
          </TabsTrigger>
          <TabsTrigger value="agent" className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-400" />
            Agent
          </TabsTrigger>
          <TabsTrigger value="sub_agent" className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-green-400" />
            Sub-Agent
          </TabsTrigger>
        </TabsList>

        {/* Internal Staff Tab */}
        <TabsContent value="internal">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button 
                onClick={handleSaveRolePermissions} 
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </div>

            {ROLES.map(role => (
              <Card key={role} className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Shield className={`h-5 w-5 ${
                      role === 'super_admin' ? 'text-red-500' : 
                      role === 'admin' ? 'text-blue-500' : 
                      role === 'key_staff' ? 'text-amber-500' : 
                      'text-gray-500'
                    }`} />
                    {ROLE_LABELS[role]}
                    {role === 'super_admin' && (
                      <Badge className="ml-2 bg-red-500/20 text-red-400 border border-red-500">Full Access</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {role === 'super_admin' ? (
                    <p className="text-gray-400">Super Admin มีสิทธิ์เข้าถึงทุกฟังก์ชั่น</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-sm text-gray-400 border-b border-slate-700">
                            <th className="py-2 px-3 font-semibold">เมนู</th>
                            <th className="py-2 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Eye className="h-4 w-4" />
                                <span>ดู</span>
                              </div>
                            </th>
                            <th className="py-2 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Plus className="h-4 w-4" />
                                <span>สร้าง</span>
                              </div>
                            </th>
                            <th className="py-2 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Edit className="h-4 w-4" />
                                <span>แก้ไข</span>
                              </div>
                            </th>
                            <th className="py-2 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Trash2 className="h-4 w-4" />
                                <span>ลบ</span>
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {PERMISSIONS.map(perm => (
                            <tr key={perm} className="border-b border-slate-700 hover:bg-slate-700/50">
                              <td className="py-2 px-3 text-white font-medium">{PERMISSION_LABELS[perm]}</td>
                              {(['can_view', 'can_create', 'can_edit', 'can_delete'] as const).map(field => (
                                <td key={field} className="py-2 px-3 text-center">
                                  <Checkbox
                                    checked={rolePermissions[role]?.[perm]?.[field] || false}
                                    onCheckedChange={(checked) => 
                                      handleRolePermissionChange(role, perm, field, !!checked)
                                    }
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Master, Agent, Sub-Agent Tabs - Similar structure */}
        {['master', 'agent', 'sub_agent'].map(tier => (
          <TabsContent key={tier} value={tier}>
            <Card className={`bg-slate-800 border-${
              tier === 'master' ? 'purple' : tier === 'agent' ? 'blue' : 'green'
            }-500/30`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  {tier === 'master' ? <Crown className="h-5 w-5 text-purple-400" /> :
                   tier === 'agent' ? <Users className="h-5 w-5 text-blue-400" /> :
                   <Keyboard className="h-5 w-5 text-green-400" />}
                  ตั้งค่าการมองเห็น {tier === 'master' ? 'Master Agent' : tier === 'agent' ? 'Agent' : 'Sub-Agent'}
                </CardTitle>
                <CardDescription className="text-gray-400">
                  กำหนดเมนูที่ {tier === 'master' ? 'Master' : tier === 'agent' ? 'Agent' : 'Sub-Agent'} สามารถเห็นและใช้งานได้
                  {tier !== 'master' && ' - จะเห็นเฉพาะโครงสร้างที่ระดับบนเปิดให้เท่านั้น'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  {/* Agent List */}
                  <div className="md:col-span-1">
                    <Card className="bg-slate-900 border-slate-700">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-white">
                          <Users className="h-4 w-4" />
                          เลือก {tier === 'master' ? 'Master' : tier === 'agent' ? 'Agent' : 'Sub-Agent'}
                        </CardTitle>
                        <Select value={filterSystem} onValueChange={setFilterSystem}>
                          <SelectTrigger className="bg-slate-800 border-slate-600">
                            <SelectValue placeholder="ระบบทั้งหมด" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">ทั้งหมด</SelectItem>
                            <SelectItem value="manual_key">คีย์หวย</SelectItem>
                            <SelectItem value="auto">ออโต้</SelectItem>
                          </SelectContent>
                        </Select>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[400px]">
                          <div className="space-y-2">
                            {agents
                              .filter(a => {
                                const agentTier = a.agent_tier || getTierFromLevel(a.level || 2);
                                const systemMatch = filterSystem === 'all' || a.system_type === filterSystem;
                                return agentTier === tier && systemMatch;
                              })
                              .map(agent => {
                                const tierConfig = AGENT_TIER_CONFIG[tier as AgentTier];
                                return (
                                  <div
                                    key={agent.id}
                                    onClick={() => handleSelectAgent(agent.id)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                      selectedAgent === agent.id 
                                        ? `border-${tier === 'master' ? 'purple' : tier === 'agent' ? 'blue' : 'green'}-500 bg-${tier === 'master' ? 'purple' : tier === 'agent' ? 'blue' : 'green'}-500/10` 
                                        : 'border-slate-700 hover:bg-slate-700/50'
                                    }`}
                                  >
                                    <div className="font-medium text-white">
                                      {agent.name || agent.code}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      <Badge className={`text-xs text-white ${tierConfig?.bgColor || 'bg-gray-600'}`}>
                                        {tierConfig?.label || tier}
                                      </Badge>
                                      {agent.system_type === 'manual_key' && (
                                        <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/30">
                                          Manual Key
                                        </Badge>
                                      )}
                                      <Badge 
                                        variant={agent.status === 'active' ? 'default' : 'destructive'}
                                        className="text-xs"
                                      >
                                        {agent.status === 'active' ? 'ใช้งาน' : 'ปิด'}
                                      </Badge>
                                    </div>
                                  </div>
                                );
                              })}
                            {agents.filter(a => (a.agent_tier || getTierFromLevel(a.level || 2)) === tier).length === 0 && (
                              <p className="text-sm text-gray-500 text-center py-4">
                                ไม่มี {tier === 'master' ? 'Master' : tier === 'agent' ? 'Agent' : 'Sub-Agent'}
                              </p>
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Menu Settings */}
                  <div className="md:col-span-2">
                    <Card className="bg-slate-900 border-slate-700">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center justify-between text-white">
                          <span className="flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            ตั้งค่าเมนูและสิทธิ์
                          </span>
                          {selectedAgent && (
                            <Badge variant="secondary">
                              เปิด {visibleCount} / {totalCount} เมนู
                            </Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {!selectedAgent ? (
                          <div className="text-center py-12 text-gray-500">
                            <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>กรุณาเลือกจากรายการด้านซ้าย</p>
                          </div>
                        ) : (
                          <>
                            {/* Special Permissions */}
                            <div className="space-y-4 p-4 bg-slate-800 rounded-lg">
                              <h4 className="font-medium text-white">สิทธิ์พิเศษ</h4>
                              <div className="flex items-center justify-between">
                                <div>
                                  <Label className="text-white">สร้างเอเย่นย่อยได้</Label>
                                  <p className="text-xs text-gray-400">อนุญาตให้สร้างเอเย่นระดับล่าง</p>
                                </div>
                                <Switch 
                                  checked={canCreateSubAgent} 
                                  onCheckedChange={setCanCreateSubAgent} 
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <div>
                                  <Label className="text-white">ดูรายงานได้</Label>
                                  <p className="text-xs text-gray-400">เห็นรายงานยอดขายและกำไร</p>
                                </div>
                                <Switch 
                                  checked={canViewReports} 
                                  onCheckedChange={setCanViewReports} 
                                />
                              </div>
                            </div>

                            <Separator className="bg-slate-700" />

                            {/* Search and Controls */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                  placeholder="ค้นหาเมนู..."
                                  value={searchMenu}
                                  onChange={(e) => setSearchMenu(e.target.value)}
                                  className="pl-9 bg-slate-800 border-slate-600 text-white"
                                />
                              </div>
                              <Button variant="outline" size="sm" onClick={selectAllMenus} className="border-slate-600">
                                <CheckSquare className="mr-1 h-3 w-3" /> เปิดทั้งหมด
                              </Button>
                              <Button variant="outline" size="sm" onClick={deselectAllMenus} className="border-slate-600">
                                <Square className="mr-1 h-3 w-3" /> ปิดทั้งหมด
                              </Button>
                              <Button variant="outline" size="sm" onClick={resetToDefault} className="border-slate-600">
                                <RotateCcw className="mr-1 h-3 w-3" /> รีเซ็ต
                              </Button>
                            </div>

                            {/* Menu Tree */}
                            <ScrollArea className="h-[300px] border border-slate-700 rounded-lg p-2">
                              <div className="space-y-1">
                                {/* Standalone Items */}
                                <div className="space-y-1 mb-4">
                                  <p className="text-xs font-medium text-gray-400 px-2 py-1">เมนูหลัก</p>
                                  {STANDALONE_ITEMS.map(item => {
                                    const Icon = item.icon;
                                    return (
                                      <div
                                        key={item.id}
                                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                                          visibleMenus.includes(item.id)
                                            ? 'bg-primary/10'
                                            : 'hover:bg-slate-700/50'
                                        }`}
                                        onClick={() => toggleMenu(item.id)}
                                      >
                                        <Checkbox checked={visibleMenus.includes(item.id)} />
                                        <Icon className="h-4 w-4 text-gray-400" />
                                        <span className="text-sm font-medium text-white">{item.title}</span>
                                      </div>
                                    );
                                  })}
                                </div>

                                <Separator className="bg-slate-700" />

                                {/* Menu Sections */}
                                {filteredSections.map(section => {
                                  const SectionIcon = section.icon;
                                  const isOpen = openSections[section.id] ?? true;
                                  const isSelected = isSectionSelected(section);
                                  const isPartial = isSectionPartial(section);
                                  const isRestricted = section.restricted;

                                  return (
                                    <Collapsible
                                      key={section.id}
                                      open={isOpen}
                                      onOpenChange={() => toggleSectionOpen(section.id)}
                                    >
                                      <div className={`rounded-lg ${isRestricted ? 'opacity-50' : ''}`}>
                                        <div className="flex items-center gap-2 p-2">
                                          <CollapsibleTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                              {isOpen ? <ChevronDown className="h-4 w-4 text-white" /> : <ChevronRight className="h-4 w-4 text-white" />}
                                            </Button>
                                          </CollapsibleTrigger>
                                          <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => toggleSection(section)}
                                            disabled={isRestricted}
                                          />
                                          <SectionIcon className="h-4 w-4 text-gray-400" />
                                          <span className="text-sm font-medium text-white flex-1">{section.title}</span>
                                          {isRestricted && <Lock className="h-3 w-3 text-red-400" />}
                                        </div>
                                        <CollapsibleContent>
                                          <div className="ml-8 space-y-1">
                                            {section.items.map(item => {
                                              const ItemIcon = item.icon;
                                              const isItemRestricted = isMenuRestricted(item.id);
                                              return (
                                                <div
                                                  key={item.id}
                                                  className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                                                    isItemRestricted ? 'opacity-50' : ''
                                                  } ${
                                                    visibleMenus.includes(item.id)
                                                      ? 'bg-primary/10'
                                                      : 'hover:bg-slate-700/50'
                                                  }`}
                                                  onClick={() => !isItemRestricted && toggleMenu(item.id)}
                                                >
                                                  <Checkbox 
                                                    checked={visibleMenus.includes(item.id)} 
                                                    disabled={isItemRestricted}
                                                  />
                                                  <ItemIcon className="h-4 w-4 text-gray-400" />
                                                  <span className="text-sm text-white">{item.title}</span>
                                                  {isItemRestricted && <Lock className="h-3 w-3 text-red-400" />}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </CollapsibleContent>
                                      </div>
                                    </Collapsible>
                                  );
                                })}
                              </div>
                            </ScrollArea>

                            {/* Save Button */}
                            <div className="flex justify-end">
                              <Button 
                                onClick={handleSaveAgentVisibility} 
                                disabled={isSaving}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Save className="h-4 w-4 mr-2" />
                                {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                              </Button>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Info Card */}
      <Card className="bg-blue-500/10 border-blue-500/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-blue-400 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-400">คำอธิบาย</p>
              <ul className="text-sm text-gray-400 mt-2 space-y-1">
                <li><strong>Mother Web:</strong> สิทธิ์สูงสุด ควบคุมการมองเห็นของทุกระดับ</li>
                <li><strong>Master:</strong> ดูแลและควบคุม Agent ภายใต้สังกัด</li>
                <li><strong>Agent:</strong> ดูแลและควบคุม Sub-Agent ภายใต้สังกัด</li>
                <li><strong>Sub-Agent:</strong> รับลูกค้าและคีย์หวย</li>
                <li className="text-purple-400"><strong>Manual Key:</strong> ข้อมูลแยกจากระบบ Auto โดยสมบูรณ์</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
