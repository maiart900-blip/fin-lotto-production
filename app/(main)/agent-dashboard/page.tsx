// LEGACY ROUTE - Redirects to canonical route /agent/dashboard
// This file is kept for backwards compatibility
// Original content moved to /app/agent/dashboard/page.tsx

import { redirect } from 'next/navigation';

export default function AgentDashboardRedirect() {
  redirect('/agent/dashboard');
}
