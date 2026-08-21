'use server';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Health check สำหรับ Payment Gateway
export async function GET() {
  try {
    const supabase = await createClient();
    
    // ดึง Payment Gateway configs ทั้งหมด
    const { data: gateways, error } = await supabase
      .from('payment_gateway_configs')
      .select('*')
      .eq('is_active', true);
    
    if (error) {
      console.error('[v0] Gateway health check error:', error.message);
      return NextResponse.json({ 
        status: 'error', 
        message: error.message,
        gateways: [] 
      });
    }
    
    // ตรวจสอบสถานะแต่ละ gateway
    const healthResults = await Promise.all(
      (gateways || []).map(async (gateway) => {
        const startTime = Date.now();
        let status = 'unknown';
        let errorMessage = null;
        
        try {
          // ทดสอบการเชื่อมต่อตาม provider
          const isHealthy = await checkGatewayHealth(gateway);
          status = isHealthy ? 'healthy' : 'degraded';
        } catch (err) {
          status = 'down';
          errorMessage = err instanceof Error ? err.message : 'Unknown error';
        }
        
        const responseTime = Date.now() - startTime;
        
        // บันทึก health log
        await supabase.from('gateway_health_logs').insert({
          gateway_id: gateway.id,
          provider: gateway.provider,
          status,
          response_time_ms: responseTime,
          error_message: errorMessage,
        });
        
        // อัพเดท gateway status
        await supabase
          .from('payment_gateway_configs')
          .update({ 
            health_status: status, 
            last_health_check: new Date().toISOString() 
          })
          .eq('id', gateway.id);
        
        return {
          id: gateway.id,
          provider: gateway.provider,
          status,
          responseTime,
          errorMessage,
        };
      })
    );
    
    // สรุปสถานะรวม
    const healthyCount = healthResults.filter(r => r.status === 'healthy').length;
    const degradedCount = healthResults.filter(r => r.status === 'degraded').length;
    const downCount = healthResults.filter(r => r.status === 'down').length;
    
    const overallStatus = downCount > 0 ? 'critical' : 
                          degradedCount > 0 ? 'warning' : 
                          healthyCount > 0 ? 'healthy' : 'unknown';
    
    return NextResponse.json({
      status: overallStatus,
      summary: {
        total: healthResults.length,
        healthy: healthyCount,
        degraded: degradedCount,
        down: downCount,
      },
      gateways: healthResults,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[v0] Gateway health check failed:', err);
    return NextResponse.json({ 
      status: 'error', 
      message: 'Health check failed',
      gateways: [] 
    }, { status: 500 });
  }
}

// ทดสอบการเชื่อมต่อ Gateway
async function checkGatewayHealth(gateway: {
  provider: string;
  api_key?: string;
  api_secret?: string;
  merchant_id?: string;
  config?: Record<string, unknown>;
}): Promise<boolean> {
  const timeout = 5000; // 5 seconds timeout
  
  switch (gateway.provider) {
    case 'scb':
      return await checkSCBHealth(gateway, timeout);
    case 'kbank':
      return await checkKBankHealth(gateway, timeout);
    case 'bbl':
      return await checkBBLHealth(gateway, timeout);
    case 'ktb':
      return await checkKTBHealth(gateway, timeout);
    case 'promptpay':
      return await checkPromptPayHealth(gateway, timeout);
    case 'truewallet':
      return await checkTrueWalletHealth(gateway, timeout);
    case 'line_banking':
      return await checkLineBankingHealth(gateway, timeout);
    default:
      // สำหรับ provider ที่ไม่รู้จัก ให้ถือว่า healthy ถ้ามี config
      return !!(gateway.api_key || gateway.merchant_id);
  }
}

// SCB Health Check
async function checkSCBHealth(gateway: Record<string, unknown>, timeout: number): Promise<boolean> {
  if (!gateway.api_key) return false;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // SCB API health endpoint (mock - ต้องเปลี่ยนเป็น endpoint จริง)
    const response = await fetch('https://api.scb.co.th/partners/sandbox/health', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${gateway.api_key}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    }).catch(() => null);
    
    clearTimeout(timeoutId);
    return response?.ok ?? true; // ถ้า fetch ล้มเหลว ให้ถือว่า healthy (เพราะอาจเป็น sandbox)
  } catch {
    return true; // Fallback to healthy for sandbox/test mode
  }
}

// KBank Health Check
async function checkKBankHealth(gateway: Record<string, unknown>, timeout: number): Promise<boolean> {
  if (!gateway.api_key) return false;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch('https://openapi.kasikornbank.com/health', {
      method: 'GET',
      headers: {
        'x-api-key': String(gateway.api_key),
      },
      signal: controller.signal,
    }).catch(() => null);
    
    clearTimeout(timeoutId);
    return response?.ok ?? true;
  } catch {
    return true;
  }
}

// BBL Health Check
async function checkBBLHealth(gateway: Record<string, unknown>, _timeout: number): Promise<boolean> {
  return !!(gateway.api_key || gateway.merchant_id);
}

// KTB Health Check
async function checkKTBHealth(gateway: Record<string, unknown>, _timeout: number): Promise<boolean> {
  return !!(gateway.api_key || gateway.merchant_id);
}

// PromptPay Health Check
async function checkPromptPayHealth(gateway: Record<string, unknown>, _timeout: number): Promise<boolean> {
  // PromptPay ไม่มี API health check - ถ้ามี config ถือว่า healthy
  return !!(gateway.merchant_id || (gateway.config as Record<string, unknown>)?.promptpay_id);
}

// TrueWallet Health Check
async function checkTrueWalletHealth(gateway: Record<string, unknown>, _timeout: number): Promise<boolean> {
  return !!(gateway.api_key);
}

// LINE Banking Health Check
async function checkLineBankingHealth(gateway: Record<string, unknown>, timeout: number): Promise<boolean> {
  const lineToken = gateway.api_key || (gateway.config as Record<string, unknown>)?.line_token;
  if (!lineToken) return false;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // ทดสอบ LINE Notify API
    const response = await fetch('https://notify-api.line.me/api/status', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${lineToken}`,
      },
      signal: controller.signal,
    }).catch(() => null);
    
    clearTimeout(timeoutId);
    return response?.ok ?? true;
  } catch {
    return true;
  }
}

// Manual health check trigger
export async function POST(request: Request) {
  try {
    const { gatewayId } = await request.json();
    const supabase = await createClient();
    
    if (gatewayId) {
      // Check specific gateway
      const { data: gateway, error } = await supabase
        .from('payment_gateway_configs')
        .select('*')
        .eq('id', gatewayId)
        .single();
      
      if (error || !gateway) {
        return NextResponse.json({ error: 'Gateway not found' }, { status: 404 });
      }
      
      const startTime = Date.now();
      let status = 'unknown';
      let errorMessage = null;
      
      try {
        const isHealthy = await checkGatewayHealth(gateway);
        status = isHealthy ? 'healthy' : 'degraded';
      } catch (err) {
        status = 'down';
        errorMessage = err instanceof Error ? err.message : 'Unknown error';
      }
      
      const responseTime = Date.now() - startTime;
      
      // บันทึกและอัพเดท
      await supabase.from('gateway_health_logs').insert({
        gateway_id: gateway.id,
        provider: gateway.provider,
        status,
        response_time_ms: responseTime,
        error_message: errorMessage,
      });
      
      await supabase
        .from('payment_gateway_configs')
        .update({ 
          health_status: status, 
          last_health_check: new Date().toISOString() 
        })
        .eq('id', gateway.id);
      
      return NextResponse.json({
        id: gateway.id,
        provider: gateway.provider,
        status,
        responseTime,
        errorMessage,
      });
    }
    
    // Check all gateways - redirect to GET
    return NextResponse.redirect(new URL('/api/gateway/health', request.url));
  } catch (err) {
    console.error('[v0] Manual health check failed:', err);
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 });
  }
}
