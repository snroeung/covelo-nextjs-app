'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useTheme } from '@/contexts/ThemeContext';

type Mode = 'signin' | 'signup';
type View = 'form' | 'confirm' | 'magic-sent' | 'forgot' | 'reset-sent';

export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}

function AuthForm() {
  const { isDark }    = useTheme();
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const callbackError = searchParams.get('error');

  const [mode, setMode]               = useState<Mode>('signup');
  const [view, setView]               = useState<View>('form');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError]             = useState<string | null>(
    callbackError ? 'Your confirmation link expired or was already used. Please sign up again.' : null
  );
  const [loading, setLoading] = useState(false);

  // Theme tokens
  const pageBg      = isDark ? 'bg-gph-dark-bg'       : 'bg-gray-50';
  const cardBg      = isDark ? 'bg-gph-dark-card'      : 'bg-white';
  const border      = isDark ? 'border-gph-dark-line'  : 'border-gray-200';
  const textPrimary = isDark ? 'text-white'            : 'text-gray-900';
  const textMuted   = isDark ? 'text-gph-dark-muted'   : 'text-gray-500';
  const inputCls    = isDark
    ? 'bg-gph-dark-bg border-gph-dark-line text-white placeholder-gph-dark-muted focus:border-blue-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gray-900';
  const btnCls      = isDark
    ? 'bg-blue-600 hover:bg-blue-500 text-white'
    : 'bg-gray-900 hover:bg-gray-700 text-white';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName || email.split('@')[0] },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setView('confirm');
      } else {
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', data.user.id)
          .single();
        router.push(profile?.onboarding_completed ? '/flights' : '/onboarding');
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  async function handleMagicLink() {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setView('magic-sent');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
      });
      if (error) throw error;
      setView('reset-sent');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Forgot password screen ───────────────────────────────────────────────
  if (view === 'forgot') {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center px-4 ${pageBg}`}>
        <Link href="/" className={`text-2xl font-bold tracking-tight mb-8 ${textPrimary}`}>
          covelo<span className={textMuted}>.</span>
        </Link>
        <div className={`w-full max-w-sm rounded-2xl border p-8 ${cardBg} ${border}`}>
          <h1 className={`text-lg font-bold mb-1 ${textPrimary}`}>Reset your password</h1>
          <p className={`text-sm mb-6 ${textMuted}`}>We&apos;ll send a reset link to your email.</p>

          <div className="flex flex-col gap-4">
            <div>
              <label className={`block text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${textMuted}`}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
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
              type="button"
              onClick={handleResetPassword}
              disabled={loading}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${btnCls}`}
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>

            <button
              type="button"
              onClick={() => { setView('form'); setMode('signin'); setError(null); }}
              className={`text-sm font-semibold ${textMuted} hover:underline`}
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Reset link sent screen ───────────────────────────────────────────────
  if (view === 'reset-sent') {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center px-4 ${pageBg}`}>
        <div className={`w-full max-w-sm rounded-2xl border p-8 text-center ${cardBg} ${border}`}>
          <div className={`mx-auto mb-5 w-14 h-14 rounded-full flex items-center justify-center ${isDark ? 'bg-blue-600/15' : 'bg-blue-50'}`}>
            <svg className="w-7 h-7 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M2 7l10 7 10-7"/>
            </svg>
          </div>

          <h1 className={`text-lg font-bold mb-2 ${textPrimary}`}>Check your inbox</h1>
          <p className={`text-sm mb-1 ${textMuted}`}>We sent a password reset link to</p>
          <p className={`text-sm font-semibold mb-6 ${textPrimary}`}>{email}</p>

          <p className={`text-xs mb-6 ${textMuted}`}>
            Click the link in the email to choose a new password. It expires in 60 minutes — check your spam folder if you don&apos;t see it.
          </p>

          <div className={`pt-5 border-t ${border}`}>
            <button
              onClick={() => { setView('form'); setMode('signin'); }}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${btnCls}`}
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Magic link sent screen ───────────────────────────────────────────────
  if (view === 'magic-sent') {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center px-4 ${pageBg}`}>
        <div className={`w-full max-w-sm rounded-2xl border p-8 text-center ${cardBg} ${border}`}>
          <div className={`mx-auto mb-5 w-14 h-14 rounded-full flex items-center justify-center ${isDark ? 'bg-blue-600/15' : 'bg-blue-50'}`}>
            <svg className="w-7 h-7 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M2 7l10 7 10-7"/>
            </svg>
          </div>

          <h1 className={`text-lg font-bold mb-2 ${textPrimary}`}>Check your inbox</h1>
          <p className={`text-sm mb-1 ${textMuted}`}>We sent a one-time sign-in link to</p>
          <p className={`text-sm font-semibold mb-6 ${textPrimary}`}>{email}</p>

          <p className={`text-xs mb-6 ${textMuted}`}>
            Click the link in the email to sign in instantly — no password needed. It expires in 60 minutes. Check your spam folder if you don&apos;t see it.
          </p>

          <div className={`pt-5 border-t ${border}`}>
            <button
              onClick={() => { setView('form'); setMode('signin'); }}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${btnCls}`}
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Email confirmation screen ────────────────────────────────────────────
  if (view === 'confirm') {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center px-4 ${pageBg}`}>
        <div className={`w-full max-w-sm rounded-2xl border p-8 text-center ${cardBg} ${border}`}>
          {/* Mail icon */}
          <div className={`mx-auto mb-5 w-14 h-14 rounded-full flex items-center justify-center ${isDark ? 'bg-blue-600/15' : 'bg-blue-50'}`}>
            <svg className="w-7 h-7 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M2 7l10 7 10-7"/>
            </svg>
          </div>

          <h1 className={`text-lg font-bold mb-2 ${textPrimary}`}>Check your inbox</h1>
          <p className={`text-sm mb-1 ${textMuted}`}>
            We sent a confirmation link to
          </p>
          <p className={`text-sm font-semibold mb-6 ${textPrimary}`}>{email}</p>

          <p className={`text-xs mb-6 ${textMuted}`}>
            Click the link in the email to activate your account. It may take a minute to arrive — check your spam folder if you don&apos;t see it.
          </p>

          <div className={`pt-5 border-t ${border}`}>
            <button
              onClick={() => { setView('form'); setMode('signin'); setPassword(''); }}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${btnCls}`}
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Sign in / Sign up form ───────────────────────────────────────────────
  return (
    <div className={`min-h-screen flex flex-col items-center justify-center px-4 ${pageBg}`}>
      {/* Logo */}
      <Link href="/" className={`text-2xl font-bold tracking-tight mb-8 ${textPrimary}`}>
        covelo<span className={textMuted}>.</span>
      </Link>

      <div className={`w-full max-w-sm rounded-2xl border p-8 ${cardBg} ${border}`}>
        {/* Mode tabs */}
        <div className={`flex rounded-lg p-1 mb-6 ${isDark ? 'bg-gph-dark-bg' : 'bg-gray-100'}`}>
          {(['signup', 'signin'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); }}
              className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                mode === m
                  ? `bg-white text-gray-900 shadow-sm`
                  : textMuted
              }`}
            >
              {m === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 mb-2">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50 ${
              isDark
                ? 'border-gph-dark-line text-white hover:bg-gph-dark-bg'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg viewBox="0 0 48 48" width="16" height="16" aria-hidden="true">
              <path fill="#4285F4" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6 8-11.3 8a12 12 0 1 1 0-24c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 24 44c11 0 20-8.9 20-20 0-1.2-.1-2.3-.4-3.5z"/>
              <path fill="#34A853" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/>
              <path fill="#FBBC05" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2c-2 1.4-4.6 2.4-7.3 2.4-5.3 0-9.7-3.3-11.3-8l-6.5 5A20 20 0 0 0 24 44z"/>
              <path fill="#EA4335" d="M43.6 20.5H24v8h11.3a12 12 0 0 1-4 5.1l6.3 5.2C41.4 35.9 44 30.5 44 24c0-1.2-.1-2.3-.4-3.5z"/>
            </svg>
            {loading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          <div className="flex items-center gap-3">
            <div className={`flex-1 h-px ${isDark ? 'bg-gph-dark-line' : 'bg-gray-200'}`} />
            <span className={`text-xs ${textMuted}`}>or</span>
            <div className={`flex-1 h-px ${isDark ? 'bg-gph-dark-line' : 'bg-gray-200'}`} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'signup' && (
            <div>
              <label className={`block text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${textMuted}`}>
                Display name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-0 ${inputCls}`}
              />
            </div>
          )}

          <div>
            <label className={`block text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${textMuted}`}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-0 ${inputCls}`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`block text-[10px] font-semibold uppercase tracking-widest ${textMuted}`}>
                Password
              </label>
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => { setView('forgot'); setError(null); }}
                  className={`text-[10px] font-semibold uppercase tracking-widest ${textMuted} hover:underline`}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
              required
              minLength={8}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
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
            {loading
              ? (mode === 'signup' ? 'Creating account…' : 'Signing in…')
              : (mode === 'signup' ? 'Create account' : 'Sign in')}
          </button>

          {mode === 'signin' && (
            <>
              <div className="flex items-center gap-3">
                <div className={`flex-1 h-px ${isDark ? 'bg-gph-dark-line' : 'bg-gray-200'}`} />
                <span className={`text-xs ${textMuted}`}>or</span>
                <div className={`flex-1 h-px ${isDark ? 'bg-gph-dark-line' : 'bg-gray-200'}`} />
              </div>
              <button
                type="button"
                onClick={handleMagicLink}
                disabled={loading}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50 ${
                  isDark
                    ? 'border-gph-dark-line text-white hover:bg-gph-dark-bg'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Send a one-time link
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
