'use client';

import { useState, useMemo } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  MinusSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  ALL_MENU_SECTIONS, 
  STANDALONE_ITEMS,
  type MenuSection,
} from '@/lib/menu-config';
import { fetcher } from '@/lib/fetcher';
import { useAuth } from '@/hooks/use-auth';

// =====================================================
// CONSOLIDATED PERMISSIONS PAGE - TIER-BASED GLOBAL CONFIG
// =====================================================
// This page configures permissions for ENTIRE TIERS at once:
// 1. พนักงาน/แอดมิน (Internal Staff)
// 2. Master Agent (Level 1 - Purple)
// 3. Agent (Level 2 - Blue)
// 4. Sub-Agent (Level 3 - Green)
//
// Each menu item has 4 granular permissions:
// - ดู (View)
// - สร้าง (Create)
// - แก้ไข (Edit)
// - ลบ (Delete)
//
// NO individual agent selection - configure by tier globally
// =====================================================

type PermissionType = 'view' | 'create' | 'edit' | 'delete';
type TierType = 'internal' | 'master' | 'agent' | 'sub_agent';

interface TierPermission {
  menu_id: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

// Manual Key specific menus to inject
const MANUAL_KEY_MENUS_BY_TIER: Record<string, Array<{ id: string; title: string; description: string }>> = {
  master: [
    { id: 'master-key-dashboard', title: 'แดชบอร์ดมาสเตอร์คีย์', description: 'ดูภาพรวมระบบคีย์หวยสำหรับ Master' },
    { id: 'master-risk-report', title: 'รายงานความเสี่ยงรวมส่งบริษัท', description: 'รายงานความเสี่ยงที่ต้องส่งให้บริษัท' },
    { id: 'master-agent-status', title: 'ตารางสถานะเอเย่นต์ เขียว/แดง', description: 'ดูสถานะกำไร/ขาดทุนของเอเย่นต์ทั้งหมด' },
    { id: 'master-agent-performance', title: 'รายงานผลงานเอเย่นต์', description: 'ดูผลงานรายเอเย่นต์' },
  ],
  agent: [
    { id: 'agent-dashboard', title: 'แดชบอร์ดเอเย่นต์', description: 'หน้าหลักสำหรับเอเย่นต์' },
    { id: 'agent-sub-agent-profit', title: 'ตารางสรุปกำไรขาดทุนของซับ', description: 'ดูกำไร/ขาดทุนของซับเอเย่นต์' },
    { id: 'agent-key-entry', title: 'คีย์โพยให้ลูกค้า', description: 'คีย์หวยให้ลูกค้าในเครือข่าย' },
    { id: 'agent-customer-manage', title: 'จัดการลูกค้า', description: 'เพิ่ม/แก้ไขลูกค้าในเครือข่าย' },
  ],
  sub_agent: [
    { id: 'sub-agent-key-daily', title: 'หน้าจอคีย์เลขหวยรายวัน', description: 'คีย์โพยหวยประจำวัน' },
    { id: 'sub-agent-key-history', title: 'ประวัติการคีย์โพยวันนี้', description: 'ดูประวัติโพยที่คีย์วันนี้' },
    { id: 'sub-agent-customer-list', title: 'รายชื่อลูกค้า', description: 'ดูรายชื่อลูกค้าของตัวเอง' },
    { id: 'sub-agent-results', title: 'ดูผลหวย', description: 'ดูผลหวยและรางวัล' },
  ],
};

// Tier configurations
const TIER_CONFIG: Record<TierType, { label: string; color: string; icon: typeof Shield; description: string }> = {
  internal: {
    label: 'พนักงาน/แอดมิน',
    color: 'amber',
    icon: Shield,
    description: 'สิทธิ์สำหรับพนักงานภายในและแอดมิน',
  },
  master: {
    label: 'Master Agent',
    color: 'purple',
    icon: Crown,
    description: 'สิทธิ์สำหรับ Master Agent (Level 1) - คีย์หวยมือเท่านั้น',
  },
  agent: {
    label: 'Agent',
    color: 'blue',
    icon: Users,
    description: 'สิทธิ์สำหรับ Agent (Level 2) - คีย์หวยมือเท่านั้น',
  },
  sub_agent: {
    label: 'Sub-Agent',
    color: 'green',
    icon: Keyboard,
    description: 'สิทธิ์สำหรับ Sub-Agent (Level 3) - คีย์หวยมือเท่านั้น',
  },
};

// Restricted sections that cannot be enabled for agents
const RESTRICTED_SECTION_IDS = ['super-admin', 'security', 'multi-tenant'];
const RESTRICTED_MENU_IDS = ['users', 'roles-permissions', 'backup', 'audit-logs', '2fa', 'health-check', 'security-dashboard'];

// Auto system menus to hide from manual-key tiers
const AUTO_SYSTEM_MENU_IDS = ['auto-system', 'auto-entries', 'auto-customers', 'auto-settings'];

export default function TierPermissionsPage() {
  const { canAccess } = useAuth();
  const [activeTab, setActiveTab] = useState<TierType>('internal');
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  
  // Fetch tier permissions
  const { data: permissionsData, isLoading } = useSWR('/api/tier-permissions', fetcher);
  
  // State for permissions per tier
  const [tierPermissions, setTierPermissions] = useState<Record<TierType, Record<string, TierPermission>>>({
    internal: {},
    master: {},
    agent: {},
    sub_agent: {},
  });

  // Initialize permissions from API data
  useMemo(() => {
    if (permissionsData?.permissions) {
      const newPerms: Record<TierType, Record<string, TierPermission>> = {
        internal: {},
        master: {},
        agent: {},
        sub_agent: {},
      };
      
      permissionsData.permissions.forEach((p: TierPermission & { tier: TierType }) => {
        if (!newPerms[p.tier]) newPerms[p.tier] = {};
        newPerms[p.tier][p.menu_id] = {
          menu_id: p.menu_id,
          can_view: p.can_view,
          can_create: p.can_create,
          can_edit: p.can_edit,
          can_delete: p.can_delete,
        };
      });
      
      setTierPermissions(newPerms);
    }
  }, [permissionsData]);

  // Build complete menu list for each tier
  const getMenusForTier = (tier: TierType) => {
    const menus: Array<{ section: MenuSection | null; items: Array<{ id: string; title: string; description?: string; restricted?: boolean }> }> = [];
    
    // Filter out auto system menus for manual-key tiers
    const isManualKeyTier = tier === 'master' || tier === 'agent' || tier === 'sub_agent';
    
    // Add standalone items
    const standaloneItems = STANDALONE_ITEMS.filter(item => {
      if (isManualKeyTier && AUTO_SYSTEM_MENU_IDS.includes(item.id)) return false;
      return true;
    }).map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      restricted: RESTRICTED_MENU_IDS.includes(item.id),
    }));
    
    if (standaloneItems.length > 0) {
      menus.push({ section: null, items: standaloneItems });
    }
    
    // Add menu sections
    ALL_MENU_SECTIONS.forEach(section => {
      // Skip restricted sections for non-internal tiers
      if (tier !== 'internal' && RESTRICTED_SECTION_IDS.includes(section.id)) return;
      
      // Filter out auto system section for manual-key tiers
      if (isManualKeyTier && section.id === 'auto-system') return;
      
      const items = section.items
        .filter(item => {
          if (isManualKeyTier && AUTO_SYSTEM_MENU_IDS.includes(item.id)) return false;
          return true;
        })
        .map(item => ({
          id: item.id,
          title: item.title,
          description: item.description,
          restricted: RESTRICTED_MENU_IDS.includes(item.id) || section.restricted,
        }));
      
      if (items.length > 0) {
        menus.push({ 
          section: { ...section, restricted: section.restricted || RESTRICTED_SECTION_IDS.includes(section.id) }, 
          items 
        });
      }
    });
    
    // Add tier-specific manual key menus
    if (MANUAL_KEY_MENUS_BY_TIER[tier]) {
      menus.push({
        section: { 
          id: `${tier}-manual-key-specific`, 
          title: 'เมนูเฉพาะระดับ (Manual Key)', 
          icon: Keyboard, 
          items: [],
          restricted: false,
        },
        items: MANUAL_KEY_MENUS_BY_TIER[tier].map(m => ({
          id: m.id,
          title: m.title,
          description: m.description,
          restricted: false,
        })),
      });
    }
    
    return menus;
  };

  // Count menus
  const countMenus = (tier: TierType) => {
    const menus = getMenusForTier(tier);
    let total = 0;
    let enabled = 0;
    
    menus.forEach(({ items }) => {
      items.forEach(item => {
        total++;
        if (tierPermissions[tier]?.[item.id]?.can_view) enabled++;
      });
    });
    
    return { total, enabled };
  };

  // Filter menus by search
  const filterMenusBySearch = (menus: ReturnType<typeof getMenusForTier>) => {
    if (!searchQuery.trim()) return menus;
    
    const query = searchQuery.toLowerCase();
    return menus.map(group => ({
      ...group,
      items: group.items.filter(item => 
        item.title.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query)
      ),
    })).filter(group => group.items.length > 0);
  };

  // Toggle permission
  const togglePermission = (tier: TierType, menuId: string, permType: PermissionType, value: boolean) => {
    setTierPermissions(prev => {
      const current = prev[tier]?.[menuId] || {
        menu_id: menuId,
        can_view: false,
        can_create: false,
        can_edit: false,
        can_delete: false,
      };
      
      // If enabling create/edit/delete, also enable view
      let newPerm = { ...current };
      if (permType === 'view') {
        newPerm.can_view = value;
        // If disabling view, disable all others
        if (!value) {
          newPerm.can_create = false;
          newPerm.can_edit = false;
          newPerm.can_delete = false;
        }
      } else {
        newPerm[`can_${permType}`] = value;
        // If enabling other perms, ensure view is enabled
        if (value) {
          newPerm.can_view = true;
        }
      }
      
      return {
        ...prev,
        [tier]: {
          ...prev[tier],
          [menuId]: newPerm,
        },
      };
    });
  };

  // Toggle all permissions for a menu
  const toggleAllForMenu = (tier: TierType, menuId: string, enable: boolean) => {
    setTierPermissions(prev => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        [menuId]: {
          menu_id: menuId,
          can_view: enable,
          can_create: enable,
          can_edit: enable,
          can_delete: enable,
        },
      },
    }));
  };

  // Toggle entire section
  const toggleSection = (tier: TierType, sectionItems: Array<{ id: string; restricted?: boolean }>, enable: boolean) => {
    setTierPermissions(prev => {
      const newPerms = { ...prev[tier] };
      sectionItems.forEach(item => {
        if (item.restricted) return; // Skip restricted items
        newPerms[item.id] = {
          menu_id: item.id,
          can_view: enable,
          can_create: enable,
          can_edit: enable,
          can_delete: enable,
        };
      });
      return { ...prev, [tier]: newPerms };
    });
  };

  // Select all menus for tier
  const selectAllForTier = (tier: TierType) => {
    const menus = getMenusForTier(tier);
    setTierPermissions(prev => {
      const newPerms: Record<string, TierPermission> = {};
      menus.forEach(({ items }) => {
        items.forEach(item => {
          if (item.restricted) return;
          newPerms[item.id] = {
            menu_id: item.id,
            can_view: true,
            can_create: true,
            can_edit: true,
            can_delete: true,
          };
        });
      });
      return { ...prev, [tier]: newPerms };
    });
    toast.info('เลือกทุกเมนูแล้ว');
  };

  // Deselect all menus for tier
  const deselectAllForTier = (tier: TierType) => {
    setTierPermissions(prev => ({ ...prev, [tier]: {} }));
    toast.info('ยกเลิกทุกเมนูแล้ว');
  };

  // Save permissions
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const allPermissions: Array<TierPermission & { tier: TierType }> = [];
      
      (Object.keys(tierPermissions) as TierType[]).forEach(tier => {
        Object.values(tierPermissions[tier]).forEach(perm => {
          allPermissions.push({ ...perm, tier });
        });
      });
      
      const res = await fetch('/api/tier-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: allPermissions }),
      });
      
      if (res.ok) {
        toast.success('บันทึกสิทธิ์สำเร็จ');
        globalMutate('/api/tier-permissions');
      } else {
        const error = await res.json();
        toast.error(error.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setIsSaving(false);
    }
  };

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

  const currentMenus = filterMenusBySearch(getMenusForTier(activeTab));
  const { total, enabled } = countMenus(activeTab);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-amber-500" />
            ตั้งค่าเมนูและสิทธิ์ (ศูนย์กลาง)
          </h1>
          <p className="text-gray-400 mt-1">ตั้งค่าสิทธิ์แบบรวมศูนย์ตามระดับ - ไม่ต้องตั้งค่าทีละคน</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => globalMutate('/api/tier-permissions')}
            className="border-slate-600"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            รีเฟรช
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
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
            ตั้งค่าสิทธิ์ตามระดับ - ทุกคนในระดับเดียวกันจะได้รับสิทธิ์เหมือนกัน
          </span>
        </AlertDescription>
      </Alert>

      {/* Data Isolation Alert */}
      <Alert className="bg-purple-500/10 border-purple-500/30">
        <Lock className="h-4 w-4 text-purple-400" />
        <AlertDescription className="text-purple-200">
          <strong>Data Isolation - คีย์หวยมือเท่านั้น:</strong> Master/Agent/Sub-Agent แยกจากระบบออโต้โดยสมบูรณ์
          <Badge className="bg-purple-600 text-white ml-2">Manual Key Only</Badge>
        </AlertDescription>
      </Alert>

      {/* Main Tier Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TierType)}>
        <TabsList className="bg-slate-800 w-full justify-start">
          {(Object.keys(TIER_CONFIG) as TierType[]).map(tier => {
            const config = TIER_CONFIG[tier];
            const Icon = config.icon;
            const counts = countMenus(tier);
            return (
              <TabsTrigger 
                key={tier} 
                value={tier} 
                className={`flex items-center gap-2 data-[state=active]:bg-${config.color}-500/20`}
              >
                <Icon className={`h-4 w-4 text-${config.color}-400`} />
                {config.label}
                <Badge variant="outline" className="ml-1 text-xs">
                  {counts.enabled}/{counts.total}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Tab Content for Each Tier */}
        {(Object.keys(TIER_CONFIG) as TierType[]).map(tier => {
          const config = TIER_CONFIG[tier];
          const menus = filterMenusBySearch(getMenusForTier(tier));
          
          return (
            <TabsContent key={tier} value={tier} className="space-y-4">
              {/* Tier Header Card */}
              <Card className={`bg-${config.color}-500/10 border-${config.color}-500/30`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white flex items-center gap-2">
                        {tier !== 'internal' && <Keyboard className="h-5 w-5 text-purple-400" />}
                        {config.label}
                        {tier !== 'internal' && (
                          <Badge className="bg-purple-600 text-white ml-2">Manual Key Only</Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-gray-400 mt-1">
                        {config.description}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">
                        เปิด {enabled} / {total} เมนู
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Search and Bulk Actions */}
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="ค้นหาเมนู..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-800 border-slate-700"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectAllForTier(tier)}
                  className="border-green-500/50 text-green-400 hover:bg-green-500/20"
                >
                  <CheckSquare className="h-4 w-4 mr-1" />
                  เลือกทั้งหมด
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deselectAllForTier(tier)}
                  className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                >
                  <Square className="h-4 w-4 mr-1" />
                  ยกเลิกทั้งหมด
                </Button>
              </div>

              {/* Menu Sections */}
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="p-0">
                  <ScrollArea className="h-[600px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-slate-800 z-10">
                        <TableRow className="border-slate-700">
                          <TableHead className="text-gray-400 w-[40%]">เมนู</TableHead>
                          <TableHead className="text-gray-400 text-center w-[15%]">
                            <div className="flex items-center justify-center gap-1">
                              <Eye className="h-4 w-4" />
                              <span>ดู</span>
                            </div>
                          </TableHead>
                          <TableHead className="text-gray-400 text-center w-[15%]">
                            <div className="flex items-center justify-center gap-1">
                              <Plus className="h-4 w-4" />
                              <span>สร้าง</span>
                            </div>
                          </TableHead>
                          <TableHead className="text-gray-400 text-center w-[15%]">
                            <div className="flex items-center justify-center gap-1">
                              <Edit className="h-4 w-4" />
                              <span>แก้ไข</span>
                            </div>
                          </TableHead>
                          <TableHead className="text-gray-400 text-center w-[15%]">
                            <div className="flex items-center justify-center gap-1">
                              <Trash2 className="h-4 w-4" />
                              <span>ลบ</span>
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {menus.map((group, groupIndex) => (
                          <Collapsible
                            key={group.section?.id || `standalone-${groupIndex}`}
                            open={openSections[group.section?.id || 'standalone'] !== false}
                            onOpenChange={() => {
                              const key = group.section?.id || 'standalone';
                              setOpenSections(prev => ({ ...prev, [key]: prev[key] === false }));
                            }}
                            asChild
                          >
                            <>
                              {/* Section Header */}
                              {group.section && (
                                <TableRow className="border-slate-700 bg-slate-700/50 hover:bg-slate-700">
                                  <TableCell colSpan={5}>
                                    <CollapsibleTrigger asChild>
                                      <div className="flex items-center justify-between cursor-pointer py-1">
                                        <div className="flex items-center gap-2">
                                          {openSections[group.section.id] === false ? (
                                            <ChevronRight className="h-4 w-4 text-gray-400" />
                                          ) : (
                                            <ChevronDown className="h-4 w-4 text-gray-400" />
                                          )}
                                          <span className="font-semibold text-white">{group.section.title}</span>
                                          <Badge variant="outline" className="text-xs">
                                            {group.items.length} เมนู
                                          </Badge>
                                          {group.section.restricted && (
                                            <Badge className="bg-red-500/20 text-red-400">
                                              <Lock className="h-3 w-3 mr-1" />
                                              Restricted
                                            </Badge>
                                          )}
                                        </div>
                                        {!group.section.restricted && (
                                          <div className="flex gap-2">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleSection(tier, group.items, true);
                                              }}
                                              className="text-green-400 hover:text-green-300 h-7 px-2"
                                            >
                                              <CheckSquare className="h-3 w-3 mr-1" />
                                              เปิดทั้งหมวด
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleSection(tier, group.items, false);
                                              }}
                                              className="text-red-400 hover:text-red-300 h-7 px-2"
                                            >
                                              <MinusSquare className="h-3 w-3 mr-1" />
                                              ปิดทั้งหมวด
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    </CollapsibleTrigger>
                                  </TableCell>
                                </TableRow>
                              )}
                              
                              {/* Menu Items */}
                              <CollapsibleContent asChild>
                                <>
                                  {group.items.map(item => {
                                    const perms = tierPermissions[tier]?.[item.id] || {
                                      can_view: false,
                                      can_create: false,
                                      can_edit: false,
                                      can_delete: false,
                                    };
                                    
                                    return (
                                      <TableRow 
                                        key={item.id} 
                                        className={`border-slate-700 ${item.restricted ? 'opacity-50' : 'hover:bg-slate-700/30'}`}
                                      >
                                        <TableCell>
                                          <div className="flex items-center gap-2 pl-6">
                                            <div>
                                              <span className="text-white">{item.title}</span>
                                              {item.description && (
                                                <p className="text-xs text-gray-500">{item.description}</p>
                                              )}
                                            </div>
                                            {item.restricted && (
                                              <Badge className="bg-red-500/20 text-red-400 text-xs">
                                                <Lock className="h-3 w-3 mr-1" />
                                                Restricted
                                              </Badge>
                                            )}
                                          </div>
                                        </TableCell>
                                        {(['view', 'create', 'edit', 'delete'] as PermissionType[]).map(permType => (
                                          <TableCell key={permType} className="text-center">
                                            <Checkbox
                                              checked={perms[`can_${permType}`]}
                                              onCheckedChange={(checked) => 
                                                togglePermission(tier, item.id, permType, !!checked)
                                              }
                                              disabled={item.restricted}
                                              className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                            />
                                          </TableCell>
                                        ))}
                                      </TableRow>
                                    );
                                  })}
                                </>
                              </CollapsibleContent>
                            </>
                          </Collapsible>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
