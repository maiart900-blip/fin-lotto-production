import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - ดึงรายการบัญชีธนาคารทั้งหมด
export async function GET() {
  const supabase = await createClient();
  
  try {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      // ถ้าไม่มีตาราง ให้ return empty array
      if (error.code === '42P01') {
        return NextResponse.json({ accounts: [], message: 'ยังไม่มีตาราง bank_accounts กรุณาสร้างตารางก่อน' });
      }
      throw error;
    }

    return NextResponse.json({ accounts: data || [] });
  } catch (error) {
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูล', accounts: [] },
      { status: 500 }
    );
  }
}

// POST - เพิ่มบัญชีธนาคารใหม่
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  
  try {
    const body = await request.json();
    const {
      site_id,
      site_name,
      bank_code,
      bank_name,
      account_number,
      account_name,
      account_type, // 'deposit' | 'withdrawal' | 'both'
      balance = 0,
    } = body;

    // Validation
    if (!bank_code || !account_number || !account_name) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('bank_accounts')
      .insert({
        site_id: site_id || 'master',
        site_name: site_name || 'Master',
        bank_code,
        bank_name,
        account_number,
        account_name,
        account_type: account_type || 'both',
        balance,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      // ถ้าไม่มีตาราง
      if (error.code === '42P01') {
        return NextResponse.json(
          { error: 'ยังไม่มีตาราง bank_accounts กรุณาสร้างตารางก่อน' },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({ account: data, success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการเพิ่มบัญชี' },
      { status: 500 }
    );
  }
}
