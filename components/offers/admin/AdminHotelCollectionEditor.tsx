'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import type { HotelCollection } from '@/lib/types/portalData';

const ISSUER_LABELS: Record<string, string> = {
  chase: 'Chase', amex: 'Amex', c1: 'Capital One', bilt: 'Bilt', citi: 'Citi',
};

interface Form {
  issuer:          string;
  collection_name: string;
  property_name:   string;
  perk_summary:    string;
  start_date:      string;
  end_date:        string;
  source_url:      string;
  active:          boolean;
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

interface Props {
  initial:  HotelCollection | null;
  isDark:   boolean;
  onCancel: () => void;
  onSave:   () => void;
}

export function AdminHotelCollectionEditor({ initial, isDark, onCancel, onSave }: Props) {
  const isEditing = initial !== null;
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<Form>({
    issuer:          initial?.issuer ?? 'chase',
    collection_name: initial?.collection_name ?? '',
    property_name:   initial?.property_name ?? '',
    perk_summary:    initial?.perk_summary ?? '',
    start_date:      initial?.start_date ?? '',
    end_date:        initial?.end_date ?? '',
    source_url:      initial?.source_url ?? '',
    active:          initial?.active ?? true,
  });

  const card  = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const ink   = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const line  = isDark ? 'border-gph-dark-line' : 'border-gray-100';

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: () =>
      trpc.portalData.admin.createHotelCollection.mutate({
        issuer:          form.issuer as 'chase' | 'amex' | 'c1' | 'bilt' | 'citi',
        collection_name: form.collection_name,
        property_name:   form.property_name || undefined,
        perk_summary:    form.perk_summary,
        start_date:      form.start_date || undefined,
        end_date:        form.end_date || undefined,
        source_url:      form.source_url || undefined,
        active:          form.active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portalData.listHotelCollections'] });
      onSave();
    },
    onError: (e: Error) => setError(e.message),
  });

  const { mutate: update, isPending: updating } = useMutation({
    mutationFn: () =>
      trpc.portalData.admin.updateHotelCollection.mutate({
        id:              initial!.id,
        issuer:          form.issuer as 'chase' | 'amex' | 'c1' | 'bilt' | 'citi',
        collection_name: form.collection_name,
        property_name:   form.property_name || undefined,
        perk_summary:    form.perk_summary,
        start_date:      form.start_date || undefined,
        end_date:        form.end_date || undefined,
        source_url:      form.source_url || undefined,
        active:          form.active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portalData.listHotelCollections'] });
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
          <div className={labelCls(isDark)}>{isEditing ? 'EDIT HOTEL COLLECTION' : 'NEW HOTEL COLLECTION'}</div>
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
            <div className={`${labelCls(isDark)} mb-3`}>1 · ISSUER & COLLECTION</div>
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
              <div>
                <label className={labelCls(isDark)}>Property (optional)</label>
                <input
                  value={form.property_name}
                  onChange={(e) => setForm({ ...form, property_name: e.target.value })}
                  placeholder="The Ritz-Carlton, ..."
                  className={`${inputCls(isDark)} mt-1`}
                />
              </div>
            </div>
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
            <div className={`${labelCls(isDark)} mb-3`}>2 · DATES & SOURCE</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls(isDark)}>Start date</label>
                <input
                  type="date"
                  inputMode="numeric"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className={`${inputCls(isDark)} mt-1`}
                />
              </div>
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
              {form.property_name ? ` — ${form.property_name}` : ''}
            </p>
            <p className={`text-xs mt-1 ${muted}`}>{form.perk_summary || 'No perk summary yet'}</p>
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
