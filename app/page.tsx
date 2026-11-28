'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { NavBar } from '@/components/layout/NavBar';
import { Footer } from '@/components/layout/Footer';
import { IntroScreen } from '@/components/home/IntroScreen';
import { Deck } from '@/components/home/Deck/Deck';
import { Features } from '@/components/home/Features';
import { Roadmap } from '@/components/home/Roadmap';
import { AccountCta } from '@/components/home/AccountCta';

const INTRO_KEY = 'covelo_intro_seen';

// pending: auth unknown · redirect: signed in, bouncing to /search ·
// intro: showing the intro overlay · done: intro gone, marketing page live.
type Phase = 'pending' | 'redirect' | 'intro' | 'done';

// Marketing home. Signed-out only — an authenticated visit redirects to /search.
// The intro overlay shows once per session; after it is dismissed the NavBar
// slides in, the deck starts, and the document gains vertical scroll-snap.
export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('pending');

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace('/search');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase('redirect');
      return;
    }
    const seen = typeof window !== 'undefined' && sessionStorage.getItem(INTRO_KEY);
    setPhase(seen ? 'done' : 'intro');
  }, [loading, user, router]);

  // Vertical scroll-snap once the intro is gone (not while it is up).
  useEffect(() => {
    if (phase !== 'done') return;
    const el = document.documentElement;
    el.style.scrollSnapType = 'y mandatory';
    el.style.scrollBehavior = 'smooth';
    el.style.scrollPaddingTop = '64px'; // clear the sticky NavBar on snap
    return () => {
      el.style.scrollSnapType = '';
      el.style.scrollBehavior = '';
      el.style.scrollPaddingTop = '';
    };
  }, [phase]);

  function dismissIntro() {
    try { sessionStorage.setItem(INTRO_KEY, '1'); } catch { /* private mode */ }
    setPhase('done');
    window.scrollTo(0, 0);
  }

  // Auth still unknown, or an authenticated user mid-redirect: hold a blank
  // surface so the marketing page never flashes before the redirect.
  if (phase === 'pending' || phase === 'redirect') {
    return <div className="min-h-dvh bg-gph-bg" aria-hidden="true" />;
  }

  const done = phase === 'done';

  return (
    <div className="min-h-dvh bg-gph-bg text-gph-ink">
      {phase === 'intro' && <IntroScreen onDismiss={dismissIntro} />}

      {/* NavBar is hidden until the intro is dismissed, then slides in and
          stays sticky at the top while the page scrolls. */}
      <div className={done ? 'cv-nav-in sticky top-0 z-40' : ''} style={done ? undefined : { visibility: 'hidden' }}>
        <NavBar />
      </div>

      <main id="top">
        <h1 className="sr-only">Covelo — compare flights and hotels in cash and points across every travel portal</h1>
        <Deck active={done} />
        <Features />
        <Roadmap />
        <AccountCta />
        <div style={{ scrollSnapAlign: 'end' }}>
          <Footer />
        </div>
      </main>
    </div>
  );
}
