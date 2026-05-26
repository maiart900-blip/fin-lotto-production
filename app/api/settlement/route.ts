import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { MasterSettlementCenter } from '@/lib/revenue/master-settlement-center';
import { RevenueShareEngine } from '@/lib/revenue/revenue-share-engine';

// GET - Get settlement data for all tenants
export async function GET(request: NextRequest) {
  try {
    // Auth guard - require admin for settlement
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'legacy';
    const period = searchParams.get('period') || new Date().toISOString().slice(0, 7);
    
    const supabase = await createClient();
    
    // New Enterprise Actions
    if (action !== 'legacy') {
      const cycleId = searchParams.get('cycleId');
      const status = searchParams.get('status') || undefined;
      const cycleType = searchParams.get('cycleType') || undefined;
      const startDate = searchParams.get('startDate') || undefined;
      const endDate = searchParams.get('endDate') || undefined;
      const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;
      
      switch (action) {
        case 'cycles': {
          const cycles = await MasterSettlementCenter.getCycles({
            status,
            cycleType,
            startDate,
            endDate,
            limit
          });
          return NextResponse.json({ cycles });
        }
        
        case 'cycle': {
          if (!cycleId) {
            return NextResponse.json({ error: 'cycleId required' }, { status: 400 });
          }
          const cycle = await MasterSettlementCenter.getCycle(cycleId);
          if (!cycle) {
            return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
          }
          return NextResponse.json({ cycle });
        }
        
        case 'transactions': {
          if (!cycleId) {
            return NextResponse.json({ error: 'cycleId required' }, { status: 400 });
          }
          const transactions = await MasterSettlementCenter.getCycleTransactions(cycleId);
          return NextResponse.json({ transactions });
        }
        
        case 'owner-reports': {
          const reportType = searchParams.get('reportType') || 'daily';
          const reports = await MasterSettlementCenter.getOwnerProfitReports({
            reportType,
            startDate,
            endDate,
            limit
          });
          return NextResponse.json({ reports });
        }
        
        case 'tenant-reports': {
          const tenantId = searchParams.get('tenantId');
          let query = supabase
            .from('tenant_revenue_reports')
            .select('*, tenants(name)')
            .order('report_date', { ascending: false })
            .limit(limit);
          
          if (tenantId) {
            query = query.eq('tenant_id', tenantId);
          }
          if (startDate) {
            query = query.gte('report_date', startDate);
          }
          if (endDate) {
            query = query.lte('report_date', endDate);
          }
          
          const { data: reports, error } = await query;
          if (error) throw error;
          return NextResponse.json({ reports });
        }
        
        case 'revenue-configs': {
          const configs = await RevenueShareEngine.getAllConfigs({
            isActive: true
          });
          return NextResponse.json({ configs });
        }
        
        case 'live-revenue': {
          const tenantId = searchParams.get('tenantId');
          const date = searchParams.get('date');
          if (!tenantId) {
            return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
          }
          const liveData = await RevenueShareEngine.getLiveRevenue(tenantId, date || undefined);
          return NextResponse.json(liveData);
        }
        
        case 'pending-adjustments': {
          const { data: adjustments } = await supabase
            .from('revenue_adjustments')
            .select('*, tenants(name)')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
          
          return NextResponse.json({ adjustments });
        }
      }
    }
    
    // Legacy settlement logic (preserved for backward compatibility)
    const { data: tenants, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, slug, is_active')
      .eq('is_master', false);

    if (tenantError) throw tenantError;

    const settlements = await Promise.all(
      (tenants || []).map(async (tenant) => {
        const startDate = `${period}-01`;
        const endDate = `${period}-31`;
        
        const { data: stats } = await supabase
          .from('tenant_stats')
          .select('total_bets, total_payouts, total_deposits, total_withdrawals, profit_loss')
          .eq('tenant_id', tenant.id)
          .gte('stat_date', startDate)
          .lte('stat_date', endDate);

        const totals = (stats || []).reduce((acc, s) => ({
          totalBets: acc.totalBets + (s.total_bets || 0),
          totalPayouts: acc.totalPayouts + (s.total_payouts || 0),
          totalDeposits: acc.totalDeposits + (s.total_deposits || 0),
          totalWithdrawals: acc.totalWithdrawals + (s.total_withdrawals || 0),
          profitLoss: acc.profitLoss + (s.profit_loss || 0),
        }), { totalBets: 0, totalPayouts: 0, totalDeposits: 0, totalWithdrawals: 0, profitLoss: 0 });

        const { data: paymentSettings } = await supabase
          .from('tenant_payment_settings')
          .select('deposit_fee_percent, withdraw_fee_percent')
          .eq('tenant_id', tenant.id)
          .single();

        const depositFeePercent = paymentSettings?.deposit_fee_percent || 1.5;
        const withdrawFeePercent = paymentSettings?.withdraw_fee_percent || 1.0;

        const depositFee = totals.totalDeposits * (depositFeePercent / 100);
        const withdrawFee = totals.totalWithdrawals * (withdrawFeePercent / 100);
        const platformFee = depositFee + withdrawFee;

        // Use new revenue share engine for calculation
        const revenueCalc = await RevenueShareEngine.calculateRevenue(
          tenant.id, 
          totals.profitLoss, 
          'lottery'
        );

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
          // New revenue share fields
          tenantSharePercent: revenueCalc.config_used.tenant_share_percent,
          platformSharePercent: revenueCalc.config_used.platform_share_percent,
          tenantShare: revenueCalc.tenant_share,
          platformShare: revenueCalc.platform_share,
          netAmount: revenueCalc.tenant_share - platformFee,
          status: settlement?.status || 'pending',
          settledAt: settlement?.settled_at,
          settledBy: settlement?.settled_by,
        };
      })
    );

    const summary = settlements.reduce((acc, s) => ({
      totalBets: acc.totalBets + s.totalBets,
      totalPayouts: acc.totalPayouts + s.totalPayouts,
      totalDeposits: acc.totalDeposits + s.totalDeposits,
      totalWithdrawals: acc.totalWithdrawals + s.totalWithdrawals,
      totalPlatformFee: acc.totalPlatformFee + s.platformFee,
      totalGrossProfit: acc.totalGrossProfit + s.grossProfit,
      totalPlatformShare: acc.totalPlatformShare + s.platformShare,
      totalTenantShare: acc.totalTenantShare + s.tenantShare,
      pendingCount: acc.pendingCount + (s.status !== 'settled' ? 1 : 0),
    }), { 
      totalBets: 0, totalPayouts: 0, totalDeposits: 0, totalWithdrawals: 0,
      totalPlatformFee: 0, totalGrossProfit: 0, totalPlatformShare: 0, 
      totalTenantShare: 0, pendingCount: 0 
    });

    return NextResponse.json({ settlements, summary, period });
  } catch (err) {
    console.error('Get settlement error:', err);
    return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูลได้' }, { status: 500 });
  }
}

// POST - Settlement actions
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    const body = await request.json();
    const { action } = body;

    // New Enterprise Actions
    switch (action) {
      case 'process-daily': {
        const date = body.date ? new Date(body.date) : new Date();
        const cycle = await MasterSettlementCenter.processDailySettlement(date);
        return NextResponse.json({ 
          success: true, 
          cycle,
          message: `Settlement cycle ${cycle.cycle_number} completed`
        });
      }
      
      case 'approve-cycle': {
        const { cycleId } = body;
        if (!cycleId) {
          return NextResponse.json({ error: 'cycleId required' }, { status: 400 });
        }
        const cycle = await MasterSettlementCenter.approveCycle(cycleId, user?.id || 'system');
        return NextResponse.json({ 
          success: true, 
          cycle,
          message: 'Settlement cycle approved'
        });
      }
      
      case 'create-adjustment': {
        const { tenantId, providerId, cycleId, adjustmentType, amount, isCredit, reason } = body;
        
        if (!adjustmentType || amount === undefined || !reason) {
          return NextResponse.json({ 
            error: 'adjustmentType, amount, and reason are required' 
          }, { status: 400 });
        }
        
        const adjustment = await MasterSettlementCenter.createAdjustment({
          tenantId,
          providerId,
          cycleId,
          adjustmentType,
          amount,
          isCredit: isCredit ?? true,
          reason,
          createdBy: user?.id
        });
        
        return NextResponse.json({ 
          success: true, 
          adjustmentId: adjustment.id,
          message: 'Adjustment created'
        });
      }
      
      case 'approve-adjustment': {
        const { adjustmentId } = body;
        if (!adjustmentId) {
          return NextResponse.json({ error: 'adjustmentId required' }, { status: 400 });
        }
        await MasterSettlementCenter.approveAdjustment(adjustmentId, user?.id || 'system');
        return NextResponse.json({ 
          success: true, 
          message: 'Adjustment approved'
        });
      }
      
      case 'generate-tenant-report': {
        const { tenantId, date, reportType } = body;
        if (!tenantId) {
          return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
        }
        const report = await MasterSettlementCenter.generateTenantRevenueReport(
          tenantId,
          date ? new Date(date) : new Date(),
          reportType || 'daily'
        );
        return NextResponse.json({ success: true, report });
      }
      
      case 'set-revenue-share': {
        const { tenantId, gameType, tenantSharePercent, platformSharePercent, providerSharePercent } = body;
        if (!tenantId || tenantSharePercent === undefined || platformSharePercent === undefined) {
          return NextResponse.json({ 
            error: 'tenantId, tenantSharePercent, and platformSharePercent are required' 
          }, { status: 400 });
        }
        
        const config = await RevenueShareEngine.setTenantRevenueShare(
          tenantId,
          gameType || 'all',
          tenantSharePercent,
          platformSharePercent,
          providerSharePercent || 0
        );
        return NextResponse.json({ success: true, config });
      }
      
      case 'update-live-revenue': {
        const { tenantId, turnover, wins, profit, bets } = body;
        if (!tenantId) {
          return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
        }
        await RevenueShareEngine.updateLiveTracking(
          tenantId,
          turnover || 0,
          wins || 0,
          profit || 0,
          bets || 1
        );
        return NextResponse.json({ success: true, message: 'Live revenue updated' });
      }
    }

    // Legacy settle action
    const { tenantId, period, amount, settledBy } = body;

    if (!tenantId || !period) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('tenant_settlements')
      .upsert({
        tenant_id: tenantId,
        period,
        amount,
        status: 'settled',
        settled_at: new Date().toISOString(),
        settled_by: settledBy || user?.id || 'Admin',
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
