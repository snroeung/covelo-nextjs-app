'use client';

import Link from 'next/link';
import { btn } from '@/components/ui/button';

// Account CTA: tinted card with a single button to the auth page, plus an
// inline link to continue browsing (straight to search) without an account.
export function AccountCta() {
  return (
    <section id="join" className="mx-auto mb-20 max-w-[1280px] px-6 pt-20" style={{ scrollSnapAlign: 'start' }}>
      <div
        className="flex flex-wrap items-center justify-between gap-8 rounded-[18px] border border-gph-line p-12"
        style={{ background: 'color-mix(in srgb, var(--gph-accent-green) 8%, var(--gph-card))' }}
      >
        <div className="min-w-0 flex-[1_1_520px]">
          <h2 className="text-[48px] font-extrabold leading-[1.05] tracking-[-0.04em] text-gph-ink">Start getting more<br />from your points</h2>
          <p className="mt-3.5 max-w-[560px] text-[17px] leading-[1.55] text-gph-muted">Create an account to save your cards and balances, keep your saved posts and trips, and pick up where you left off on any device.</p>
        </div>
        <div className="flex w-full flex-col items-stretch gap-2.5 sm:w-auto sm:items-end">
          <Link href="/auth" className={btn('accent', 'lg', 'min-w-[200px]')}>Sign in or create account</Link>
          <Link href="/search" className="text-center text-sm font-semibold text-gph-muted underline-offset-2 hover:text-gph-ink hover:underline">
            Continue browsing without an account →
          </Link>
        </div>
      </div>
    </section>
  );
}
