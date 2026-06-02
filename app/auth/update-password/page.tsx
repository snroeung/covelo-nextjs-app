'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useTheme } from '@/contexts/ThemeContext';

export default function UpdatePasswordPage() {
  const { isDark } = useTheme();
  const router     = useRouter();

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);

  const pageBg      = isDark ? 'bg-gph-dark-bg'      : 'bg-gray-50';
  const cardBg      = isDark ? 'bg-gph-dark-card'     : 'bg-white';
  const border      = isDark ? 'border-gph-dark-line' : 'border-gray-200';
  const textPrimary = isDark ? 'text-white'           : 'text-gray-900';
  const textMuted   = isDark ? 'text-gph-dark-muted'  : 'text-gray-500';
  const inputCls    = isDark
    ? 'bg-gph-dark-bg border-gph-dark-line text-white placeholder-gph-dark-muted focus:border-blue-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gray-900';
  const btnCls = isDark
    ? 'bg-blue-600 hover:bg-blue-500 text-white'
    : 'bg-gray-900 hover:bg-gray-700 text-white';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.push('/flights');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center px-4 ${pageBg}`}>
      <Link href="/" className={`text-2xl font-bold tracking-tight mb-8 ${textPrimary}`}>
        covelo<span className={textMuted}>.</span>
      </Link>

      <div className={`w-full max-w-sm rounded-2xl border p-8 ${cardBg} ${border}`}>
        <h1 className={`text-lg font-bold mb-1 ${textPrimary}`}>Choose a new password</h1>
        <p className={`text-sm mb-6 ${textMuted}`}>Must be at least 8 characters.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className={`block text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${textMuted}`}>
              New password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
              className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-0 ${inputCls}`}
            />
          </div>

          <div>
            <label className={`block text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${textMuted}`}>
              Confirm password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your new password"
              required
              minLength={8}
              autoComplete="new-password"
              className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-0 ${inputCls}`}
            />
          </div>

          {error && (
            <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
              <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 3.5a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4.5zm0 7a.875.875 0 1 1 0-1.75A.875.875 0 0 1 8 11.5z"/>
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`mt-1 w-full py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${btnCls}`}
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
