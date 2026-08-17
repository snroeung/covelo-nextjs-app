'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc-client';
import type { PointsValuation } from '@/lib/types/portalData';

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

interface Form {
  program:      string;
  cpp:          string;
  source_month: string;
  source_url:   string;
  active:       boolean;
}

interface Props {
  initial:  PointsValuation | null;
  isDark:   boolean;
  onCancel: () => void;
  onSave:   () => void;
}

export function AdminPointsValuationEditor({ initial, isDark, onCancel, onSave }: Props) {
  const isEditing = initial !== null;
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<Form>({
    program:      initial?.program ?? '',
    cpp:          initial?.cpp != null ? String(initial.cpp) : '',
    source_month: initial?.source_month ?? '',
    source_url:   initial?.source_url ?? '',
    active:       initial?.active ?? true,
  });

  const card  = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const ink   = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const line  = isDark ? 'border-gph-dark-line' : 'border-gray-100';

  const cppValue = Number(form.cpp);

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: () =>
      trpc.portalData.admin.createPointsValuation.mutate({
        program:      form.program,
        cpp:          cppValue,
        source_month: form.source_month,
        source_url:   form.source_url || undefined,
        active:       form.active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portalData.admin.listPointsValuations'] });
      onSave();
    },
    onError: (e: Error) => setError(e.message),
  });

  const { mutate: update, isPending: updating } = useMutation({
    mutationFn: () =>
      trpc.portalData.admin.updatePointsValuation.mutate({
        id:           initial!.id,
        program:      form.program,
        cpp:          cppValue,
        source_month: form.source_month,
        source_url:   form.source_url || undefined,
        active:       form.active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portalData.admin.listPointsValuations'] });
      onSave();
    },
    onError: (e: Error) => setError(e.message),
  });

  const isPending = creating || updating;

  const checks = [
    { label: 'Program name set', ok: form.program.trim().length > 0 },
    { label: 'CPP is a positive number', ok: Number.isFinite(cppValue) && cppValue > 0 },
    { label: 'Source month set', ok: form.source_month.trim().length > 0 },
  ];
  const allValid = checks.every((c) => c.ok);

  return (
    <div className={`rounded-xl border p-5 md:p-6 ${card}`}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className={labelCls(isDark)}>{isEditing ? 'EDIT POINTS VALUATION' : 'NEW POINTS VALUATION'}</div>
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
            <div className={`${labelCls(isDark)} mb-3`}>1 · PROGRAM & VALUE</div>
            <div>
              <label className={labelCls(isDark)}>Program name</label>
              <input
                value={form.program}
                onChange={(e) => setForm({ ...form, program: e.target.value })}
                placeholder="World of Hyatt"
                className={`${inputCls(isDark)} mt-1`}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className={labelCls(isDark)}>CPP (cents per point)</label>
                <input
                  value={form.cpp}
                  onChange={(e) => setForm({ ...form, cpp: e.target.value })}
                  placeholder="1.7"
                  inputMode="decimal"
                  className={`${inputCls(isDark)} mt-1`}
                />
              </div>
              <div>
                <label className={labelCls(isDark)}>Source month</label>
                <input
                  value={form.source_month}
                  onChange={(e) => setForm({ ...form, source_month: e.target.value })}
                  placeholder="August 2026"
                  className={`${inputCls(isDark)} mt-1`}
                />
              </div>
            </div>
          </section>

          <section>
            <div className={`${labelCls(isDark)} mb-3`}>2 · SOURCE</div>
            <div>
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
            <p className={`text-sm font-semibold ${ink}`}>{form.program || '—'}</p>
            <p className={`text-xs font-mono mt-1 ${muted}`}>{form.cpp || '—'}¢/pt · {form.source_month || '—'}</p>
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
