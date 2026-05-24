import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Fetch agent bank accounts for manual key system
export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('agent_bank_accounts')
      .select('*')
      .eq('system_type', 'manual_key')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch agent bank accounts error:', error);
      return NextResponse.json({ accounts: [] });
    }

    return NextResponse.json({ accounts: data || [] });
  } catch (err) {
    console.error('Agent bank accounts error:', err);
    return NextResponse.json({ accounts: [] });
  }
}

// POST - Create new agent bank account
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('agent_bank_accounts')
      .insert({
        bank_code: body.bank_code,
        bank_name: body.bank_name,
        account_number: body.account_number,
        account_name: body.account_name,
        for_deposit: body.for_deposit ?? true,
        for_withdraw: body.for_withdraw ?? true,
        is_active: true,
        system_type: 'manual_key',
      })
      .select()
      .single();

    if (error) {
      console.error('Create agent bank account error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ account: data });
  } catch (err) {
    console.error('Create agent bank account error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update agent bank account
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('agent_bank_accounts')
      .update({
        bank_code: body.bank_code,
        bank_name: body.bank_name,
        account_number: body.account_number,
        account_name: body.account_name,
        for_deposit: body.for_deposit,
        for_withdraw: body.for_withdraw,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      console.error('Update agent bank account error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ account: data });
  } catch (err) {
    console.error('Update agent bank account error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Toggle active status
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { error } = await supabase
      .from('agent_bank_accounts')
      .update({ 
        is_active: body.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id);

    if (error) {
      console.error('Toggle agent bank account error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Toggle agent bank account error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove agent bank account
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { error } = await supabase
      .from('agent_bank_accounts')
      .delete()
      .eq('id', body.id);

    if (error) {
      console.error('Delete agent bank account error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete agent bank account error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
