import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

// PATCH /api/bank-accounts/[id] - Update bank account
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth guard
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const { account_name, account_number, account_type, is_active } = body;

    // Update bank account
    const { data, error } = await supabase
      .from('bank_accounts')
      .update({
        account_name,
        account_number,
        account_type,
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Bank account update error:', error);
      return NextResponse.json(
        { error: 'ไม่สามารถแก้ไขบัญชีได้' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      account: data,
    });
  } catch (error) {
    console.error('Bank account PATCH error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}

// DELETE /api/bank-accounts/[id] - Delete bank account
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth guard
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
    const supabase = await createClient();

    // Check if account exists and get details for audit
    const { data: account } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (!account) {
      return NextResponse.json(
        { error: 'ไม่พบบัญชีธนาคาร' },
        { status: 404 }
      );
    }

    // Delete bank account
    const { error } = await supabase
      .from('bank_accounts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Bank account delete error:', error);
      return NextResponse.json(
        { error: 'ไม่สามารถลบบัญชีได้' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'ลบบัญชีสำเร็จ',
      deleted_account: {
        id: account.id,
        bank_name: account.bank_name,
        account_number: account.account_number,
      },
    });
  } catch (error) {
    console.error('Bank account DELETE error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
