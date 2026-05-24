import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// ประเภทแอดมิน
type AdminType = 'manual_key' | 'auto';

// Interface สำหรับผลตรวจสอบ
interface VerificationResult {
  canEndShift: boolean;
  adminType: AdminType;
  adminId: string;
  adminName: string;
  shiftDate: string;
  
  // สรุปยอดรวม
  summary: {
    totalCustomers: number;
    totalBets: number;
    totalWins: number;
    totalWithdraws: number;
    totalDeposits: number;
    pendingBets: number;
    creditUsed: number;
    expectedCredit: number;
    actualCredit: number;
    difference: number;
  };
  
  // รายละเอียดแต่ละลูกค้า
  customerDetails: Array<{
    customerId: string;
    customerName: string;
    totalBets: number;
    totalWins: number;
    pendingBets: number;
    creditBalance: number;
    status: 'matched' | 'mismatch' | 'pending';
    difference: number;
  }>;
  
  // รายการหวยที่คีย์
  lotteryBreakdown: Array<{
    lotteryName: string;
    totalBets: number;
    betCount: number;
    wins: number;
    pending: number;
  }>;
  
  // ปัญหาที่พบ
  issues: Array<{
    type: 'credit_mismatch' | 'pending_bets' | 'unverified_withdrawal' | 'missing_data';
    severity: 'error' | 'warning';
    message: string;
    details?: any;
  }>;
  
  // เวลาตรวจสอบ
  verifiedAt: string;
}

// GET: ตรวจสอบยอดก่อนออกกะ
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const adminId = searchParams.get('admin_id');
    const adminType = searchParams.get('admin_type') as AdminType || 'manual_key';

    if (!adminId) {
      return NextResponse.json({ error: 'กรุณาระบุ admin_id' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];
    
    // ดึงข้อมูลแอดมิน
    const { data: admin } = await supabase
      .from('users')
      .select('id, username, display_name, role, credit_balance')
      .eq('id', adminId)
      .single();

    if (!admin) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลแอดมิน' }, { status: 404 });
    }

    // ดึงข้อมูลลูกค้าใต้สายงาน
    const { data: customers } = await supabase
      .from('customers')
      .select('*')
      .eq('created_by', adminId);

    // ดึงยอดแทงวันนี้
    const { data: todayBets } = await supabase
      .from('bets')
      .select('*')
      .eq('agent_id', adminId)
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    // ดึงยอดถูกรางวัลวันนี้
    const { data: todayWins } = await supabase
      .from('bets')
      .select('*')
      .eq('agent_id', adminId)
      .eq('status', 'won')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    // ดึงยอดรอผล
    const { data: pendingBets } = await supabase
      .from('bets')
      .select('*')
      .eq('agent_id', adminId)
      .eq('status', 'pending');

    // ดึงยอดฝากวันนี้
    const { data: todayDeposits } = await supabase
      .from('transactions')
      .select('*')
      .eq('admin_id', adminId)
      .eq('type', 'deposit')
      .eq('status', 'completed')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    // ดึงยอดถอนวันนี้
    const { data: todayWithdraws } = await supabase
      .from('transactions')
      .select('*')
      .eq('admin_id', adminId)
      .eq('type', 'withdraw')
      .eq('status', 'completed')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    // คำนวณยอดรวม
    const totalBets = (todayBets || []).reduce((sum, b) => sum + (b.amount || 0), 0);
    const totalWins = (todayWins || []).reduce((sum, b) => sum + (b.win_amount || 0), 0);
    const totalPending = (pendingBets || []).reduce((sum, b) => sum + (b.amount || 0), 0);
    const totalDeposits = (todayDeposits || []).reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalWithdraws = (todayWithdraws || []).reduce((sum, t) => sum + (t.amount || 0), 0);

    // คำนวณเครดิตที่ควรจะมี
    // เครดิตที่ใช้ = ยอดแทง - ยอดถูก + ยอดถอน - ยอดฝาก
    const creditUsed = totalBets - totalWins + totalWithdraws - totalDeposits;
    const actualCredit = admin.credit_balance || 0;
    
    // เครดิตเริ่มต้น (สมมติว่ามี)
    const startingCredit = 100000; // ควรดึงจาก shift record
    const expectedCredit = startingCredit - creditUsed;
    const difference = actualCredit - expectedCredit;

    // สร้างรายละเอียดลูกค้า
    const customerDetails = (customers || []).map(customer => {
      const customerBets = (todayBets || []).filter(b => b.customer_id === customer.id);
      const customerWins = (todayWins || []).filter(b => b.customer_id === customer.id);
      const customerPending = (pendingBets || []).filter(b => b.customer_id === customer.id);
      
      const custTotalBets = customerBets.reduce((sum, b) => sum + (b.amount || 0), 0);
      const custTotalWins = customerWins.reduce((sum, b) => sum + (b.win_amount || 0), 0);
      const custPending = customerPending.reduce((sum, b) => sum + (b.amount || 0), 0);
      
      const custExpectedCredit = (customer.credit_balance || 0) - custTotalBets + custTotalWins;
      const custActualCredit = customer.credit_balance || 0;
      const custDiff = custActualCredit - custExpectedCredit;
      
      return {
        customerId: customer.id,
        customerName: customer.name,
        totalBets: custTotalBets,
        totalWins: custTotalWins,
        pendingBets: custPending,
        creditBalance: custActualCredit,
        status: custPending > 0 ? 'pending' : (Math.abs(custDiff) < 1 ? 'matched' : 'mismatch') as 'matched' | 'mismatch' | 'pending',
        difference: custDiff,
      };
    });

    // สร้างรายละเอียดหวย
    const lotteryMap = new Map<string, { totalBets: number; betCount: number; wins: number; pending: number }>();
    
    for (const bet of todayBets || []) {
      const lotteryName = bet.lottery_name || 'ไม่ระบุ';
      const existing = lotteryMap.get(lotteryName) || { totalBets: 0, betCount: 0, wins: 0, pending: 0 };
      existing.totalBets += bet.amount || 0;
      existing.betCount += 1;
      if (bet.status === 'won') existing.wins += bet.win_amount || 0;
      if (bet.status === 'pending') existing.pending += bet.amount || 0;
      lotteryMap.set(lotteryName, existing);
    }
    
    const lotteryBreakdown = Array.from(lotteryMap.entries()).map(([name, data]) => ({
      lotteryName: name,
      ...data,
    }));

    // ตรวจสอบปัญหา
    const issues: VerificationResult['issues'] = [];
    
    // 1. ตรวจสอบเครดิตไม่ตรง
    if (Math.abs(difference) > 10) {
      issues.push({
        type: 'credit_mismatch',
        severity: 'error',
        message: `เครดิตไม่ตรง: ขาด/เกิน ${difference.toLocaleString()} บาท`,
        details: { expected: expectedCredit, actual: actualCredit, difference },
      });
    }
    
    // 2. ตรวจสอบยอดรอผล
    if (totalPending > 0) {
      issues.push({
        type: 'pending_bets',
        severity: 'warning',
        message: `มียอดรอผล ${totalPending.toLocaleString()} บาท (${(pendingBets || []).length} รายการ)`,
        details: { amount: totalPending, count: (pendingBets || []).length },
      });
    }
    
    // 3. ตรวจสอบยอดถอนที่ยังไม่ verify
    const unverifiedWithdraws = (todayWithdraws || []).filter(w => !w.verified_at);
    if (unverifiedWithdraws.length > 0) {
      const unverifiedAmount = unverifiedWithdraws.reduce((sum, w) => sum + (w.amount || 0), 0);
      issues.push({
        type: 'unverified_withdrawal',
        severity: 'error',
        message: `มียอดถอนที่ยังไม่ตรวจสอบ ${unverifiedAmount.toLocaleString()} บาท`,
        details: { amount: unverifiedAmount, count: unverifiedWithdraws.length },
      });
    }
    
    // 4. ตรวจสอบลูกค้าที่ยอดไม่ตรง
    const mismatchedCustomers = customerDetails.filter(c => c.status === 'mismatch');
    if (mismatchedCustomers.length > 0) {
      issues.push({
        type: 'credit_mismatch',
        severity: 'error',
        message: `มีลูกค้า ${mismatchedCustomers.length} ราย ที่ยอดเครดิตไม่ตรง`,
        details: { customers: mismatchedCustomers.map(c => c.customerName) },
      });
    }

    // ตัดสินว่าสามารถออกกะได้หรือไม่
    const hasErrors = issues.some(i => i.severity === 'error');
    const canEndShift = !hasErrors;

    const result: VerificationResult = {
      canEndShift,
      adminType,
      adminId,
      adminName: admin.display_name || admin.username,
      shiftDate: today,
      summary: {
        totalCustomers: (customers || []).length,
        totalBets,
        totalWins,
        totalWithdraws,
        totalDeposits,
        pendingBets: totalPending,
        creditUsed,
        expectedCredit,
        actualCredit,
        difference,
      },
      customerDetails,
      lotteryBreakdown,
      issues,
      verifiedAt: new Date().toISOString(),
    };

    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Shift verification error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการตรวจสอบ' }, { status: 500 });
  }
}

// POST: บันทึกการตรวจสอบและอนุญาตออกกะ
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { admin_id, admin_type, force_end = false, override_reason } = body;

    if (!admin_id) {
      return NextResponse.json({ error: 'กรุณาระบุ admin_id' }, { status: 400 });
    }

    // ตรวจสอบยอดก่อน
    const verifyResponse = await GET(new NextRequest(
      `http://localhost/api/shift-verification?admin_id=${admin_id}&admin_type=${admin_type}`
    ));
    const verification = await verifyResponse.json();

    // ถ้าไม่ผ่านและไม่ได้ force
    if (!verification.canEndShift && !force_end) {
      return NextResponse.json({
        error: 'ไม่สามารถออกกะได้ เนื่องจากยอดไม่ตรง',
        verification,
      }, { status: 400 });
    }

    // ถ้า force ต้องมีเหตุผล
    if (force_end && !verification.canEndShift && !override_reason) {
      return NextResponse.json({
        error: 'กรุณาระบุเหตุผลในการ override',
      }, { status: 400 });
    }

    // บันทึกการตรวจสอบ
    const { error: logError } = await supabase
      .from('shift_verifications')
      .insert({
        admin_id,
        admin_type,
        shift_date: verification.shiftDate,
        verification_data: verification,
        passed: verification.canEndShift,
        force_ended: force_end && !verification.canEndShift,
        override_reason: override_reason || null,
        verified_at: new Date().toISOString(),
      });

    if (logError) {
      console.error('Error logging verification:', logError);
    }

    return NextResponse.json({
      success: true,
      canProceed: verification.canEndShift || force_end,
      verification,
    });

  } catch (error) {
    console.error('Shift end verification error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
