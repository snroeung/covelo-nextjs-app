'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import type { TravelCollection } from '@/lib/types/portalData';

const ISSUER_LABELS: Record<string, string> = {
  chase: 'Chase', amex: 'Amex', c1: 'Capital One', bilt: 'Bilt', citi: 'Citi',
};

const CABIN_LABELS: Record<string, string> = {
  economy: 'Economy', premium_economy: 'Premium economy', business: 'Business', first: 'First',
};

interface Form {
  issuer:             string;
  type:               'hotel' | 'flight';
  collection_name:    string;
  property_name:      string;
  airline_name:       string;
  airline_iata_code:  string;
  origin_iata_code:      string;
  destination_iata_code: string;
  cabin_class:        string;
  perk_summary:       string;
  original_amount:    string;
  original_unit:      string;
  discount_amount:    string;
  discount_unit:      string;
  end_date:           string;
  limited_time_offer: boolean;
  source_url:         string;
  active:             boolean;
}

function labelCls(isDark: boolean) {
  return `text-[10px] font-mono font-bold tracking-widest ${isDark ? 'text-gph-dark-muted' : 'text-gray-500'}`;
}

function inputCls(isDark: boolean) {
  return `w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors ${
    isDark
      ? 'bg-gph-dark-bg border-gph-dark-line text-gph-dark-ink placeholder-gph-dark-muted focus:border-blue-500'
      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500'
  }`;
}

function numOrUndefined(s: string): number | undefined {
  if (!s.trim()) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

interface Props {
  initial:  TravelCollection | null;
  isDark:   boolean;
  onCancel: () => void;
  onSave:   () => void;
}

export function AdminHotelCollectionEditor({ initial, isDark, onCancel, onSave }: Props) {
  const isEditing = initial !== null;
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<Form>({
    issuer:             initial?.issuer ?? 'chase',
    type:               initial?.type ?? 'hotel',
    collection_name:    initial?.collection_name ?? '',
    property_name:      initial?.property_name ?? '',
    airline_name:       initial?.airline_name ?? '',
    airline_iata_code:  initial?.airline_iata_code ?? '',
    origin_iata_code:      initial?.origin_iata_code ?? '',
    destination_iata_code: initial?.destination_iata_code ?? '',
    cabin_class:        initial?.cabin_class ?? 'economy',
    perk_summary:       initial?.perk_summary ?? '',
    original_amount:    initial?.original_amount != null ? String(initial.original_amount) : '',
    original_unit:      initial?.original_unit ?? 'points',
    discount_amount:    initial?.discount_amount != null ? String(initial.discount_amount) : '',
    discount_unit:      initial?.discount_unit ?? 'points',
    end_date:           initial?.end_date ?? '',
    limited_time_offer: initial?.limited_time_offer ?? false,
    source_url:         initial?.source_url ?? '',
    active:             initial?.active ?? true,
  });

  const card  = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const ink   = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const line  = isDark ? 'border-gph-dark-line' : 'border-gray-100';

  function buildPayload() {
    return {
      issuer:             form.issuer as 'chase' | 'amex' | 'c1' | 'bilt' | 'citi',
      type:               form.type,
      collection_name:    form.collection_name,
      property_name:      form.type === 'hotel' ? (form.property_name || undefined) : undefined,
      airline_name:       form.type === 'flight' ? (form.airline_name || undefined) : undefined,
      airline_iata_code:  form.type === 'flight' ? (form.airline_iata_code || undefined) : undefined,
      origin_iata_code:      form.type === 'flight' ? (form.origin_iata_code || undefined) : undefined,
      destination_iata_code: form.type === 'flight' ? (form.destination_iata_code || undefined) : undefined,
      cabin_class:        form.type === 'flight' ? (form.cabin_class as 'economy' | 'premium_economy' | 'business' | 'first') : undefined,
      perk_summary:       form.perk_summary,
      original_amount:    numOrUndefined(form.original_amount),
      original_unit:      form.original_amount ? (form.original_unit as 'points' | 'usd') : undefined,
      discount_amount:    numOrUndefined(form.discount_amount),
      discount_unit:      form.discount_amount ? (form.discount_unit as 'points' | 'usd') : undefined,
      end_date:           form.end_date || undefined,
      limited_time_offer: form.limited_time_offer,
      source_url:         form.source_url || undefined,
      active:             form.active,
    };
  }

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: () => trpc.portalData.admin.createTravelCollection.mutate(buildPayload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portalData.listTravelCollections'] });
      onSave();
    },
    onError: (e: Error) => setError(e.message),
  });

  const { mutate: update, isPending: updating } = useMutation({
    mutationFn: () => trpc.portalData.admin.updateTravelCollection.mutate({ id: initial!.id, ...buildPayload() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portalData.listTravelCollections'] });
      onSave();
    },
    onError: (e: Error) => setError(e.message),
  });

  const isPending = creating || updating;

  const checks = [
    { label: 'Collection name set', ok: form.collection_name.trim().length > 0 },
    { label: 'Perk summary set', ok: form.perk_summary.trim().length > 0 },
  ];
  const allValid = checks.every((c) => c.ok);

  return (
    <div className={`rounded-xl border p-5 md:p-6 ${card}`}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className={labelCls(isDark)}>{isEditing ? 'EDIT TRAVEL COLLECTION' : 'NEW TRAVEL COLLECTION'}</div>
          <h2 className={`text-lg font-bold mt-1 ${ink}`}>{form.collection_name || 'Untitled collection'}</h2>
        </div>
        <button
          onClick={onCancel}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            isDark ? 'bg-gph-dark-linesoft text-gph-dark-ink hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Cancel
        </button>
      </div>

      <div className="grid md:grid-cols-[1.2fr_1fr] gap-6">
        <div className="space-y-5">
          <section>
            <div className={`${labelCls(isDark)} mb-3`}>1 · TYPE, ISSUER & COLLECTION</div>
            <div className="flex items-center gap-2 mb-3">
              {(['hotel', 'flight'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={isEditing}
                  onClick={() => setForm({ ...form, type: t })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
                    form.type === t
                      ? isDark ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
                      : isDark ? 'bg-gph-dark-linesoft text-gph-dark-ink hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {t === 'hotel' ? 'Hotel' : 'Flight'}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls(isDark)}>Issuer</label>
                <select
                  disabled={isEditing}
                  value={form.issuer}
                  onChange={(e) => setForm({ ...form, issuer: e.target.value })}
                  className={`${inputCls(isDark)} mt-1 disabled:opacity-50`}
                >
                  {Object.entries(ISSUER_LABELS).map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
              </div>
              {form.type === 'hotel' ? (
                <div>
                  <label className={labelCls(isDark)}>Property (optional)</label>
                  <input
                    value={form.property_name}
                    onChange={(e) => setForm({ ...form, property_name: e.target.value })}
                    placeholder="The Ritz-Carlton, ..."
                    className={`${inputCls(isDark)} mt-1`}
                  />
                </div>
              ) : (
                <div>
                  <label className={labelCls(isDark)}>Cabin class</label>
                  <select
                    value={form.cabin_class}
                    onChange={(e) => setForm({ ...form, cabin_class: e.target.value })}
                    className={`${inputCls(isDark)} mt-1`}
                  >
                    {Object.entries(CABIN_LABELS).map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {form.type === 'flight' && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className={labelCls(isDark)}>Airline name</label>
                  <input
                    value={form.airline_name}
                    onChange={(e) => setForm({ ...form, airline_name: e.target.value })}
                    placeholder="United Airlines"
                    className={`${inputCls(isDark)} mt-1`}
                  />
                </div>
                <div>
                  <label className={labelCls(isDark)}>Airline IATA code</label>
                  <input
                    value={form.airline_iata_code}
                    onChange={(e) => setForm({ ...form, airline_iata_code: e.target.value.toUpperCase() })}
                    placeholder="UA"
                    maxLength={2}
                    className={`${inputCls(isDark)} mt-1`}
                  />
                </div>
                <div>
                  <label className={labelCls(isDark)}>Origin IATA code</label>
                  <input
                    value={form.origin_iata_code}
                    onChange={(e) => setForm({ ...form, origin_iata_code: e.target.value.toUpperCase() })}
                    placeholder="SFO (leave blank for any route)"
                    maxLength={3}
                    className={`${inputCls(isDark)} mt-1`}
                  />
                </div>
                <div>
                  <label className={labelCls(isDark)}>Destination IATA code</label>
                  <input
                    value={form.destination_iata_code}
                    onChange={(e) => setForm({ ...form, destination_iata_code: e.target.value.toUpperCase() })}
                    placeholder="NRT (leave blank for any route)"
                    maxLength={3}
                    className={`${inputCls(isDark)} mt-1`}
                  />
                </div>
              </div>
            )}

            <div className="mt-3">
              <label className={labelCls(isDark)}>Collection name</label>
              <input
                value={form.collection_name}
                onChange={(e) => setForm({ ...form, collection_name: e.target.value })}
                placeholder="Fine Hotels + Resorts"
                className={`${inputCls(isDark)} mt-1`}
              />
            </div>
            <div className="mt-3">
              <label className={labelCls(isDark)}>Perk summary</label>
              <textarea
                value={form.perk_summary}
                onChange={(e) => setForm({ ...form, perk_summary: e.target.value })}
                placeholder="$100 credit, room upgrade, late checkout"
                rows={3}
                className={`${inputCls(isDark)} mt-1 resize-none`}
              />
            </div>
          </section>

          <section>
            <div className={`${labelCls(isDark)} mb-3`}>2 · DISCOUNT</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls(isDark)}>Original amount</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="number"
                    value={form.original_amount}
                    onChange={(e) => setForm({ ...form, original_amount: e.target.value })}
                    placeholder="60000"
                    className={inputCls(isDark)}
                  />
                  <select
                    value={form.original_unit}
                    onChange={(e) => setForm({ ...form, original_unit: e.target.value })}
                    className={`${inputCls(isDark)} shrink-0 w-24`}
                  >
                    <option value="points">points</option>
                    <option value="usd">usd</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls(isDark)}>Discounted amount</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="number"
                    value={form.discount_amount}
                    onChange={(e) => setForm({ ...form, discount_amount: e.target.value })}
                    placeholder="48000"
                    className={inputCls(isDark)}
                  />
                  <select
                    value={form.discount_unit}
                    onChange={(e) => setForm({ ...form, discount_unit: e.target.value })}
                    className={`${inputCls(isDark)} shrink-0 w-24`}
                  >
                    <option value="points">points</option>
                    <option value="usd">usd</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className={`${labelCls(isDark)} mb-3`}>3 · DATES & SOURCE</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls(isDark)}>End date</label>
                <input
                  type="date"
                  inputMode="numeric"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className={`${inputCls(isDark)} mt-1`}
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.limited_time_offer}
                    onChange={(e) => setForm({ ...form, limited_time_offer: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className={`text-xs font-semibold ${ink}`}>Limited time</span>
                </label>
              </div>
            </div>
            <div className="mt-3">
              <label className={labelCls(isDark)}>Source URL</label>
              <input
                value={form.source_url}
                onChange={(e) => setForm({ ...form, source_url: e.target.value })}
                placeholder="https://..."
                className={`${inputCls(isDark)} mt-1`}
              />
            </div>
            <label className="flex items-center gap-2 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="w-4 h-4"
              />
              <span className={`text-xs font-semibold ${ink}`}>Active (visible publicly)</span>
            </label>
          </section>

          {error && <p className={`text-xs font-semibold ${isDark ? 'text-red-400' : 'text-red-600'}`}>{error}</p>}
        </div>

        <div className="space-y-4">
          <div className={`rounded-lg border p-4 ${line}`}>
            <div className={`${labelCls(isDark)} mb-3`}>VALIDATION</div>
            <ul className="space-y-2">
              {checks.map((c) => (
                <li key={c.label} className="flex items-center gap-2 text-xs">
                  <span className={c.ok ? 'text-green-500' : 'text-red-500'}>{c.ok ? '✓' : '✗'}</span>
                  <span className={ink}>{c.label}</span>
                  {!c.ok && <span className="ml-auto text-[10px] font-bold text-red-500">REQUIRED</span>}
                </li>
              ))}
            </ul>
          </div>
          <div className={`rounded-lg border p-4 ${line}`}>
            <div className={`${labelCls(isDark)} mb-2`}>PREVIEW</div>
            <p className={`text-sm font-semibold ${ink}`}>
              {ISSUER_LABELS[form.issuer]} · {form.collection_name || '—'}
              {form.type === 'hotel' && form.property_name ? ` — ${form.property_name}` : ''}
              {form.type === 'flight' && form.airline_name ? ` — ${form.airline_name} (${form.airline_iata_code || '—'})${form.origin_iata_code || form.destination_iata_code ? ` ${form.origin_iata_code || '—'}→${form.destination_iata_code || '—'}` : ''}` : ''}
            </p>
            <p className={`text-xs mt-1 ${muted}`}>{form.perk_summary || 'No perk summary yet'}</p>
            {form.limited_time_offer && (
              <span className="inline-block mt-2 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-cv-amber-400/20 text-cv-amber-900 dark:text-cv-amber-400">
                Limited time
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-inherit">
        <button
          onClick={onCancel}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
            isDark ? 'bg-gph-dark-linesoft text-gph-dark-ink hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Cancel
        </button>
        <button
          disabled={!allValid || isPending}
          onClick={() => (isEditing ? update() : create())}
          className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Saving…' : isEditing ? 'Save changes' : 'Publish'}
        </button>
      </div>
    </div>
  );
}
