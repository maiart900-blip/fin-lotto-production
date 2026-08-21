'use client';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-xl font-bold">เกิดข้อผิดพลาด</h2>

      <p className="text-sm text-muted-foreground">
        {error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่'}
      </p>

      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
      >
        ลองใหม่
      </button>
    </div>
  );
}