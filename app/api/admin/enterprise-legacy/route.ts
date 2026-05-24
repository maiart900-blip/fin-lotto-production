import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const section = searchParams.get("section") || "all"

    const result: Record<string, unknown> = {}

    // Handbooks
    if (section === "all" || section === "handbooks") {
      const { data: handbooks } = await supabase
        .from("enterprise_handbooks")
        .select("*")
        .eq("is_published", true)
        .order("handbook_type")
      result.handbooks = handbooks || []
    }

    // Change Requests
    if (section === "all" || section === "changes") {
      const { data: changeRequests } = await supabase
        .from("change_requests")
        .select("*")
        .order("requested_at", { ascending: false })
        .limit(50)
      result.changeRequests = changeRequests || []

      const { data: pendingChanges } = await supabase
        .from("change_requests")
        .select("id")
        .eq("status", "pending")
      result.pendingChangesCount = pendingChanges?.length || 0
    }

    // Audit Archives
    if (section === "all" || section === "archives") {
      const { data: archives } = await supabase
        .from("audit_archives")
        .select("*")
        .order("archive_year", { ascending: false })
        .order("archive_month", { ascending: false })
        .limit(24)
      result.archives = archives || []
    }

    // Financial Integrity
    if (section === "all" || section === "integrity") {
      const { data: integrityChecks } = await supabase
        .from("financial_integrity_checks")
        .select("*")
        .order("check_date", { ascending: false })
        .limit(30)
      result.integrityChecks = integrityChecks || []

      const { data: inconsistentChecks } = await supabase
        .from("financial_integrity_checks")
        .select("id")
        .eq("is_consistent", false)
        .is("resolved_at", null)
      result.inconsistentCount = inconsistentChecks?.length || 0
    }

    // Permission History
    if (section === "all" || section === "permissions") {
      const { data: permissionHistory } = await supabase
        .from("permission_history")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(50)
      result.permissionHistory = permissionHistory || []
    }

    // Summary stats
    if (section === "all") {
      const { data: totalArchives } = await supabase
        .from("audit_archives")
        .select("id")
      result.totalArchives = totalArchives?.length || 0

      const { data: totalHandbooks } = await supabase
        .from("enterprise_handbooks")
        .select("id")
        .eq("is_published", true)
      result.totalHandbooks = totalHandbooks?.length || 0
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Enterprise legacy error:", error)
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case "create_change_request": {
        const { error } = await supabase.from("change_requests").insert({
          change_type: data.change_type,
          change_scope: data.change_scope,
          title: data.title,
          description: data.description,
          impact_level: data.impact_level || "low",
          requested_by: data.requested_by,
          rollback_plan: data.rollback_plan,
        })
        if (error) throw error
        return NextResponse.json({ success: true })
      }

      case "approve_change": {
        const { error } = await supabase
          .from("change_requests")
          .update({
            status: "approved",
            approved_by: data.approved_by,
            approved_at: new Date().toISOString(),
          })
          .eq("id", data.id)
        if (error) throw error
        return NextResponse.json({ success: true })
      }

      case "reject_change": {
        const { error } = await supabase
          .from("change_requests")
          .update({
            status: "rejected",
            rejected_by: data.rejected_by,
            rejected_at: new Date().toISOString(),
            rejection_reason: data.reason,
          })
          .eq("id", data.id)
        if (error) throw error
        return NextResponse.json({ success: true })
      }

      case "run_integrity_check": {
        // Run financial integrity check
        const checkDate = new Date().toISOString().split("T")[0]
        
        // Get total deposits
        const { data: deposits } = await supabase
          .from("transactions")
          .select("amount")
          .eq("type", "deposit")
          .eq("status", "completed")
        const totalDeposits = deposits?.reduce((sum, d) => sum + Number(d.amount), 0) || 0

        // Get total withdrawals
        const { data: withdrawals } = await supabase
          .from("transactions")
          .select("amount")
          .eq("type", "withdrawal")
          .eq("status", "completed")
        const totalWithdrawals = withdrawals?.reduce((sum, w) => sum + Number(w.amount), 0) || 0

        // Get total customer balances
        const { data: customers } = await supabase
          .from("customers")
          .select("balance")
        const totalBalances = customers?.reduce((sum, c) => sum + Number(c.balance || 0), 0) || 0

        // Expected balance = deposits - withdrawals (simplified)
        const expectedBalance = totalDeposits - totalWithdrawals
        const difference = Math.abs(expectedBalance - totalBalances)
        const isConsistent = difference < 1 // Allow small rounding differences

        const { error } = await supabase.from("financial_integrity_checks").insert({
          check_date: checkDate,
          check_type: "balance_consistency",
          expected_value: expectedBalance,
          actual_value: totalBalances,
          difference: difference,
          is_consistent: isConsistent,
          checked_by: data.checked_by,
          notes: `Deposits: ${totalDeposits}, Withdrawals: ${totalWithdrawals}`,
        })
        if (error) throw error
        return NextResponse.json({ 
          success: true, 
          isConsistent,
          expected: expectedBalance,
          actual: totalBalances,
          difference 
        })
      }

      case "create_archive": {
        const { error } = await supabase.from("audit_archives").insert({
          archive_type: data.archive_type,
          archive_period: data.archive_period,
          archive_year: data.archive_year,
          archive_month: data.archive_month,
          record_count: data.record_count || 0,
          total_amount: data.total_amount || 0,
          summary_data: data.summary_data || {},
          archived_by: data.archived_by,
        })
        if (error) throw error
        return NextResponse.json({ success: true })
      }

      case "update_handbook": {
        const { error } = await supabase
          .from("enterprise_handbooks")
          .update({
            content: data.content,
            version: data.version,
            updated_by: data.updated_by,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.id)
        if (error) throw error
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Enterprise legacy action error:", error)
    return NextResponse.json({ error: "Action failed" }, { status: 500 })
  }
}
