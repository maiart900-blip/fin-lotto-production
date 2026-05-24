// =============================================================================
// EVENT SCHEDULER SYSTEM - Production Ready
// =============================================================================
// ระบบ Scheduler สำหรับ: Promotions, Lottery Open/Close, Maintenance, System Tasks
// รองรับ One-time และ Recurring Events (Cron patterns)
// =============================================================================

import { createClient } from '@/lib/supabase/server';

export type EventType = 
  | 'promotion_start' 
  | 'promotion_end' 
  | 'lottery_open' 
  | 'lottery_close' 
  | 'maintenance_start' 
  | 'maintenance_end' 
  | 'system_task'
  | 'daily_closing'
  | 'commission_calculation'
  | 'bonus_expiry_check'
  | 'send_notification';

export type ActionType = 
  | 'api_call' 
  | 'update_status' 
  | 'send_notification' 
  | 'run_script'
  | 'database_update';

export type RecurrencePattern = 'once' | 'daily' | 'weekly' | 'monthly' | 'custom';

export interface ScheduledEvent {
  id: string;
  name: string;
  description?: string;
  eventType: EventType;
  targetType?: string;
  targetId?: string;
  scheduledAt: string;
  timezone: string;
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
  recurrenceCron?: string;
  nextRunAt?: string;
  lastRunAt?: string;
  actionType: ActionType;
  actionPayload: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  runCount: number;
  lastResult?: Record<string, unknown>;
  lastError?: string;
  isActive: boolean;
  priority: number;
  maxRetries: number;
  retryCount: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventParams {
  name: string;
  description?: string;
  eventType: EventType;
  targetType?: string;
  targetId?: string;
  scheduledAt: Date;
  timezone?: string;
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern;
  recurrenceCron?: string;
  actionType: ActionType;
  actionPayload: Record<string, unknown>;
  priority?: number;
  maxRetries?: number;
  createdBy?: string;
}

// =============================================================================
// EVENT SCHEDULER SERVICE
// =============================================================================

export class EventSchedulerService {
  private supabase: Awaited<ReturnType<typeof createClient>>;

  constructor(supabase: Awaited<ReturnType<typeof createClient>>) {
    this.supabase = supabase;
  }

  // ---------------------------------------------------------------------------
  // CREATE / UPDATE EVENTS
  // ---------------------------------------------------------------------------

  async createEvent(params: CreateEventParams): Promise<ScheduledEvent> {
    const { data, error } = await this.supabase
      .from('scheduled_events')
      .insert({
        name: params.name,
        description: params.description,
        event_type: params.eventType,
        target_type: params.targetType,
        target_id: params.targetId,
        scheduled_at: params.scheduledAt.toISOString(),
        timezone: params.timezone || 'Asia/Bangkok',
        is_recurring: params.isRecurring || false,
        recurrence_pattern: params.recurrencePattern,
        recurrence_cron: params.recurrenceCron,
        next_run_at: params.isRecurring ? this.calculateNextRun(params.recurrenceCron!, params.scheduledAt) : null,
        action_type: params.actionType,
        action_payload: params.actionPayload,
        priority: params.priority || 0,
        max_retries: params.maxRetries || 3,
        created_by: params.createdBy,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapEvent(data);
  }

  async updateEvent(id: string, updates: Partial<CreateEventParams>): Promise<ScheduledEvent> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.eventType) updateData.event_type = updates.eventType;
    if (updates.scheduledAt) updateData.scheduled_at = updates.scheduledAt.toISOString();
    if (updates.actionPayload) updateData.action_payload = updates.actionPayload;
    if (updates.isRecurring !== undefined) updateData.is_recurring = updates.isRecurring;
    if (updates.recurrenceCron) updateData.recurrence_cron = updates.recurrenceCron;

    const { data, error } = await this.supabase
      .from('scheduled_events')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapEvent(data);
  }

  async cancelEvent(id: string): Promise<void> {
    await this.supabase
      .from('scheduled_events')
      .update({ 
        status: 'cancelled', 
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  }

  async deleteEvent(id: string): Promise<void> {
    await this.supabase
      .from('scheduled_events')
      .delete()
      .eq('id', id);
  }

  // ---------------------------------------------------------------------------
  // GET EVENTS
  // ---------------------------------------------------------------------------

  async getEvent(id: string): Promise<ScheduledEvent | null> {
    const { data, error } = await this.supabase
      .from('scheduled_events')
      .select()
      .eq('id', id)
      .single();

    if (error) return null;
    return this.mapEvent(data);
  }

  async getPendingEvents(limit = 100): Promise<ScheduledEvent[]> {
    const now = new Date().toISOString();
    
    const { data, error } = await this.supabase
      .from('scheduled_events')
      .select()
      .eq('status', 'pending')
      .eq('is_active', true)
      .lte('scheduled_at', now)
      .order('priority', { ascending: false })
      .order('scheduled_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data?.map(this.mapEvent) || [];
  }

  async getUpcomingEvents(hours = 24): Promise<ScheduledEvent[]> {
    const now = new Date();
    const future = new Date(now.getTime() + hours * 60 * 60 * 1000);
    
    const { data, error } = await this.supabase
      .from('scheduled_events')
      .select()
      .eq('is_active', true)
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', future.toISOString())
      .order('scheduled_at', { ascending: true });

    if (error) throw error;
    return data?.map(this.mapEvent) || [];
  }

  async getEventsByType(eventType: EventType): Promise<ScheduledEvent[]> {
    const { data, error } = await this.supabase
      .from('scheduled_events')
      .select()
      .eq('event_type', eventType)
      .eq('is_active', true)
      .order('scheduled_at', { ascending: true });

    if (error) throw error;
    return data?.map(this.mapEvent) || [];
  }

  async getAllEvents(params: {
    status?: string;
    eventType?: EventType;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ events: ScheduledEvent[]; total: number }> {
    let query = this.supabase
      .from('scheduled_events')
      .select('*', { count: 'exact' })
      .order('scheduled_at', { ascending: false });

    if (params.status) query = query.eq('status', params.status);
    if (params.eventType) query = query.eq('event_type', params.eventType);
    if (params.isActive !== undefined) query = query.eq('is_active', params.isActive);
    if (params.limit) query = query.limit(params.limit);
    if (params.offset) query = query.range(params.offset, params.offset + (params.limit || 50) - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    return {
      events: data?.map(this.mapEvent) || [],
      total: count || 0,
    };
  }

  // ---------------------------------------------------------------------------
  // EXECUTE EVENTS
  // ---------------------------------------------------------------------------

  async executeEvent(event: ScheduledEvent): Promise<{ success: boolean; result?: unknown; error?: string }> {
    // Mark as running
    await this.supabase
      .from('scheduled_events')
      .update({ 
        status: 'running',
        updated_at: new Date().toISOString(),
      })
      .eq('id', event.id);

    try {
      let result: unknown;

      switch (event.actionType) {
        case 'api_call':
          result = await this.executeApiCall(event.actionPayload);
          break;
        case 'update_status':
          result = await this.executeStatusUpdate(event.actionPayload);
          break;
        case 'send_notification':
          result = await this.executeSendNotification(event.actionPayload);
          break;
        case 'database_update':
          result = await this.executeDatabaseUpdate(event.actionPayload);
          break;
        default:
          throw new Error(`Unknown action type: ${event.actionType}`);
      }

      // Mark as completed
      const updateData: Record<string, unknown> = {
        status: event.isRecurring ? 'pending' : 'completed',
        run_count: event.runCount + 1,
        last_run_at: new Date().toISOString(),
        last_result: result,
        last_error: null,
        retry_count: 0,
        updated_at: new Date().toISOString(),
      };

      // Calculate next run for recurring events
      if (event.isRecurring && event.recurrenceCron) {
        updateData.next_run_at = this.calculateNextRun(event.recurrenceCron, new Date());
        updateData.scheduled_at = updateData.next_run_at;
      }

      await this.supabase
        .from('scheduled_events')
        .update(updateData)
        .eq('id', event.id);

      return { success: true, result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Handle retry
      if (event.retryCount < event.maxRetries) {
        await this.supabase
          .from('scheduled_events')
          .update({
            status: 'pending',
            retry_count: event.retryCount + 1,
            last_error: errorMessage,
            // Retry after exponential backoff
            scheduled_at: new Date(Date.now() + Math.pow(2, event.retryCount) * 60000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', event.id);
      } else {
        await this.supabase
          .from('scheduled_events')
          .update({
            status: 'failed',
            last_error: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', event.id);
      }

      return { success: false, error: errorMessage };
    }
  }

  // ---------------------------------------------------------------------------
  // ACTION EXECUTORS
  // ---------------------------------------------------------------------------

  private async executeApiCall(payload: Record<string, unknown>): Promise<unknown> {
    const { url, method = 'POST', headers = {}, body } = payload;
    
    const response = await fetch(url as string, {
      method: method as string,
      headers: {
        'Content-Type': 'application/json',
        ...(headers as Record<string, string>),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async executeStatusUpdate(payload: Record<string, unknown>): Promise<unknown> {
    const { table, id, updates } = payload;
    
    const { data, error } = await this.supabase
      .from(table as string)
      .update(updates as Record<string, unknown>)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  private async executeSendNotification(payload: Record<string, unknown>): Promise<unknown> {
    const { type, recipients, title, message, data } = payload;
    
    // Call notification API
    const response = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, recipients, title, message, data }),
    });

    return response.json();
  }

  private async executeDatabaseUpdate(payload: Record<string, unknown>): Promise<unknown> {
    const { query, params } = payload;
    
    // Execute raw SQL (be careful with this)
    const { data, error } = await this.supabase.rpc('execute_scheduled_query', {
      query_text: query,
      query_params: params,
    });

    if (error) throw error;
    return data;
  }

  // ---------------------------------------------------------------------------
  // CRON HELPERS
  // ---------------------------------------------------------------------------

  private calculateNextRun(cronExpression: string, fromDate: Date): string {
    // Simple cron parser for common patterns
    // Format: minute hour day month dayOfWeek
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) {
      throw new Error('Invalid cron expression');
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    const next = new Date(fromDate);

    // Add at least 1 minute
    next.setMinutes(next.getMinutes() + 1);

    // Set time
    if (minute !== '*') {
      next.setMinutes(parseInt(minute, 10));
    }
    if (hour !== '*') {
      next.setHours(parseInt(hour, 10));
      if (next <= fromDate) {
        next.setDate(next.getDate() + 1);
      }
    }

    // For daily at specific time
    if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      if (next <= fromDate) {
        next.setDate(next.getDate() + 1);
      }
    }

    return next.toISOString();
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  private mapEvent(data: Record<string, unknown>): ScheduledEvent {
    return {
      id: data.id as string,
      name: data.name as string,
      description: data.description as string | undefined,
      eventType: data.event_type as EventType,
      targetType: data.target_type as string | undefined,
      targetId: data.target_id as string | undefined,
      scheduledAt: data.scheduled_at as string,
      timezone: data.timezone as string,
      isRecurring: Boolean(data.is_recurring),
      recurrencePattern: data.recurrence_pattern as RecurrencePattern | undefined,
      recurrenceCron: data.recurrence_cron as string | undefined,
      nextRunAt: data.next_run_at as string | undefined,
      lastRunAt: data.last_run_at as string | undefined,
      actionType: data.action_type as ActionType,
      actionPayload: (data.action_payload as Record<string, unknown>) || {},
      status: data.status as ScheduledEvent['status'],
      runCount: Number(data.run_count || 0),
      lastResult: data.last_result as Record<string, unknown> | undefined,
      lastError: data.last_error as string | undefined,
      isActive: Boolean(data.is_active),
      priority: Number(data.priority || 0),
      maxRetries: Number(data.max_retries || 3),
      retryCount: Number(data.retry_count || 0),
      createdBy: data.created_by as string | undefined,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  }
}

// Factory function
export async function createEventSchedulerService() {
  const supabase = await createClient();
  return new EventSchedulerService(supabase);
}

// =============================================================================
// PRESET EVENTS
// =============================================================================

export const PRESET_EVENTS = {
  dailyClosing: (time = '01:00'): CreateEventParams => ({
    name: 'Daily Closing',
    description: 'ปิดยอดรายวันอัตโนมัติ',
    eventType: 'daily_closing',
    scheduledAt: new Date(),
    isRecurring: true,
    recurrencePattern: 'daily',
    recurrenceCron: `0 ${time.split(':')[0]} * * *`,
    actionType: 'api_call',
    actionPayload: {
      url: '/api/cron/daily-closing',
      method: 'POST',
    },
  }),

  commissionCalculation: (): CreateEventParams => ({
    name: 'Commission Calculation',
    description: 'คำนวณค่าคอมมิชชั่นประจำวัน',
    eventType: 'commission_calculation',
    scheduledAt: new Date(),
    isRecurring: true,
    recurrencePattern: 'daily',
    recurrenceCron: '30 1 * * *', // 01:30 AM
    actionType: 'api_call',
    actionPayload: {
      url: '/api/cron/calculate-commission',
      method: 'POST',
    },
  }),

  bonusExpiryCheck: (): CreateEventParams => ({
    name: 'Bonus Expiry Check',
    description: 'ตรวจสอบโบนัสหมดอายุ',
    eventType: 'bonus_expiry_check',
    scheduledAt: new Date(),
    isRecurring: true,
    recurrencePattern: 'daily',
    recurrenceCron: '0 0 * * *', // Midnight
    actionType: 'api_call',
    actionPayload: {
      url: '/api/cron/check-bonus-expiry',
      method: 'POST',
    },
  }),

  lotteryOpen: (lotteryId: string, openTime: Date): CreateEventParams => ({
    name: 'Lottery Open',
    description: 'เปิดรับแทงหวย',
    eventType: 'lottery_open',
    targetType: 'lottery',
    targetId: lotteryId,
    scheduledAt: openTime,
    isRecurring: false,
    actionType: 'update_status',
    actionPayload: {
      table: 'lottery_rounds',
      id: lotteryId,
      updates: { status: 'open', is_accepting_bets: true },
    },
  }),

  lotteryClose: (lotteryId: string, closeTime: Date): CreateEventParams => ({
    name: 'Lottery Close',
    description: 'ปิดรับแทงหวย',
    eventType: 'lottery_close',
    targetType: 'lottery',
    targetId: lotteryId,
    scheduledAt: closeTime,
    isRecurring: false,
    actionType: 'update_status',
    actionPayload: {
      table: 'lottery_rounds',
      id: lotteryId,
      updates: { status: 'closed', is_accepting_bets: false },
    },
  }),

  promotionStart: (promotionId: string, startTime: Date): CreateEventParams => ({
    name: 'Promotion Start',
    description: 'เริ่มโปรโมชั่น',
    eventType: 'promotion_start',
    targetType: 'promotion',
    targetId: promotionId,
    scheduledAt: startTime,
    isRecurring: false,
    actionType: 'update_status',
    actionPayload: {
      table: 'promotions',
      id: promotionId,
      updates: { status: 'active', is_active: true },
    },
  }),

  promotionEnd: (promotionId: string, endTime: Date): CreateEventParams => ({
    name: 'Promotion End',
    description: 'สิ้นสุดโปรโมชั่น',
    eventType: 'promotion_end',
    targetType: 'promotion',
    targetId: promotionId,
    scheduledAt: endTime,
    isRecurring: false,
    actionType: 'update_status',
    actionPayload: {
      table: 'promotions',
      id: promotionId,
      updates: { status: 'ended', is_active: false },
    },
  }),

  maintenanceStart: (startTime: Date, message: string): CreateEventParams => ({
    name: 'Maintenance Start',
    description: 'เริ่มปิดปรับปรุงระบบ',
    eventType: 'maintenance_start',
    scheduledAt: startTime,
    isRecurring: false,
    actionType: 'api_call',
    actionPayload: {
      url: '/api/admin/maintenance',
      method: 'POST',
      body: { action: 'start', message },
    },
  }),

  maintenanceEnd: (endTime: Date): CreateEventParams => ({
    name: 'Maintenance End',
    description: 'สิ้นสุดการปรับปรุงระบบ',
    eventType: 'maintenance_end',
    scheduledAt: endTime,
    isRecurring: false,
    actionType: 'api_call',
    actionPayload: {
      url: '/api/admin/maintenance',
      method: 'POST',
      body: { action: 'end' },
    },
  }),
};
