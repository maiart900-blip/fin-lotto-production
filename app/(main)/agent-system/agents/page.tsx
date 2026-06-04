'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect page: /agent-system/agents → /agent-system/members
 * This route was deprecated and replaced with /agent-system/members
 */
export default function AgentSystemAgentsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/agent-system/members');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#f8f5f0]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto mb-4"></div>
        <p className="text-muted-foreground">กำลังนำทางไป หน้าจัดการพนักงาน...</p>
      </div>
    </div>
  );
}
