'use client';

import { useId } from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import { CARD_NAMES, ISSUER_CARDS, type CardId, type PortalId } from '@/lib/points/types';
import { PARTNER_IMAGES } from '@/lib/partnerImages';
import { issuersForPartner, partnerLabel, partnersForIssuer, soleIssuer } from '@/lib/points/partnerOptions';
import { ISSUER_LABELS } from '@/lib/discover/offerCopy';
import {
  BONUS_TYPES, EMPTY_MEMBER_OFFER, OFFER_COUNTRIES, OFFER_ISSUERS, OFFER_TAGS, draftChecks, draftError, effectiveRatio,
  type MemberOfferDraft,
} from '@/lib/board/memberOffer';
import { FIELD, LABEL } from '@/components/ui/field';

// Mirrors the admin offer editor section for section — issuer & partner,
// eligible cards, tags / dates / flags, then the validation checklist and a
// preview — so an admin can publish a member's offer without re-typing it.
// Admin-only controls (Active, post-to-board) are left out.

export type NewOfferDraft = MemberOfferDraft;
export const EMPTY_OFFER = EMPTY_MEMBER_OFFER;
export const newOfferError = draftError;

const BONUS_TYPE_LABELS: Record<(typeof BONUS_TYPES)[number], string> = {
  points_multiplier: 'Points multiplier (5×)',
  cash_back_pct: 'Cash back (%)',
  dollar_amount: 'Statement credit ($)',
};

const SEG = 'min-h-11 rounded-[5px] px-3 text-xs font-bold focus-visible:outline-2 focus-visible:outline-gph-ink';
const SEG_ON = 'bg-gph-action text-gph-bg';
const SEG_OFF = 'text-gph-muted hover:text-gph-ink';
const SEG_WRAP = 'flex w-fit gap-[3px] rounded-[7px] bg-gph-card p-[3px] shadow-[0_0_0_1px_var(--gph-line)]';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className={LABEL + ' !mb-0'}>{title}</div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
        {hint && <span className="ml-1 font-sans text-[10px] font-medium normal-case tracking-normal"> {hint}</span>}
      </label>
      {children(id)}
    </div>
  );
}

/** A labelled on/off switch with a 44px hit area. */
function Switch({ on, onChange, children }: { on: boolean; onChange: (next: boolean) => void; children: React.ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex min-h-11 w-full items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-gph-ink">
      <span aria-hidden="true" className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-gph-pending' : 'bg-gph-line'}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
      <span className="text-[13.5px] font-semibold text-gph-ink">{children}</span>
    </button>
  );
}

const fmtDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });

export function NewOfferForm({ value, onChange }: { value: NewOfferDraft; onChange: (next: NewOfferDraft) => void }) {
  const set = (patch: Partial<NewOfferDraft>) => onChange({ ...value, ...patch });
  const text = <K extends keyof NewOfferDraft>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    set({ [k]: e.target.value } as Partial<NewOfferDraft>);

  const transfer = value.kind === 'transfer';
  const { data: partners } = useQuery({
    queryKey: ['portalData.transferPartners'],
    queryFn: () => trpc.portalData.listTransferPartners.query(),
    enabled: transfer,
  });
  const partnerOptions = partnersForIssuer(partners, value.issuer as PortalId | '');
  const issuerChoices = issuersForPartner(partners, value.transfer_partner, OFFER_ISSUERS);

  // Either order works: a partner the new issuer doesn't reach is dropped, and a partner picked first fills in its issuer when only one reaches it
  function pickIssuer(issuer: NewOfferDraft['issuer']) {
    const keeps = !!issuer && partnersForIssuer(partners, issuer).some((p) => p.program === value.transfer_partner);
    set({ issuer, transfer_partner: keeps ? value.transfer_partner : '', card_ids: [] });
  }
  function pickPartner(program: string) {
    const only = value.issuer ? '' : soleIssuer(partners, program);
    set({ transfer_partner: program, ...(only ? { issuer: only, card_ids: [] } : {}) });
  }
  const cardOptions: CardId[] = value.issuer ? (ISSUER_CARDS[value.issuer as PortalId] ?? []) : [];
  const allCards = value.card_ids.length === 0;
  const checks = draftChecks(value);
  const input = `${FIELD} min-h-11`;
  const issuerName = value.issuer ? ISSUER_LABELS[value.issuer] : '—';
  const ratio = effectiveRatio(value.bonus_pct);
  const partnerImg = transfer && value.transfer_partner ? PARTNER_IMAGES[value.transfer_partner] : undefined;

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-gph-line bg-gph-bg p-3.5">
      <div role="group" aria-label="Offer type" className={SEG_WRAP}>
        {([['transfer', 'Transfer Bonus'], ['spending', 'Spending Bonus']] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={value.kind === k}
            onClick={() => set({ kind: k, card_ids: [] })}
            className={`${SEG} ${value.kind === k ? SEG_ON : SEG_OFF}`}
          >
            {label}
          </button>
        ))}
      </div>

      <Section title={transfer ? '1 · ISSUER & PARTNER' : '1 · ISSUER & MERCHANT'}>
        <Field label="ISSUER">
          {(id) => (
            <select id={id} value={value.issuer} onChange={(e) => pickIssuer(e.target.value as NewOfferDraft['issuer'])} className={input}>
              <option value="">Select issuer…</option>
              {issuerChoices.map((i) => <option key={i} value={i}>{ISSUER_LABELS[i]}</option>)}
            </select>
          )}
        </Field>

        {transfer ? (
          <>
            <Field label="TRANSFER PARTNER">
              {(id) => (
                <select id={id} value={value.transfer_partner} onChange={(e) => pickPartner(e.target.value)} className={input}>
                  <option value="">Select partner…</option>
                  {partnerOptions.map((p) => (
                    <option key={p.program} value={p.program}>{partnerLabel(p, value.issuer as PortalId | '', (i) => ISSUER_LABELS[i])}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="DESCRIPTION" hint="— optional">
              {(id) => <textarea id={id} value={value.description} maxLength={300} rows={2} onChange={text('description')} placeholder="e.g. Limited-time 30% bonus when transferring Chase points to Hyatt through Dec 31." className={`${FIELD} resize-y`} />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="BONUS %">
                {(id) => <input id={id} type="number" inputMode="decimal" min="0" step="0.01" value={value.bonus_pct} onChange={text('bonus_pct')} placeholder="e.g. 30" className={input} />}
              </Field>
              <div>
                <span className={LABEL}>EFFECTIVE RATIO</span>
                <div aria-label={`Effective ratio ${ratio} to 1`} className={`${FIELD} flex min-h-11 items-center font-mono text-gph-muted`}>{ratio}:1</div>
              </div>
              <Field label="MIN TRANSFER PTS" hint="(status-only)">
                {(id) => <input id={id} type="number" inputMode="numeric" min="0" step="1" value={value.min_transfer_points} onChange={text('min_transfer_points')} placeholder="e.g. 5000 (no % bonus, status match only)" className={input} />}
              </Field>
            </div>
          </>
        ) : (
          <>
            <Field label="MERCHANT NAME">
              {(id) => <input id={id} value={value.merchant_name} maxLength={80} onChange={text('merchant_name')} placeholder="e.g. Hyatt, Lyft, Dining" className={input} />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="BONUS TYPE">
                {(id) => (
                  <select id={id} value={value.bonus_type} onChange={text('bonus_type')} className={input}>
                    {BONUS_TYPES.map((t) => <option key={t} value={t}>{BONUS_TYPE_LABELS[t]}</option>)}
                  </select>
                )}
              </Field>
              <Field label={value.bonus_type === 'points_multiplier' ? 'MULTIPLIER' : value.bonus_type === 'cash_back_pct' ? 'CASH BACK %' : 'CREDIT AMOUNT ($)'}>
                {(id) => <input id={id} type="number" inputMode="decimal" min="0" step="0.01" value={value.bonus_multiplier} onChange={text('bonus_multiplier')} className={input} />}
              </Field>
              <Field label="MIN. SPEND ($)" hint="— optional">
                {(id) => <input id={id} type="number" inputMode="decimal" min="0" value={value.spending_minimum} onChange={text('spending_minimum')} className={input} />}
              </Field>
              <Field label="MIN. NIGHTS" hint="— optional">
                {(id) => <input id={id} type="number" inputMode="numeric" min="0" step="1" value={value.minimum_nights} onChange={text('minimum_nights')} className={input} />}
              </Field>
            </div>
            <Field label="DESCRIPTION" hint="— optional">
              {(id) => <textarea id={id} value={value.description} maxLength={300} rows={2} onChange={text('description')} placeholder="Terms, caps, how to get it…" className={`${FIELD} resize-y`} />}
            </Field>
          </>
        )}
      </Section>

      <Section title="2 · ELIGIBLE CARDS">
        <div role="group" aria-label="Eligible cards" className={SEG_WRAP}>
          <button type="button" aria-pressed={allCards} onClick={() => set({ card_ids: [] })} className={`${SEG} ${allCards ? SEG_ON : SEG_OFF}`}>
            All cards
          </button>
          <button
            type="button"
            aria-pressed={!allCards}
            disabled={!value.issuer}
            onClick={() => allCards && set({ card_ids: cardOptions.slice(0, 1) })}
            className={`${SEG} disabled:opacity-40 ${!allCards ? SEG_ON : SEG_OFF}`}
          >
            Specific cards
          </button>
        </div>
        {!allCards && (
          <div className="flex flex-col">
            {cardOptions.map((cardId) => {
              const checked = value.card_ids.includes(cardId);
              return (
                <label key={cardId} className="flex min-h-11 cursor-pointer items-center gap-3 text-[13.5px] font-semibold text-gph-ink">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => set({ card_ids: checked ? value.card_ids.filter((c) => c !== cardId) : [...value.card_ids, cardId] })}
                    className="size-4 accent-[var(--gph-action)]"
                  />
                  {CARD_NAMES[cardId]}
                </label>
              );
            })}
            {cardOptions.length > 1 && (
              <button type="button" onClick={() => set({ card_ids: cardOptions.slice() })} className="min-h-11 self-start font-mono text-[11px] font-bold text-gph-muted underline-offset-2 hover:text-gph-ink hover:underline">
                Select all
              </button>
            )}
          </div>
        )}
      </Section>

      <Section title="3 · TAGS, DATES & FLAGS">
        <div>
          <span className={LABEL}>TAGS <span className="font-sans font-medium normal-case tracking-normal">— select all that apply</span></span>
          <div role="group" aria-label="Tags" className="flex flex-wrap gap-2">
            {OFFER_TAGS.map((tag) => {
              const on = value.tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ tags: on ? value.tags.filter((t) => t !== tag) : [...value.tags, tag] })}
                  className={`min-h-11 rounded-full px-3 font-mono text-[11px] font-bold focus-visible:outline-2 focus-visible:outline-gph-ink ${on ? SEG_ON : 'bg-gph-linesoft text-gph-muted hover:text-gph-ink'}`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="START DATE">
            {(id) => <input id={id} type="date" value={value.start_date} onChange={text('start_date')} className={input} />}
          </Field>
          <Field label="END DATE">
            {(id) => <input id={id} type="date" value={value.end_date} min={value.start_date || undefined} onChange={text('end_date')} className={input} />}
          </Field>
        </div>

        <Field label="COUNTRY / REGION">
          {(id) => (
            <select id={id} value={value.country} onChange={text('country')} className={input}>
              {OFFER_COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          )}
        </Field>

        <Field label="SOURCE URL" hint="— optional">
          {(id) => <input id={id} type="url" inputMode="url" value={value.source_url} maxLength={2000} onChange={text('source_url')} placeholder="https://…" className={`${input} font-mono text-xs`} />}
        </Field>

        {transfer && (
          <Switch on={value.for_status_transfer} onChange={(next) => set({ for_status_transfer: next })}>
            {value.for_status_transfer ? 'Status deal' : 'Not a status deal'}
          </Switch>
        )}
      </Section>

      <section aria-label="Validation and preview" className="flex flex-col gap-3 border-t border-gph-line pt-4">
        <div className={LABEL + ' !mb-0'}>VALIDATION</div>
        <ul className="flex flex-col gap-2">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2.5">
              <span aria-hidden="true" className={`flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${c.ok ? 'bg-gph-ok-soft text-gph-ok' : 'bg-gph-danger-soft text-gph-danger'}`}>
                {c.ok ? '✓' : '✕'}
              </span>
              <span className={`text-xs font-medium ${c.ok ? 'text-gph-ink' : 'text-gph-danger'}`}>{c.label}</span>
              {!c.ok && <span className="ml-auto font-mono text-[10px] font-bold text-gph-danger">REQUIRED</span>}
            </li>
          ))}
        </ul>

        <div className="rounded-xl border border-gph-line bg-gph-card">
          <div className="px-4 pb-1 pt-3 font-mono text-[10px] font-bold tracking-widest text-gph-muted">PREVIEW</div>
          <div className="flex items-center gap-3 px-4 pb-4">
            {partnerImg && (
              <div className="relative flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gph-line bg-white p-1">
                <Image src={partnerImg} alt={value.transfer_partner} fill className="object-contain p-1" />
              </div>
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="truncate text-sm font-bold text-gph-ink">
                {transfer ? `${issuerName} → ${value.transfer_partner || '—'}` : value.merchant_name || '—'}
              </div>
              <div className="font-mono text-xs text-gph-muted">
                {transfer
                  ? value.bonus_pct
                    ? `+${value.bonus_pct}% bonus · ${ratio}:1 ratio`
                    : value.min_transfer_points
                      ? `Status match at ${value.min_transfer_points}+ pts transferred`
                      : 'No bonus % or min points set'
                  : <>
                      {value.bonus_type === 'dollar_amount' ? `$${value.bonus_multiplier || '0'} credit` : value.bonus_type === 'cash_back_pct' ? `${value.bonus_multiplier || '0'}% cash back` : `${value.bonus_multiplier || '0'}x points`}
                      {value.spending_minimum ? ` · min. $${value.spending_minimum}` : ''}
                      {value.issuer ? ` · ${issuerName}` : ''}
                    </>}
              </div>
              <div className="truncate font-mono text-[10px] text-gph-muted">
                {value.card_ids.length > 0 ? value.card_ids.map((id) => CARD_NAMES[id as CardId]).join(', ') : 'All cards'}
              </div>
              {value.end_date && (
                <div className="font-mono text-[10px] text-gph-muted">
                  Expires {fmtDate(value.end_date)}{!allCards && ' · TARGETED'}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
