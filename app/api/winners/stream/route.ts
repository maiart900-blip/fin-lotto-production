import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Server-Sent Events (SSE) for real-time winning ticker
export async function GET(request: Request) {
  const encoder = new TextEncoder();
  
  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const supabase = await createClient();
      
      // Send initial connection message
      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Send heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        sendEvent({ type: 'heartbeat', timestamp: new Date().toISOString() });
      }, 30000);

      // Fetch recent winners initially
      const fetchWinners = async () => {
        const { data: winners } = await supabase
          .from('winning_entries')
          .select(`
            id,
            customer_id,
            prize_amount,
            number,
            bet_type,
            created_at,
            customers (
              name,
              agent_id,
              agents (name)
            ),
            lotteries (name, icon)
          `)
          .order('created_at', { ascending: false })
          .limit(20);

        return winners?.map((w: any) => ({
          id: w.id,
          customerName: w.customers?.name ? maskName(w.customers.name) : 'ลูกค้า',
          agentName: w.customers?.agents?.name || 'ไม่ระบุ',
          prizeAmount: w.prize_amount,
          number: w.number,
          betType: w.bet_type,
          lotteryName: w.lotteries?.name || 'หวย',
          lotteryIcon: w.lotteries?.icon || '🎰',
          timestamp: w.created_at,
        })) || [];
      };

      // Send initial winners
      try {
        const initialWinners = await fetchWinners();
        sendEvent({ 
          type: 'initial', 
          winners: initialWinners,
          timestamp: new Date().toISOString() 
        });
      } catch (error) {
        console.error('Error fetching initial winners:', error);
      }

      // Subscribe to real-time updates via Supabase
      const channel = supabase
        .channel('winning-ticker')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'winning_entries',
          },
          async (payload) => {
            // Fetch full winner data with relations
            const { data: winner } = await supabase
              .from('winning_entries')
              .select(`
                id,
                customer_id,
                prize_amount,
                number,
                bet_type,
                created_at,
                customers (
                  name,
                  agent_id,
                  agents (name)
                ),
                lotteries (name, icon)
              `)
              .eq('id', payload.new.id)
              .single();

            if (winner) {
              sendEvent({
                type: 'new_winner',
                winner: {
                  id: winner.id,
                  customerName: (winner.customers as any)?.name ? maskName((winner.customers as any).name) : 'ลูกค้า',
                  agentName: (winner.customers as any)?.agents?.[0]?.name || 'ไม่ระบุ',
                  prizeAmount: winner.prize_amount,
                  number: winner.number,
                  betType: winner.bet_type,
                  lotteryName: (winner.lotteries as any)?.name || 'หวย',
                  lotteryIcon: (winner.lotteries as any)?.icon || '🎰',
                  timestamp: winner.created_at,
                },
                timestamp: new Date().toISOString(),
              });
            }
          }
        )
        .subscribe();

      // Poll for new winners every 10 seconds as fallback
      const pollInterval = setInterval(async () => {
        try {
          const winners = await fetchWinners();
          sendEvent({ 
            type: 'update', 
            winners: winners.slice(0, 5),
            timestamp: new Date().toISOString() 
          });
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 10000);

      // Handle cleanup when client disconnects
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        clearInterval(pollInterval);
        channel.unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

// Mask customer name for privacy (e.g., "สมชาย" -> "ส***")
function maskName(name: string): string {
  if (!name || name.length <= 1) return 'ลูกค้า';
  return name.charAt(0) + '***';
}
