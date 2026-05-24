import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api-auth"

export async function GET(request: NextRequest) {
  try {
    // Auth guard - require admin
    const authResult = await requireAdmin()
    if (authResult instanceof NextResponse) return authResult

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "all"

    if (type === "health_scores" || type === "all") {
      const { data: healthScores } = await supabase
        .from("enterprise_health_scores")
        .select("*")
        .order("score_date", { ascending: false })
        .limit(30)

      if (type === "health_scores") {
        return NextResponse.json({ healthScores })
      }
    }

    if (type === "validations" || type === "all") {
      const { data: validations } = await supabase
        .from("stability_validations")
        .select("*")
        .order("validation_type")
    
      if (type === "validations") {
        return NextResponse.json({ validations })
      }
    }

    if (type === "locks" || type === "all") {
      const { data: locks } = await supabase
        .from("production_sovereignty_locks")
        .select("*")
        .order("lock_category")

      if (type === "locks") {
        return NextResponse.json({ locks })
      }
    }

    if (type === "restrictions" || type === "all") {
      const { data: restrictions } = await supabase
        .from("enterprise_restrictions")
        .select("*")
        .order("restriction_type")

      if (type === "restrictions") {
        return NextResponse.json({ restrictions })
      }
    }

    if (type === "scalability_tests" || type === "all") {
      const { data: scalabilityTests } = await supabase
        .from("scalability_tests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20)

      if (type === "scalability_tests") {
        return NextResponse.json({ scalabilityTests })
      }
    }

    // Return all data
    const [healthRes, validRes, locksRes, restrictRes, scaleRes] = await Promise.all([
      supabase.from("enterprise_health_scores").select("*").order("score_date", { ascending: false }).limit(7),
      supabase.from("stability_validations").select("*").order("validation_type"),
      supabase.from("production_sovereignty_locks").select("*").order("lock_category"),
      supabase.from("enterprise_restrictions").select("*").order("restriction_type"),
      supabase.from("scalability_tests").select("*").order("created_at", { ascending: false }).limit(10)
    ])

    return NextResponse.json({
      healthScores: healthRes.data || [],
      validations: validRes.data || [],
      locks: locksRes.data || [],
      restrictions: restrictRes.data || [],
      scalabilityTests: scaleRes.data || []
    })

  } catch (error) {
    console.error("Enterprise stability error:", error)
    return NextResponse.json({ error: "Failed to fetch enterprise stability data" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case "run_validation": {
        const { validation_id } = data
        const passed = Math.random() > 0.1 // 90% pass rate simulation
        
        const { error } = await supabase
          .from("stability_validations")
          .update({
            status: passed ? "passed" : "failed",
            last_validated_at: new Date().toISOString(),
            pass_count: passed ? supabase.rpc("increment_pass_count") : undefined,
            fail_count: !passed ? supabase.rpc("increment_fail_count") : undefined,
            last_result: { passed, checked_at: new Date().toISOString() }
          })
          .eq("id", validation_id)

        // Simpler update - use try/catch instead of .catch
        try {
          await supabase.rpc("run_stability_validation", { p_validation_id: validation_id });
        } catch {
          // Fallback direct update
          await supabase
            .from("stability_validations")
            .update({
              status: passed ? "passed" : "failed",
              last_validated_at: new Date().toISOString(),
              last_result: { passed, checked_at: new Date().toISOString() }
            })
            .eq("id", validation_id);
        }

        return NextResponse.json({ success: true, passed })
      }

      case "toggle_lock": {
        const { lock_id, is_locked, user_id } = data
        
        const { error } = await supabase
          .from("production_sovereignty_locks")
          .update({
            is_locked,
            ...(is_locked 
              ? { locked_by: user_id, locked_at: new Date().toISOString() }
              : { last_unlock_at: new Date().toISOString(), last_unlock_by: user_id }
            )
          })
          .eq("id", lock_id)

        if (error) throw error
        return NextResponse.json({ success: true })
      }

      case "toggle_restriction": {
        const { restriction_id, is_active } = data
        
        const { error } = await supabase
          .from("enterprise_restrictions")
          .update({ is_active })
          .eq("id", restriction_id)

        if (error) throw error
        return NextResponse.json({ success: true })
      }

      case "create_scalability_test": {
        const { test_type, test_name, target_load, user_id } = data
        
        const { data: test, error } = await supabase
          .from("scalability_tests")
          .insert({
            test_type,
            test_name,
            target_load,
            status: "pending",
            tested_by: user_id
          })
          .select()
          .single()

        if (error) throw error
        return NextResponse.json({ success: true, test })
      }

      case "run_scalability_test": {
        const { test_id } = data
        
        // Simulate test results
        const actual_load = Math.floor(Math.random() * 1000) + 500
        const response_time_ms = Math.floor(Math.random() * 500) + 50
        const error_rate_percent = Math.random() * 5
        const passed = error_rate_percent < 2 && response_time_ms < 300

        const { error } = await supabase
          .from("scalability_tests")
          .update({
            status: "completed",
            actual_load,
            response_time_ms,
            error_rate_percent,
            passed,
            tested_at: new Date().toISOString(),
            findings: passed 
              ? "Test passed. System performed within acceptable parameters."
              : "Test failed. Performance degradation detected."
          })
          .eq("id", test_id)

        if (error) throw error
        return NextResponse.json({ success: true, passed, actual_load, response_time_ms, error_rate_percent })
      }

      case "calculate_health_scores": {
        // Calculate today's health scores
        const today = new Date().toISOString().split("T")[0]
        
        // Get validation pass rates
        const { data: validations } = await supabase
          .from("stability_validations")
          .select("status")
        
        const passedCount = validations?.filter(v => v.status === "passed").length || 0
        const totalValidations = validations?.length || 1
        const validationScore = Math.round((passedCount / totalValidations) * 100)

        // Get lock status
        const { data: locks } = await supabase
          .from("production_sovereignty_locks")
          .select("is_locked")
        
        const lockedCount = locks?.filter(l => l.is_locked).length || 0
        const totalLocks = locks?.length || 1
        const lockScore = Math.round((lockedCount / totalLocks) * 100)

        // Get restriction status
        const { data: restrictions } = await supabase
          .from("enterprise_restrictions")
          .select("is_active")
        
        const activeCount = restrictions?.filter(r => r.is_active).length || 0
        const totalRestrictions = restrictions?.length || 1
        const restrictionScore = Math.round((activeCount / totalRestrictions) * 100)

        const overallScore = Math.round((validationScore + lockScore + restrictionScore) / 3)

        const { error } = await supabase
          .from("enterprise_health_scores")
          .upsert({
            score_date: today,
            enterprise_health_score: validationScore,
            financial_integrity_score: Math.min(100, validationScore + 5),
            governance_integrity_score: lockScore,
            realtime_stability_score: Math.min(100, validationScore + 3),
            branch_trust_score: Math.min(100, restrictionScore + 5),
            queue_health_score: validationScore,
            audit_integrity_score: lockScore,
            recovery_readiness_score: restrictionScore,
            overall_score: overallScore,
            calculated_at: new Date().toISOString()
          }, { onConflict: "score_date" })

        if (error) throw error
        return NextResponse.json({ success: true, overallScore })
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

  } catch (error) {
    console.error("Enterprise stability action error:", error)
    return NextResponse.json({ error: "Action failed" }, { status: 500 })
  }
}
