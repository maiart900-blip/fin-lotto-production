import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

// GET - Get settlement data for all tenants
export async function GET(request: Request) {
  try {
    // Auth guard - require admin for settlement
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || new Date().toISOString().slice(0, 7);
    
    const supabase = await createClient();
    
    // Get all sub-tenants (not master)
    const { data: tenants, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, slug, is_active')
      .eq('is_master', false);

    if (tenantError) throw tenantError;

    // Get settlement data for each tenant
    const settlements = await Promise.all(
      (tenants || []).map(async (tenant) => {
        // Get tenant stats for the period
        const startDate = `${period}-01`;
        const endDate = `${period}-31`;
        
        const { data: stats } = await supabase
          .from('tenant_stats')
          .select('total_bets, total_payouts, total_deposits, total_withdrawals, profit_loss')
          .eq('tenant_id', tenant.id)
          .gte('stat_date', startDate)
          .lte('stat_date', endDate);

        // Sum up all stats for the period
        const totals = (stats || []).reduce((acc, s) => ({
          totalBets: acc.totalBets + (s.total_bets || 0),
          totalPayouts: acc.totalPayouts + (s.total_payouts || 0),
          totalDeposits: acc.totalDeposits + (s.total_deposits || 0),
          totalWithdrawals: acc.totalWithdrawals + (s.total_withdrawals || 0),
          profitLoss: acc.profitLoss + (s.profit_loss || 0),
        }), { totalBets: 0, totalPayouts: 0, totalDeposits: 0, totalWithdrawals: 0, profitLoss: 0 });

        // Get payment settings for fee calculation
        const { data: paymentSettings } = await supabase
          .from('tenant_payment_settings')
          .select('deposit_fee_percent, withdraw_fee_percent')
          .eq('tenant_id', tenant.id)
          .single();

        const depositFeePercent = paymentSettings?.deposit_fee_percent || 1.5;
        const withdrawFeePercent = paymentSettings?.withdraw_fee_percent || 1.0;

        // Calculate fees
        const depositFee = totals.totalDeposits * (depositFeePercent / 100);
        const withdrawFee = totals.totalWithdrawals * (withdrawFeePercent / 100);
        const platformFee = depositFee + withdrawFee;

        // Get settlement status
        const { data: settlement } = await supabase
          .from('tenant_settlements')
          .select('status, settled_at, settled_by')
          .eq('tenant_id', tenant.id)
          .eq('period', period)
          .single();

        return {
          tenantId: tenant.id,
          tenantName: tenant.name,
          tenantSlug: tenant.slug,
          isActive: tenant.is_active,
          period,
          totalBets: totals.totalBets,
          totalPayouts: totals.totalPayouts,
          totalDeposits: totals.totalDeposits,
          totalWithdrawals: totals.totalWithdrawals,
          grossProfit: totals.profitLoss,
          depositFeePercent,
          withdrawFeePercent,
          depositFee,
          withdrawFee,
          platformFee,
          netAmount: totals.profitLoss - platformFee,
          status: settlement?.status || 'pending',
          settledAt: settlement?.settled_at,
          settledBy: settlement?.settled_by,
        };
      })
    );

    // Calculate totals
    const summary = settlements.reduce((acc, s) => ({
      totalBets: acc.totalBets + s.totalBets,
      totalPayouts: acc.totalPayouts + s.totalPayouts,
      totalDeposits: acc.totalDeposits + s.totalDeposits,
      totalWithdrawals: acc.totalWithdrawals + s.totalWithdrawals,
      totalPlatformFee: acc.totalPlatformFee + s.platformFee,
      totalGrossProfit: acc.totalGrossProfit + s.grossProfit,
      pendingCount: acc.pendingCount + (s.status !== 'settled' ? 1 : 0),
    }), { 
      totalBets: 0, totalPayouts: 0, totalDeposits: 0, totalWithdrawals: 0,
      totalPlatformFee: 0, totalGrossProfit: 0, pendingCount: 0 
    });

    return NextResponse.json({ settlements, summary, period });
  } catch (err) {
    console.error('Get settlement error:', err);
    return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูลได้' }, { status: 500 });
  }
}

// POST - Settle a tenant
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tenantId, period, amount, settledBy } = body;

    if (!tenantId || !period) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('tenant_settlements')
      .upsert({
        tenant_id: tenantId,
        period,
        amount,
        status: 'settled',
        settled_at: new Date().toISOString(),
        settled_by: settledBy || 'Admin',
      }, { onConflict: 'tenant_id,period' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error('Settle error:', err);
    return NextResponse.json({ error: 'ไม่สามารถเคลียร์ยอดได้' }, { status: 500 });
  }
}
