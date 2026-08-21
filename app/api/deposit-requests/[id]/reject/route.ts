import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();
    const { rejected_by, reject_reason } = body;

    // Get the deposit request
    const { data: depositRequest, error: fetchError } = await supabase
      .from('deposit_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !depositRequest) {
      return NextResponse.json({ error: 'Deposit request not found' }, { status: 404 });
    }

    if (depositRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Deposit request already processed' }, { status: 400 });
    }

    // Update deposit request status to rejected
    const { data: updatedRequest, error: updateError } = await supabase
      .from('deposit_requests')
      .update({
        status: 'rejected',
        rejected_by,
        rejected_at: new Date().toISOString(),
        reject_reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[v0] Update deposit request error:', updateError);
      return NextResponse.json({ error: 'Failed to update deposit request' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: updatedRequest,
    });
  } catch (error) {
    console.error('[v0] Error rejecting deposit:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
