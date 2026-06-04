import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAgentOrHigher } from '@/lib/api-auth';
import { requireCustomerAccess, getCustomerScopeForUser, filterAccessibleCustomerIds } from '@/lib/customer-scope';

export async function GET(request: NextRequest) {
  try {
    // Auth guard
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;
    
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const customerId = searchParams.get('customer_id');
    const type = searchParams.get('type');

    // SECURITY: If customer_id specified, verify access
    if (customerId) {
      const accessCheck = await requireCustomerAccess(customerId, {
        id: session.id,
        role: session.role,
        user_type: session.user_type,
        tenant_id: session.tenant_id,
      });
      
      if (!accessCheck.allowed) {
        return NextResponse.json([]);
      }
    }

    let query = supabase
      .from('credit_transactions')
      .select(`
        *,
        customer:customers(id, name, phone, tenant_id, agent_id),
        creator:users!credit_transactions_created_by_fkey(id, display_name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (customerId) {
      query = query.eq('customer_id', customerId);
    } else {
      // SECURITY: If no specific customer, get scope-filtered customer IDs
      const scope = await getCustomerScopeForUser({
        id: session.id,
        role: session.role,
        user_type: session.user_type,
        tenant_id: session.tenant_id,
      });
      
      // For agents, we need to filter transactions to only their customers
      if (scope.isAgent && scope.agentIds.length > 0) {
        // Get all customer IDs in the user's scope
        const { data: scopedCustomers } = await supabase
          .from('customers')
          .select('id')
          .in('agent_id', scope.agentIds);
        
        const customerIds = (scopedCustomers || []).map(c => c.id);
        if (customerIds.length > 0) {
          query = query.in('customer_id', customerIds);
        } else {
          return NextResponse.json([]);
        }
      } else if (scope.isTenantOwner && scope.tenantId) {
        // Get customers in tenant
        const { data: tenantCustomers } = await supabase
          .from('customers')
          .select('id')
          .eq('tenant_id', scope.tenantId);
        
        const customerIds = (tenantCustomers || []).map(c => c.id);
        if (customerIds.length > 0) {
          query = query.in('customer_id', customerIds);
        } else {
          return NextResponse.json([]);
        }
      }
      // Super admin sees all
    }

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[v0] Credit transactions fetch error:', error);
      // Return empty array on error
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[v0] Credit transactions GET error:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Auth guard
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;

    const supabase = await createClient();
    const body = await request.json();
    const { customer_id, type, amount, note, reason, created_by, audit_metadata } = body;

    if (!customer_id || !type || amount === undefined) {
      return NextResponse.json(
        { error: 'ข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    // SECURITY: Mandatory reason for admin adjustments
    if ((type === 'admin_add' || type === 'admin_subtract') && !reason) {
      return NextResponse.json(
        { error: 'กรุณาระบุเหตุผลในการปรับยอด' },
        { status: 400 }
      );
    }

    // Get customer current balance (database uses credit_balance column)
    // WARNING: Race condition risk - read-then-write pattern
    // TODO: Convert to atomic transaction using Postgres RPC with FOR UPDATE lock
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, credit_balance')
      .eq('id', customer_id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลลูกค้า' },
        { status: 404 }
      );
    }

    const currentBalance = Number(customer.credit_balance || 0);
    const newBalance = currentBalance + Number(amount);

    if (newBalance < 0) {
      return NextResponse.json(
        { error: 'ยอดเครดิตไม่เพียงพอ' },
        { status: 400 }
      );
    }

    // Build note with reason for audit trail
    const auditNote = reason 
      ? `[${reason}] ${note || ''}`.trim()
      : note;

    // Create transaction record with audit metadata
    const { data: transaction, error: txError } = await supabase
      .from('credit_transactions')
      .insert({
        customer_id,
        type,
        amount: Number(amount),
        balance_before: currentBalance,
        balance_after: newBalance,
        note: auditNote,
        created_by: created_by || session.id,
        // Store audit metadata in note if table doesn't have metadata column
        // metadata: audit_metadata,
      })
      .select()
      .single();

    if (txError) {
      console.error('[v0] Credit transaction insert error:', txError);
      return NextResponse.json(
        { error: 'ไม่สามารถบันทึกรายการได้' },
        { status: 500 }
      );
    }

    // Update customer balance (database uses credit_balance column)
    const { error: updateError } = await supabase
      .from('customers')
      .update({ credit_balance: newBalance })
      .eq('id', customer_id);

    if (updateError) {
      console.error('Customer balance update error:', updateError);
      // Don't fail the request, transaction was already created
    }

    // Log to audit_logs table if exists (silent fail)
    try {
      await supabase.from('audit_logs').insert({
        user_id: session.id,
        action: type === 'admin_add' ? 'credit_add' : 'credit_subtract',
        resource_type: 'customer',
        resource_id: customer_id,
        metadata: {
          amount: Number(amount),
          reason,
          note,
          balance_before: currentBalance,
          balance_after: newBalance,
          customer_name: customer.name,
          ...audit_metadata,
        },
        created_at: new Date().toISOString(),
      });
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({
      success: true,
      transaction,
      balance_before: currentBalance,
      balance_after: newBalance,
    });
  } catch (error) {
    console.error('Credit transactions POST error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการปรับยอดเครดิต' },
      { status: 500 }
    );
  }
}
