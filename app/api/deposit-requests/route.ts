import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const customerId = searchParams.get('customer_id');

    let query = supabase
      .from('deposit_requests')
      .select(`
        *,
        customer:customers(id, name, phone, credit_balance),
        approved_by_user:users!deposit_requests_approved_by_fkey(id, username, display_name)
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
      console.error('[v0] Deposit requests fetch error:', error);
      return NextResponse.json({ 
        requests: [], 
        summary: {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          totalAmount: 0,
          pendingAmount: 0,
        }
      });
    }

    // Get summary counts
    const { data: allRequests } = await supabase
      .from('deposit_requests')
      .select('status, amount');

    const summary = {
      total: allRequests?.length || 0,
      pending: allRequests?.filter(r => r.status === 'pending').length || 0,
      approved: allRequests?.filter(r => r.status === 'approved').length || 0,
      rejected: allRequests?.filter(r => r.status === 'rejected').length || 0,
      totalAmount: allRequests?.reduce((sum, r) => sum + Number(r.amount), 0) || 0,
      pendingAmount: allRequests?.filter(r => r.status === 'pending').reduce((sum, r) => sum + Number(r.amount), 0) || 0,
    };

    return NextResponse.json({ requests: data || [], summary });
  } catch (error) {
    console.error('[v0] Error fetching deposit requests:', error);
    return NextResponse.json({ 
      requests: [], 
      summary: {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        totalAmount: 0,
        pendingAmount: 0,
      }
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { customer_id, amount, slip_url, bank_name, transfer_time, admin_note } = body;

    // Validate required fields
    if (!customer_id || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create deposit request
    const { data, error } = await supabase
      .from('deposit_requests')
      .insert({
        customer_id,
        amount: Number(amount),
        slip_url,
        bank_name,
        transfer_time,
        admin_note,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[v0] Create deposit request error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[v0] Error creating deposit request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
