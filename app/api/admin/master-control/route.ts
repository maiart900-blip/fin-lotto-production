import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - ดึงข้อมูล Master Control ทั้งหมด
export async function GET() {
  try {
    const supabase = await createClient()

    // ดึง global controls
    const { data: controls } = await supabase
      .from('global_controls')
      .select('*')
      .order('control_key')

    // ดึง queue status
    const { data: queues } = await supabase
      .from('queue_status')
      .select('*')
      .order('queue_type')

    // ดึง incidents ที่ยังไม่ resolved
    const { data: incidents } = await supabase
      .from('system_incidents')
      .select('*')
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })
      .limit(20)

    // ดึง realtime metrics วันนี้
    const today = new Date().toISOString().split('T')[0]
    const { data: metrics } = await supabase
      .from('realtime_metrics')
      .select('*')
      .eq('metric_date', today)
      .order('metric_hour', { ascending: false })

    // ดึงสถิติ realtime
    const { data: todayStats } = await supabase
      .from('entries')
      .select('amount')
      .gte('created_at', `${today}T00:00:00`)

    const { data: pendingDeposits } = await supabase
      .from('transactions')
      .select('id, amount')
      .eq('type', 'deposit')
      .eq('status', 'pending')

    const { data: pendingWithdrawals } = await supabase
      .from('transactions')
      .select('id, amount')
      .eq('type', 'withdrawal')
      .eq('status', 'pending')

    const { count: activeCustomers } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    // คำนวณสถิติ
    const totalBetToday = todayStats?.reduce((sum, e) => sum + Number(e.amount || 0), 0) || 0
    const pendingDepositCount = pendingDeposits?.length || 0
    const pendingDepositAmount = pendingDeposits?.reduce((sum, d) => sum + Number(d.amount || 0), 0) || 0
    const pendingWithdrawCount = pendingWithdrawals?.length || 0
    const pendingWithdrawAmount = pendingWithdrawals?.reduce((sum, w) => sum + Number(w.amount || 0), 0) || 0

    return NextResponse.json({
      controls: controls || [],
      queues: queues || [],
      incidents: incidents || [],
      metrics: metrics || [],
      stats: {
        totalBetToday,
        pendingDepositCount,
        pendingDepositAmount,
        pendingWithdrawCount,
        pendingWithdrawAmount,
        activeCustomers: activeCustomers || 0,
        unresolvedIncidents: incidents?.length || 0,
      }
    })
  } catch (error) {
    console.error('Error fetching master control:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}

// PATCH - อัปเดต global control
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { control_key, control_value, is_enabled } = body

    if (!control_key) {
      return NextResponse.json({ error: 'control_key is required' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {
      last_changed_at: new Date().toISOString(),
    }

    if (control_value !== undefined) {
      updateData.control_value = control_value
    }
    if (is_enabled !== undefined) {
      updateData.is_enabled = is_enabled
    }

    const { data, error } = await supabase
      .from('global_controls')
      .update(updateData)
      .eq('control_key', control_key)
      .select()
      .single()

    if (error) throw error

    // บันทึก audit log
    await supabase.from('audit_logs').insert({
      action: 'update_global_control',
      entity_type: 'global_controls',
      entity_id: data.id,
      new_data: data,
      note: `Updated control: ${control_key}`,
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error updating control:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

// POST - สร้าง incident ใหม่ หรือ resolve incident
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { action, incident_id, ...incidentData } = body

    if (action === 'resolve' && incident_id) {
      // Resolve incident
      const { data, error } = await supabase
        .from('system_incidents')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', incident_id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, data })
    }

    // สร้าง incident ใหม่
    const { data, error } = await supabase
      .from('system_incidents')
      .insert({
        incident_type: incidentData.incident_type || 'manual',
        severity: incidentData.severity || 'warning',
        title: incidentData.title,
        message: incidentData.message,
        source: 'admin',
        data: incidentData.data,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error handling incident:', error)
    return NextResponse.json({ error: 'Failed to process' }, { status: 500 })
  }
}
