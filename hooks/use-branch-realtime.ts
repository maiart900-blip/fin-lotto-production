"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface SyncEvent {
  id: string;
  source_branch_id: string;
  target_branch_id: string;
  event_type: string;
  data: Record<string, unknown>;
  synced_at: string;
  is_acknowledged: boolean;
}

interface RealtimeEvent {
  id: string;
  branch_id: string;
  event_type: string;
  event_category: string;
  title?: string;
  data: Record<string, unknown>;
  created_at: string;
}

interface UseBranchRealtimeOptions {
  branchId: string | null;
  onSyncEvent?: (event: SyncEvent) => void;
  onRealtimeEvent?: (event: RealtimeEvent) => void;
  onConnectionChange?: (isConnected: boolean) => void;
  heartbeatInterval?: number; // ms, default 30000
}

export function useBranchRealtime({
  branchId,
  onSyncEvent,
  onRealtimeEvent,
  onConnectionChange,
  heartbeatInterval = 30000,
}: UseBranchRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [pendingSync, setPendingSync] = useState<SyncEvent[]>([]);
  const [connectionQuality, setConnectionQuality] = useState<"good" | "fair" | "poor">("good");
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Send heartbeat to server
  const sendHeartbeat = useCallback(async () => {
    if (!branchId) return;

    try {
      const res = await fetch("/api/branch/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "heartbeat", branch_id: branchId }),
      });

      if (res.ok) {
        setConnectionQuality("good");
        reconnectAttempts.current = 0;
      } else {
        setConnectionQuality("fair");
      }
    } catch {
      setConnectionQuality("poor");
    }
  }, [branchId]);

  // Fetch pending sync items
  const fetchPendingSync = useCallback(async () => {
    if (!branchId) return;

    try {
      const res = await fetch(`/api/branch/sync?branch_id=${branchId}&action=pending`);
      if (res.ok) {
        const data = await res.json();
        setPendingSync(data.pending || []);
      }
    } catch (error) {
      console.error("Failed to fetch pending sync:", error);
    }
  }, [branchId]);

  // Acknowledge a sync event
  const acknowledgeSyncEvent = useCallback(async (syncId: string) => {
    try {
      await fetch("/api/branch/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge", sync_id: syncId }),
      });

      setPendingSync((prev) => prev.filter((s) => s.id !== syncId));
    } catch (error) {
      console.error("Failed to acknowledge sync:", error);
    }
  }, []);

  // Send sync to parent branch
  const syncToParent = useCallback(async (eventType: string, data: Record<string, unknown>) => {
    if (!branchId) return;

    try {
      const res = await fetch("/api/branch/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_to_parent",
          branch_id: branchId,
          event_type: eventType,
          data,
        }),
      });

      return res.ok;
    } catch (error) {
      console.error("Failed to sync to parent:", error);
      return false;
    }
  }, [branchId]);

  // Broadcast to all children
  const broadcastToChildren = useCallback(async (eventType: string, data: Record<string, unknown>, title?: string) => {
    if (!branchId) return;

    try {
      const res = await fetch("/api/branch/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "broadcast_to_children",
          branch_id: branchId,
          event_type: eventType,
          data,
          title,
        }),
      });

      return res.ok;
    } catch (error) {
      console.error("Failed to broadcast:", error);
      return false;
    }
  }, [branchId]);

  // Create event
  const createEvent = useCallback(async (
    eventType: string, 
    eventCategory: string, 
    data: Record<string, unknown>,
    options?: { title?: string; broadcastToParent?: boolean; broadcastToChildren?: boolean }
  ) => {
    if (!branchId) return;

    try {
      const res = await fetch("/api/branch/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_event",
          branch_id: branchId,
          event_type: eventType,
          event_category: eventCategory,
          data,
          title: options?.title,
          broadcast_to_parent: options?.broadcastToParent,
          broadcast_to_children: options?.broadcastToChildren,
        }),
      });

      return res.ok;
    } catch (error) {
      console.error("Failed to create event:", error);
      return false;
    }
  }, [branchId]);

  // Setup realtime subscription
  useEffect(() => {
    if (!branchId) return;

    const supabase = createClient();

    // Subscribe to sync logs for this branch
    const channel = supabase
      .channel(`branch-sync-${branchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "branch_sync_logs",
          filter: `target_branch_id=eq.${branchId}`,
        },
        (payload) => {
          const event = payload.new as SyncEvent;
          setPendingSync((prev) => [...prev, event]);
          onSyncEvent?.(event);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "branch_realtime_events",
          filter: `branch_id=eq.${branchId}`,
        },
        (payload) => {
          const event = payload.new as RealtimeEvent;
          onRealtimeEvent?.(event);
        }
      )
      .subscribe((status) => {
        const connected = status === "SUBSCRIBED";
        setIsConnected(connected);
        onConnectionChange?.(connected);

        if (connected) {
          reconnectAttempts.current = 0;
          fetchPendingSync();
        } else if (status === "CHANNEL_ERROR") {
          // Attempt reconnect
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current++;
            setTimeout(() => {
              channel.subscribe();
            }, Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000));
          }
        }
      });

    channelRef.current = channel;

    // Start heartbeat
    sendHeartbeat();
    heartbeatRef.current = setInterval(sendHeartbeat, heartbeatInterval);

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [branchId, heartbeatInterval, onSyncEvent, onRealtimeEvent, onConnectionChange, sendHeartbeat, fetchPendingSync]);

  return {
    isConnected,
    connectionQuality,
    pendingSync,
    acknowledgeSyncEvent,
    syncToParent,
    broadcastToChildren,
    createEvent,
    fetchPendingSync,
  };
}
