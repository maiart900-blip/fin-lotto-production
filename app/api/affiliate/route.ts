import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'

// GET - ดึงข้อมูล affiliate ของ user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // ดึง user จาก session (ในระบบจริงใช้ auth)
    const userId = request.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ดึงข้อมูล user และ referral code
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, username, display_name, referral_code')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // ถ้ายังไม่มี referral code ให้สร้างใหม่
    let referralCode = user.referral_code
    if (!referralCode) {
      referralCode = `FIN${nanoid(8).toUpperCase()}`
      await supabase
        .from('users')
        .update({ referral_code: referralCode })
        .eq('id', userId)
    }

    // ดึงสถิติการแนะนำ
    const { data: referrals, error: refError } = await supabase
      .from('referrals')
      .select(`
        id,
        referred_customer_id,
        commission_percent,
        created_at,
        referred:users!referred_customer_id(username, display_name, created_at)
      `)
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false })

    // คำนวณสถิติ
    const totalReferrals = referrals?.length || 0
    const totalCommission = referrals?.reduce((sum, r) => sum + (Number(r.commission_percent) || 0), 0) || 0

    // สร้าง affiliate link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://finlottop.com'
    const affiliateLink = `${baseUrl}/register?ref=${referralCode}`

    return NextResponse.json({
      success: true,
      data: {
        referralCode,
        affiliateLink,
        stats: {
          totalReferrals,
          totalCommission,
          commissionRate: 5, // 5% default
        },
        referrals: referrals || []
      }
    })
  } catch (error) {
    console.error('Affiliate API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - สร้าง referral ใหม่เมื่อมีคนสมัครผ่าน link
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { referralCode, newUserId } = body

    if (!referralCode || !newUserId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // หา referrer จาก referral code
    const { data: referrer, error: refError } = await supabase
      .from('users')
      .select('id')
      .eq('referral_code', referralCode)
      .single()

    if (refError || !referrer) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 })
    }

    // ตรวจสอบว่า user ใหม่ไม่ได้ถูก refer มาแล้ว
    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_customer_id', newUserId)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'User already referred' }, { status: 400 })
    }

    // สร้าง referral record
    const { data: referral, error: insertError } = await supabase
      .from('referrals')
      .insert({
        referrer_id: referrer.id,
        referred_customer_id: newUserId,
        referral_code: referralCode,
        commission_percent: 5.00
      })
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    return NextResponse.json({
      success: true,
      data: referral
    })
  } catch (error) {
    console.error('Create referral error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
