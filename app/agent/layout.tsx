import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'แผงควบคุมเอเย่น',
  description: 'ระบบจัดการร้านหวยสำหรับเอเย่น',
};

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
