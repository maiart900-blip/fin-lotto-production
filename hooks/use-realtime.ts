'use client';

/**
 * Real-time Subscription Hook
 * Subscribe to Supabase Realtime channels for live updates
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type RealtimeEventType = 
  | 'new_bet'
  | 'bet_volume_update'
  | 'limit_reached'
  | 'market_status'
  | 'deposit_request'
  | 'withdraw_request'
  | 'credit_update'
  | 'agent_sync'
  | 'risk_alert'
  | 'system_broadcast';

export interface RealtimeEvent {
  type: RealtimeEventType;
  channel: string;
  data: Record<string, any>;
  timestamp: string;
  source?: string;
}

interface UseRealtimeOptions {
  channels: string[];
  eventTypes?: RealtimeEventType[];
  onEvent?: (event: RealtimeEvent) => void;
  enabled?: boolean;
}

export function useRealtime({ 
  channels, 
  eventTypes, 
  onEvent,
  enabled = true 
}: UseRealtimeOptions) {
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRefs = useRef<RealtimeChannel[]>([]);
  const supabase = createClient();

  const handleNewEvent = useCallback((payload: any) => {
    const event: RealtimeEvent = {
      type: payload.new.event_type,
      channel: payload.new.channel,
      data: payload.new.payload,
      timestamp: payload.new.created_at,
      source: payload.new.source,
    };

    // Filter by event type if specified
    if (eventTypes && !eventTypes.includes(event.type)) {
      return;
    }

    setEvents(prev => [event, ...prev].slice(0, 100)); // Keep last 100
    onEvent?.(event);
  }, [eventTypes, onEvent]);

  useEffect(() => {
    if (!enabled) return;

    const subscribeToChannels = async () => {
      try {
        // Clean up existing subscriptions
        for (const channel of channelRefs.current) {
          await supabase.removeChannel(channel);
        }
        channelRefs.current = [];

        // Subscribe to each channel
        for (const channelName of channels) {
          const channel = supabase
            .channel(`realtime_${channelName}`)
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'realtime_events',
                filter: `channel=eq.${channelName}`,
              },
              handleNewEvent
            )
            .subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                setIsConnected(true);
                setError(null);
              } else if (status === 'CHANNEL_ERROR') {
                setError('Connection error');
                setIsConnected(false);
              }
            });

          channelRefs.current.push(channel);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsConnected(false);
      }
    };

    subscribeToChannels();

    return () => {
      for (const channel of channelRefs.current) {
        supabase.removeChannel(channel);
      }
      channelRefs.current = [];
    };
  }, [channels.join(','), enabled, handleNewEvent, supabase]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    events,
    isConnected,
    error,
    clearEvents,
  };
}

/**
 * Hook for admin dashboard - subscribes to all admin channels
 */
export function useAdminRealtime(onEvent?: (event: RealtimeEvent) => void) {
  return useRealtime({
    channels: ['admin_dashboard', 'risk_alerts', 'market_updates'],
    onEvent,
  });
}

/**
 * Hook for agent dashboard
 */
export function useAgentRealtime(agentId: string, onEvent?: (event: RealtimeEvent) => void) {
  return useRealtime({
    channels: [`agent_${agentId}`, 'market_updates'],
    onEvent,
  });
}

/**
 * Hook for customer portal
 */
export function useCustomerRealtime(customerId: string, onEvent?: (event: RealtimeEvent) => void) {
  return useRealtime({
    channels: [`customer_${customerId}`, 'market_updates'],
    eventTypes: ['credit_update', 'market_status', 'system_broadcast'],
    onEvent,
  });
}

/**
 * Hook for risk monitoring only
 */
export function useRiskAlerts(onAlert?: (event: RealtimeEvent) => void) {
  return useRealtime({
    channels: ['risk_alerts'],
    eventTypes: ['risk_alert', 'limit_reached'],
    onEvent: onAlert,
  });
}

/**
 * Polling fallback hook for environments without WebSocket support
 */
export function useRealtimePolling(channel: string, interval: number = 5000) {
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/realtime/events?channel=${channel}&limit=20`);
        if (response.ok) {
          const data = await response.json();
          setEvents(data.events || []);
        }
      } catch (err) {
        console.error('Polling error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
    const timer = setInterval(fetchEvents, interval);

    return () => clearInterval(timer);
  }, [channel, interval]);

  return { events, isLoading };
}
