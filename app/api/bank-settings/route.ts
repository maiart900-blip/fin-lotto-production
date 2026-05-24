import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Fetch all bank settings
export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('bank_settings')
      .select('*')
      .order('bank_name_th', { ascending: true });

    if (error) {
      // If table doesn't exist, return empty array
      if (error.code === '42P01') {
        return NextResponse.json([]);
      }
      throw error;
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching bank settings:', error);
    return NextResponse.json([]);
  }
}

// POST - Create new bank setting
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('bank_settings')
      .insert({
        bank_code: body.bank_code,
        bank_name: body.bank_name,
        bank_name_th: body.bank_name_th,
        is_active: true,
        supports_deposit: body.supports_deposit ?? true,
        supports_withdraw: body.supports_withdraw ?? true,
        min_deposit: body.min_deposit ?? 100,
        max_deposit: body.max_deposit ?? 50000,
        min_withdraw: body.min_withdraw ?? 100,
        max_withdraw: body.max_withdraw ?? 50000,
        daily_deposit_limit: body.daily_deposit_limit ?? 500000,
        daily_withdraw_limit: body.daily_withdraw_limit ?? 500000,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating bank setting:', error);
    return NextResponse.json({ error: 'Failed to create bank setting' }, { status: 500 });
  }
}

// PUT - Update bank setting
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('bank_settings')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating bank setting:', error);
    return NextResponse.json({ error: 'Failed to update bank setting' }, { status: 500 });
  }
}

// DELETE - Delete bank setting
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('bank_settings')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting bank setting:', error);
    return NextResponse.json({ error: 'Failed to delete bank setting' }, { status: 500 });
  }
}
