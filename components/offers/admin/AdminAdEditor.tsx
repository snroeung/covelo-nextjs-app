'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import type { SponsoredAd, AdSlot } from '@/lib/types/offers';

const SLOTS: { value: AdSlot; label: string }[] = [
  { value: 'hero',       label: 'Hero (top of page)' },
  { value: 'grid_inline', label: 'Grid inline' },
  { value: 'below_grid', label: 'Below grid' },
  { value: 'sidebar',    label: 'Sidebar' },
];

interface Props {
  ad?: SponsoredAd;
  onSave: () => void;
  onCancel: () => void;
  isDark: boolean;
}

interface FormState {
  partner:     string;
  product:     string;
  slot:        AdSlot;
  headline:    string;
  subheadline: string;
  bullets:     string[];
  cta_label:   string;
  cta_url:     string;
  tracking_id: string;
  disclosure:  string;
  tone:        string;
  active:      boolean;
  start_date:  string;
  end_date:    string;
}

function defaultForm(ad?: SponsoredAd): FormState {
  return {
    partner:     ad?.partner     ?? '',
    product:     ad?.product     ?? '',
    slot:        ad?.slot        ?? 'below_grid',
    headline:    ad?.headline    ?? '',
    subheadline: ad?.subheadline ?? '',
    bullets:     ad?.bullets     ?? [''],
    cta_label:   ad?.cta_label   ?? 'Apply now',
    cta_url:     ad?.cta_url     ?? '',
    tracking_id: ad?.tracking_id ?? '',
    disclosure:  ad?.disclosure  ?? 'Advertiser disclosure · Covelo may receive compensation when you apply. Terms apply.',
    tone:        ad?.tone        ?? 'neutral',
    active:      ad?.active      ?? false,
    start_date:  ad?.start_date  ?? '',
    end_date:    ad?.end_date    ?? '',
  };
}

function LabelCls(isDark: boolean) {
  return `text-[10px] font-mono font-bold tracking-widest ${isDark ? 'text-gph-dark-muted' : 'text-gray-500'}`;
}

function InputCls(isDark: boolean, focused = false) {
  return `w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors ${
    focused ? 'ring-2 ring-blue-500' : ''
  } ${isDark
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

  const { mutate: createAd, isPending: creating } = useMutation({
    mutationFn: () => trpc.offers.admin.createAd.mutate({
      ...form,
      subheadline: form.subheadline || null,
      image_url:   null,
      start_date:  form.start_date || null,
      end_date:    form.end_date   || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers.admin.listAds'] });
      onSave();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Save failed'),
  });

  const { mutate: updateAd, isPending: updating } = useMutation({
    mutationFn: () => trpc.offers.admin.updateAd.mutate({
      id: ad!.id,
      ...form,
      subheadline: form.subheadline || null,
      start_date:  form.start_date || null,
      end_date:    form.end_date   || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers.admin.listAds'] });
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

  // Compliance checks
  const checks = [
    { label: 'Sponsored tag will be visible',          ok: true },
    { label: 'Disclosure text present',                ok: form.disclosure.trim().length > 0 },
    { label: 'CTA URL is a valid URL',                 ok: /^https?:\/\/.+/.test(form.cta_url) },
    { label: 'Tracking ID set',                        ok: form.tracking_id.trim().length > 0 },
    { label: 'Headline under 80 chars',                ok: form.headline.length <= 80 },
  ];

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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block mb-1.5 ${labelCls}`}>PARTNER</label>
                <input className={inputCls} value={form.partner} onChange={(e) => set('partner', e.target.value)} placeholder="Chase" />
              </div>
              <div>
                <label className={`block mb-1.5 ${labelCls}`}>PRODUCT</label>
                <input className={inputCls} value={form.product} onChange={(e) => set('product', e.target.value)} placeholder="Sapphire Preferred®" />
              </div>
              <div>
                <label className={`block mb-1.5 ${labelCls}`}>SLOT</label>
                <select
                  className={inputCls}
                  value={form.slot}
                  onChange={(e) => set('slot', e.target.value as AdSlot)}
                >
                  {SLOTS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
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

          {/* 4. Schedule */}
          <section>
            <div className={`mb-3 ${labelCls}`}>4 · SCHEDULE</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block mb-1.5 ${labelCls}`}>START DATE</label>
                <input type="date" className={inputCls} value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
              </div>
              <div>
                <label className={`block mb-1.5 ${labelCls}`}>END DATE</label>
                <input type="date" className={inputCls} value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
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
            <p className="text-sm text-red-500 font-semibold">{error}</p>
          )}

          <div className={`flex items-center justify-end gap-3 pt-4 border-t ${line}`}>
            <button onClick={onCancel} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${isDark ? 'text-gph-dark-muted hover:text-gph-dark-ink' : 'text-gray-500 hover:text-gray-700'}`}>
              Cancel
            </button>
            <button
              disabled={isPending}
              onClick={() => ad ? updateAd() : createAd()}
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
                {!c.ok && <span className={`ml-auto text-[10px] font-mono font-bold text-red-500`}>FIX</span>}
              </div>
            ))}
          </div>

          {/* Live preview */}
          <div className={`mt-2 p-4 rounded-xl border ${isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200'}`}>
            <div className={`text-[10px] font-mono font-bold tracking-widest mb-3 ${muted}`}>LIVE PREVIEW</div>
            <div className={`flex items-center gap-2 mb-2`}>
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
  );
}
