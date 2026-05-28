'use client';

import { useState } from 'react';
import { PortalId, CARD_PORTAL_MAP } from '@/lib/points/types';
import { useSelectedCards } from '@/contexts/SelectedCardsContext';
import { useTheme } from '@/contexts/ThemeContext';

const CPP_ESTIMATE = 0.0125; // 1.25¢/pt

const PORTAL_LABEL: Record<PortalId, string> = {
  chase:       'Chase Ultimate Rewards',
  amex:        'Amex Membership Rewards',
  capital_one: 'Capital One',
  bilt:        'Bilt Rewards',
  citi:        'Citi ThankYou Rewards',
};

const PORTAL_COLOR: Record<PortalId, string> = {
  chase:       '#166534',
  amex:        '#a3e635',
  capital_one: '#f5a623',
  bilt:        '#1a1a1a',
  citi:        '#3b82f6',
};

const PORTAL_ORDER: PortalId[] = ['chase', 'amex', 'capital_one', 'bilt', 'citi'];

export function BalancePanel() {
  const { selectedCards, portalBalances, setPortalBalance } = useSelectedCards();
  const { isDark } = useTheme();
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Partial<Record<PortalId, string>>>({});

  const activePortals = PORTAL_ORDER.filter((pid) =>
    selectedCards.some((cardId) => CARD_PORTAL_MAP[cardId] === pid)
  );

  if (activePortals.length === 0) return null;

  const totalPts = activePortals.reduce((sum, pid) => sum + (portalBalances[pid] ?? 0), 0);
  const totalUsd = Math.round(totalPts * CPP_ESTIMATE);

  function startEdit() {
    const d: Partial<Record<PortalId, string>> = {};
    activePortals.forEach((pid) => {
      d[pid] = (portalBalances[pid] ?? 0) > 0 ? String(portalBalances[pid]) : '';
    });
    setDrafts(d);
    setEditing(true);
  }

  function commitEdit() {
    activePortals.forEach((pid) => {
      const raw = drafts[pid] ?? '';
      const val = parseInt(raw.replace(/,/g, ''), 10);
      setPortalBalance(pid, isNaN(val) ? 0 : Math.max(0, val));
    });
    setEditing(false);
    setDrafts({});
  }

  const panelBg  = isDark ? 'bg-gph-dark-bg'    : 'bg-gray-100';
  const inkCls   = isDark ? 'text-gph-dark-ink'  : 'text-gray-900';
  const mutedCls = isDark ? 'text-gph-dark-muted': 'text-gray-500';
  const inputCls = isDark
    ? 'bg-gph-dark-card border-gph-dark-line text-gph-dark-ink focus:border-gph-dark-action'
    : 'bg-white border-gray-300 text-gray-900 focus:border-gray-500';

  return (
    <div className={`rounded-xl p-4 ${panelBg}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className={`text-[10px] font-bold font-mono uppercase tracking-widest ${mutedCls}`}>
          Balance
        </p>
        <button
          onClick={editing ? commitEdit : startEdit}
          className={`text-[10px] font-bold font-mono uppercase tracking-widest transition-colors ${
            editing
              ? 'text-green-600 hover:text-green-700'
              : `${mutedCls} hover:text-green-600`
          }`}
        >
          {editing ? 'Done ✓' : 'Edit →'}
        </button>
      </div>

      {/* Total */}
      <p className={`text-2xl font-bold font-mono tabular-nums leading-none ${inkCls}`}>
        {totalPts.toLocaleString()}
      </p>
      <p className={`text-xs font-mono mt-1 mb-4 ${mutedCls}`}>
        across {selectedCards.length} card{selectedCards.length !== 1 ? 's' : ''} · ~${totalUsd.toLocaleString()}
      </p>

      {/* Per-portal rows */}
      <div className="space-y-2.5">
        {activePortals.map((pid) => (
          <div key={pid} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ background: isDark && pid === 'bilt' ? '#f3f3f1' : PORTAL_COLOR[pid] }}
            />
            <span className={`text-xs font-medium flex-1 truncate ${inkCls}`}>
              {PORTAL_LABEL[pid]}
            </span>
            {editing ? (
              <input
                type="text"
                inputMode="numeric"
                value={drafts[pid] ?? ''}
                placeholder="0"
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [pid]: e.target.value.replace(/[^0-9]/g, '') }))
                }
                className={`w-24 text-right text-xs font-mono rounded-md px-2 py-1 border outline-none transition-colors ${inputCls}`}
              />
            ) : (
              <span
                className={`text-xs font-bold font-mono tabular-nums ${
                  (portalBalances[pid] ?? 0) === 0 ? mutedCls : inkCls
                }`}
              >
                {(portalBalances[pid] ?? 0).toLocaleString()}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
