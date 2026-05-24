import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

// รายการเมนูทั้งหมดในระบบ
const ALL_MENUS = {
  // ระบบออโต้
  auto: [
    'auto-system',
    'auto-entries', 
    'auto-customers',
    'auto-reports',
  ],
  // ระบบคีย์หวย
  manual_key: [
    'manual-key',
    'manual-entries',
    'manual-customers',
    'manual-reports',
  ],
  // เมนูกลาง
  common: [
    'dashboard',
    'results',
    'risk-control',
    'reports',
  ],
  // เมนู admin
  admin: [
    'master-control',
    'member-visibility',
    'lottery-settings',
    'payout-settings',
    'financial',
    'multi-tenant',
  ],
};

// GET: ดึงสิทธิ์ของ agent
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth guard - require admin
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const supabase = await createClient();

    // ดึงข้อมูล agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, name, code, role, system_type, enable_auto, enable_manual_key')
      .eq('id', id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // ดึง permissions จาก agent_permissions table
    const { data: permissions, error: permError } = await supabase
      .from('agent_permissions')
      .select('*')
      .eq('agent_id', id);

    if (permError) {
      console.error('Error fetching permissions:', permError);
    }

    // สร้าง permissions map
    const permissionsMap: Record<string, any> = {};
    (permissions || []).forEach((p: any) => {
      permissionsMap[p.menu_key] = {
        can_view: p.can_view,
        can_create: p.can_create,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
        can_approve: p.can_approve,
        can_payout: p.can_payout,
      };
    });

    // คำนวณ visible_menus จาก permissions + system_type
    const visibleMenus: string[] = [];
    
    // เมนูกลาง
    ALL_MENUS.common.forEach(menu => {
      if (permissionsMap[menu]?.can_view !== false) {
        visibleMenus.push(menu);
      }
    });

    // เมนูออโต้ (ถ้าเปิดใช้)
    if (agent.enable_auto || agent.system_type === 'auto' || agent.system_type === 'both') {
      ALL_MENUS.auto.forEach(menu => {
        if (permissionsMap[menu]?.can_view !== false) {
          visibleMenus.push(menu);
        }
      });
    }

    // เมนูคีย์หวย (ถ้าเปิดใช้)
    if (agent.enable_manual_key || agent.system_type === 'manual_key' || agent.system_type === 'both') {
      ALL_MENUS.manual_key.forEach(menu => {
        if (permissionsMap[menu]?.can_view !== false) {
          visibleMenus.push(menu);
        }
      });
    }

    // เมนู admin (ถ้าเป็น super_admin หรือ admin)
    if (agent.role === 'super_admin' || agent.role === 'admin') {
      ALL_MENUS.admin.forEach(menu => {
        if (permissionsMap[menu]?.can_view !== false) {
          visibleMenus.push(menu);
        }
      });
    }

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        code: agent.code,
        role: agent.role,
        system_type: agent.system_type,
        enable_auto: agent.enable_auto,
        enable_manual_key: agent.enable_manual_key,
      },
      permissions: permissionsMap,
      visible_menus: visibleMenus,
      all_menus: ALL_MENUS,
    });
  } catch (error) {
    console.error('Error in GET permissions:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: อัปเดตสิทธิ์ของ agent
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { 
      system_type, 
      enable_auto, 
      enable_manual_key, 
      permissions,
      visible_menus,
    } = body;

    const supabase = await createClient();

    // อัปเดต agent settings
    const updateData: Record<string, any> = {};
    if (system_type !== undefined) updateData.system_type = system_type;
    if (enable_auto !== undefined) updateData.enable_auto = enable_auto;
    if (enable_manual_key !== undefined) updateData.enable_manual_key = enable_manual_key;

    if (Object.keys(updateData).length > 0) {
      const { error: agentError } = await supabase
        .from('agents')
        .update(updateData)
        .eq('id', id);

      if (agentError) {
        console.error('Error updating agent:', agentError);
        return NextResponse.json(
          { success: false, error: 'Failed to update agent settings' },
          { status: 500 }
        );
      }
    }

    // อัปเดต permissions
    if (permissions && typeof permissions === 'object') {
      for (const [menuKey, perms] of Object.entries(permissions)) {
        const permData = perms as any;
        
        // Upsert permission
        const { error: permError } = await supabase
          .from('agent_permissions')
          .upsert({
            agent_id: id,
            menu_key: menuKey,
            can_view: permData.can_view ?? true,
            can_create: permData.can_create ?? false,
            can_edit: permData.can_edit ?? false,
            can_delete: permData.can_delete ?? false,
            can_approve: permData.can_approve ?? false,
            can_payout: permData.can_payout ?? false,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'agent_id,menu_key',
          });

        if (permError) {
          console.error(`Error upserting permission for ${menuKey}:`, permError);
        }
      }
    }

    // ถ้าส่ง visible_menus มา ให้อัปเดต can_view ตาม
    if (visible_menus && Array.isArray(visible_menus)) {
      // รวมเมนูทั้งหมด
      const allMenuKeys = [
        ...ALL_MENUS.auto,
        ...ALL_MENUS.manual_key,
        ...ALL_MENUS.common,
        ...ALL_MENUS.admin,
      ];

      for (const menuKey of allMenuKeys) {
        const canView = visible_menus.includes(menuKey);
        
        const { error: permError } = await supabase
          .from('agent_permissions')
          .upsert({
            agent_id: id,
            menu_key: menuKey,
            can_view: canView,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'agent_id,menu_key',
          });

        if (permError) {
          console.error(`Error upserting menu visibility for ${menuKey}:`, permError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Permissions updated successfully',
    });
  } catch (error) {
    console.error('Error in PUT permissions:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
