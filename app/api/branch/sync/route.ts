import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET - ดึงข้อมูล sync และ events ของ branch
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branch_id");
    const action = searchParams.get("action") || "status";

    if (!branchId) {
      return NextResponse.json({ error: "branch_id required" }, { status: 400 });
    }

    if (action === "status") {
      // Get connection status
      const { data: status } = await supabase
        .from("branch_connection_status")
        .select("*")
        .eq("branch_id", branchId)
        .single();

      // Get pending events count
      const { count: pendingCount } = await supabase
        .from("branch_sync_logs")
        .select("*", { count: "exact", head: true })
        .eq("target_branch_id", branchId)
        .eq("is_acknowledged", false);

      return NextResponse.json({
        success: true,
        status: status || { is_online: false },
        pending_sync_count: pendingCount || 0,
      });
    }

    if (action === "events") {
      // Get recent events for this branch
      const { data: events } = await supabase
        .from("branch_realtime_events")
        .select("*")
        .eq("branch_id", branchId)
        .order("created_at", { ascending: false })
        .limit(50);

      return NextResponse.json({ success: true, events: events || [] });
    }

    if (action === "pending") {
      // Get pending sync items
      const { data: pending } = await supabase
        .from("branch_sync_logs")
        .select("*")
        .eq("target_branch_id", branchId)
        .eq("is_acknowledged", false)
        .order("created_at", { ascending: true });

      return NextResponse.json({ success: true, pending: pending || [] });
    }

    if (action === "children") {
      // Get all child branches status
      const { data: children } = await supabase
        .from("branches")
        .select(`
          id, code, name, branch_type, is_active,
          branch_connection_status (is_online, last_seen_at, connection_quality)
        `)
        .eq("parent_branch_id", branchId);

      return NextResponse.json({ success: true, children: children || [] });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Branch sync GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST - ส่ง sync event และ broadcast
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { action } = body;

    // Heartbeat - update connection status
    if (action === "heartbeat") {
      const { branch_id } = body;
      if (!branch_id) {
        return NextResponse.json({ error: "branch_id required" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("branch_connection_status")
        .upsert({
          branch_id,
          is_online: true,
          last_seen_at: new Date().toISOString(),
          connection_quality: "good",
        }, { onConflict: "branch_id" })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, status: data });
    }

    // Send sync event to parent
    if (action === "sync_to_parent") {
      const { branch_id, event_type, data: eventData } = body;
      
      // Get parent branch
      const { data: branch } = await supabase
        .from("branches")
        .select("parent_branch_id")
        .eq("id", branch_id)
        .single();

      if (!branch?.parent_branch_id) {
        return NextResponse.json({ error: "No parent branch" }, { status: 400 });
      }

      // Create sync log
      const { data: syncLog, error } = await supabase
        .from("branch_sync_logs")
        .insert({
          source_branch_id: branch_id,
          target_branch_id: branch.parent_branch_id,
          event_type,
          data: eventData,
        })
        .select()
        .single();

      if (error) throw error;

      // Also create realtime event
      await supabase.from("branch_realtime_events").insert({
        branch_id: branch.parent_branch_id,
        event_type,
        event_category: "sync_from_child",
        title: `Sync from branch ${branch_id}`,
        data: eventData,
        broadcast_to_parent: false,
        broadcast_to_children: false,
      });

      return NextResponse.json({ success: true, sync_log: syncLog });
    }

    // Broadcast to all children
    if (action === "broadcast_to_children") {
      const { branch_id, event_type, data: eventData, title } = body;

      // Get all child branches
      const { data: children } = await supabase
        .from("branches")
        .select("id")
        .eq("parent_branch_id", branch_id);

      if (!children || children.length === 0) {
        return NextResponse.json({ success: true, message: "No children to broadcast" });
      }

      // Create sync logs for each child
      const syncLogs = children.map((child) => ({
        source_branch_id: branch_id,
        target_branch_id: child.id,
        event_type,
        data: eventData,
      }));

      await supabase.from("branch_sync_logs").insert(syncLogs);

      // Create realtime event
      await supabase.from("branch_realtime_events").insert({
        branch_id,
        event_type,
        event_category: "broadcast",
        title: title || `Broadcast: ${event_type}`,
        data: eventData,
        is_broadcast: true,
        broadcast_to_children: true,
      });

      return NextResponse.json({ 
        success: true, 
        broadcast_count: children.length 
      });
    }

    // Acknowledge sync
    if (action === "acknowledge") {
      const { sync_id } = body;

      const { error } = await supabase
        .from("branch_sync_logs")
        .update({
          is_acknowledged: true,
          acknowledged_at: new Date().toISOString(),
        })
        .eq("id", sync_id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // Create event
    if (action === "create_event") {
      const { branch_id, event_type, event_category, title, data: eventData, broadcast_to_parent, broadcast_to_children } = body;

      const { data: event, error } = await supabase
        .from("branch_realtime_events")
        .insert({
          branch_id,
          event_type,
          event_category,
          title,
          data: eventData,
          broadcast_to_parent: broadcast_to_parent || false,
          broadcast_to_children: broadcast_to_children || false,
        })
        .select()
        .single();

      if (error) throw error;

      // If broadcast to parent, create sync log
      if (broadcast_to_parent) {
        const { data: branch } = await supabase
          .from("branches")
          .select("parent_branch_id")
          .eq("id", branch_id)
          .single();

        if (branch?.parent_branch_id) {
          await supabase.from("branch_sync_logs").insert({
            source_branch_id: branch_id,
            target_branch_id: branch.parent_branch_id,
            event_type,
            data: eventData,
          });
        }
      }

      // If broadcast to children, create sync logs
      if (broadcast_to_children) {
        const { data: children } = await supabase
          .from("branches")
          .select("id")
          .eq("parent_branch_id", branch_id);

        if (children && children.length > 0) {
          const syncLogs = children.map((child) => ({
            source_branch_id: branch_id,
            target_branch_id: child.id,
            event_type,
            data: eventData,
          }));
          await supabase.from("branch_sync_logs").insert(syncLogs);
        }
      }

      return NextResponse.json({ success: true, event });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Branch sync POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
