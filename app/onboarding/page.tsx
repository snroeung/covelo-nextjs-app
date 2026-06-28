'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image, { type StaticImageData } from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { CardId } from '@/lib/points/types';

import imgChaseReserve    from '@/assets/cards/card_sapphire_reserve.webp';
import imgChasePreferred  from '@/assets/cards/chase_sapphire_preferred.jpeg';
import imgChaseFreedom    from '@/assets/cards/chase_freedom.avif';
import imgC1VentureX      from '@/assets/cards/capitalone_venture_x.avif';
import imgC1Venture       from '@/assets/cards/capitalone_venture.avif';
import imgC1Savor         from '@/assets/cards/capitalone_savor.avif';
import imgAmexPlatinum    from '@/assets/cards/amex_platinum.avif';
import imgAmexGold        from '@/assets/cards/amex_gold.avif';
import imgAmexGreen       from '@/assets/cards/amex_green.avif';
import imgBiltBlue        from '@/assets/cards/bilt_blue.webp';
import imgBiltObsidian    from '@/assets/cards/bilt_obsidian.webp';
import imgBiltPalladium   from '@/assets/cards/bilt_palladium.webp';
import imgCitiPremier     from '@/assets/cards/citi_strata_premier.webp';
import imgCitiElite       from '@/assets/cards/citi_strata_elite.png';

type Step = 'cards' | 'username';

interface OnboardingCard {
  id: CardId;
  issuer: string;
  name: string;
  annualFee: number;
  image: StaticImageData;
}

const ONBOARDING_CARDS: OnboardingCard[] = [
  { id: 'chase_reserve',           issuer: 'Chase',       name: 'Sapphire Reserve',   annualFee: 550, image: imgChaseReserve },
  { id: 'chase_preferred',         issuer: 'Chase',       name: 'Sapphire Preferred', annualFee: 95,  image: imgChasePreferred },
  { id: 'chase_freedom_unlimited', issuer: 'Chase',       name: 'Freedom Unlimited',  annualFee: 0,   image: imgChaseFreedom },
  { id: 'c1_venture_x',            issuer: 'Capital One', name: 'Venture X',          annualFee: 395, image: imgC1VentureX },
  { id: 'c1_venture',              issuer: 'Capital One', name: 'Venture',            annualFee: 95,  image: imgC1Venture },
  { id: 'c1_savor',                issuer: 'Capital One', name: 'Savor',              annualFee: 0,   image: imgC1Savor },
  { id: 'amex_platinum',           issuer: 'American Express',        name: 'Platinum',           annualFee: 695, image: imgAmexPlatinum },
  { id: 'amex_gold',               issuer: 'American Express',        name: 'Gold',               annualFee: 325, image: imgAmexGold },
  { id: 'amex_green',              issuer: 'American Express',        name: 'Green',              annualFee: 150, image: imgAmexGreen },
  { id: 'bilt_blue',               issuer: 'Bilt',        name: 'Blue',               annualFee: 0,   image: imgBiltBlue },
  { id: 'bilt_obsidian',           issuer: 'Bilt',        name: 'Obsidian',           annualFee: 95,  image: imgBiltObsidian },
  { id: 'bilt_palladium',          issuer: 'Bilt',        name: 'Palladium',          annualFee: 495, image: imgBiltPalladium },
  { id: 'citi_strata_premier',     issuer: 'Citi',        name: 'Strata Premier',     annualFee: 95,  image: imgCitiPremier },
  { id: 'citi_strata_elite',       issuer: 'Citi',        name: 'Strata Elite',       annualFee: 595, image: imgCitiElite },
];

const ISSUERS = ['All', 'Chase', 'Capital One', 'American Express', 'Bilt', 'Citi'] as const;
type Issuer = typeof ISSUERS[number];

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingForm />
    </Suspense>
  );
}

function OnboardingForm() {
  const router           = useRouter();
  const searchParams     = useSearchParams();
  const verified         = searchParams.get('verified') === '1';
  const { user, profile, loading, completeOnboarding } = useAuth();
  const { isDark }       = useTheme();

  const [step, setStep]               = useState<Step>('cards');
  const [activeIssuer, setActiveIssuer] = useState<Issuer>('All');
  const [selectedCards, setSelectedCards] = useState<CardId[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername]       = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/auth'); return; }
    if (profile?.onboarding_completed) { router.replace('/flights'); return; }
    if (profile?.display_name) setDisplayName(profile.display_name);
    if (profile?.username) setUsername(profile.username);
    else if (profile?.display_name) setUsername(profile.display_name.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20));
  }, [loading, user, profile, router]);

  const pageBg      = isDark ? 'bg-gph-dark-bg'      : 'bg-gray-50';
  const cardBg      = isDark ? 'bg-gph-dark-card'     : 'bg-white';
  const border      = isDark ? 'border-gph-dark-line' : 'border-gray-200';
  const textPrimary = isDark ? 'text-white'           : 'text-gray-900';
  const textMuted   = isDark ? 'text-gph-dark-muted'  : 'text-gray-500';
  const inputCls    = isDark
    ? 'bg-gph-dark-bg border-gph-dark-line text-white placeholder-gph-dark-muted focus:border-blue-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gray-900';
  const btnPrimary  = isDark
    ? 'bg-blue-600 hover:bg-blue-500 text-white'
    : 'bg-gray-900 hover:bg-gray-700 text-white';

  const validSelectedCount = ONBOARDING_CARDS.filter(c => selectedCards.includes(c.id)).length;

  function toggleCard(id: CardId) {
    setSelectedCards(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  }

  function validateUsername(value: string): string | null {
    if (!value) return 'Username is required.';
    if (!USERNAME_RE.test(value)) return 'Username must be 3–20 characters: letters, numbers, and underscores only.';
    return null;
  }

  async function handleFinish() {
    const err = validateUsername(username);
    if (err) { setUsernameError(err); return; }
    setSaving(true);
    try {
      const validIds = new Set(ONBOARDING_CARDS.map(c => c.id));
      const sanitized = selectedCards.filter(id => validIds.has(id));
      await completeOnboarding(sanitized, username.trim(), displayName.trim() || username.trim());
      router.push('/flights');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) {
    return <div className={`min-h-screen ${pageBg}`} />;
  }

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center px-4 py-12 ${pageBg}`}>
      {/* Logo */}
      <Link href="/" className={`text-2xl font-bold tracking-tight mb-10 ${textPrimary}`}>
        covelo<span className={textMuted}>.</span>
      </Link>

      {/* Email verified banner */}
      {verified && (
        <div className={`flex text-center gap-2.5 w-full max-w-sm mb-6 px-4 py-3 rounded-xl text-sm font-medium ${
          isDark ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          Account verified - your account is now ready to use.
        </div>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {(['cards', 'username'] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`h-2 rounded-full transition-all duration-300 ${
              step === s
                ? 'w-6 bg-lime-500'
                : i < (['cards', 'username'] as Step[]).indexOf(step)
                  ? 'w-2 bg-lime-500'
                  : `w-2 ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`
            }`}
          />
        ))}
      </div>

      {/* ── Step 1: Card selection ── */}
      {step === 'cards' && (
        <div className="w-full max-w-4xl">
          <div className="text-center mb-8">
            <h1 className={`text-2xl font-bold mb-2 ${textPrimary}`}>What cards do you have?</h1>
            <p className={`text-sm ${textMuted}`}>We'll find your best redemption value across all your cards.</p>
          </div>

          {/* Issuer filter tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-none">
            {ISSUERS.map((issuer) => {
              const active = activeIssuer === issuer;
              const issuerCount = issuer === 'All'
                ? validSelectedCount
                : ONBOARDING_CARDS.filter(c => c.issuer === issuer && selectedCards.includes(c.id)).length;
              return (
                <button
                  key={issuer}
                  type="button"
                  onClick={() => setActiveIssuer(issuer)}
                  className={[
                    'flex-none flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap',
                    active
                      ? isDark ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
                      : isDark
                        ? 'bg-gph-dark-card border border-gph-dark-line text-gph-dark-muted hover:text-white'
                        : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-900',
                  ].join(' ')}
                >
                  {issuer}
                  {issuerCount > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                      active ? 'bg-lime-500 text-white' : 'bg-lime-500 text-white'
                    }`}>
                      {issuerCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
            {ONBOARDING_CARDS.filter(c => activeIssuer === 'All' || c.issuer === activeIssuer).map((card, i) => {
              const selected = selectedCards.includes(card.id);
              return (
                <button
                  key={`${card.issuer}-${card.name}-${i}`}
                  type="button"
                  onClick={() => toggleCard(card.id)}
                  className={[
                    'relative flex flex-col rounded-2xl border-2 text-left transition-all duration-150 overflow-hidden',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2',
                    isDark ? 'bg-gph-dark-card' : 'bg-white',
                    selected
                      ? 'border-lime-500 shadow-md shadow-lime-500/10'
                      : `border-transparent hover:border-lime-500 ${isDark ? '' : 'shadow-sm hover:shadow-md hover:shadow-lime-500/10'}`,
                  ].join(' ')}
                >
                  {/* Card image */}
                  <div className="relative w-full aspect-[1.586/1] overflow-hidden rounded-t-xl">
                    <Image
                      src={card.image}
                      alt={`${card.issuer} ${card.name}`}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover"
                    />
                    {/* Selection overlay */}
                    {selected && (
                      <div className="absolute inset-0 bg-lime-500/10" />
                    )}
                  </div>

                  {/* Card details */}
                  <div className="flex flex-col px-3 pt-2.5 pb-3 gap-0.5">
                    <span className={`text-xs font-semibold leading-snug ${textPrimary}`}>
                      {card.name}
                    </span>
                    <span className={`text-[10px] font-medium ${textMuted}`}>
                      {card.annualFee === 0 ? 'No annual fee' : `$${card.annualFee}/yr`}
                    </span>
                  </div>

                  {/* Checkmark */}
                  <div className={`absolute top-2 right-2 transition-all duration-150 ${selected ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
                    <div className="w-5 h-5 rounded-full bg-lime-500 flex items-center justify-center shadow-sm">
                      <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={() => setStep('username')}
              disabled={validSelectedCount === 0}
              className={`w-full max-w-xs py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${btnPrimary}`}
            >
              {validSelectedCount > 0 ? `Continue with ${validSelectedCount} card${validSelectedCount > 1 ? 's' : ''}` : 'Select a card to continue'}
            </button>
            <button
              type="button"
              onClick={() => setStep('username')}
              className={`text-sm ${textMuted} hover:underline`}
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Username ── */}
      {step === 'username' && (
        <div className={`w-full max-w-sm rounded-2xl border p-8 ${cardBg} ${border}`}>
          <h1 className={`text-lg font-bold mb-1 ${textPrimary}`}>Set up your profile</h1>
          <p className={`text-sm mb-6 ${textMuted}`}>This is how you'll appear on shared trips and leaderboards.</p>

          <div className="flex flex-col gap-5">
            <div>
              <label className={`block text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${textMuted}`}>
                Display name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                maxLength={50}
                autoComplete="name"
                autoFocus
                className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-0 ${inputCls}`}
              />
            </div>

            <div>
              <label className={`block text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${textMuted}`}>
                Username
              </label>
              <div className="relative">
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm select-none ${textMuted}`}>@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setUsernameError(null);
                  }}
                  onBlur={() => setUsernameError(validateUsername(username))}
                  placeholder="yourname"
                  maxLength={20}
                  autoComplete="username"
                  className={`w-full pl-7 pr-3 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-0 ${inputCls} ${usernameError ? (isDark ? 'border-red-500' : 'border-red-400') : ''}`}
                />
              </div>
              {usernameError && (
                <p className={`mt-1.5 text-xs ${isDark ? 'text-red-400' : 'text-red-500'}`}>{usernameError}</p>
              )}
              <p className={`mt-1.5 text-xs ${textMuted}`}>3–20 characters · letters, numbers, underscores</p>
            </div>

            <button
              type="button"
              onClick={handleFinish}
              disabled={saving}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${btnPrimary}`}
            >
              {saving ? 'Saving…' : 'Finish setup'}
            </button>

            <button
              type="button"
              onClick={() => setStep('cards')}
              className={`text-sm font-semibold text-center ${textMuted} hover:underline`}
            >
              ← Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
