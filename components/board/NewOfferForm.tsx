'use client';

import { useId } from 'react';
import { BOARD_OFFER_TYPES } from '@/lib/board/constants';
import { FIELD, LABEL } from './buttons';

export interface NewOfferDraft {
  type: (typeof BOARD_OFFER_TYPES)[number];
  value: string;
  name: string;
  from: string;
  to: string;
  conditions: string;
  ends: string;
  url: string;
}

export const EMPTY_OFFER: NewOfferDraft = { type: BOARD_OFFER_TYPES[0], value: '', name: '', from: '', to: '', conditions: '', ends: '', url: '' };

const isHttp = (v: string) => v === '' || /^https?:\/\/\S+$/i.test(v);

/** Required fields filled in and the link, if any, well-formed. */
export function newOfferError(o: NewOfferDraft): string | null {
  if (!o.value.trim()) return 'Add the offer’s value (like +25% or $100).';
  if (!o.name.trim()) return 'Give the offer a name.';
  if (!o.from.trim()) return 'Say which program or card it comes from.';
  if (!isHttp(o.url.trim())) return 'The source link must start with http:// or https://.';
  return null;
}

function Field({ label, required, children, wide }: { label: string; required?: boolean; children: (id: string) => React.ReactNode; wide?: boolean }) {
  const id = useId();
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label htmlFor={id} className={LABEL}>{label}{required && <span aria-hidden="true"> *</span>}{required && <span className="sr-only"> (required)</span>}</label>
      {children(id)}
    </div>
  );
}

export function NewOfferForm({ value, onChange }: { value: NewOfferDraft; onChange: (next: NewOfferDraft) => void }) {
  const set = <K extends keyof NewOfferDraft>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...value, [k]: e.target.value });
  const urlBad = !isHttp(value.url.trim());

  return (
    <div className="grid gap-3 rounded-lg border border-gph-line bg-gph-bg p-3.5 sm:grid-cols-2">
      <Field label="TYPE">
        {(id) => (
          <select id={id} value={value.type} onChange={set('type')} className={`${FIELD} min-h-11`}>
            {BOARD_OFFER_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        )}
      </Field>
      <Field label="VALUE" required>
        {(id) => <input id={id} value={value.value} maxLength={24} onChange={set('value')} placeholder="+25%, 5×, $100" className={`${FIELD} min-h-11`} />}
      </Field>
      <Field label="OFFER NAME" required wide>
        {(id) => <input id={id} value={value.name} maxLength={120} onChange={set('name')} placeholder="25% transfer bonus · Amex → Virgin" className={`${FIELD} min-h-11`} />}
      </Field>
      <Field label="FROM" required>
        {(id) => <input id={id} value={value.from} maxLength={80} onChange={set('from')} placeholder="Program or card" className={`${FIELD} min-h-11`} />}
      </Field>
      <Field label="TO">
        {(id) => <input id={id} value={value.to} maxLength={80} onChange={set('to')} placeholder="Partner (optional)" className={`${FIELD} min-h-11`} />}
      </Field>
      <Field label="CONDITIONS">
        {(id) => <input id={id} value={value.conditions} maxLength={300} onChange={set('conditions')} placeholder="Min. spend, caps…" className={`${FIELD} min-h-11`} />}
      </Field>
      <Field label="ENDS">
        {(id) => <input id={id} value={value.ends} maxLength={40} onChange={set('ends')} placeholder="Jun 30" className={`${FIELD} min-h-11`} />}
      </Field>
      <Field label="SOURCE LINK" wide>
        {(id) => (
          <>
            <input
              id={id}
              type="url"
              inputMode="url"
              value={value.url}
              maxLength={2000}
              onChange={set('url')}
              placeholder="https://"
              aria-invalid={urlBad || undefined}
              className={`${FIELD} min-h-11 ${urlBad ? 'border-gph-danger' : ''}`}
            />
            {urlBad && <p className="mt-1 text-[12px] font-semibold text-gph-danger">Start with http:// or https://</p>}
          </>
        )}
      </Field>
    </div>
  );
}
