import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  const cookieStore = await cookies();
  
  // Clear all auth cookies
  cookieStore.delete('lottery_session');
  cookieStore.delete('admin_id');
  cookieStore.delete('admin_role');
  cookieStore.delete('customer_id');
  
  return NextResponse.json({ success: true });
}
