'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function RecoveryPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recoverySecret, setRecoverySecret] = useState('');
  const [action, setAction] = useState<'bypass' | 'reset_2fa' | 'get_status'>('bypass');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string; message?: string } | null>(null);

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          recoverySecret,
          action,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({ error: data.error || 'Recovery failed' });
        toast.error(data.error || 'Recovery failed');
        return;
      }

      setResult({ success: true, message: data.message });
      toast.success(data.message);

      if (action === 'bypass' && data.redirectTo) {
        // Store session
        if (data.user) {
          localStorage.setItem('lottery_session', JSON.stringify({
            ...data.user,
            displayName: data.user.username,
          }));
        }
        setTimeout(() => router.push(data.redirectTo), 1000);
      }

    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-red-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-red-500/10 border border-red-500/30 mb-4">
            <Shield className="size-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white">Super Admin Recovery</h1>
          <p className="text-neutral-400 mt-2">Emergency access when 2FA is broken</p>
        </div>

        <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleRecovery} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-neutral-400">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-12 px-4 bg-neutral-800/50 border border-neutral-700 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-red-500/50"
                placeholder="admin"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-neutral-400">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-4 bg-neutral-800/50 border border-neutral-700 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-red-500/50"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-neutral-400">Recovery Secret</label>
              <input
                type="password"
                value={recoverySecret}
                onChange={(e) => setRecoverySecret(e.target.value)}
                className="w-full h-12 px-4 bg-neutral-800/50 border border-neutral-700 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-red-500/50"
                placeholder="Contact admin for recovery secret"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-neutral-400">Action</label>
              <div className="grid grid-cols-3 gap-2">
                {(['bypass', 'reset_2fa', 'get_status'] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAction(a)}
                    className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      action === a
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-neutral-800/50 text-neutral-400 border border-neutral-700 hover:text-white'
                    }`}
                  >
                    {a === 'bypass' ? 'Login Now' : a === 'reset_2fa' ? 'Reset 2FA' : 'Check Status'}
                  </button>
                ))}
              </div>
            </div>

            {result && (
              <div className={`p-4 rounded-xl ${result.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                <div className="flex items-start gap-3">
                  {result.success ? (
                    <CheckCircle className="size-5 text-green-400 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="size-5 text-red-400 flex-shrink-0" />
                  )}
                  <p className={`text-sm ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                    {result.message || result.error}
                  </p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold hover:from-red-400 hover:to-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                'Execute Recovery'
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="text-sm text-neutral-400 hover:text-white transition-colors"
              >
                Back to Login
              </button>
            </div>
          </form>
        </div>

        <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <p className="text-amber-400 text-xs">
            <strong>Warning:</strong> This recovery mode is for emergency use only. 
            All actions are logged. Contact system administrator for the recovery secret.
          </p>
        </div>
      </div>
    </div>
  );
}
