import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// GET - ดึงข้อมูล emergency controls, broadcasts, notifications
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "all"

    const result: Record<string, unknown> = {}

    // Emergency Controls
    if (type === "all" || type === "controls") {
      const { data: controls } = await supabase
        .from("emergency_controls")
        .select("*")
        .order("control_key")

      result.controls = controls || []
    }

    // Active Broadcasts
    if (type === "all" || type === "broadcasts") {
      const { data: broadcasts } = await supabase
        .from("emergency_broadcasts")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(10)

      result.broadcasts = broadcasts || []
    }

    // Owner Notifications
    if (type === "all" || type === "notifications") {
      const { data: notifications } = await supabase
        .from("owner_notifications")
        .select("*")
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(20)

      result.notifications = notifications || []
      result.unreadCount = notifications?.length || 0
    }

    // Recent Timeline
    if (type === "all" || type === "timeline") {
      const { data: timeline } = await supabase
        .from("emergency_timeline")
        .select("*")
        .order("performed_at", { ascending: false })
        .limit(50)

      result.timeline = timeline || []
    }

    // Active Incidents Count
    const { count: activeIncidents } = await supabase
      .from("system_incidents")
      .select("*", { count: "exact", head: true })
      .eq("is_resolved", false)

    result.activeIncidents = activeIncidents || 0

    return NextResponse.json(result)
  } catch (error) {
    console.error("Emergency control GET error:", error)
    return NextResponse.json({ error: "Failed to fetch emergency data" }, { status: 500 })
  }
}

// POST - Toggle emergency control หรือสร้าง broadcast
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { action, ...data } = body

    if (action === "toggle_control") {
      const { control_key, is_active, user_id, reason } = data

      const updateData: Record<string, unknown> = {
        is_active,
        reason: reason || null,
      }

      if (is_active) {
        updateData.activated_by = user_id
        updateData.activated_at = new Date().toISOString()
        updateData.deactivated_by = null
        updateData.deactivated_at = null
      } else {
        updateData.deactivated_by = user_id
        updateData.deactivated_at = new Date().toISOString()
      }

      const { data: control, error } = await supabase
        .from("emergency_controls")
        .update(updateData)
        .eq("control_key", control_key)
        .select()
        .single()

      if (error) throw error

      // Log to timeline
      await supabase.from("emergency_timeline").insert({
        action_type: is_active ? "activate_control" : "deactivate_control",
        action_detail: `${control_key}: ${is_active ? "เปิด" : "ปิด"}`,
        performed_by: user_id,
        before_state: { is_active: !is_active },
        after_state: { is_active },
        note: reason,
      })

      return NextResponse.json({ success: true, control })
    }

    if (action === "create_broadcast") {
      const { title, message, broadcast_type, priority, user_id, expires_at } = data

      const { data: broadcast, error } = await supabase
        .from("emergency_broadcasts")
        .insert({
          title,
          message,
          broadcast_type: broadcast_type || "all",
          priority: priority || "normal",
          created_by: user_id,
          expires_at: expires_at || null,
        })
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({ success: true, broadcast })
    }

    if (action === "acknowledge_notification") {
      const { notification_id, user_id, action_taken } = data

      const { error } = await supabase
        .from("owner_notifications")
        .update({
          is_acknowledged: true,
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user_id,
          action_taken,
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq("id", notification_id)

      if (error) throw error

      return NextResponse.json({ success: true })
    }

    if (action === "mark_read") {
      const { notification_id } = data

      const { error } = await supabase
        .from("owner_notifications")
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq("id", notification_id)

      if (error) throw error

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Emergency control POST error:", error)
    return NextResponse.json({ error: "Failed to execute action" }, { status: 500 })
  }
}

// DELETE - ปิด broadcast
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const broadcastId = searchParams.get("broadcast_id")

    if (!broadcastId) {
      return NextResponse.json({ error: "broadcast_id required" }, { status: 400 })
    }

    const { error } = await supabase
      .from("emergency_broadcasts")
      .update({ is_active: false })
      .eq("id", broadcastId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Emergency control DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
  }
}
