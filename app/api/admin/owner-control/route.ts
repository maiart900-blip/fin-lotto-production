import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { requireSuperAdmin } from "@/lib/api-auth"

// GET - ดึงข้อมูล governance, approvals, locks, sessions
export async function GET(request: NextRequest) {
  try {
    // Auth guard - require super_admin for owner control
    const authResult = await requireSuperAdmin()
    if (authResult instanceof NextResponse) return authResult

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "all"

    const result: Record<string, unknown> = {}

    // Governance Policies
    if (type === "all" || type === "policies") {
      const { data: policies } = await supabase
        .from("governance_policies")
        .select("*")
        .order("policy_type", { ascending: true })
      result.policies = policies || []
    }

    // Multi-Level Approvals (pending)
    if (type === "all" || type === "approvals") {
      const { data: approvals } = await supabase
        .from("multi_level_approvals")
        .select("*")
        .eq("final_status", "pending")
        .order("requested_at", { ascending: false })
        .limit(50)
      result.approvals = approvals || []
    }

    // Executive Locks
    if (type === "all" || type === "locks") {
      const { data: locks } = await supabase
        .from("executive_locks")
        .select("*")
        .order("lock_key", { ascending: true })
      result.locks = locks || []
    }

    // Active Sessions
    if (type === "all" || type === "sessions") {
      const { data: sessions } = await supabase
        .from("session_governance")
        .select("*")
        .eq("is_active", true)
        .order("last_active_at", { ascending: false })
        .limit(100)
      result.sessions = sessions || []
    }

    // Suspicious Sessions
    if (type === "all" || type === "suspicious") {
      const { data: suspicious } = await supabase
        .from("session_governance")
        .select("*")
        .eq("is_suspicious", true)
        .eq("is_active", true)
        .order("login_at", { ascending: false })
      result.suspiciousSessions = suspicious || []
    }

    // Ownership Actions (recent)
    if (type === "all" || type === "actions") {
      const { data: actions } = await supabase
        .from("ownership_actions")
        .select("*")
        .order("performed_at", { ascending: false })
        .limit(50)
      result.ownerActions = actions || []
    }

    // Summary Stats
    if (type === "all") {
      const { count: pendingApprovals } = await supabase
        .from("multi_level_approvals")
        .select("*", { count: "exact", head: true })
        .eq("final_status", "pending")

      const { count: activeLocks } = await supabase
        .from("executive_locks")
        .select("*", { count: "exact", head: true })
        .eq("is_locked", true)

      const { count: activeSessions } = await supabase
        .from("session_governance")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)

      const { count: suspiciousCount } = await supabase
        .from("session_governance")
        .select("*", { count: "exact", head: true })
        .eq("is_suspicious", true)
        .eq("is_active", true)

      result.summary = {
        pendingApprovals: pendingApprovals || 0,
        activeLocks: activeLocks || 0,
        activeSessions: activeSessions || 0,
        suspiciousSessions: suspiciousCount || 0,
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Owner control GET error:", error)
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 })
  }
}

// POST - ทำ action ต่างๆ
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      // Toggle Executive Lock
      case "toggle_lock": {
        const { lockKey, isLocked, reason, userId } = data
        const { error } = await supabase
          .from("executive_locks")
          .update({
            is_locked: isLocked,
            locked_by: isLocked ? userId : null,
            locked_at: isLocked ? new Date().toISOString() : null,
            unlock_by: !isLocked ? userId : null,
            unlock_at: !isLocked ? new Date().toISOString() : null,
            reason,
          })
          .eq("lock_key", lockKey)

        if (error) throw error

        // Log ownership action
        await supabase.from("ownership_actions").insert({
          action_type: isLocked ? "lock_activated" : "lock_deactivated",
          action_target: "executive_lock",
          action_detail: `${isLocked ? "Locked" : "Unlocked"} ${lockKey}`,
          performed_by: userId,
          reason,
        })

        return NextResponse.json({ success: true })
      }

      // Approve Multi-Level Request
      case "approve_request": {
        const { requestId, level, userId, note } = data
        const updateData: Record<string, unknown> = {}

        if (level === 1) {
          updateData.level1_status = "approved"
          updateData.level1_by = userId
          updateData.level1_at = new Date().toISOString()
          updateData.level1_note = note
        } else if (level === 2) {
          updateData.level2_status = "approved"
          updateData.level2_by = userId
          updateData.level2_at = new Date().toISOString()
          updateData.level2_note = note
        } else if (level === "owner") {
          updateData.owner_status = "approved"
          updateData.owner_by = userId
          updateData.owner_at = new Date().toISOString()
          updateData.owner_note = note
          updateData.final_status = "approved"
        }

        const { error } = await supabase
          .from("multi_level_approvals")
          .update(updateData)
          .eq("id", requestId)

        if (error) throw error

        return NextResponse.json({ success: true })
      }

      // Reject Multi-Level Request
      case "reject_request": {
        const { requestId, level, userId, note } = data
        const updateData: Record<string, unknown> = {
          final_status: "rejected",
        }

        if (level === 1) {
          updateData.level1_status = "rejected"
          updateData.level1_by = userId
          updateData.level1_at = new Date().toISOString()
          updateData.level1_note = note
        } else if (level === 2) {
          updateData.level2_status = "rejected"
          updateData.level2_by = userId
          updateData.level2_at = new Date().toISOString()
          updateData.level2_note = note
        } else if (level === "owner") {
          updateData.owner_status = "rejected"
          updateData.owner_by = userId
          updateData.owner_at = new Date().toISOString()
          updateData.owner_note = note
        }

        const { error } = await supabase
          .from("multi_level_approvals")
          .update(updateData)
          .eq("id", requestId)

        if (error) throw error

        return NextResponse.json({ success: true })
      }

      // Force Logout Session
      case "force_logout": {
        const { sessionId, userId, reason } = data
        const { error } = await supabase
          .from("session_governance")
          .update({
            is_active: false,
            forced_logout: true,
            forced_logout_by: userId,
            forced_logout_at: new Date().toISOString(),
            forced_logout_reason: reason,
          })
          .eq("id", sessionId)

        if (error) throw error

        // Log ownership action
        await supabase.from("ownership_actions").insert({
          action_type: "force_logout",
          action_target: "session",
          target_id: sessionId,
          action_detail: `Force logout session`,
          performed_by: userId,
          reason,
        })

        return NextResponse.json({ success: true })
      }

      // Update Policy Threshold
      case "update_policy": {
        const { policyKey, thresholdAmount, isActive, userId } = data
        const { error } = await supabase
          .from("governance_policies")
          .update({
            threshold_amount: thresholdAmount,
            is_active: isActive,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          })
          .eq("policy_key", policyKey)

        if (error) throw error

        // Log ownership action
        await supabase.from("ownership_actions").insert({
          action_type: "policy_updated",
          action_target: "governance_policy",
          action_detail: `Updated policy ${policyKey}`,
          performed_by: userId,
          after_state: { threshold_amount: thresholdAmount, is_active: isActive },
        })

        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Owner control POST error:", error)
    return NextResponse.json({ error: "Failed to perform action" }, { status: 500 })
  }
}
