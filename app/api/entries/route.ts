import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAgentOrHigher } from '@/lib/api-auth';
import { getDataScope, applyFullDataScope, assertNoGlobalFallback } from '@/lib/data-scope';
import { requireCustomerAccess } from '@/lib/customer-scope';

/**
 * Entries API - Betting entries/slips
 * 
 * SECURITY: Data is scoped by tenant_id and agent_id
 * Agents can only see entries from their own customers/downline
 */
export async function GET(request: Request) {
  try {
    // Auth guard
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;
    
    // Get data scope for current user
    const scope = await getDataScope({
      id: session.id,
      role: session.role,
      user_type: session.user_type,
      tenant_id: session.tenant_id,
    });
    
    // Block global fallback for agents
    assertNoGlobalFallback(scope);
    
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');
    const date = searchParams.get('date');
    const withResults = searchParams.get('with_results') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500);
    const offset = (page - 1) * limit;
    
    // If specific customer requested, verify access first
    if (customerId) {
      const accessCheck = await requireCustomerAccess(customerId, {
        id: session.id,
        role: session.role,
        user_type: session.user_type,
        tenant_id: session.tenant_id,
      });
      if (!accessCheck.allowed) {
        return withResults 
          ? NextResponse.json({ entries: [], results: [] })
          : NextResponse.json([]);
      }
    }
    
    const supabase = await createClient();
    let query = supabase
      .from('entries')
      .select('*, customer:customers(id, name, tenant_id, agent_id), lottery:lotteries(id, name)')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // SECURITY: Apply data scope filters
    query = applyFullDataScope(query, scope, {
      tenantColumn: 'tenant_id',
      agentColumn: 'agent_id',
      excludeNullTenant: true,
      excludeNullAgent: scope.isAgent,
    });
    
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }
    
    if (date) {
      const startOfDay = `${date}T00:00:00`;
      const endOfDay = `${date}T23:59:59`;
      query = query.gte('created_at', startOfDay).lte('created_at', endOfDay);
    }
    
    const { data, error } = await query;
    
    if (error) {
      if (withResults) {
        return NextResponse.json({ entries: [], results: [] });
      }
      return NextResponse.json([]);
    }
    
    if (withResults) {
      if (data && data.length > 0) {
        const lotteryIds = [...new Set(data.map((e: any) => e.lottery_id))];
        const { data: resultsData } = await supabase
          .from('lottery_results')
          .select('*')
          .in('lottery_id', lotteryIds)
          .eq('draw_date', date || new Date().toISOString().split('T')[0]);
        
        return NextResponse.json({ entries: data || [], results: resultsData || [] });
      }
      return NextResponse.json({ entries: [], results: [] });
    }
    
    return NextResponse.json(data || []);
  } catch {
    const { searchParams } = new URL(request.url);
    const withResults = searchParams.get('with_results') === 'true';
    if (withResults) {
      return NextResponse.json({ entries: [], results: [] });
    }
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    // Auth guard - get session for tenant_id
    const authResult = await requireAgentOrHigher();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;
    
    const body = await request.json();
    const supabase = await createClient();
    
    // Extract data from request
    const { entries, userId, lotteryId, lottery_id, customerId, customer_id, skipBlockedCheck, created_by, agent_id, customer_name, source_type } = body;
    const entriesToInsert = Array.isArray(entries) ? entries : [body];
    const finalLotteryId = lotteryId || lottery_id || null;
    const finalCustomerId = customerId || customer_id || null;
    const finalCreatedBy = created_by || body.createdBy || userId || session.id || null;
    const finalSourceType = source_type || 'manual';
    const finalTenantId = session.tenant_id || null;
    
    // ===== VALIDATION: Manual key entries MUST have customer linkage =====
    // For manual_key or manual source_type, we need either:
    // 1. A valid customer_id, OR
    // 2. A customer_name to create/find customer record
    if ((finalSourceType === 'manual_key' || finalSourceType === 'manual') && !userId) {
      // This is a manual key entry (not from logged-in customer)
      // Check if we have customer identification
      if (!finalCustomerId && !customer_name) {
        console.warn('Manual entry rejected: no customer_id or customer_name provided');
        return NextResponse.json({ 
          error: 'กรุณาเลือกลูกค้าก่อนส่งโพย',
          code: 'CUSTOMER_REQUIRED',
          details: 'Manual key entries must be linked to a customer for payout tracking'
        }, { status: 400 });
      }
      
      // If customer_name provided but no customer_id, try to find or create customer
      let resolvedCustomerId = finalCustomerId;
      if (!resolvedCustomerId && customer_name) {
        // First, try to find existing customer with this name
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('name', customer_name.trim())
          .eq('source_type', 'manual_key')
          .maybeSingle();
        
        if (existingCustomer) {
          resolvedCustomerId = existingCustomer.id;
        } else {
          // Create new customer record for this name
          const { data: newCustomer, error: createError } = await supabase
            .from('customers')
            .insert({
              name: customer_name.trim(),
              source_type: 'manual_key',
              system_type: 'manual_key',
              credit_balance: 0,
              is_active: true,
              agent_id: agent_id || finalCreatedBy || session.id || null,
              tenant_id: finalTenantId,
              agent_level: null,
              user_type: 'customer',
            })
            .select('id')
            .single();
          
          if (createError) {
            console.error('Failed to create customer for manual entry:', createError);
            return NextResponse.json({ 
              error: 'ไม่สามารถสร้างข้อมูลลูกค้าได้',
              code: 'CUSTOMER_CREATE_FAILED'
            }, { status: 500 });
          }
          
          resolvedCustomerId = newCustomer.id;
          console.log('Created new customer for manual entry:', { id: resolvedCustomerId, name: customer_name });
        }
      }
      
      // Update finalCustomerId with resolved value
      body._resolvedCustomerId = resolvedCustomerId;
    }
    
    // หา agent_id ถ้าไม่ได้ส่งมา - ดูจาก created_by
    let finalAgentId = agent_id || null;
    if (!finalAgentId && finalCreatedBy) {
      const supabaseCheck = await createClient();
      // ตรวจสอบว่า created_by เป็น agent หรือ staff
      const { data: agentData } = await supabaseCheck
        .from('agents')
        .select('id, parent_id, role')
        .eq('id', finalCreatedBy)
        .single();
      
      if (agentData) {
        // ถ้าเป็น staff ให้ใช้ parent_id, ถ้าเป็น agent ให้ใช้ตัวเอง
        finalAgentId = agentData.role === 'staff' && agentData.parent_id 
          ? agentData.parent_id 
          : agentData.id;
      }
    }
    
    // ตรวจสอบเลขอั้น/เลขปิด (ยกเว้น skipBlockedCheck = true)
    if (!skipBlockedCheck && finalLotteryId) {
      const { data: blockedNumbers } = await supabase
        .from('blocked_numbers')
        .select('number, bet_type, is_blocked, limit_amount, current_amount')
        .or(`lottery_id.eq.${finalLotteryId},lottery_id.is.null`);
      
      if (blockedNumbers && blockedNumbers.length > 0) {
        const validEntries: typeof entriesToInsert = [];
        const rejectedEntries: Array<{ number: string; betType: string; reason: string }> = [];
        
        for (const entry of entriesToInsert) {
          const number = entry.number?.replace(/\D/g, '');
          const betType = entry.betType || entry.bet_type;
          
          // หาเลขอั้นที่ตรงกับเลขนี้
          const blocked = blockedNumbers.find(b => 
            b.number === number && 
            (b.bet_type === betType || b.bet_type === 'all' || !b.bet_type)
          );
          
          if (blocked) {
            if (blocked.is_blocked) {
              // เลขปิดรับ - ปฏิเสธทั้งหมด
              rejectedEntries.push({ 
                number, 
                betType, 
                reason: 'เลขปิดรับ' 
              });
              continue;
            } else if (blocked.limit_amount) {
              // เลขมี limit - ตรวจสอบยอด
              const currentAmount = blocked.current_amount || 0;
              const availableAmount = blocked.limit_amount - currentAmount;
              const entryAmount = Number(entry.amount) || 0;
              
              if (entryAmount > availableAmount) {
                if (availableAmount <= 0) {
                  rejectedEntries.push({ 
                    number, 
                    betType, 
                    reason: 'เลขเต็มยอดแล้ว' 
                  });
                  continue;
                } else {
                  // ตัดยอดให้เท่ากับที่รับได้
                  entry.amount = availableAmount;
                  rejectedEntries.push({ 
                    number, 
                    betType, 
                    reason: `รับได้เพียง ${availableAmount} บาท` 
                  });
                }
              }
            }
          }
          validEntries.push(entry);
        }
        
        // ถ้าไม่มีรายการที่ผ่าน
        if (validEntries.length === 0) {
          return NextResponse.json({ 
            error: 'ไม่มีรายการที่ผ่านการตรวจสอบ', 
            rejectedEntries 
          }, { status: 400 });
        }
        
        // ใช้เฉพาะรายการที่ผ่าน
        entriesToInsert.length = 0;
        entriesToInsert.push(...validEntries);
        
        // แจ้งเตือนถ้ามีรายการถูกปฏิเสธ
        if (rejectedEntries.length > 0) {
          console.log('Rejected entries:', rejectedEntries);
        }
      }
    }
    
    // Calculate total bet amount
    const totalAmount = entriesToInsert.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    
    // If userId provided, check and deduct credit
    if (userId) {
      // Get current user balance
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('credit_balance, is_unlimited_credit')
        .eq('id', userId)
        .single();
      
      if (userError) {
        return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ใช้' }, { status: 404 });
      }
      
      // Check if user has unlimited credit or sufficient balance
      if (!user.is_unlimited_credit) {
        const currentBalance = Number(user.credit_balance) || 0;
        if (currentBalance < totalAmount) {
          return NextResponse.json({ 
            error: `เครดิตไม่เพียงพอ (ยอดแทง: ${totalAmount.toLocaleString()} บาท, คงเหลือ: ${currentBalance.toLocaleString()} บาท)` 
          }, { status: 400 });
        }
        
        // Deduct credit
        const { error: deductError } = await supabase
          .from('users')
          .update({ 
            credit_balance: currentBalance - totalAmount,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
        
        if (deductError) {
          return NextResponse.json({ error: 'ไม่สามารถตัดเครดิตได้' }, { status: 500 });
        }
      }
    }
    
    // Insert entries
    // Use resolved customer_id if available
    const resolvedCustomerId = body._resolvedCustomerId || finalCustomerId;
    
    const { data, error } = await supabase
      .from('entries')
      .insert(entriesToInsert.map(e => ({
        number: e.number,
        bet_type: e.betType || e.bet_type,
        amount: Number(e.amount) || 0,
        customer_id: resolvedCustomerId || e.customerId || e.customer_id || null,
        lottery_id: finalLotteryId || e.lotteryId || e.lottery_id || null,
        user_id: userId || e.userId || e.user_id || null,
        created_by: finalCreatedBy || e.createdBy || e.created_by || null,
        agent_id: finalAgentId || e.agent_id || null,
        tenant_id: finalTenantId,
        status: 'pending',
        payout_rate: e.payoutRate || e.payout_rate || null,
        source_type: finalSourceType || e.source_type || 'manual',
      })))
      .select('*');
    
    if (error) {
      console.error('Insert entries error:', error);
      // If entries fail, refund credit
      if (userId && !body.skipRefund) {
        const { data: user } = await supabase
          .from('users')
          .select('credit_balance')
          .eq('id', userId)
          .single();
        
        if (user) {
          await supabase
            .from('users')
            .update({ credit_balance: Number(user.credit_balance) + totalAmount })
            .eq('id', userId);
        }
      }
      return NextResponse.json({ error: 'ไม่สามารถบันทึกโพยได้', detail: error.message, code: error.code }, { status: 500 });
    }
    
    // Create bet slip record
    if (data && data.length > 0 && userId) {
      await supabase
        .from('bet_slips')
        .insert({
          user_id: userId,
          lottery_id: lotteryId,
          total_amount: totalAmount,
          entry_count: data.length,
          status: 'submitted',
        });
    }
    
    // Log transaction
    if (userId && totalAmount > 0) {
      await supabase
        .from('credit_transactions')
        .insert({
          user_id: userId,
          amount: -totalAmount,
          type: 'bet',
          description: `แทงหวย ${data?.length || 0} รายการ`,
          status: 'completed',
        });
    }
    
    // คำนวณ commission chain สำหรับทุก entry ที่บันทึกสำเร็จ
    // เพื่อส่งยอดขึ้นเว็บแม่ตาม commission structure
    if (data && data.length > 0) {
      for (const entry of data) {
        try {
          // หา agent_id จาก customer หรือ user
          let agentId = null;
          
          if (entry.customer_id) {
            const { data: customer } = await supabase
              .from('customers')
              .select('agent_id')
              .eq('id', entry.customer_id)
              .single();
            agentId = customer?.agent_id;
          }
          
          if (!agentId && entry.user_id) {
            const { data: user } = await supabase
              .from('users')
              .select('parent_agent_id')
              .eq('id', entry.user_id)
              .single();
            agentId = user?.parent_agent_id;
          }
          
          if (agentId) {
            // หา commission rate ของ agent
            const { data: agent } = await supabase
              .from('users')
              .select('commission_rate, parent_agent_id')
              .eq('id', agentId)
              .single();
            
            const commissionRate = Number(agent?.commission_rate) || 5;
            const agentCommission = entry.amount * (commissionRate / 100);
            
            // หา parent commission ถ้ามี
            let parentCommission = 0;
            if (agent?.parent_agent_id) {
              const { data: parentAgent } = await supabase
                .from('users')
                .select('commission_rate')
                .eq('id', agent.parent_agent_id)
                .single();
              const parentRate = Number(parentAgent?.commission_rate) || 3;
              parentCommission = entry.amount * (parentRate / 100);
            }
            
            // ยอดที่เหลือส่งเว็บแม่
            const masterAmount = entry.amount - agentCommission - parentCommission;
            
            // อัปเดต entry ด้วยค่า commission
            await supabase
              .from('entries')
              .update({
                agent_id: agentId,
                agent_commission: agentCommission,
                parent_commission: parentCommission,
                master_amount: masterAmount,
              })
              .eq('id', entry.id);
          }
        } catch (commErr) {
          console.error('Commission calculation error for entry:', entry.id, commErr);
        }
      }
    }
    
    // อัพเดท current_amount ใน blocked_numbers สำหรับ limit tracking
    if (lotteryId && data && data.length > 0) {
      const amountByNumber: Record<string, number> = {};
      for (const entry of data) {
        const key = `${entry.number}-${entry.bet_type}`;
        amountByNumber[key] = (amountByNumber[key] || 0) + (entry.amount || 0);
      }
      
      // อัพเดทแต่ละเลขที่มี limit
      for (const [key, amount] of Object.entries(amountByNumber)) {
        const [number, betType] = key.split('-');
        try {
          await supabase.rpc('increment_blocked_number_amount', {
            p_number: number,
            p_bet_type: betType,
            p_lottery_id: lotteryId,
            p_amount: amount
          });
        } catch {
          // ถ้า function ไม่มี - skip (optional feature)
        }
      }
    }
    
    // ตรวจสอบว่าเป็น Demo User หรือไม่
    let isDemoUser = false;
    if (customerId) {
      const { data: customer } = await supabase
        .from('customers')
        .select('is_demo_user')
        .eq('id', customerId)
        .single();
      isDemoUser = customer?.is_demo_user === true;
    }
    
    // Sync ไปเว็บแม่ (ถ้าเป็นเว็บลูก และไม่ใช่ Demo User)
    const parentSiteUrl = process.env.PARENT_SITE_URL;
    const parentSiteApiKey = process.env.PARENT_SITE_API_KEY;
    const siteId = process.env.SITE_ID || 'master';
    
    // Skip sync สำหรับ Demo User
    if (parentSiteUrl && parentSiteApiKey && siteId !== 'master' && data && data.length > 0 && !isDemoUser) {
      try {
        // Sync entries ไปเว็บแม่
        await fetch(`${parentSiteUrl}/api/network/receive`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': parentSiteApiKey,
            'X-Child-Site': siteId,
          },
          body: JSON.stringify({
            type: 'entries_sync',
            data: {
              entries: data,
              source_site_id: siteId,
              total_amount: totalAmount,
              lottery_id: lotteryId,
            },
            timestamp: new Date().toISOString(),
          }),
        });
        
        console.log(`Synced ${data.length} entries to parent site`);
      } catch (syncError) {
        console.error('Failed to sync to parent site:', syncError);
        // ไม่ fail request เพราะ local save สำเร็จแล้ว
      }
    }
    
    // สร้าง forwarding entries สำหรับ agent system
    if (data && data.length > 0 && userId) {
      const { data: user } = await supabase
        .from('users')
        .select('role, parent_id')
        .eq('id', userId)
        .single();
      
      if (user?.role === 'agent' && user.parent_id) {
        // สร้าง forwarding entries
        for (const entry of data) {
          try {
            await fetch('/api/forwarding', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                entry_id: entry.id,
                customer_id: customerId,
                agent_id: userId,
                lottery_id: lotteryId,
                number: entry.number,
                entry_type: entry.bet_type,
                total_amount: entry.amount,
              }),
            });
          } catch {
            // Continue even if forwarding fails
          }
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      entries: data,
      totalAmount,
      synced: !!(parentSiteUrl && siteId !== 'master'),
      message: `บันทึกโพย ${data?.length || 0} รายการ ยอดรวม ${totalAmount.toLocaleString()} บาท`
    });
  } catch {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึกโพย' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { ids } = await request.json();
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('entries')
      .delete()
      .in('id', ids);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete entries' }, { status: 500 });
  }
}
