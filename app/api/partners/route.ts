import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get all partners
    const { data: partners, error } = await supabase
      .from('partners')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[v0] Partners GET error:', error.message);
      return NextResponse.json({ partners: [], summary: {} });
    }

    // Get total bets for calculating shares
    const { data: entriesData } = await supabase
      .from('entries')
      .select('total_amount');
    
    const totalBets = entriesData?.reduce((sum, e) => sum + (e.total_amount || 0), 0) || 0;
    
    // Calculate share amount for each partner
    const partnersWithStats = partners?.map(partner => ({
      ...partner,
      share_amount: totalBets * ((partner.share_percent || 0) / 100),
    })) || [];

    return NextResponse.json({
      partners: partnersWithStats,
      summary: {
        totalPartners: partners?.length || 0,
        activePartners: partners?.filter(p => p.is_active).length || 0,
        totalSharePercent: partners?.reduce((sum, p) => sum + (p.share_percent || 0), 0) || 0,
        totalBets,
        totalShareAmount: totalBets * ((partners?.reduce((sum, p) => sum + (p.share_percent || 0), 0) || 0) / 100),
      }
    });
  } catch (err) {
    console.error('[v0] Partners GET exception:', err);
    return NextResponse.json({ partners: [], summary: {} });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    if (!body.name) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อหุ้นส่วน' }, { status: 400 });
    }
    
    const { data, error } = await supabase
      .from('partners')
      .insert({
        name: body.name,
        phone: body.phone || null,
        share_percent: body.share_percent || body.sharePercent || 0,
        is_active: body.is_active ?? body.isActive ?? true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[v0] Partners POST exception:', err);
    return NextResponse.json({ error: 'Failed to create partner' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    if (!body.id) {
      return NextResponse.json({ error: 'Missing partner ID' }, { status: 400 });
    }
    
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updateData.name = body.name;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.share_percent !== undefined) updateData.share_percent = body.share_percent;
    if (body.sharePercent !== undefined) updateData.share_percent = body.sharePercent;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;
    
    const { data, error } = await supabase
      .from('partners')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('[v0] Partners PUT exception:', err);
    return NextResponse.json({ error: 'Failed to update partner' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Missing partner ID' }, { status: 400 });
    }
    
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('partners')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[v0] Partners DELETE exception:', err);
    return NextResponse.json({ error: 'Failed to delete partner' }, { status: 500 });
  }
}
