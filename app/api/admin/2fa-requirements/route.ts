import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { get2FARequirements, update2FARequirement } from '@/lib/2fa-guard';

// GET - ดึงการตั้งค่า 2FA requirements ทั้งหมด
export async function GET() {
  try {
    const requirements = await get2FARequirements();
    
    return NextResponse.json({
      success: true,
      requirements,
    });
  } catch (error) {
    console.error('Error fetching 2FA requirements:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch 2FA requirements' },
      { status: 500 }
    );
  }
}

// PUT - อัปเดตการตั้งค่า 2FA requirement ของ role
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { role, is_required } = body;
    
    if (!role) {
      return NextResponse.json(
        { success: false, error: 'Role is required' },
        { status: 400 }
      );
    }
    
    const success = await update2FARequirement(role, is_required);
    
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to update 2FA requirement' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: `2FA requirement for ${role} updated to ${is_required}`,
    });
  } catch (error) {
    console.error('Error updating 2FA requirement:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update 2FA requirement' },
      { status: 500 }
    );
  }
}

// POST - เพิ่ม role ใหม่
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { role, is_required = false } = body;
    
    if (!role) {
      return NextResponse.json(
        { success: false, error: 'Role is required' },
        { status: 400 }
      );
    }
    
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('system_2fa_requirements')
      .insert({ role, is_required })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'Role already exists' },
          { status: 400 }
        );
      }
      throw error;
    }
    
    return NextResponse.json({
      success: true,
      requirement: data,
    });
  } catch (error) {
    console.error('Error creating 2FA requirement:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create 2FA requirement' },
      { status: 500 }
    );
  }
}
