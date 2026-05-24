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

    let data: Record<string, unknown> = {}

    if (type === "all" || type === "capacity") {
      const { data: capacity } = await supabase
        .from("capacity_forecasts")
        .select("*")
        .order("forecast_date", { ascending: false })
        .limit(20)
      data.capacity = capacity || []
    }

    if (type === "all" || type === "lifecycle") {
      const { data: lifecycle } = await supabase
        .from("data_lifecycle")
        .select("*")
        .order("data_type")
      data.lifecycle = lifecycle || []
    }

    if (type === "all" || type === "queues") {
      const { data: queues } = await supabase
        .from("queue_health")
        .select("*")
        .order("queue_name")
      data.queues = queues || []
    }

    if (type === "all" || type === "simulations") {
      const { data: simulations } = await supabase
        .from("recovery_simulations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20)
      data.simulations = simulations || []
    }

    if (type === "all" || type === "dependencies") {
      const { data: dependencies } = await supabase
        .from("dependency_health")
        .select("*")
        .order("is_critical", { ascending: false })
      data.dependencies = dependencies || []
    }

    if (type === "all" || type === "forecasts") {
      const { data: forecasts } = await supabase
        .from("operational_forecasts")
        .select("*")
        .order("forecast_date", { ascending: false })
        .limit(30)
      data.forecasts = forecasts || []
    }

    // Summary stats
    const { data: queueStats } = await supabase
      .from("queue_health")
      .select("status")
    
    const { data: depStats } = await supabase
      .from("dependency_health")
      .select("status, is_critical")

    data.summary = {
      queues_healthy: queueStats?.filter(q => q.status === "healthy").length || 0,
      queues_warning: queueStats?.filter(q => q.status === "warning").length || 0,
      queues_critical: queueStats?.filter(q => q.status === "critical").length || 0,
      deps_healthy: depStats?.filter(d => d.status === "healthy").length || 0,
      deps_critical_down: depStats?.filter(d => d.is_critical && d.status !== "healthy").length || 0
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Future-proof GET error:", error)
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { action, ...params } = body

    switch (action) {
      case "update_lifecycle": {
        const { id, active_retention_days, archive_retention_days, delete_retention_days, is_auto_cleanup } = params
        const { error } = await supabase
          .from("data_lifecycle")
          .update({
            active_retention_days,
            archive_retention_days,
            delete_retention_days,
            is_auto_cleanup
          })
          .eq("id", id)
        if (error) throw error
        return NextResponse.json({ success: true })
      }

      case "run_cleanup": {
        const { data_type } = params
        // Simulate cleanup - in real system would archive/delete old records
        const { error } = await supabase
          .from("data_lifecycle")
          .update({
            last_cleanup_at: new Date().toISOString(),
            next_cleanup_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          })
          .eq("data_type", data_type)
        if (error) throw error
        return NextResponse.json({ success: true, message: `Cleanup for ${data_type} completed` })
      }

      case "update_queue": {
        const { queue_name, alert_threshold } = params
        const { error } = await supabase
          .from("queue_health")
          .update({ alert_threshold })
          .eq("queue_name", queue_name)
        if (error) throw error
        return NextResponse.json({ success: true })
      }

      case "create_simulation": {
        const { simulation_type, title, description, performed_by } = params
        const { error } = await supabase
          .from("recovery_simulations")
          .insert({
            simulation_type,
            title,
            description,
            status: "pending",
            performed_by
          })
        if (error) throw error
        return NextResponse.json({ success: true })
      }

      case "run_simulation": {
        const { id } = params
        // Start simulation
        await supabase
          .from("recovery_simulations")
          .update({
            status: "running",
            started_at: new Date().toISOString()
          })
          .eq("id", id)
        
        // Simulate completion after brief delay
        setTimeout(async () => {
          await supabase
            .from("recovery_simulations")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              duration_seconds: Math.floor(Math.random() * 60) + 10,
              result: "passed",
              findings: "All systems recovered successfully",
              recommendations: "Continue regular testing schedule"
            })
            .eq("id", id)
        }, 3000)

        return NextResponse.json({ success: true, message: "Simulation started" })
      }

      case "check_dependency": {
        const { dependency_type, dependency_name } = params
        // Simulate health check
        const { error } = await supabase
          .from("dependency_health")
          .update({
            last_check_at: new Date().toISOString(),
            response_time_ms: Math.floor(Math.random() * 100) + 20,
            status: "healthy"
          })
          .eq("dependency_type", dependency_type)
          .eq("dependency_name", dependency_name)
        if (error) throw error
        return NextResponse.json({ success: true })
      }

      case "calculate_forecast": {
        const { forecast_type } = params
        // Insert sample forecast
        const today = new Date().toISOString().split("T")[0]
        const currentValue = Math.floor(Math.random() * 10000) + 1000
        
        const { error } = await supabase
          .from("capacity_forecasts")
          .upsert({
            forecast_type,
            forecast_date: today,
            current_value: currentValue,
            forecast_7d: currentValue * 1.05,
            forecast_30d: currentValue * 1.15,
            forecast_90d: currentValue * 1.35,
            growth_rate_percent: 5,
            status: "normal",
            calculated_at: new Date().toISOString()
          }, { onConflict: "forecast_type,forecast_date" })
        if (error) throw error
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Future-proof POST error:", error)
    return NextResponse.json({ error: "Failed to process action" }, { status: 500 })
  }
}
