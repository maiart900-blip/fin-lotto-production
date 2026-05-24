import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// API สำหรับส่งรายงานจากสาขาลูกเข้าระบบแม่แบบ Realtime
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    const { 
      branch_id, 
      report_type, 
      data,
      period_from,
      period_to 
    } = body;

    if (!branch_id || !report_type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get branch info and parent
    const { data: branch } = await supabase
      .from('branches')
      .select('id, code, name, parent_branch_id, is_master')
      .eq('id', branch_id)
      .single();

    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }

    // If this is a child branch, send report to parent
    if (branch.parent_branch_id) {
      // Create sync log
      const { error: syncError } = await supabase
        .from('branch_sync_logs')
        .insert({
          source_branch_id: branch_id,
          target_branch_id: branch.parent_branch_id,
          event_type: `report_${report_type}`,
          data: {
            report_type,
            period_from,
            period_to,
            report_data: data,
            synced_from: branch.name,
          },
        });

      if (syncError) throw syncError;

      // Create realtime event for parent to receive
      const { error: eventError } = await supabase
        .from('branch_realtime_events')
        .insert({
          branch_id: branch.parent_branch_id,
          event_type: 'report_received',
          event_category: 'sync',
          title: `รายงานจาก ${branch.name}`,
          data: {
            source_branch_id: branch_id,
            source_branch_name: branch.name,
            report_type,
            period_from,
            period_to,
            summary: data.summary || {},
          },
          broadcast_to_parent: false,
          broadcast_to_children: false,
        });

      if (eventError) throw eventError;
    }

    // Save report locally
    const { error: reportError } = await supabase
      .from('branch_reports')
      .upsert({
        branch_id,
        report_type,
        period_from,
        period_to,
        data,
        synced_to_parent: !!branch.parent_branch_id,
        synced_at: branch.parent_branch_id ? new Date().toISOString() : null,
      }, {
        onConflict: 'branch_id,report_type,period_from,period_to',
      });

    // Ignore error if table doesn't exist yet
    if (reportError && !reportError.message.includes('does not exist')) {
      console.error('Report save error:', reportError);
    }

    return NextResponse.json({
      success: true,
      synced_to_parent: !!branch.parent_branch_id,
      parent_branch_id: branch.parent_branch_id,
    });

  } catch (error) {
    console.error('Sync report error:', error);
    return NextResponse.json(
      { error: 'Failed to sync report' },
      { status: 500 }
    );
  }
}

// API สำหรับดึงรายงานจากสาขาลูกทั้งหมด (สำหรับระบบแม่)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const master_branch_id = searchParams.get('master_branch_id');
    const report_type = searchParams.get('report_type') || 'profit_loss';
    const period = searchParams.get('period') || 'today';

    if (!master_branch_id) {
      return NextResponse.json(
        { error: 'Missing master_branch_id' },
        { status: 400 }
      );
    }

    // Calculate date range
    let dateFrom: string;
    const dateTo: string = new Date().toISOString().split('T')[0];
    
    switch (period) {
      case 'today':
        dateFrom = dateTo;
        break;
      case '7days':
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateFrom = weekAgo.toISOString().split('T')[0];
        break;
      case '30days':
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        dateFrom = monthAgo.toISOString().split('T')[0];
        break;
      default:
        dateFrom = dateTo;
    }

    // Get all child branches
    const { data: childBranches } = await supabase
      .from('branches')
      .select('id, code, name, branch_type')
      .eq('parent_branch_id', master_branch_id);

    // Get sync logs from children
    const { data: syncLogs } = await supabase
      .from('branch_sync_logs')
      .select('*')
      .eq('target_branch_id', master_branch_id)
      .eq('event_type', `report_${report_type}`)
      .gte('synced_at', `${dateFrom}T00:00:00`)
      .lte('synced_at', `${dateTo}T23:59:59`)
      .order('synced_at', { ascending: false });

    // Group by source branch
    const branchReports: Record<string, any> = {};
    
    for (const branch of (childBranches || [])) {
      const branchLogs = (syncLogs || []).filter(
        (log: any) => log.source_branch_id === branch.id
      );
      
      // Get latest report
      const latestReport = branchLogs[0];
      
      branchReports[branch.id] = {
        branch_id: branch.id,
        branch_code: branch.code,
        branch_name: branch.name,
        branch_type: branch.branch_type,
        latest_sync: latestReport?.synced_at || null,
        report_data: latestReport?.data?.report_data || null,
        sync_count: branchLogs.length,
      };
    }

    // Get connection status for each child
    const { data: connectionStatus } = await supabase
      .from('branch_connection_status')
      .select('*')
      .in('branch_id', (childBranches || []).map((b: any) => b.id));

    // Merge connection status
    for (const status of (connectionStatus || [])) {
      if (branchReports[status.branch_id]) {
        branchReports[status.branch_id].is_online = status.is_online;
        branchReports[status.branch_id].last_seen = status.last_seen_at;
        branchReports[status.branch_id].connection_quality = status.connection_quality;
      }
    }

    // Calculate totals from all branches
    const allReports = Object.values(branchReports);
    const totalSummary = {
      total_branches: allReports.length,
      online_branches: allReports.filter((r: any) => r.is_online).length,
      synced_branches: allReports.filter((r: any) => r.latest_sync).length,
      total_sales: allReports.reduce((sum: number, r: any) => 
        sum + (r.report_data?.summary?.total_sales || 0), 0),
      total_payout: allReports.reduce((sum: number, r: any) => 
        sum + (r.report_data?.summary?.total_payout || 0), 0),
      total_profit: allReports.reduce((sum: number, r: any) => 
        sum + (r.report_data?.summary?.total_profit || 0), 0),
    };

    return NextResponse.json({
      branches: allReports,
      summary: totalSummary,
      period: { from: dateFrom, to: dateTo },
    });

  } catch (error) {
    console.error('Get branch reports error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch branch reports' },
      { status: 500 }
    );
  }
}
