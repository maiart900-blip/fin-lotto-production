import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const customerId = searchParams.get('customer_id');

    let query = supabase
      .from('deposit_issues')
      .select(`
        *,
        customer_phone,
        customer_first_name,
        customer_last_name,
        customer_bank_account,
        customer_bank_name,
        transfer_datetime,
        customer:customers(id, name, phone, credit_balance),
        resolved_by_user:users!deposit_issues_resolved_by_fkey(id, name)
      `)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Deposit issues fetch error:', error);

      return NextResponse.json({
        issues: [],
        summary: {
          total: 0,
          pending: 0,
          reviewing: 0,
          need_info: 0,
          approved: 0,
          rejected: 0,
        },
      });
    }

    // Get summary stats - with safe fallback
    const { data: stats } = await supabase
      .from('deposit_issues')
      .select('status');

    const summary = {
      total: stats?.length || 0,
      pending:
        stats?.filter((s) => s.status === 'pending').length || 0,
      reviewing:
        stats?.filter((s) => s.status === 'reviewing').length || 0,
      need_info:
        stats?.filter((s) => s.status === 'need_info').length || 0,
      approved:
        stats?.filter((s) => s.status === 'approved').length || 0,
      rejected:
        stats?.filter((s) => s.status === 'rejected').length || 0,
    };

    return NextResponse.json({
      issues: data || [],
      summary,
    });
  } catch (error) {
    console.error('Error fetching deposit issues:', error);

    return NextResponse.json({
      issues: [],
      summary: {
        total: 0,
        pending: 0,
        reviewing: 0,
        need_info: 0,
        approved: 0,
        rejected: 0,
      },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    // Find customer by phone if provided
    let customerId = body.customer_id;

    if (!customerId && body.customer_phone) {
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', body.customer_phone)
        .single();

      if (customer) {
        customerId = customer.id;
      }
    }

    const { data, error } = await supabase
      .from('deposit_issues')
      .insert({
        customer_id: customerId,
        topup_request_id: body.topup_request_id,
        amount: body.amount,
        slip_image_url: body.slip_image_url,
        slip_hash: body.slip_hash,
        issue_detail: body.issue_detail,
        status: 'pending',
        customer_phone: body.customer_phone,
        customer_first_name: body.customer_first_name,
        customer_last_name: body.customer_last_name,
        customer_bank_account: body.customer_bank_account,
        customer_bank_name: body.customer_bank_name,
        transfer_datetime: body.transfer_datetime,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log the creation.
    // Supabase query builders in this project do not support .catch().
    try {
      const { error: logError } = await supabase
        .from('deposit_issue_logs')
        .insert({
          issue_id: data.id,
          action: 'created',
          new_status: 'pending',
          note: 'ลูกค้าแจ้งปัญหาฝากเงินไม่เข้า',
        });

      if (logError) {
        console.error(
          'Deposit issue creation log error:',
          logError
        );
      }
    } catch (logError) {
      console.error(
        'Deposit issue creation log exception:',
        logError
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating deposit issue:', error);

    return NextResponse.json(
      { error: 'Failed to create deposit issue' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      id,
      status,
      admin_note,
      resolved_by,
      credit_amount,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing issue id' },
        { status: 400 }
      );
    }

    // Get current issue
    const { data: currentIssue, error: currentIssueError } =
      await supabase
        .from('deposit_issues')
        .select('status, customer_id, amount')
        .eq('id', id)
        .single();

    if (currentIssueError || !currentIssue) {
      return NextResponse.json(
        { error: 'Deposit issue not found' },
        { status: 404 }
      );
    }

    // Prevent duplicate approval/rejection
    if (currentIssue.status === 'approved') {
      return NextResponse.json(
        {
          error:
            'รายการนี้ได้รับการอนุมัติไปแล้ว ไม่สามารถดำเนินการซ้ำได้',
        },
        { status: 400 }
      );
    }

    if (currentIssue.status === 'rejected') {
      return NextResponse.json(
        {
          error:
            'รายการนี้ถูกปฏิเสธไปแล้ว ไม่สามารถดำเนินการซ้ำได้',
        },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      status,
      admin_note,
    };

    // If approved, add credit to customer
    if (status === 'approved') {
      updateData.resolved_by = resolved_by;
      updateData.resolved_at = new Date().toISOString();

      const amountToAdd = Number(
        credit_amount ?? currentIssue.amount ?? 0
      );

      if (
        !currentIssue.customer_id ||
        !Number.isFinite(amountToAdd) ||
        amountToAdd <= 0
      ) {
        return NextResponse.json(
          { error: 'Invalid customer or credit amount' },
          { status: 400 }
        );
      }

      // Get current balance
      const { data: customer, error: customerError } =
        await supabase
          .from('customers')
          .select('credit_balance')
          .eq('id', currentIssue.customer_id)
          .single();

      if (customerError || !customer) {
        return NextResponse.json(
          { error: 'Customer not found' },
          { status: 404 }
        );
      }

      const currentBalance =
        Number(customer.credit_balance) || 0;
      const newBalance =
        currentBalance + amountToAdd;

      // Update customer balance
      const { error: balanceError } = await supabase
        .from('customers')
        .update({ credit_balance: newBalance })
        .eq('id', currentIssue.customer_id);

      if (balanceError) {
        console.error(
          'Deposit issue balance update error:',
          balanceError
        );

        return NextResponse.json(
          { error: 'Failed to update customer credit' },
          { status: 500 }
        );
      }

      // Create credit transaction
      const { data: creditTx, error: creditTxError } =
        await supabase
          .from('credit_transactions')
          .insert({
            customer_id: currentIssue.customer_id,
            amount: amountToAdd,
            type: 'deposit',
            balance_before: currentBalance,
            balance_after: newBalance,
            note: `แก้ไขปัญหาฝากเงินไม่เข้า #${String(id).slice(0, 8)}`,
            created_by: resolved_by,
          })
          .select()
          .single();

      if (creditTxError) {
        console.error(
          'Deposit issue credit transaction error:',
          creditTxError
        );
      }

      if (creditTx) {
        updateData.credit_transaction_id = creditTx.id;
      }
    }

    if (status === 'rejected') {
      updateData.resolved_by = resolved_by;
      updateData.resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('deposit_issues')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log the action
    const { error: actionLogError } = await supabase
      .from('deposit_issue_logs')
      .insert({
        issue_id: id,
        action:
          status === 'approved'
            ? 'approved'
            : status === 'rejected'
              ? 'rejected'
              : 'updated',
        old_status: currentIssue.status,
        new_status: status,
        note: admin_note,
        performed_by: resolved_by,
      });

    if (actionLogError) {
      console.error(
        'Deposit issue action log error:',
        actionLogError
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating deposit issue:', error);

    return NextResponse.json(
      { error: 'Failed to update deposit issue' },
      { status: 500 }
    );
  }
}