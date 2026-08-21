import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAgentOrHigher } from '@/lib/api-auth';
import {
  requireCustomerAccess,
  getCustomerScopeForUser,
} from '@/lib/customer-scope';

type SessionUser = {
  id: string;
  role: string;
  user_type: string;
  tenant_id: string | null;
};

function normalizeSession(authResult: unknown): SessionUser | null {
  const result = authResult as {
    user?: {
      id?: string;
      role?: string;
      user_type?: string;
      tenant_id?: string | null;
    };
  };

  const user = result.user;

  if (!user?.id) {
    return null;
  }

  return {
    id: user.id,
    role: user.role ?? 'agent',
    user_type: user.user_type ?? 'agent',
    tenant_id: user.tenant_id ?? null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    const session = normalizeSession(authResult);
    if (!session) {
      return NextResponse.json(
        { data: [], message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const customerId = searchParams.get('customer_id');
    const type = searchParams.get('type');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const transactionType = searchParams.get('transaction_type');
    const searchQuery = searchParams.get('search');

    const hasFilters =
      customerId ||
      startDate ||
      endDate ||
      transactionType ||
      searchQuery;

    if (!hasFilters) {
      return NextResponse.json({
        data: [],
        message: 'กรุณาเลือกตัวกรองและกดค้นหาข้อมูล',
        requiresFilter: true,
      });
    }

    if (customerId) {
      const accessCheck = await requireCustomerAccess(customerId, session);

      if (!accessCheck.allowed) {
        return NextResponse.json({
          data: [],
          message: 'ไม่มีสิทธิ์เข้าถึงข้อมูล',
        });
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
      const scope = await getCustomerScopeForUser(session);

      if (scope.isAgent && scope.agentIds.length > 0) {
        const { data: scopedCustomers } = await supabase
          .from('customers')
          .select('id')
          .in('agent_id', scope.agentIds);

        const customerIds = (scopedCustomers || []).map((customer) => customer.id);

        if (customerIds.length > 0) {
          query = query.in('customer_id', customerIds);
        } else {
          return NextResponse.json({
            data: [],
            message: 'ไม่พบข้อมูล',
          });
        }
      } else if (scope.isTenantOwner && scope.tenantId) {
        const { data: tenantCustomers } = await supabase
          .from('customers')
          .select('id')
          .eq('tenant_id', scope.tenantId);

        const customerIds = (tenantCustomers || []).map((customer) => customer.id);

        if (customerIds.length > 0) {
          query = query.in('customer_id', customerIds);
        } else {
          return NextResponse.json({
            data: [],
            message: 'ไม่พบข้อมูล',
          });
        }
      }
    }

    if (type) {
      query = query.eq('type', type);
    }

    if (transactionType && transactionType !== 'all') {
      if (transactionType === 'bet') {
        query = query.in('type', ['bet', 'bet_win', 'bet_lose', 'bet_refund']);
      } else if (transactionType === 'deposit') {
        query = query.in('type', ['deposit', 'admin_add', 'bonus', 'topup']);
      } else if (transactionType === 'withdraw') {
        query = query.in('type', ['withdraw', 'admin_subtract', 'deduction']);
      } else {
        query = query.eq('type', transactionType);
      }
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Credit transactions fetch error:', error);
      return NextResponse.json({
        data: [],
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
      });
    }

    return NextResponse.json({
      data: data || [],
      total: data?.length || 0,
    });
  } catch (error) {
    console.error('Credit transactions GET error:', error);
    return NextResponse.json({
      data: [],
      message: 'เกิดข้อผิดพลาด',
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;

    const session = normalizeSession(authResult);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const body = await request.json();

    const {
      customer_id,
      type,
      amount,
      note,
      reason,
      created_by,
      audit_metadata,
    } = body;

    if (!customer_id || !type || amount === undefined) {
      return NextResponse.json(
        { error: 'ข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    if (
      (type === 'admin_add' || type === 'admin_subtract') &&
      !reason
    ) {
      return NextResponse.json(
        { error: 'กรุณาระบุเหตุผลในการปรับยอด' },
        { status: 400 }
      );
    }

    const accessCheck = await requireCustomerAccess(customer_id, session);

    if (!accessCheck.allowed) {
      return NextResponse.json(
        { error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลลูกค้า' },
        { status: 403 }
      );
    }

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

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount)) {
      return NextResponse.json(
        { error: 'จำนวนเงินไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const currentBalance = Number(customer.credit_balance || 0);
    const newBalance = currentBalance + numericAmount;

    if (newBalance < 0) {
      return NextResponse.json(
        { error: 'ยอดเครดิตไม่เพียงพอ' },
        { status: 400 }
      );
    }

    const auditNote = reason
      ? `[${reason}] ${note || ''}`.trim()
      : note;

    const creatorId =
      typeof created_by === 'string' && created_by.length > 0
        ? created_by
        : session.id;

    const { data: transaction, error: txError } = await supabase
      .from('credit_transactions')
      .insert({
        customer_id,
        type,
        amount: numericAmount,
        balance_before: currentBalance,
        balance_after: newBalance,
        note: auditNote,
        created_by: creatorId,
      })
      .select()
      .single();

    if (txError) {
      console.error('Credit transaction insert error:', txError);
      return NextResponse.json(
        { error: 'ไม่สามารถบันทึกรายการได้' },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabase
      .from('customers')
      .update({ credit_balance: newBalance })
      .eq('id', customer_id);

    if (updateError) {
      console.error('Customer balance update error:', updateError);
    }

    try {
      await supabase.from('audit_logs').insert({
        user_id: session.id,
        action:
          type === 'admin_add'
            ? 'credit_add'
            : 'credit_subtract',
        resource_type: 'customer',
        resource_id: customer_id,
        metadata: {
          amount: numericAmount,
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