import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Network Receive API
 * 
 * รับข้อมูลจากเว็บลูก (child sites) หรือเว็บแม่ (parent site)
 * - entries_sync: รับ entries จากเว็บลูก
 * - lottery_status: รับสถานะหวยจากเว็บแม่
 * - payout_rates: รับเรทจ่ายจากเว็บแม่
 * - blocked_numbers: รับเลขอั้นจากเว็บแม่
 * - market_close: สั่งปิดรับทันทีจากเว็บแม่
 */

interface SyncPayload {
  type:
    | 'entries_sync'
    | 'lottery_status'
    | 'payout_rates'
    | 'blocked_numbers'
    | 'market_close'
    | 'full_sync';
  data: Record<string, any>;
  timestamp: string;
  master_site_id?: string;
}

// Verify API key
function verifyApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  const expectedKey =
    process.env.NETWORK_API_KEY || process.env.PARENT_SITE_API_KEY;

  if (!expectedKey) return true; // ถ้าไม่ได้ตั้งค่า ให้ผ่าน (dev mode)
  return apiKey === expectedKey;
}

export async function POST(request: NextRequest) {
  try {
    // Verify API key
    if (!verifyApiKey(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const body: SyncPayload = await request.json();
    const { type, data, timestamp } = body;

    const childSiteId = request.headers.get('X-Child-Site');
    const masterSiteId = request.headers.get('X-Master-Site');

    // Log received sync
    try {
      await supabase.from('network_sync_logs').insert({
        sync_type: type,
        direction: childSiteId ? 'from_child' : 'from_parent',
        source_site_id: childSiteId || masterSiteId,
        payload: data,
        received_at: timestamp,
        processed_at: new Date().toISOString(),
      });
    } catch {
      // Ignore log errors
    }

    switch (type) {
      case 'entries_sync': {
        // รับ entries จากเว็บลูก
        const { entries, source_site_id, total_amount, lottery_id } = data;

        if (!entries || !Array.isArray(entries)) {
          return NextResponse.json(
            { error: 'Invalid entries data' },
            { status: 400 }
          );
        }

        // บันทึก entries ที่รับมา (mark as from child site)
        const { error } = await supabase
          .from('network_entries')
          .insert(
            entries.map((e: any) => ({
              original_entry_id: e.id,
              source_site_id: source_site_id || childSiteId,
              number: e.number,
              bet_type: e.bet_type,
              amount: e.amount,
              lottery_id: lottery_id || e.lottery_id,
              customer_id: e.customer_id,
              status: 'received',
              received_at: timestamp,
            }))
          )
          .select();

        if (error) {
          console.error('Failed to save network entries:', error);

          // ลองบันทึกลง entries table ปกติแทน
          await supabase.from('entries').insert(
            entries.map((e: any) => ({
              number: e.number,
              bet_type: e.bet_type,
              amount: e.amount,
              lottery_id: lottery_id || e.lottery_id,
              source_site_id: source_site_id || childSiteId,
              status: 'pending',
            }))
          );
        }

        return NextResponse.json({
          success: true,
          received: entries.length,
          total_amount,
          message: `Received ${entries.length} entries from ${
            source_site_id || childSiteId
          }`,
        });
      }

      case 'lottery_status': {
        // รับสถานะหวยจากเว็บแม่
        const { lottery_id, is_active, is_closed_temp, close_reason } = data;

        if (!lottery_id) {
          return NextResponse.json(
            { error: 'lottery_id required' },
            { status: 400 }
          );
        }

        await supabase
          .from('lotteries')
          .update({
            is_active,
            is_closed_temp,
            close_reason,
            last_sync_at: new Date().toISOString(),
          })
          .eq('id', lottery_id);

        return NextResponse.json({
          success: true,
          message: 'Lottery status updated',
        });
      }

      case 'payout_rates': {
        // รับเรทจ่ายจากเว็บแม่
        const { rates, lottery_id } = data;

        if (!rates || !Array.isArray(rates)) {
          return NextResponse.json(
            { error: 'Invalid rates data' },
            { status: 400 }
          );
        }

        // อัปเดทเรทจ่าย
        for (const rate of rates) {
          await supabase.from('payout_rates').upsert(
            {
              lottery_id: lottery_id || rate.lottery_id,
              bet_type: rate.bet_type,
              rate: rate.rate,
              is_from_parent: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'lottery_id,bet_type' }
          );
        }

        return NextResponse.json({
          success: true,
          updated: rates.length,
        });
      }

      case 'blocked_numbers': {
        // รับเลขอั้นจากเว็บแม่
        const { blocked_numbers, lottery_id } = data;

        if (!blocked_numbers || !Array.isArray(blocked_numbers)) {
          return NextResponse.json(
            { error: 'Invalid blocked_numbers data' },
            { status: 400 }
          );
        }

        // อัปเดทเลขอั้น
        for (const bn of blocked_numbers) {
          await supabase.from('blocked_numbers').upsert(
            {
              lottery_id: lottery_id || bn.lottery_id,
              number: bn.number,
              bet_type: bn.bet_type || 'all',
              is_blocked: bn.is_blocked,
              limit_amount: bn.limit_amount,
              is_from_parent: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'lottery_id,number,bet_type' }
          );
        }

        return NextResponse.json({
          success: true,
          updated: blocked_numbers.length,
        });
      }

      case 'market_close': {
        // สั่งปิดรับทันทีจากเว็บแม่
        const { lottery_id, close_all, reason } = data;

        if (close_all) {
          // ปิดทุกหวย
          await supabase
            .from('lotteries')
            .update({
              is_closed_temp: true,
              close_reason: reason || 'ปิดรับจากเว็บแม่',
              closed_at: new Date().toISOString(),
            })
            .eq('is_active', true);
        } else if (lottery_id) {
          // ปิดเฉพาะหวยที่ระบุ
          await supabase
            .from('lotteries')
            .update({
              is_closed_temp: true,
              close_reason: reason || 'ปิดรับจากเว็บแม่',
              closed_at: new Date().toISOString(),
            })
            .eq('id', lottery_id);
        }

        return NextResponse.json({
          success: true,
          message: 'Market closed',
        });
      }

      case 'full_sync': {
        // รับข้อมูลทั้งหมดจากเว็บแม่
        const {
          lotteries,
          payout_rates,
          blocked_numbers,
        } = data;

        const synced = {
          lotteries: 0,
          rates: 0,
          blocked: 0,
        };

        if (lotteries && Array.isArray(lotteries)) {
          for (const lottery of lotteries) {
            await supabase
              .from('lotteries')
              .upsert(lottery, { onConflict: 'id' });

            synced.lotteries++;
          }
        }

        if (payout_rates && Array.isArray(payout_rates)) {
          for (const rate of payout_rates) {
            await supabase.from('payout_rates').upsert(
              {
                ...rate,
                is_from_parent: true,
              },
              { onConflict: 'lottery_id,bet_type' }
            );

            synced.rates++;
          }
        }

        if (blocked_numbers && Array.isArray(blocked_numbers)) {
          for (const bn of blocked_numbers) {
            await supabase.from('blocked_numbers').upsert(
              {
                ...bn,
                is_from_parent: true,
              },
              { onConflict: 'lottery_id,number,bet_type' }
            );

            synced.blocked++;
          }
        }

        return NextResponse.json({
          success: true,
          synced,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown sync type: ${type}` },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    console.error('Network receive error:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Internal server error',
      },
      { status: 500 }
    );
  }
}