import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get active incidents count
    const { count: activeIncidents } = await supabase
      .from('security_incidents')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'investigating', 'contained']);
    
    // Get failed logins in last 24h
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    
    const { count: failedLogins24h } = await supabase
      .from('login_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('is_successful', false)
      .gte('created_at', yesterday.toISOString());
    
    // Get active sessions count
    const { count: activeSessions } = await supabase
      .from('active_sessions')
      .select('*', { count: 'exact', head: true })
      .gt('expires_at', new Date().toISOString());
    
    // Get blacklisted IPs count
    const { count: blacklistedIPs } = await supabase
      .from('ip_access_rules')
      .select('*', { count: 'exact', head: true })
      .eq('rule_type', 'blacklist')
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.now()');
    
    // Get 2FA adoption rate
    const { count: totalAdmins } = await supabase
      .from('admins')
      .select('*', { count: 'exact', head: true });
    
    const { count: adminsWiths2FA } = await supabase
      .from('user_2fa')
      .select('*', { count: 'exact', head: true })
      .eq('user_type', 'admin')
      .eq('is_enabled', true);
    
    const twoFAAdoption = totalAdmins ? Math.round(((adminsWiths2FA || 0) / totalAdmins) * 100) : 0;
    
    // Calculate security score
    let securityScore = 100;
    
    // Deduct for active incidents
    securityScore -= (activeIncidents || 0) * 5;
    
    // Deduct for high failed login rate
    if ((failedLogins24h || 0) > 50) securityScore -= 10;
    else if ((failedLogins24h || 0) > 20) securityScore -= 5;
    
    // Deduct for low 2FA adoption
    if (twoFAAdoption < 50) securityScore -= 15;
    else if (twoFAAdoption < 80) securityScore -= 5;
    
    // Ensure score is between 0-100
    securityScore = Math.max(0, Math.min(100, securityScore));
    
    return NextResponse.json({
      security_score: securityScore,
      active_incidents: activeIncidents || 0,
      failed_logins_24h: failedLogins24h || 0,
      active_sessions: activeSessions || 0,
      blacklisted_ips: blacklistedIPs || 0,
      two_fa_adoption: twoFAAdoption
    });
  } catch (error) {
    console.error('Error fetching security stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch security stats' },
      { status: 500 }
    );
  }
}
