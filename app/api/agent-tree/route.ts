import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const level = searchParams.get('level') || 'all';
    
    const supabase = await createClient();

    // Get all users with hierarchy info
    let query = supabase
      .from('users')
      .select(`
        id,
        username,
        display_name,
        role,
        referral_code,
        referred_by,
        parent_agent_id,
        hierarchy_level,
        commission_percent,
        share_percent,
        credit_balance,
        is_partner,
        created_at
      `)
      .order('hierarchy_level', { ascending: true })
      .order('created_at', { ascending: true });

    // Filter by agent if specified
    if (agentId) {
      query = query.or(`referred_by.eq.${agentId},parent_agent_id.eq.${agentId}`);
    }

    const { data: users, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build hierarchy tree
    const buildTree = (users: any[], parentId: string | null = null, currentLevel: number = 0): any[] => {
      return users
        .filter(user => user.referred_by === parentId || user.parent_agent_id === parentId)
        .map(user => ({
          ...user,
          level: currentLevel,
          children: buildTree(users, user.id, currentLevel + 1),
          totalDownline: 0, // Will be calculated
          totalCommission: 0, // Will be calculated
        }));
    };

    // Get root users (super_admin or no parent)
    const rootUsers = users?.filter(u => 
      u.role === 'super_admin' || 
      (!u.referred_by && !u.parent_agent_id)
    ) || [];

    // Calculate statistics
    const stats = {
      totalAgents: users?.filter(u => ['super_admin', 'admin', 'agent', 'partner'].includes(u.role)).length || 0,
      totalMembers: users?.filter(u => u.role === 'member').length || 0,
      totalUsers: users?.length || 0,
      activePartners: users?.filter(u => u.is_partner).length || 0,
    };

    // Build tree from each root
    const tree = rootUsers.map(root => ({
      ...root,
      level: 0,
      children: buildTree(users || [], root.id, 1),
    }));

    return NextResponse.json({
      success: true,
      tree,
      stats,
      flatList: users,
    });
  } catch (error) {
    console.error('Agent tree error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสายงาน' },
      { status: 500 }
    );
  }
}

// Get downline of specific agent
export async function POST(request: Request) {
  try {
    const { agent_id, include_stats } = await request.json();
    
    if (!agent_id) {
      return NextResponse.json({ error: 'กรุณาระบุ agent_id' }, { status: 400 });
    }

    const supabase = await createClient();

    // Recursive CTE to get all downline
    const { data: downline, error } = await supabase.rpc('get_agent_downline', {
      agent_uuid: agent_id
    });

    if (error) {
      // Fallback: simple query if RPC not available
      const { data: simpleDownline, error: simpleError } = await supabase
        .from('users')
        .select('*')
        .or(`referred_by.eq.${agent_id},parent_agent_id.eq.${agent_id}`);

      if (simpleError) {
        return NextResponse.json({ error: simpleError.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        downline: simpleDownline,
        total: simpleDownline?.length || 0,
      });
    }

    // Get commission stats if requested
    let commissionStats = null;
    if (include_stats) {
      const { data: stats } = await supabase
        .from('commission_logs')
        .select('amount, commission_type, status')
        .eq('agent_id', agent_id);

      commissionStats = {
        totalEarned: stats?.reduce((sum, s) => sum + Number(s.amount), 0) || 0,
        pendingCommission: stats?.filter(s => s.status === 'pending').reduce((sum, s) => sum + Number(s.amount), 0) || 0,
        paidCommission: stats?.filter(s => s.status === 'paid').reduce((sum, s) => sum + Number(s.amount), 0) || 0,
      };
    }

    return NextResponse.json({
      success: true,
      downline,
      total: downline?.length || 0,
      commissionStats,
    });
  } catch (error) {
    console.error('Downline error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลลูกข่าย' },
      { status: 500 }
    );
  }
}
