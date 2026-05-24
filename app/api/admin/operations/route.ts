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
    const section = searchParams.get("section") || "all"

    const result: Record<string, unknown> = {}

    // Health Checks
    if (section === "all" || section === "health") {
      const { data: healthChecks } = await supabase
        .from("production_health_checks")
        .select("*")
        .order("check_type")

      result.healthChecks = healthChecks || []
      
      // Summary
      const healthy = healthChecks?.filter(h => h.status === "healthy").length || 0
      const warning = healthChecks?.filter(h => h.status === "warning").length || 0
      const critical = healthChecks?.filter(h => h.status === "critical").length || 0
      result.healthSummary = { healthy, warning, critical, total: healthChecks?.length || 0 }
    }

    // Business KPIs
    if (section === "all" || section === "kpis") {
      const { data: kpis } = await supabase
        .from("business_kpis")
        .select("*")
        .gte("kpi_date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
        .order("kpi_date", { ascending: false })

      result.kpis = kpis || []
    }

    // Maintenance Windows
    if (section === "all" || section === "maintenance") {
      const { data: maintenance } = await supabase
        .from("maintenance_windows")
        .select("*")
        .gte("scheduled_end", new Date().toISOString())
        .order("scheduled_start")
        .limit(10)

      result.maintenance = maintenance || []
    }

    // Feature Deployments
    if (section === "all" || section === "deployments") {
      const { data: deployments } = await supabase
        .from("feature_deployments")
        .select("*")
        .order("deployed_at", { ascending: false })
        .limit(20)

      result.deployments = deployments || []
    }

    // Knowledge Base
    if (section === "all" || section === "knowledge") {
      const { data: articles } = await supabase
        .from("knowledge_base")
        .select("*")
        .eq("is_published", true)
        .order("view_count", { ascending: false })
        .limit(20)

      result.knowledgeBase = articles || []
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Operations fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch operations data" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case "update_health_check": {
        const { id, status, last_error } = data
        const { error } = await supabase
          .from("production_health_checks")
          .update({
            status,
            last_error,
            last_check_at: new Date().toISOString(),
            error_count: status === "healthy" ? 0 : supabase.rpc("increment_error_count", { row_id: id })
          })
          .eq("id", id)

        if (error) throw error
        return NextResponse.json({ success: true })
      }

      case "create_maintenance": {
        const { title, description, maintenance_type, scheduled_start, scheduled_end, affected_services, created_by } = data
        const { data: maintenance, error } = await supabase
          .from("maintenance_windows")
          .insert({
            title,
            description,
            maintenance_type,
            scheduled_start,
            scheduled_end,
            affected_services,
            created_by: created_by || "00000000-0000-0000-0000-000000000000"
          })
          .select()
          .single()

        if (error) throw error
        return NextResponse.json({ success: true, maintenance })
      }

      case "update_maintenance": {
        const { id, status, actual_start, actual_end } = data
        const { error } = await supabase
          .from("maintenance_windows")
          .update({ status, actual_start, actual_end })
          .eq("id", id)

        if (error) throw error
        return NextResponse.json({ success: true })
      }

      case "create_deployment": {
        const { feature_name, version, description, deployed_by } = data
        const { data: deployment, error } = await supabase
          .from("feature_deployments")
          .insert({
            feature_name,
            version,
            description,
            deployed_by: deployed_by || "00000000-0000-0000-0000-000000000000"
          })
          .select()
          .single()

        if (error) throw error
        return NextResponse.json({ success: true, deployment })
      }

      case "rollback_deployment": {
        const { id, rollback_reason, rollback_by } = data
        const { error } = await supabase
          .from("feature_deployments")
          .update({
            status: "rolled_back",
            rollback_at: new Date().toISOString(),
            rollback_by: rollback_by || "00000000-0000-0000-0000-000000000000",
            rollback_reason
          })
          .eq("id", id)

        if (error) throw error
        return NextResponse.json({ success: true })
      }

      case "create_article": {
        const { category, title, content, tags, created_by } = data
        const { data: article, error } = await supabase
          .from("knowledge_base")
          .insert({
            category,
            title,
            content,
            tags,
            created_by: created_by || "00000000-0000-0000-0000-000000000000"
          })
          .select()
          .single()

        if (error) throw error
        return NextResponse.json({ success: true, article })
      }

      case "update_article": {
        const { id, title, content, tags, is_published, updated_by } = data
        const { error } = await supabase
          .from("knowledge_base")
          .update({
            title,
            content,
            tags,
            is_published,
            updated_by: updated_by || "00000000-0000-0000-0000-000000000000",
            updated_at: new Date().toISOString()
          })
          .eq("id", id)

        if (error) throw error
        return NextResponse.json({ success: true })
      }

      case "record_kpi": {
        const { kpi_date, kpi_type, kpi_value, kpi_target, branch_id } = data
        const { data: kpi, error } = await supabase
          .from("business_kpis")
          .upsert({
            kpi_date,
            kpi_type,
            kpi_value,
            kpi_target,
            branch_id
          }, { onConflict: "kpi_date,kpi_type,branch_id" })
          .select()
          .single()

        if (error) throw error
        return NextResponse.json({ success: true, kpi })
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Operations action error:", error)
    return NextResponse.json({ error: "Failed to perform action" }, { status: 500 })
  }
}
