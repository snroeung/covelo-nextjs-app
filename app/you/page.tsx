'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NavBar } from '@/components/layout/NavBar';
import { Footer } from '@/components/layout/Footer';
import { btn } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedCards } from '@/contexts/SelectedCardsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';

// Estimate shown in the sidebar balance summary (CLAUDE.md: ~1.25¢/pt)
const CENTS_PER_POINT = 1.25;

const label = 'font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-gph-muted';
const rowCls = 'flex min-h-14 items-center gap-3 px-4 text-[14.5px] font-bold text-gph-ink border-t border-gph-linesoft first:border-t-0 hover:bg-gph-linesoft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gph-ink';

function Chevron() {
  return <span aria-hidden="true" className="ml-auto text-gph-muted">›</span>;
}

export default function YouPage() {
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const { selectedCards, cardBalances } = useSelectedCards();
  const { isDark, toggleTheme } = useTheme();
  const isAdmin = useIsAdmin();

  const total = selectedCards.reduce((sum, id) => sum + (cardBalances[id] ?? 0), 0);
  const dollars = Math.round((total * CENTS_PER_POINT) / 100);
  const name = profile?.display_name || 'Traveler';
  const initials = profile?.display_name
    ? profile.display_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  async function handleSignOut() {
    await signOut();
    router.push('/');
  }

  return (
    <div className="flex min-h-dvh flex-col bg-gph-bg">
      <NavBar />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-5 md:py-10">
        <h1 className="sr-only">You</h1>

        {loading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-gph-linesoft" />
        ) : !user ? (
          <section aria-label="Sign in" className="flex flex-col gap-3 rounded-2xl border border-gph-line bg-gph-card p-5">
            <span className={label}>Your account</span>
            <h2 className="text-2xl font-extrabold leading-tight tracking-tight text-gph-ink">Sign in to keep your wallet</h2>
            <p className="text-sm text-gph-muted">Save your cards and balances so every search ranks by what you can actually spend.</p>
            <Link href="/auth" className={btn('accent', 'lg', 'sm:w-full!')}>Sign in or create account</Link>
          </section>
        ) : (
          <div className="flex flex-col gap-5">
            <section aria-label="Profile" className="flex items-center gap-3.5 rounded-2xl border border-gph-line bg-gph-card p-4">
              <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-full bg-cv-green-800 text-lg font-extrabold text-white">{initials}</span>
              <div className="min-w-0">
                <p className="truncate text-xl font-extrabold tracking-tight text-gph-ink">{name}</p>
                <p className="truncate text-xs text-gph-muted">{user.email}</p>
              </div>
            </section>

            <section aria-label="Points balance" className="flex flex-col gap-1.5 rounded-2xl bg-cv-navy-950 p-4">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-cv-navy-300">Total balance</span>
              <p className="font-mono text-3xl font-bold tracking-tight text-cv-lime-500" data-testid="you-balance">{total.toLocaleString()}</p>
              <p className="font-mono text-[11px] text-cv-navy-300">
                PTS · {selectedCards.length} {selectedCards.length === 1 ? 'CARD' : 'CARDS'} · ≈ ${dollars.toLocaleString()} AT {CENTS_PER_POINT}¢
              </p>
            </section>

            <section aria-label="Account" className="flex flex-col gap-2">
              <h2 className={`px-1 ${label}`}>Account</h2>
              <div className="overflow-hidden rounded-2xl border border-gph-line bg-gph-card">
                <Link href="/settings" className={rowCls}>Settings<Chevron /></Link>
                {isAdmin && <Link href="/admin" className={rowCls}>Admin<Chevron /></Link>}
              </div>
            </section>
          </div>
        )}

        <section aria-label="Appearance" className="mt-5 flex flex-col gap-2">
          <h2 className={`px-1 ${label}`}>Appearance</h2>
          <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-gph-line bg-gph-card px-4 py-2">
            <span className="text-[14.5px] font-bold text-gph-ink">Theme</span>
            <div role="group" aria-label="Theme" className="ml-auto grid grid-cols-2 gap-[3px] rounded-lg bg-gph-bg p-[3px]">
              {([['Light', false], ['Dark', true]] as const).map(([text, dark]) => (
                <button
                  key={text}
                  type="button"
                  aria-pressed={isDark === dark}
                  onClick={() => { if (isDark !== dark) toggleTheme(); }}
                  className={`min-h-11 rounded-md px-4 text-xs font-extrabold focus-visible:outline-2 focus-visible:outline-gph-ink ${
                    isDark === dark ? 'bg-gph-card text-gph-ink shadow-[0_0_0_1px_var(--gph-line)]' : 'text-gph-muted'
                  }`}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        </section>

        {user && (
          <button type="button" onClick={handleSignOut} className={btn('secondary', 'lg', 'mt-5 sm:w-full!')}>Sign out</button>
        )}
      </main>
      <Footer />
    </div>
  );
}
