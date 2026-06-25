'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { NavBar } from '@/components/NavBar';

export default function SettingsPage() {
  const { isDark } = useTheme();
  const { user, profile, updateProfile } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [nameSaving, setNameSaving]   = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError]     = useState<string | null>(null);

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError]     = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? '');
  }, [profile]);

  const pageBg      = isDark ? 'bg-gph-dark-bg'       : 'bg-gray-50';
  const cardBg      = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const textPrimary = isDark ? 'text-white'            : 'text-gray-900';
  const textMuted   = isDark ? 'text-gph-dark-muted'   : 'text-gray-500';
  const inputCls    = isDark
    ? 'bg-gph-dark-bg border-gph-dark-line text-white placeholder-gph-dark-muted focus:border-blue-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gray-900';
  const btnCls = isDark
    ? 'bg-blue-600 hover:bg-blue-500 text-white'
    : 'bg-gray-900 hover:bg-gray-700 text-white';
  const labelCls = `text-[10px] font-semibold uppercase tracking-widest ${textMuted}`;

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setNameError(null);
    setNameSuccess(false);
    setNameSaving(true);
    try {
      await updateProfile({ display_name: displayName || null });
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (err: unknown) {
      setNameError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setNameSaving(false);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setPwError('Passwords do not match.');
      return;
    }
    setPwError(null);
    setPwSuccess(false);
    setPwLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPwSuccess(true);
      setPassword('');
      setConfirm('');
      setTimeout(() => setPwSuccess(false), 4000);
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className={`min-h-screen flex flex-col ${pageBg}`}>
      <NavBar />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-8 md:py-12 flex flex-col gap-6">
        <div>
          <h1 className={`text-xl font-bold ${textPrimary}`}>Account Settings</h1>
          <p className={`text-sm mt-1 ${textMuted}`}>Manage your profile and security preferences.</p>
        </div>

        {/* Profile */}
        <section className={`rounded-2xl border p-6 flex flex-col gap-5 ${cardBg}`}>
          <h2 className={`text-sm font-bold ${textPrimary}`}>Profile</h2>

          <div>
            <p className={`mb-1 ${labelCls}`}>Email</p>
            <p className={`text-sm ${textMuted}`}>{user?.email ?? '—'}</p>
          </div>

          <form onSubmit={handleSaveName} className="flex flex-col gap-4">
            <div>
              <label className={`block mb-1.5 ${labelCls}`}>Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-0 ${inputCls}`}
              />
            </div>

            {nameError   && <StatusBanner type="error"   isDark={isDark} message={nameError} />}
            {nameSuccess && <StatusBanner type="success" isDark={isDark} message="Display name updated." />}

            <div>
              <button
                type="submit"
                disabled={nameSaving}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${btnCls}`}
              >
                {nameSaving ? 'Saving…' : 'Save name'}
              </button>
            </div>
          </form>
        </section>

        {/* Security */}
        <section className={`rounded-2xl border p-6 flex flex-col gap-5 ${cardBg}`}>
          <h2 className={`text-sm font-bold ${textPrimary}`}>Security</h2>

          <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
            <div>
              <label className={`block mb-1.5 ${labelCls}`}>New password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
                className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-0 ${inputCls}`}
              />
            </div>

            <div>
              <label className={`block mb-1.5 ${labelCls}`}>Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat your new password"
                required
                minLength={8}
                autoComplete="new-password"
                className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-0 ${inputCls}`}
              />
            </div>

            {pwError   && <StatusBanner type="error"   isDark={isDark} message={pwError} />}
            {pwSuccess && <StatusBanner type="success" isDark={isDark} message="Password updated successfully." />}

            <div>
              <button
                type="submit"
                disabled={pwLoading}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${btnCls}`}
              >
                {pwLoading ? 'Updating…' : 'Update password'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

function StatusBanner({ type, isDark, message }: { type: 'error' | 'success'; isDark: boolean; message: string }) {
  const isError = type === 'error';
  const cls = isError
    ? isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'
    : isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-700';

  return (
    <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${cls}`}>
      {isError ? (
        <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 3.5a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4.5zm0 7a.875.875 0 1 1 0-1.75A.875.875 0 0 1 8 11.5z"/>
        </svg>
      ) : (
        <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm3.54 5.15a.75.75 0 0 0-1.08-1.04l-3 3.12-1.22-1.27a.75.75 0 0 0-1.08 1.04l1.75 1.82a.75.75 0 0 0 1.08 0l3.55-3.67z"/>
        </svg>
      )}
      {message}
    </div>
  );
}
