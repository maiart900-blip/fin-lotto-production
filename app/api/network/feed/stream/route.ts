import { NextRequest } from 'next/server';
import { dataPipe } from '@/lib/double-pipe';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial data
      const recentBets = await dataPipe.getRecentBets(50);
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'initial', bets: recentBets })}\n\n`)
      );

      // Keep connection alive and poll for new data
      let lastBetId = recentBets[0]?.id || '';
      
      const interval = setInterval(async () => {
        try {
          const newBets = await dataPipe.getRecentBets(10);
          
          // Check for new bets
          for (const bet of newBets) {
            if (bet.id === lastBetId) break;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'new_bet', bet })}\n\n`)
            );
          }
          
          if (newBets.length > 0) {
            lastBetId = newBets[0].id;
          }

          // Send heartbeat
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch (error) {
          console.error('Stream error:', error);
        }
      }, 2000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
