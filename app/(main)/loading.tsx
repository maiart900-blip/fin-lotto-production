import { Loader2 } from 'lucide-react';

export default function MainLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="size-10 animate-spin text-accent" />
        <p className="text-muted-foreground">กำลังโหลด...</p>
      </div>
    </div>
  );
}
