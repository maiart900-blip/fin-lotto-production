import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/api-auth';
import {
  sendMotherWebAlert,
  alertMotherWebSystemError,
  alertMotherWebRiskCritical,
  alertMotherWebTenantOffline,
  alertMotherWebSecurityAlert,
  sendMotherWebDailyAggregation,
  MotherWebAlertType,
} from '@/lib/notifications/line-multi-tenant';

/**
 * Mother Web LINE Alert API
 * SUPER ADMIN ONLY
 * 
 * Routes system errors and major risk alerts to the main LINE_GROUP_ID.
 * 
 * POST /api/mother-web/alerts
 * - Send alert to Mother Web's main LINE group
 * 
 * Body:
 * {
 *   type: 'system_error' | 'risk_critical' | 'risk_warning' | 'tenant_offline' | 'security_alert',
 *   severity: 'low' | 'medium' | 'high' | 'critical',
 *   title: string,
 *   message: string,
 *   data?: Record<string, any>,
 *   affectedTenants?: string[],
 * }
 */

export async function POST(request: NextRequest) {
  try {
    // Auth guard - SUPER ADMIN ONLY
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) return authResult;
    
    const body = await request.json();
    const { type, severity, title, message, data, affectedTenants } = body;
    
    // Validate required fields
    if (!type || !severity || !title || !message) {
      return NextResponse.json(
        { error: 'ต้องระบุ type, severity, title, และ message' },
        { status: 400 }
      );
    }
    
    // Validate type
    const validTypes: MotherWebAlertType[] = [
      'system_error',
      'risk_critical',
      'risk_warning',
      'tenant_offline',
      'security_alert',
      'daily_aggregation',
    ];
    
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `type ไม่ถูกต้อง: ${type}. ต้องเป็น: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Validate severity
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(severity)) {
      return NextResponse.json(
        { error: `severity ไม่ถูกต้อง: ${severity}. ต้องเป็น: ${validSeverities.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Send alert
    const result = await sendMotherWebAlert({
      type,
      severity,
      title,
      message,
      data,
      affectedTenants,
    });
    
    if (!result.success) {
      return NextResponse.json(
        { 
          success: false,
          error: result.error || 'ไม่สามารถส่งการแจ้งเตือนได้',
          details: 'กรุณาตรวจสอบการตั้งค่า LINE_CHANNEL_ACCESS_TOKEN และ LINE_GROUP_ID'
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'ส่งการแจ้งเตือนสำเร็จ',
      alert: {
        type,
        severity,
        title,
        sent_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Mother Web alert error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}

// GET - Check LINE configuration status
export async function GET() {
  try {
    // Auth guard - SUPER ADMIN ONLY
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) return authResult;
    
    const hasToken = !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const hasGroupId = !!process.env.LINE_GROUP_ID;
    
    return NextResponse.json({
      configured: hasToken && hasGroupId,
      status: {
        LINE_CHANNEL_ACCESS_TOKEN: hasToken ? 'configured' : 'missing',
        LINE_GROUP_ID: hasGroupId ? 'configured' : 'missing',
      },
      message: hasToken && hasGroupId
        ? 'LINE Notification พร้อมใช้งาน'
        : 'กรุณาตั้งค่า LINE_CHANNEL_ACCESS_TOKEN และ LINE_GROUP_ID',
    });
  } catch (error) {
    console.error('Mother Web config check error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
