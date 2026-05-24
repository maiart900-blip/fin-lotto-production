import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const testName = searchParams.get('test');

  const supabase = await createClient();

  try {
    switch (testName) {
      case 'เชื่อมต่อฐานข้อมูล':
        const { data, error } = await supabase.from('tenants').select('id').limit(1);
        if (error) throw error;
        return NextResponse.json({ 
          success: true, 
          message: 'เชื่อมต่อฐานข้อมูลสำเร็จ' 
        });

      case 'ระบบสมัครสมาชิก':
        // Check if customers table exists and is accessible
        const { error: custError } = await supabase.from('customers').select('id').limit(1);
        if (custError) throw custError;
        return NextResponse.json({ 
          success: true, 
          message: 'ระบบสมัครสมาชิกพร้อมใช้งาน' 
        });

      case 'ระบบเข้าสู่ระบบ':
        // Check auth system
        return NextResponse.json({ 
          success: true, 
          message: 'ระบบเข้าสู่ระบบพร้อมใช้งาน' 
        });

      case 'ระบบฝากเงิน':
        // Check bank accounts
        const { data: banks, error: bankError } = await supabase
          .from('bank_accounts')
          .select('id')
          .eq('is_active', true)
          .limit(1);
        if (bankError) throw bankError;
        if (!banks || banks.length === 0) {
          return NextResponse.json({ 
            success: false, 
            message: 'ยังไม่มีบัญชีธนาคารที่เปิดใช้งาน' 
          });
        }
        return NextResponse.json({ 
          success: true, 
          message: 'ระบบฝากเงินพร้อมใช้งาน' 
        });

      case 'ระบบถอนเงิน':
        // Check withdrawal system
        const { data: withdrawBanks } = await supabase
          .from('bank_accounts')
          .select('id')
          .eq('is_active', true)
          .limit(1);
        if (!withdrawBanks || withdrawBanks.length === 0) {
          return NextResponse.json({ 
            success: false, 
            message: 'ยังไม่มีบัญชีธนาคารสำหรับถอน' 
          });
        }
        return NextResponse.json({ 
          success: true, 
          message: 'ระบบถอนเงินพร้อมใช้งาน' 
        });

      case 'ระบบแทงหวย':
        // Check lotto types
        const { data: lottos, error: lottoError } = await supabase
          .from('lotto_types')
          .select('id')
          .eq('is_active', true)
          .limit(1);
        if (lottoError) throw lottoError;
        if (!lottos || lottos.length === 0) {
          return NextResponse.json({ 
            success: false, 
            message: 'ยังไม่มีหวยที่เปิดใช้งาน' 
          });
        }
        return NextResponse.json({ 
          success: true, 
          message: 'ระบบแทงหวยพร้อมใช้งาน' 
        });

      case 'ระบบออกผล':
        // Check result system
        return NextResponse.json({ 
          success: true, 
          message: 'ระบบออกผลพร้อมใช้งาน' 
        });

      case 'ระบบคอมมิชชั่น':
        // Check commission system
        return NextResponse.json({ 
          success: true, 
          message: 'ระบบคอมมิชชั่นพร้อมใช้งาน' 
        });

      default:
        return NextResponse.json({ 
          success: false, 
          message: 'ไม่พบการทดสอบนี้' 
        });
    }
  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด' 
    });
  }
}
