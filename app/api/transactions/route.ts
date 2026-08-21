import { createClient } from '@/lib/supabase/server';
import {
  NextRequest,
  NextResponse,
} from 'next/server';
import { requireAgentOrHigher } from '@/lib/api-auth';
import {
  getDataScope,
  applyFullDataScope,
  assertNoGlobalFallback,
} from '@/lib/data-scope';
import { requireCustomerAccess } from '@/lib/customer-scope';

/**
 * Transactions API - AGENT OR HIGHER
 * Manages financial transactions
 * (deposits, withdrawals, bets, wins)
 *
 * SECURITY:
 * Data is scoped by tenant_id and agent_id
 */
export async function GET(
  request: NextRequest
) {
  try {
    // Auth guard
    const authResult =
      await requireAgentOrHigher();

    if (authResult instanceof NextResponse) {
      return authResult;
    }

    /*
     * IMPORTANT:
     * requireAgentOrHigher() คืนค่าเป็น
     * { user: AuthenticatedUser }
     */
    const session = authResult.user;

    // Get data scope
    const scope = await getDataScope({
      id: session.id,
      role: session.role,
      user_type: session.user_type,
      tenant_id: session.tenant_id,
    });

    // Block global fallback for agents
    assertNoGlobalFallback(scope);

    const supabase = await createClient();

    const { searchParams } =
      new URL(request.url);

    const limit = Math.min(
      Math.max(
        parseInt(
          searchParams.get('limit') ||
            '50',
          10
        ),
        1
      ),
      500
    );

    const offset = Math.max(
      parseInt(
        searchParams.get('offset') ||
          '0',
        10
      ),
      0
    );

    const type =
      searchParams.get('type');

    const customerId =
      searchParams.get('customer_id');

    // If specific customer, verify access
    if (customerId) {
      const accessCheck =
        await requireCustomerAccess(
          customerId,
          {
            id: session.id,
            role: session.role,
            user_type:
              session.user_type,
            tenant_id:
              session.tenant_id,
          }
        );

      if (!accessCheck.allowed) {
        return NextResponse.json({
          transactions: [],
          total: 0,
        });
      }
    }

    // Build query
    let query = supabase
      .from('transactions')
      .select(
        `
          *,
          customer:customers(
            id,
            name,
            phone,
            tenant_id,
            agent_id
          )
        `,
        {
          count: 'exact',
        }
      )
      .order('created_at', {
        ascending: false,
      })
      .range(
        offset,
        offset + limit - 1
      );

    // SECURITY: Apply data scope
    query = applyFullDataScope(
      query,
      scope,
      {
        tenantColumn: 'tenant_id',
        agentColumn: 'agent_id',
        excludeNullTenant: true,
        excludeNullAgent:
          scope.isAgent,
      }
    );

    // Apply filters
    if (type) {
      query = query.eq('type', type);
    }

    if (customerId) {
      query = query.eq(
        'customer_id',
        customerId
      );
    }

    const {
      data: transactions,
      error,
      count,
    } = await query;

    if (error) {
      console.error(
        'Transactions query error:',
        error
      );

      return NextResponse.json({
        transactions: [],
        total: 0,
        error: error.message,
      });
    }

    // Calculate summary - also scoped
    let summaryQuery = supabase
      .from('transactions')
      .select('type, amount');

    summaryQuery = applyFullDataScope(
      summaryQuery,
      scope,
      {
        tenantColumn: 'tenant_id',
        agentColumn: 'agent_id',
        excludeNullTenant: true,
        excludeNullAgent:
          scope.isAgent,
      }
    );

    // Apply same filters to summary
    if (type) {
      summaryQuery =
        summaryQuery.eq('type', type);
    }

    if (customerId) {
      summaryQuery =
        summaryQuery.eq(
          'customer_id',
          customerId
        );
    }

    const {
      data: summaryData,
      error: summaryError,
    } = await summaryQuery;

    if (summaryError) {
      console.error(
        'Transaction summary error:',
        summaryError
      );
    }

    const summary = {
      totalDeposits: 0,
      totalWithdraws: 0,
      totalBets: 0,
      totalWins: 0,
    };

    if (summaryData) {
      summaryData.forEach((t: any) => {
        const amount =
          Number(t.amount) || 0;

        switch (t.type) {
          case 'deposit':
            summary.totalDeposits +=
              amount;
            break;

          case 'withdraw':
            summary.totalWithdraws +=
              amount;
            break;

          case 'bet':
            summary.totalBets +=
              amount;
            break;

          case 'win':
            summary.totalWins +=
              amount;
            break;
        }
      });
    }

    return NextResponse.json({
      transactions:
        transactions || [],

      total:
        count ??
        transactions?.length ??
        0,

      summary,
    });
  } catch (error) {
    console.error(
      'Transactions API error:',
      error
    );

    return NextResponse.json(
      {
        transactions: [],
        total: 0,
        error:
          'Internal server error',
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    // Auth guard
    const authResult =
      await requireAgentOrHigher();

    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const session = authResult.user;

    const supabase =
      await createClient();

    const body =
      await request.json();

    const {
      customer_id,
      type,
      amount,
      description,
      reference_id,
      status = 'completed',
    } = body;

    if (
      !customer_id ||
      !type ||
      amount === undefined ||
      amount === null
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Missing required fields: customer_id, type, amount',
        },
        { status: 400 }
      );
    }

    const numericAmount =
      Number(amount);

    if (
      !Number.isFinite(numericAmount)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid transaction amount',
        },
        { status: 400 }
      );
    }

    /*
     * SECURITY:
     * ตรวจว่าผู้ใช้มีสิทธิ์เข้าถึง customer
     * ก่อนสร้าง transaction
     */
    const accessCheck =
      await requireCustomerAccess(
        customer_id,
        {
          id: session.id,
          role: session.role,
          user_type:
            session.user_type,
          tenant_id:
            session.tenant_id,
        }
      );

    if (!accessCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error:
            'ไม่มีสิทธิ์เข้าถึงลูกค้ารายนี้',
        },
        { status: 403 }
      );
    }

    /*
     * ดึงข้อมูล customer เพื่อให้ transaction
     * มี tenant / agent scope ถูกต้อง
     */
    const {
      data: customer,
      error: customerError,
    } = await supabase
      .from('customers')
      .select(
        'id, tenant_id, agent_id'
      )
      .eq('id', customer_id)
      .single();

    if (
      customerError ||
      !customer
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Customer not found',
        },
        { status: 404 }
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from('transactions')
      .insert({
        customer_id,

        tenant_id:
          customer.tenant_id ||
          session.tenant_id ||
          null,

        agent_id:
          customer.agent_id ||
          null,

        type,

        amount: numericAmount,

        description:
          description || null,

        reference_id:
          reference_id || null,

        status,

        created_at:
          new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error(
        'Error creating transaction:',
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction: data,
    });
  } catch (error) {
    console.error(
      'Transactions POST error:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          'Internal server error',
      },
      { status: 500 }
    );
  }
}