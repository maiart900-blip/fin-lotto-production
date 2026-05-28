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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  RefreshCw, 
  Settings, 
  Eye, 
  EyeOff, 
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
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  ALL_MENU_SECTIONS, 
  STANDALONE_ITEMS,
  getDefaultPermissions,
  getRestrictedMenuIds,
  isMenuRestricted,
  type MenuSection,
  type MenuItem,
} from '@/lib/menu-config';
import { fetcher } from '@/lib/fetcher';

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
  enable_auto?: boolean;
  enable_manual_key?: boolean;
}

// Helper to parse visible_menus (can be string or array, may have corrupted data)
function parseVisibleMenus(menus: string[] | string | undefined): string[] {
  if (!menus) return [];
  
  if (typeof menus === 'string') {
    try {
      const parsed = JSON.parse(menus);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  
  if (Array.isArray(menus)) {
    // Filter out single-character entries (corrupted JSON chars like [, ", etc.)
    // Valid menu IDs are always longer than 1 character
    return menus.filter(m => typeof m === 'string' && m.length > 1);
  }
  
  return [];
}

export default function AgentVisibilityPage() {
  const { data, mutate, isLoading } = useSWR('/api/agents?include_visibility=true', fetcher);
  const agents: Agent[] = data?.agents || [];
  
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [visibleMenus, setVisibleMenus] = useState<string[]>([]);
  const [canCreateSubAgent, setCanCreateSubAgent] = useState(false);
  const [canViewReports, setCanViewReports] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterSystem, setFilterSystem] = useState<string>('all');
  const [searchMenu, setSearchMenu] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const filteredAgents = agents.filter(a => 
    filterSystem === 'all' || a.system_type === filterSystem
  );

  // Get agent-relevant sections (exclude agent-only sections since we're configuring for agents)
  const agentMenuSections = useMemo(() => {
    return ALL_MENU_SECTIONS.filter(section => !section.agentOnly);
  }, []);

  // Filter menu sections based on search
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
      count += 1 + section.items.length; // section + items
    });
    return count;
  }, [agentMenuSections]);

  // Load permissions when agent is selected
  const handleSelectAgent = async (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    
    if (agent) {
      setSelectedAgent(agentId);
      
      // Load permissions from API
      try {
        const res = await fetch(`/api/menu-permissions?target_id=${agentId}&target_type=agent`, {
          credentials: 'include',
        });
        const data = await res.json();
        
        if (data.permissions && data.permissions.length > 0) {
          setVisibleMenus(data.permissions);
        } else {
          // Use agent's existing visible_menus or default
          const parsedMenus = parseVisibleMenus(agent.visible_menus);
          setVisibleMenus(parsedMenus.length > 0 ? parsedMenus : getDefaultPermissions('agent'));
        }
        
        setCanCreateSubAgent(data.canCreateSubAgent || agent.can_create_sub_agent || false);
        setCanViewReports(data.canViewReports ?? agent.can_view_reports ?? true);
      } catch {
        // Fallback to agent data
        const parsedMenus = parseVisibleMenus(agent.visible_menus);
        setVisibleMenus(parsedMenus.length > 0 ? parsedMenus : getDefaultPermissions('agent'));
        setCanCreateSubAgent(agent.can_create_sub_agent || false);
        setCanViewReports(agent.can_view_reports !== false);
      }
    }
  };

  // Toggle single menu item
  const toggleMenu = (menuId: string) => {
    // Check if restricted
    if (isMenuRestricted(menuId)) {
      toast.error('เมนูนี้เป็นเมนู Restricted ไม่สามารถเปิดให้เอเย่นต์ได้');
      return;
    }
    
    setVisibleMenus(prev => 
      prev.includes(menuId) 
        ? prev.filter(m => m !== menuId)
        : [...prev, menuId]
    );
  };

  // Toggle entire section
  const toggleSection = (section: MenuSection) => {
    if (section.restricted) {
      toast.error('หมวดนี้เป็นหมวด Restricted ไม่สามารถเปิดให้เอเย่นต์ได้');
      return;
    }
    
    const sectionIds = [section.id, ...section.items.map(item => item.id)];
    const allSelected = sectionIds.every(id => visibleMenus.includes(id));
    
    if (allSelected) {
      // Deselect all
      setVisibleMenus(prev => prev.filter(id => !sectionIds.includes(id)));
    } else {
      // Select all (excluding restricted)
      const nonRestrictedIds = sectionIds.filter(id => !isMenuRestricted(id));
      setVisibleMenus(prev => [...new Set([...prev, ...nonRestrictedIds])]);
    }
  };

  // Check if section is fully selected
  const isSectionSelected = (section: MenuSection) => {
    const sectionIds = [section.id, ...section.items.map(item => item.id)];
    return sectionIds.every(id => visibleMenus.includes(id));
  };

  // Check if section is partially selected
  const isSectionPartial = (section: MenuSection) => {
    const sectionIds = [section.id, ...section.items.map(item => item.id)];
    const selected = sectionIds.filter(id => visibleMenus.includes(id));
    return selected.length > 0 && selected.length < sectionIds.length;
  };

  // Select all / Deselect all
  const selectAll = () => {
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

  const deselectAll = () => setVisibleMenus([]);

  const resetToDefault = () => {
    setVisibleMenus(getDefaultPermissions('agent'));
    toast.info('รีเซ็ตเป็นค่าเริ่มต้นแล้ว');
  };

  // Save permissions
  const handleSave = async () => {
    if (!selectedAgent) return;
    
    setSaving(true);
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
        mutate();
      } else {
        const error = await res.json();
        toast.error(error.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setSaving(false);
    }
  };

  const toggleSectionOpen = (sectionId: string) => {
    setOpenSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ตั้งค่าการมองเห็นเอเย่น</h1>
          <p className="text-muted-foreground">กำหนดเมนูและสิทธิ์ที่เอเย่นสามารถเห็นและใช้งานได้</p>
        </div>
        <Button variant="outline" onClick={() => mutate()} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          รีเฟรช
        </Button>
      </div>

      {/* คำเตือน Restricted */}
      <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            ข้อจำกัดสิทธิ์
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-red-700 dark:text-red-400">
          <p>หมวด <strong>Super Admin</strong> และ <strong>ความปลอดภัย</strong> เป็นหมวด Restricted</p>
          <p>ไม่สามารถเปิดให้เอเย่นต์เห็นได้ แม้จะเลือก &quot;เปิดทั้งหมด&quot; ก็ตาม</p>
        </CardContent>
      </Card>

      {/* ลำดับชั้นระบบ */}
      <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-600" />
            ลำดับชั้นระบบ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <Badge variant="default" className="bg-purple-600">เว็บแม่ (Master)</Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Badge variant="default" className="bg-blue-600">เอเย่น Lv.1</Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Badge variant="default" className="bg-green-600">เอเย่น Lv.2</Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Badge variant="outline">แมมเบอร์ (ลูกค้า)</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            หวยจากแมมเบอร์ → ส่งผ่านเอเย่น (หัก % กำไร) → ส่งเว็บแม่
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        {/* รายชื่อเอเย่น */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              เลือกเอเย่น
            </CardTitle>
            <Select value={filterSystem} onValueChange={setFilterSystem}>
              <SelectTrigger>
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
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {filteredAgents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">ไม่มีเอเย่น</p>
                ) : (
                  filteredAgents.map(agent => (
                    <div
                      key={agent.id}
                      onClick={() => handleSelectAgent(agent.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedAgent === agent.id 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="font-medium">
                        {agent.name || agent.code}
                        {agent.name && agent.code && agent.name !== agent.code && (
                          <span className="text-xs text-muted-foreground ml-2">({agent.code})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {agent.enable_manual_key && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            คีย์
                          </Badge>
                        )}
                        {agent.enable_auto && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            ออโต้
                          </Badge>
                        )}
                        {!agent.enable_manual_key && !agent.enable_auto && (
                          <Badge variant="outline" className="text-xs">
                            {agent.system_type === 'auto' ? 'ออโต้' : agent.system_type === 'hybrid' ? 'ผสม' : 'คีย์'}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          Lv.{agent.level || 1}
                        </Badge>
                        <Badge 
                          variant={agent.status === 'active' ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {agent.status === 'active' ? 'ใช้งาน' : 'ปิด'}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* ตั้งค่าการมองเห็น */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                ตั้งค่าเมนูและสิทธิ์
              </span>
              {selectedAgent && (
                <Badge variant="secondary">
                  เปิด {visibleCount} / {totalCount} เมนู
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {selectedAgent 
                ? `กำหนดสิทธิ์สำหรับ: ${agents.find(a => a.id === selectedAgent)?.name || agents.find(a => a.id === selectedAgent)?.code || 'เอเย่น'}`
                : 'เลือกเอเย่นเพื่อตั้งค่า'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedAgent ? (
              <div className="text-center py-12 text-muted-foreground">
                <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>กรุณาเลือกเอเย่นจากรายการด้านซ้าย</p>
              </div>
            ) : (
              <>
                {/* สิทธิ์พิเศษ */}
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-medium">สิทธิ์พิเศษ</h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>สร้างเอเย่นย่อยได้</Label>
                      <p className="text-xs text-muted-foreground">อนุญาตให้สร้างเอเย่นระดับล่าง</p>
                    </div>
                    <Switch 
                      checked={canCreateSubAgent} 
                      onCheckedChange={setCanCreateSubAgent} 
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>ดูรายงานได้</Label>
                      <p className="text-xs text-muted-foreground">เห็นรายงานยอดขายและกำไร</p>
                    </div>
                    <Switch 
                      checked={canViewReports} 
                      onCheckedChange={setCanViewReports} 
                    />
                  </div>
                </div>

                <Separator />

                {/* ค้นหาและปุ่มควบคุม */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="ค้นหาเมนู..."
                      value={searchMenu}
                      onChange={(e) => setSearchMenu(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    <CheckSquare className="mr-1 h-3 w-3" /> เปิดทั้งหมด
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAll}>
                    <Square className="mr-1 h-3 w-3" /> ปิดทั้งหมด
                  </Button>
                  <Button variant="outline" size="sm" onClick={resetToDefault}>
                    <RotateCcw className="mr-1 h-3 w-3" /> รีเซ็ต
                  </Button>
                </div>

                {/* Permission Tree */}
                <ScrollArea className="h-[400px] border rounded-lg p-2">
                  <div className="space-y-1">
                    {/* Standalone Items */}
                    <div className="space-y-1 mb-4">
                      <p className="text-xs font-medium text-muted-foreground px-2 py-1">เมนูหลัก</p>
                      {STANDALONE_ITEMS.map(item => {
                        const Icon = item.icon;
                        return (
                          <div
                            key={item.id}
                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                              visibleMenus.includes(item.id)
                                ? 'bg-primary/10'
                                : 'hover:bg-muted/50'
                            }`}
                            onClick={() => toggleMenu(item.id)}
                          >
                            <Checkbox checked={visibleMenus.includes(item.id)} />
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{item.title}</span>
                          </div>
                        );
                      })}
                    </div>

                    <Separator />

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
                                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </Button>
                              </CollapsibleTrigger>
                              <Checkbox
                                checked={isSelected}
                                ref={el => {
                                  if (el && isPartial && !isSelected) {
                                    el.dataset.state = 'indeterminate';
                                  }
                                }}
                                onCheckedChange={() => toggleSection(section)}
                                disabled={isRestricted}
                              />
                              <SectionIcon className="h-4 w-4 text-amber-500" />
                              <span className="font-medium text-sm flex-1">{section.title}</span>
                              {isRestricted && (
                                <Badge variant="destructive" className="text-xs">
                                  <Lock className="h-3 w-3 mr-1" />
                                  Restricted
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {section.items.filter(item => visibleMenus.includes(item.id)).length}/{section.items.length}
                              </Badge>
                            </div>

                            <CollapsibleContent>
                              <div className="ml-8 space-y-1 pb-2">
                                {section.items.map(item => {
                                  const ItemIcon = item.icon;
                                  const itemRestricted = isMenuRestricted(item.id);
                                  
                                  return (
                                    <div
                                      key={item.id}
                                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                                        itemRestricted ? 'opacity-50 cursor-not-allowed' :
                                        visibleMenus.includes(item.id)
                                          ? 'bg-primary/10'
                                          : 'hover:bg-muted/50'
                                      }`}
                                      onClick={() => !itemRestricted && toggleMenu(item.id)}
                                    >
                                      <Checkbox 
                                        checked={visibleMenus.includes(item.id)} 
                                        disabled={itemRestricted}
                                      />
                                      <ItemIcon className="h-4 w-4 text-muted-foreground" />
                                      <div className="flex-1">
                                        <span className="text-sm">{item.title}</span>
                                        {item.description && (
                                          <p className="text-xs text-muted-foreground">{item.description}</p>
                                        )}
                                      </div>
                                      {itemRestricted && <Lock className="h-3 w-3 text-red-500" />}
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

                {/* ปุ่มบันทึก */}
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'กำลังบันทึก...' : 'บันทึกสิทธิ์'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
