'use client';

import { useState, useMemo } from 'react';
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
} from '@/lib/menu-config';
import { fetcher } from '@/lib/fetcher';

interface Member {
  id: string;
  username: string;
  name: string;
  system_type: string;
  agent_level: string;
  status: string;
  visible_menus: string[];
  can_key_lottery: boolean;
  can_approve_transactions: boolean;
}

export default function MemberVisibilityPage() {
  // Fetch members (staff/team) from customers table where agent_level = 'member'
  // Members are staff working under agents, NOT customers/bettors
  const { data, mutate, isLoading } = useSWR('/api/customers?agent_level=member&limit=100', fetcher);
  // API returns array directly: Customer[]
  const members: Member[] = (Array.isArray(data) ? data : []).map((customer: any) => ({
    id: customer.id,
    username: customer.username,
    name: customer.name || customer.display_name,
    system_type: customer.system_type || 'manual_key',
    agent_level: customer.agent_level || 'member',
    status: customer.is_active !== false ? 'active' : 'inactive',
    visible_menus: Array.isArray(customer.visible_menus) ? customer.visible_menus : [],
    can_key_lottery: customer.can_key_lottery !== false,
    can_approve_transactions: customer.can_approve_transactions || false,
  }));
  
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [visibleMenus, setVisibleMenus] = useState<string[]>([]);
  const [canKeyLottery, setCanKeyLottery] = useState(true);
  const [canApproveTransactions, setCanApproveTransactions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterSystem, setFilterSystem] = useState<string>('all');
  const [searchMenu, setSearchMenu] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const filteredMembers = members.filter((m: Member) => 
    filterSystem === 'all' || m.system_type === filterSystem
  );

  // Get member-relevant sections (exclude agent-only and super-admin sections)
  const memberMenuSections = useMemo(() => {
    return ALL_MENU_SECTIONS.filter(section => 
      !section.agentOnly && 
      !section.superAdminOnly && 
      section.memberVisible
    );
  }, []);

  // Filter menu sections based on search
  const filteredSections = useMemo(() => {
    if (!searchMenu.trim()) return memberMenuSections;
    
    const search = searchMenu.toLowerCase();
    return memberMenuSections.map(section => {
      const filteredItems = section.items.filter(item => 
        item.title.toLowerCase().includes(search) ||
        item.description?.toLowerCase().includes(search)
      );
      
      if (filteredItems.length > 0 || section.title.toLowerCase().includes(search)) {
        return { ...section, items: filteredItems.length > 0 ? filteredItems : section.items };
      }
      return null;
    }).filter(Boolean) as MenuSection[];
  }, [searchMenu, memberMenuSections]);

  // Count visible menus
  const visibleCount = visibleMenus.length;
  const totalCount = useMemo(() => {
    let count = STANDALONE_ITEMS.length;
    memberMenuSections.forEach(section => {
      count += 1 + section.items.length;
    });
    return count;
  }, [memberMenuSections]);

  // Load permissions when member is selected
  const handleSelectMember = async (memberId: string) => {
    const member = members.find((m: Member) => m.id === memberId);
    if (member) {
      setSelectedMember(memberId);
      
      try {
        // Use customer menu-permissions API for members (staff)
        const res = await fetch(`/api/menu-permissions?target_id=${memberId}&target_type=member`, {
          credentials: 'include',
        });
        const data = await res.json();
        
        if (data.permissions && data.permissions.length > 0) {
          setVisibleMenus(data.permissions);
        } else {
          setVisibleMenus(member.visible_menus || getDefaultPermissions('member'));
        }
        
        setCanKeyLottery(data.canKeyLottery ?? member.can_key_lottery ?? true);
        setCanApproveTransactions(data.canApproveTransactions ?? member.can_approve_transactions ?? false);
      } catch {
        setVisibleMenus(member.visible_menus || getDefaultPermissions('member'));
        setCanKeyLottery(member.can_key_lottery !== false);
        setCanApproveTransactions(member.can_approve_transactions || false);
      }
    }
  };

  // Toggle single menu item
  const toggleMenu = (menuId: string) => {
    if (isMenuRestricted(menuId)) {
      toast.error('เมนูนี้เป็นเมนู Restricted ไม่สามารถเปิดให้แมมเบอร์ได้');
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
      toast.error('หมวดนี้เป็นหมวด Restricted ไม่สามารถเปิดให้แมมเบอร์ได้');
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
    memberMenuSections.forEach(section => {
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
    setVisibleMenus(getDefaultPermissions('member'));
    toast.info('รีเซ็ตเป็นค่าเริ่มต้นแล้ว');
  };

  // Save permissions
  const handleSave = async () => {
    if (!selectedMember) return;
    
    setSaving(true);
    try {
      // Use menu-permissions API for members (staff)
      const res = await fetch('/api/menu-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          target_id: selectedMember,
          target_type: 'member',
          permissions: visibleMenus,
          canKeyLottery: canKeyLottery,
          canApproveTransactions: canApproveTransactions,
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
          <h1 className="text-2xl font-bold">ตั้งค่าการมองเห็นแมมเบอร์</h1>
          <p className="text-muted-foreground">กำหนดเมนูและสิทธิ์ที่แมมเบอร์ (พนักงาน) สามารถเห็นและใช้งานได้</p>
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
          <p>แมมเบอร์จะเห็นเฉพาะเมนูที่เกี่ยวข้องกับการทำงานเท่านั้น</p>
          <p>หมวด Super Admin และความปลอดภัยจะไม่แสดงให้แมมเบอร์เห็น</p>
        </CardContent>
      </Card>

      {/* บทบาทแมมเบอร์ */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            บทบาทของแมมเบอร์ (พนักงาน)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <Badge variant="default" className="bg-purple-600">เว็บแม่ (Master)</Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Badge variant="default" className="bg-blue-600">เอเย่น</Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Badge variant="default" className="bg-green-600">แมมเบอร์ (พนักงาน)</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            แมมเบอร์ทำหน้าที่: คีย์หวย, ตรวจสอบฝาก/ถอน, จัดการลูกค้า, รับโพยลูกค้า
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        {/* รายชื่อแมมเบอร์ */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              เลือกแมมเบอร์
            </CardTitle>
            <Select value={filterSystem} onValueChange={setFilterSystem}>
              <SelectTrigger>
                <SelectValue placeholder="ระบบทั้งหมด" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="manual_key">คีย์หวย</SelectItem>
                <SelectItem value="auto">ออโต้</SelectItem>
                <SelectItem value="both">ออโต้ + คีย์หวย</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {filteredMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">ไม่มีแมมเบอร์</p>
                ) : (
                  filteredMembers.map((member: Member) => (
                    <div
                      key={member.id}
                      onClick={() => handleSelectMember(member.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedMember === member.id 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="font-medium">{member.name || member.username}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {member.system_type === 'auto' ? 'ออโต้' : member.system_type === 'both' ? 'ออโต้+คีย์' : 'คีย์หวย'}
                        </Badge>
                        <Badge 
                          variant={member.status === 'active' ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {member.status === 'active' ? 'ใช้งาน' : 'ปิด'}
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
              {selectedMember && (
                <Badge variant="secondary">
                  เปิด {visibleCount} / {totalCount} เมนู
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {selectedMember 
                ? `กำหนดสิทธิ์สำหรับ: ${members.find((m: Member) => m.id === selectedMember)?.name || 'แมมเบอร์'}`
                : 'เลือกแมมเบอร์เพื่อตั้งค่า'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedMember ? (
              <div className="text-center py-12 text-muted-foreground">
                <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>กรุณาเลือกแมมเบอร์จากรายการด้านซ้าย</p>
              </div>
            ) : (
              <>
                {/* สิทธิ์การทำงาน */}
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-medium">สิทธิ์การทำงาน</h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>คีย์หวยได้</Label>
                      <p className="text-xs text-muted-foreground">อนุญาตให้คีย์หวยให้ลูกค้า</p>
                    </div>
                    <Switch 
                      checked={canKeyLottery} 
                      onCheckedChange={setCanKeyLottery} 
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>อนุมัติธุรกรรมได้</Label>
                      <p className="text-xs text-muted-foreground">อนุมัติการเติมเงิน/ถอนเงิน</p>
                    </div>
                    <Switch 
                      checked={canApproveTransactions} 
                      onCheckedChange={setCanApproveTransactions} 
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
                              <SectionIcon className="h-4 w-4 text-blue-500" />
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
