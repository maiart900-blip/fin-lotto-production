import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';

export async function GET() {
  // Auth guard - require admin
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  // Mock balance data - in production, calculate from actual transactions
  return NextResponse.json({
    available: 5000,
    pending: 0,
  });
}
