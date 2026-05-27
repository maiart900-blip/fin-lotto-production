import { NextResponse } from 'next/server';
import { is2FARequiredForRole } from '@/lib/2fa-guard';
import { requireSuperAdmin } from '@/lib/api-auth';

// Hardcoded roles that require 2FA (for security, not configurable via UI)
const ROLES_REQUIRING_2FA = ['super_admin', 'admin', 'agent'];
const ALL_ROLES = ['super_admin', 'admin', 'agent', 'member', 'customer'];

// GET - ดึงการตั้งค่า 2FA requirements ทั้งหมด
export async function GET() {
  try {
    // Auth guard - require super_admin for 2FA settings
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) return authResult;

    // Return hardcoded requirements
    const requirements = ALL_ROLES.map(role => ({
      role,
      is_required: ROLES_REQUIRING_2FA.includes(role),
      is_configurable: false, // Security policy - not configurable via UI
    }));
    
    return NextResponse.json({
      success: true,
      requirements,
      note: '2FA requirements are enforced by security policy and cannot be modified via UI.',
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
// Disabled for security - 2FA requirements are hardcoded
export async function PUT() {
  return NextResponse.json(
    { 
      success: false, 
      error: '2FA requirements are enforced by security policy and cannot be modified.',
      note: 'Contact system administrator to change 2FA policy.',
    },
    { status: 403 }
  );
}

// POST - เพิ่ม role ใหม่
// Disabled for security
export async function POST() {
  return NextResponse.json(
    { 
      success: false, 
      error: '2FA requirements are enforced by security policy and cannot be modified.',
    },
    { status: 403 }
  );
}
