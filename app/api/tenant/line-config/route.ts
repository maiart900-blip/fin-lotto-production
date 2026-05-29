import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import {
  getTenantLineConfig,
  updateTenantLineConfig,
  testTenantLineConnection,
} from '@/lib/notifications/line-multi-tenant';

/**
 * Tenant LINE Configuration API
 * 
 * Allows each Sub-Web tenant to configure their own LINE Token
 * for receiving deposit/withdrawal/betting notifications.
 * 
 * GET /api/tenant/line-config
 * - Returns current LINE configuration for authenticated tenant
 * 
 * PUT /api/tenant/line-config
 * - Updates LINE configuration (token, group ID, enabled status)
 * 
 * POST /api/tenant/line-config/test
 * - Tests LINE connection for tenant
 */

// GET - Get tenant's LINE configuration
export async function GET(request: NextRequest) {
  try {
    // Auth guard
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;
    
    // Get tenant_id from user
    const tenantId = user.tenant_id;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูล Tenant' },
        { status: 400 }
      );
    }
    
    const config = await getTenantLineConfig(tenantId);
    
    if (!config) {
      return NextResponse.json(
        { error: 'ไม่พบการตั้งค่า' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      config: {
        tenant_name: config.tenant_name,
        line_channel_token: config.line_channel_token ? '********' : null,
        line_group_id: config.line_group_id ? `***${config.line_group_id.slice(-8)}` : null,
        line_notification_enabled: config.line_notification_enabled,
        is_configured: !!(config.line_channel_token && config.line_group_id),
      },
    });
  } catch (error) {
    console.error('GET tenant LINE config error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}

// PUT - Update tenant's LINE configuration
export async function PUT(request: NextRequest) {
  try {
    // Auth guard
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;
    
    // Only admin/owner can update LINE config
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์ดำเนินการ' },
        { status: 403 }
      );
    }
    
    const tenantId = user.tenant_id;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูล Tenant' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { line_channel_token, line_group_id, line_notification_enabled } = body;
    
    // Validate inputs
    if (line_channel_token && line_channel_token.length < 50) {
      return NextResponse.json(
        { error: 'LINE Channel Token ไม่ถูกต้อง' },
        { status: 400 }
      );
    }
    
    if (line_group_id && !line_group_id.startsWith('C')) {
      return NextResponse.json(
        { error: 'LINE Group ID ไม่ถูกต้อง (ต้องขึ้นต้นด้วย C)' },
        { status: 400 }
      );
    }
    
    const result = await updateTenantLineConfig(tenantId, {
      line_channel_token,
      line_group_id,
      line_notification_enabled,
    });
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'ไม่สามารถบันทึกได้' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'บันทึกการตั้งค่าสำเร็จ',
    });
  } catch (error) {
    console.error('PUT tenant LINE config error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}

// POST - Test tenant's LINE connection
export async function POST(request: NextRequest) {
  try {
    // Auth guard
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;
    
    const tenantId = user.tenant_id;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูล Tenant' },
        { status: 400 }
      );
    }
    
    const result = await testTenantLineConnection(tenantId);
    
    return NextResponse.json({
      success: result.success,
      message: result.success 
        ? 'ทดสอบการเชื่อมต่อสำเร็จ - ตรวจสอบกลุ่ม LINE' 
        : result.error || 'ไม่สามารถเชื่อมต่อได้',
    });
  } catch (error) {
    console.error('POST tenant LINE test error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
