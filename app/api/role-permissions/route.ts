import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  
  try {
    const { data: permissions, error } = await supabase
      .from('role_permissions')
      .select('*')
      .order('role')
      .order('permission_key');
    
    if (error) throw error;
    
    return NextResponse.json({ permissions: permissions || [] });
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  
  try {
    const body = await request.json();
    const { permissions } = body;
    
    if (!permissions || !Array.isArray(permissions)) {
      return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    }
    
    // Upsert all permissions
    for (const perm of permissions) {
      const { error } = await supabase
        .from('role_permissions')
        .upsert({
          role: perm.role,
          permission_key: perm.permission_key,
          can_view: perm.can_view,
          can_create: perm.can_create,
          can_edit: perm.can_edit,
          can_delete: perm.can_delete,
        }, {
          onConflict: 'role,permission_key',
        });
      
      if (error) throw error;
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating role permissions:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
