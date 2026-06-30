'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import { CARD_NAMES, type CardId } from '@/lib/points/types';
import { CARD_IMAGES } from '@/lib/cardImages';
import type { SponsoredAd } from '@/lib/types/offers';

const ISSUER_NAMES: Record<string, string> = {
  chase: 'Chase',
  amex:  'American Express',
  c1:    'Capital One',
  bilt:  'Bilt',
  citi:  'Citi',
};

const ISSUER_CARDS: Record<string, CardId[]> = {
  chase: ['chase_reserve', 'chase_preferred', 'chase_freedom_unlimited'],
  amex:  ['amex_platinum', 'amex_gold', 'amex_green'],
  c1:    ['c1_venture_x', 'c1_venture', 'c1_savor'],
  bilt:  ['bilt_blue', 'bilt_obsidian', 'bilt_palladium'],
  citi:  ['citi_strata_premier', 'citi_strata_elite'],
};


function reverseCardLookup(product: string): { issuer: string; cardId: string } {
  const entry = (Object.entries(CARD_NAMES) as [CardId, string][]).find(([, name]) => name === product);
  if (!entry) return { issuer: 'other', cardId: 'other' };
  const cardId = entry[0];
  const issuerEntry = Object.entries(ISSUER_CARDS).find(([, cards]) => (cards as string[]).includes(cardId));
  return { issuer: issuerEntry?.[0] ?? 'other', cardId };
}

interface Props {
  ad?: SponsoredAd;
  onSave: () => void;
  onCancel: () => void;
  isDark: boolean;
}

interface FormState {
  card_issuer: string;
  card_id_key: string;
  partner:     string;
  product:     string;
  headline:    string;
  subheadline: string;
  bullets:     string[];
  cta_label:   string;
  cta_url:     string;
  tracking_id: string;
  disclosure:  string;
  tone:        string;
  active:      boolean;
  country:     string;
  start_date:  string;
  end_date:    string;
}

function defaultForm(ad?: SponsoredAd): FormState {
  const { issuer, cardId } = ad?.product ? reverseCardLookup(ad.product) : { issuer: '', cardId: '' };
  return {
    card_issuer: issuer,
    card_id_key: cardId,
    partner:     ad?.partner     ?? '',
    product:     ad?.product     ?? '',
    headline:    ad?.headline    ?? '',
    subheadline: ad?.subheadline ?? '',
    bullets:     ad?.bullets     ?? [''],
    cta_label:   ad?.cta_label   ?? 'Apply now',
    cta_url:     ad?.cta_url     ?? '',
    tracking_id: ad?.tracking_id ?? '',
    disclosure:  ad?.disclosure  ?? 'Advertiser disclosure · Covelo may receive compensation when you apply. Terms apply.',
    tone:        ad?.tone        ?? 'neutral',
    active:      ad?.active      ?? true,
    country:     ad?.country     ?? 'US',
    start_date:  ad?.start_date  ?? '',
    end_date:    ad?.end_date    ?? '',
  };
}

function LabelCls(isDark: boolean) {
  return `text-[10px] font-mono font-bold tracking-widest ${isDark ? 'text-gph-dark-muted' : 'text-gray-500'}`;
}

function InputCls(isDark: boolean) {
  return `w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors ${
    isDark
      ? 'bg-gph-dark-bg border-gph-dark-line text-gph-dark-ink placeholder-gph-dark-muted focus:border-blue-500'
      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
  }`;
}

export function AdminAdEditor({ ad, onSave, onCancel, isDark }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => defaultForm(ad));
  const [error, setError] = useState<string | null>(null);

  const card    = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const ink     = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted   = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const line    = isDark ? 'border-gph-dark-line' : 'border-gray-200';
  const subBg   = isDark ? 'bg-gph-dark-bg' : 'bg-gray-50';

  const labelCls = LabelCls(isDark);
  const inputCls = InputCls(isDark);

  const cardImage = form.card_id_key && form.card_id_key !== 'other'
    ? CARD_IMAGES[form.card_id_key as CardId] ?? null
    : null;

  const { mutate: createAd, isPending: creating } = useMutation({
    mutationFn: () => trpc.offers.admin.createAd.mutate({
      partner:     form.partner,
      product:     form.product,
      slot:        'below_grid',
      headline:    form.headline,
      subheadline: form.subheadline || null,
      bullets:     form.bullets.filter(Boolean),
      cta_label:   form.cta_label,
      cta_url:     form.cta_url,
      tracking_id: form.tracking_id,
      disclosure:  form.disclosure,
      tone:        form.tone,
      image_url:   null,
      active:      form.active,
      country:     form.country,
      start_date:  form.start_date || null,
      end_date:    form.end_date   || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers.admin.listAds'] });
      queryClient.removeQueries({ queryKey: ['offers.featuredAd'] });
      onSave();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Save failed'),
  });

  const { mutate: updateAd, isPending: updating } = useMutation({
    mutationFn: () => trpc.offers.admin.updateAd.mutate({
      id:          ad!.id,
      partner:     form.partner,
      product:     form.product,
      image_url:   null,
      headline:    form.headline,
      subheadline: form.subheadline || null,
      bullets:     form.bullets.filter(Boolean),
      cta_label:   form.cta_label,
      cta_url:     form.cta_url,
      tracking_id: form.tracking_id,
      disclosure:  form.disclosure,
      tone:        form.tone,
      active:      form.active,
      country:     form.country,
      start_date:  form.start_date || null,
      end_date:    form.end_date   || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers.admin.listAds'] });
      queryClient.removeQueries({ queryKey: ['offers.featuredAd'] });
      onSave();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Save failed'),
  });

  const isPending = creating || updating;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setBullet(i: number, value: string) {
    const next = [...form.bullets];
    next[i] = value;
    setForm((prev) => ({ ...prev, bullets: next }));
  }

  function handleIssuerChange(issuer: string) {
    if (issuer === 'other') {
      setForm((prev) => ({ ...prev, card_issuer: 'other', card_id_key: 'other', partner: '', product: '' }));
    } else {
      setForm((prev) => ({ ...prev, card_issuer: issuer, card_id_key: '', partner: ISSUER_NAMES[issuer] ?? '', product: '' }));
    }
  }

  function handleCardChange(cardId: string) {
    if (cardId === 'other') {
      setForm((prev) => ({ ...prev, card_id_key: 'other', product: '' }));
    } else {
      const name = CARD_NAMES[cardId as CardId] ?? '';
      setForm((prev) => ({ ...prev, card_id_key: cardId, product: name }));
    }
  }

  const checks = [
    { label: 'Sponsored tag will be visible',          ok: true },
    { label: 'Disclosure text present',                ok: form.disclosure.trim().length > 0 },
    { label: 'CTA URL is a valid URL',                 ok: /^https?:\/\/.+/.test(form.cta_url) },
    { label: 'Tracking ID set',                        ok: form.tracking_id.trim().length > 0 },
    { label: 'Headline under 80 chars',                ok: form.headline.length <= 80 },
  ];

  const REQUIRED_FIELDS: { key: keyof FormState; label: string; valid: (v: FormState) => boolean }[] = [
    { key: 'product',     label: 'Card name',       valid: (f) => f.product.trim().length > 0 },
    { key: 'headline',    label: 'Headline',        valid: (f) => f.headline.trim().length > 0 && f.headline.length <= 80 },
    { key: 'cta_url',     label: 'Destination URL', valid: (f) => /^https?:\/\/.+/.test(f.cta_url) },
    { key: 'tracking_id', label: 'Tracking ID',     valid: (f) => f.tracking_id.trim().length > 0 },
    { key: 'disclosure',  label: 'Disclosure',      valid: (f) => f.disclosure.trim().length > 0 },
  ];

  function validate(): string | null {
    const missing = REQUIRED_FIELDS.filter((f) => !f.valid(form)).map((f) => f.label);
    if (missing.length === 0) return null;
    return `Missing required fields: ${missing.join(', ')}`;
  }

  function handleSubmit() {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setError(null);
    ad ? updateAd() : createAd();
  }

  const availableCards = form.card_issuer && form.card_issuer !== 'other'
    ? ISSUER_CARDS[form.card_issuer] ?? []
    : [];

  return (
    <div className={`rounded-xl border overflow-hidden ${card}`}>
      <div className={`flex items-center justify-between px-5 py-4 border-b ${line}`}>
        <div>
          <div className={`text-[10px] font-mono font-bold tracking-widest mb-1 ${muted}`}>
            {ad ? 'EDIT SPONSORED AD' : 'NEW SPONSORED AD'}
          </div>
          <h3 className={`text-lg font-bold ${ink}`}>
            {ad ? ad.headline : 'Create a new ad placement'}
          </h3>
        </div>
        <button
          onClick={onCancel}
          className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${
            isDark ? 'text-gph-dark-muted hover:text-gph-dark-ink hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          Cancel
        </button>
      </div>

      <div className="grid md:grid-cols-[1.2fr_1fr]">
        {/* Form */}
        <div className={`p-5 md:p-6 flex flex-col gap-5 border-r ${line}`}>
          {/* 1. Identity */}
          <section>
            <div className={`mb-3 ${labelCls}`}>1 · PARTNER & PRODUCT</div>
            <div className="flex flex-col gap-3">
              {/* Card issuer dropdown */}
              <div>
                <label className={`block mb-1.5 ${labelCls}`}>CARD ISSUER</label>
                <select
                  className={inputCls}
                  value={form.card_issuer}
                  onChange={(e) => handleIssuerChange(e.target.value)}
                >
                  <option value="">Select issuer…</option>
                  {Object.entries(ISSUER_NAMES).map(([key, name]) => (
                    <option key={key} value={key}>{name}</option>
                  ))}
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Card name: dropdown when issuer known, text inputs when "other" */}
              {form.card_issuer === 'other' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block mb-1.5 ${labelCls}`}>PARTNER</label>
                    <input
                      className={inputCls}
                      value={form.partner}
                      onChange={(e) => set('partner', e.target.value)}
                      placeholder="e.g. Discover"
                    />
                  </div>
                  <div>
                    <label className={`block mb-1.5 ${labelCls}`}>CARD NAME</label>
                    <input
                      className={inputCls}
                      value={form.product}
                      onChange={(e) => set('product', e.target.value)}
                      placeholder="e.g. it® Cash Back"
                    />
                  </div>
                </div>
              ) : form.card_issuer ? (
                <div>
                  <label className={`block mb-1.5 ${labelCls}`}>CARD NAME</label>
                  <select
                    className={inputCls}
                    value={form.card_id_key}
                    onChange={(e) => handleCardChange(e.target.value)}
                  >
                    <option value="">Select card…</option>
                    {availableCards.map((id) => (
                      <option key={id} value={id}>{CARD_NAMES[id]}</option>
                    ))}
                    <option value="other">Other</option>
                  </select>
                  {form.card_id_key === 'other' && (
                    <input
                      className={`${inputCls} mt-2`}
                      value={form.product}
                      onChange={(e) => set('product', e.target.value)}
                      placeholder="Enter card name…"
                    />
                  )}
                </div>
              ) : null}

              <div>
                <label className={`block mb-1.5 ${labelCls}`}>TONE</label>
                <select className={inputCls} value={form.tone} onChange={(e) => set('tone', e.target.value)}>
                  {['neutral', 'premium', 'aspirational', 'value'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* 2. Creative */}
          <section>
            <div className={`mb-3 ${labelCls}`}>2 · CREATIVE</div>
            <div className="flex flex-col gap-3">
              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <label className={labelCls}>HEADLINE</label>
                  <span className={`text-[10px] font-mono ${form.headline.length > 80 ? 'text-red-500' : muted}`}>
                    {form.headline.length}/80
                  </span>
                </div>
                <input className={inputCls} value={form.headline} onChange={(e) => set('headline', e.target.value)} placeholder="60,000 bonus points + $50 hotel credit" />
              </div>
              <div>
                <label className={`block mb-1.5 ${labelCls}`}>SUBHEADLINE</label>
                <textarea
                  rows={2}
                  className={inputCls}
                  value={form.subheadline}
                  onChange={(e) => set('subheadline', e.target.value)}
                  placeholder="After $4,000 spend in your first 3 months…"
                />
              </div>
              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <label className={labelCls}>BULLET POINTS</label>
                  <button
                    onClick={() => setForm((p) => ({ ...p, bullets: [...p.bullets, ''] }))}
                    className={`text-[10px] font-mono font-bold ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
                  >
                    + Add
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  {form.bullets.map((b, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        className={inputCls}
                        value={b}
                        onChange={(e) => setBullet(i, e.target.value)}
                        placeholder={`Bullet ${i + 1}`}
                      />
                      {form.bullets.length > 1 && (
                        <button
                          onClick={() => setForm((p) => ({ ...p, bullets: p.bullets.filter((_, j) => j !== i) }))}
                          className={`shrink-0 text-sm ${isDark ? 'text-gph-dark-muted hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 3. CTA & Tracking */}
          <section>
            <div className={`mb-3 ${labelCls}`}>3 · CTA & TRACKING</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block mb-1.5 ${labelCls}`}>CTA LABEL</label>
                <input className={inputCls} value={form.cta_label} onChange={(e) => set('cta_label', e.target.value)} placeholder="Apply now" />
              </div>
              <div>
                <label className={`block mb-1.5 ${labelCls}`}>TRACKING ID</label>
                <input className={`${inputCls} font-mono`} value={form.tracking_id} onChange={(e) => set('tracking_id', e.target.value)} placeholder="covelo-CSP-2026Q2" />
              </div>
              <div className="col-span-2">
                <label className={`block mb-1.5 ${labelCls}`}>DESTINATION URL</label>
                <input className={`${inputCls} font-mono text-xs`} value={form.cta_url} onChange={(e) => set('cta_url', e.target.value)} placeholder="https://…" />
              </div>
              <div className="col-span-2">
                <label className={`block mb-1.5 ${labelCls}`}>DISCLOSURE</label>
                <textarea rows={2} className={inputCls} value={form.disclosure} onChange={(e) => set('disclosure', e.target.value)} />
              </div>
            </div>
          </section>

          {/* 4. Schedule & Targeting */}
          <section>
            <div className={`mb-3 ${labelCls}`}>4 · SCHEDULE & TARGETING</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block mb-1.5 ${labelCls}`}>START DATE</label>
                <input type="date" className={inputCls} value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
              </div>
              <div>
                <label className={`block mb-1.5 ${labelCls}`}>END DATE</label>
                <input type="date" className={inputCls} value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={`block mb-1.5 ${labelCls}`}>COUNTRY / REGION</label>
                <select className={inputCls} value={form.country} onChange={(e) => set('country', e.target.value)}>
                  <option value="US">United States</option>
                  <option value="Global">Global</option>
                  <option value="CA">Canada</option>
                  <option value="GB">United Kingdom</option>
                  <option value="AU">Australia</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                onClick={() => set('active', !form.active)}
                className={`relative w-9 h-5 rounded-full transition-colors ${form.active ? 'bg-green-500' : isDark ? 'bg-gph-dark-line' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <span className={`text-sm font-semibold ${ink}`}>
                {form.active ? 'Active — visible to users' : 'Inactive — hidden from users'}
              </span>
            </div>
          </section>

          {error && (
            <div role="alert" className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
              isDark
                ? 'border-red-800 bg-red-950/40 text-red-300'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}>
              <span className="mt-0.5 text-base leading-none">⚠</span>
              <p className="flex-1 font-semibold">{error}</p>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-current opacity-60 hover:opacity-100"
                aria-label="Dismiss"
              >✕</button>
            </div>
          )}

          <div className={`flex items-center justify-end gap-3 pt-4 border-t ${line}`}>
            <button onClick={onCancel} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${isDark ? 'text-gph-dark-muted hover:text-gph-dark-ink' : 'text-gray-500 hover:text-gray-700'}`}>
              Cancel
            </button>
            <button
              disabled={isPending}
              onClick={handleSubmit}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${
                isDark ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-gray-900 text-white hover:bg-gray-700'
              }`}
            >
              {isPending ? 'Saving…' : ad ? 'Save changes' : 'Publish ad'}
            </button>
          </div>
        </div>

        {/* Compliance + preview */}
        <div className={`p-5 md:p-6 flex flex-col gap-4 ${subBg}`}>
          <div className={`text-[10px] font-mono font-bold tracking-widest ${muted}`}>
            COMPLIANCE CHECKLIST
          </div>
          <div className="flex flex-col gap-2">
            {checks.map((c) => (
              <div key={c.label} className="flex items-center gap-2.5">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                  c.ok ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {c.ok ? (
                    <svg className="w-2.5 h-2.5 text-green-600" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg className="w-2.5 h-2.5 text-red-600" viewBox="0 0 12 12" fill="none">
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  )}
                </div>
                <span className={`text-xs font-medium ${c.ok ? ink : 'text-red-500'}`}>{c.label}</span>
                {!c.ok && <span className="ml-auto text-[10px] font-mono font-bold text-red-500">FIX</span>}
              </div>
            ))}
          </div>

          {/* Live preview */}
          <div className={`mt-2 rounded-xl border overflow-hidden ${isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200'}`}>
            <div className={`px-4 pt-3 pb-1 text-[10px] font-mono font-bold tracking-widest ${muted}`}>LIVE PREVIEW</div>
            <div className="flex">
              {/* Card image — shown only when an asset is mapped for the selected card */}
              {cardImage && (
                <div className="shrink-0 flex items-center justify-center p-4 pr-0">
                  <div className="relative w-20 h-12.5 rounded-md overflow-hidden shadow-md">
                    <Image
                      src={cardImage}
                      alt={form.product || 'Card image'}
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              )}
              <div className="flex-1 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${isDark ? 'bg-gph-dark-linesoft text-gph-dark-muted' : 'bg-gray-100 text-gray-500'}`}>
                    SPONSORED
                  </span>
                  <span className={`text-[10px] font-mono ${muted}`}>· {form.partner || 'PARTNER'}</span>
                </div>
                <p className={`text-base font-bold leading-tight mb-1 ${ink}`}>{form.headline || 'Your headline here'}</p>
                {form.subheadline && <p className={`text-xs leading-relaxed mb-2 ${muted}`}>{form.subheadline}</p>}
                {form.bullets.filter(Boolean).length > 0 && (
                  <ul className="flex flex-col gap-1 mb-2">
                    {form.bullets.filter(Boolean).map((b, i) => (
                      <li key={i} className={`flex items-center gap-1.5 text-[11px] font-semibold font-mono ${ink}`}>
                        <svg className="w-2.5 h-2.5 text-green-500 shrink-0" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
                <div className={`text-[9px] font-mono italic ${muted}`}>{form.disclosure}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
