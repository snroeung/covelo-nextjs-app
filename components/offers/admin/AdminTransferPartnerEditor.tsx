'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import type { TransferPartnerRow } from '@/lib/types/portalData';

const PORTAL_LABELS: Record<string, string> = {
  chase: 'Chase', amex: 'Amex', capital_one: 'Capital One', bilt: 'Bilt', citi: 'Citi',
};

interface Form {
  portal_id:  string;
  program:    string;
  type:       'hotel' | 'airline';
  ratio:      string;
  chain_key:  string;
  iata_codes: string;
  source_url: string;
  active:     boolean;
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
  initial:  TransferPartnerRow | null;
  isDark:   boolean;
  onCancel: () => void;
  onSave:   () => void;
}

export function AdminTransferPartnerEditor({ initial, isDark, onCancel, onSave }: Props) {
  const isEditing = initial !== null;
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<Form>({
    portal_id:  initial?.portal_id ?? 'chase',
    program:    initial?.program ?? '',
    type:       initial?.type ?? 'hotel',
    ratio:      initial?.ratio ?? '1:1',
    chain_key:  initial?.chain_key ?? '',
    iata_codes: initial?.iata_codes?.join(', ') ?? '',
    source_url: initial?.source_url ?? '',
    active:     initial?.active ?? true,
  });

  const card  = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const ink   = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const line  = isDark ? 'border-gph-dark-line' : 'border-gray-100';

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: () =>
      trpc.portalData.admin.createTransferPartner.mutate({
        portal_id:  form.portal_id as 'chase' | 'amex' | 'capital_one' | 'bilt' | 'citi',
        program:    form.program,
        type:       form.type,
        ratio:      form.ratio,
        chain_key:  form.chain_key || undefined,
        iata_codes: form.iata_codes ? form.iata_codes.split(',').map((s) => s.trim()).filter(Boolean) : [],
        source_url: form.source_url || undefined,
        active:     form.active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portalData.listTransferPartners'] });
      onSave();
    },
    onError: (e: Error) => setError(e.message),
  });

  const { mutate: update, isPending: updating } = useMutation({
    mutationFn: () =>
      trpc.portalData.admin.updateTransferPartner.mutate({
        id:         initial!.id,
        portal_id:  form.portal_id as 'chase' | 'amex' | 'capital_one' | 'bilt' | 'citi',
        program:    form.program,
        type:       form.type,
        ratio:      form.ratio,
        chain_key:  form.chain_key || undefined,
        iata_codes: form.iata_codes ? form.iata_codes.split(',').map((s) => s.trim()).filter(Boolean) : [],
        source_url: form.source_url || undefined,
        active:     form.active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portalData.listTransferPartners'] });
      onSave();
    },
    onError: (e: Error) => setError(e.message),
  });

  const isPending = creating || updating;

  const checks = [
    { label: 'Program name set', ok: form.program.trim().length > 0 },
    { label: 'Ratio format is N:N', ok: /^\d+:\d+$/.test(form.ratio.trim()) },
  ];
  const allValid = checks.every((c) => c.ok);

  return (
    <div className={`rounded-xl border p-5 md:p-6 ${card}`}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className={labelCls(isDark)}>{isEditing ? 'EDIT TRANSFER PARTNER' : 'NEW TRANSFER PARTNER'}</div>
          <h2 className={`text-lg font-bold mt-1 ${ink}`}>{form.program || 'Untitled program'}</h2>
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
            <div className={`${labelCls(isDark)} mb-3`}>1 · PORTAL & PROGRAM</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls(isDark)}>Portal</label>
                <select
                  disabled={isEditing}
                  value={form.portal_id}
                  onChange={(e) => setForm({ ...form, portal_id: e.target.value })}
                  className={`${inputCls(isDark)} mt-1 disabled:opacity-50`}
                >
                  {Object.entries(PORTAL_LABELS).map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls(isDark)}>Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as 'hotel' | 'airline' })}
                  className={`${inputCls(isDark)} mt-1`}
                >
                  <option value="hotel">Hotel</option>
                  <option value="airline">Airline</option>
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className={labelCls(isDark)}>Program name</label>
              <input
                value={form.program}
                onChange={(e) => setForm({ ...form, program: e.target.value })}
                placeholder="World of Hyatt"
                className={`${inputCls(isDark)} mt-1`}
              />
            </div>
          </section>

          <section>
            <div className={`${labelCls(isDark)} mb-3`}>2 · RATIO & MATCHING</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls(isDark)}>Ratio</label>
                <input
                  value={form.ratio}
                  onChange={(e) => setForm({ ...form, ratio: e.target.value })}
                  placeholder="1:1"
                  className={`${inputCls(isDark)} mt-1`}
                />
              </div>
              <div>
                <label className={labelCls(isDark)}>Chain key (hotel matching)</label>
                <input
                  value={form.chain_key}
                  onChange={(e) => setForm({ ...form, chain_key: e.target.value })}
                  placeholder="hyatt"
                  className={`${inputCls(isDark)} mt-1`}
                />
              </div>
            </div>
            <div className="mt-3">
              <label className={labelCls(isDark)}>IATA codes (airline, comma-separated)</label>
              <input
                value={form.iata_codes}
                onChange={(e) => setForm({ ...form, iata_codes: e.target.value })}
                placeholder="UA, AC"
                className={`${inputCls(isDark)} mt-1`}
              />
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
            <p className={`text-sm font-semibold ${ink}`}>{PORTAL_LABELS[form.portal_id]} → {form.program || '—'}</p>
            <p className={`text-xs font-mono mt-1 ${muted}`}>{form.type} · ratio {form.ratio}</p>
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
