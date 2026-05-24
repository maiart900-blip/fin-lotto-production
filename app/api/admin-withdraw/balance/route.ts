import { NextResponse } from 'next/server';

export async function GET() {
  // Mock balance data - in production, calculate from actual transactions
  return NextResponse.json({
    available: 5000,
    pending: 0,
  });
}
