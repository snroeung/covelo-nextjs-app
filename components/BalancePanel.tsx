'use client';

import { useState } from 'react';
import { PortalId, CardId, CARD_PORTAL_MAP, CARD_NAMES } from '@/lib/points/types';
import { useSelectedCards } from '@/contexts/SelectedCardsContext';
import { useTheme } from '@/contexts/ThemeContext';

const CPP_ESTIMATE = 0.0125;

const PORTAL_LABEL: Record<PortalId, string> = {
  chase: 'Chase Ultimate Rewards',
  amex:  'Amex Membership Rewards',
  c1:    'Capital One Miles',
  bilt:  'Bilt Rewards',
  citi:  'Citi ThankYou Rewards',
};

const PORTAL_COLOR: Record<PortalId, string> = {
  chase: '#166534',
  amex:  '#a3e635',
  c1:    '#f5a623',
  bilt:  '#1a1a1a',
  citi:  '#3b82f6',
};

const PORTAL_ORDER: PortalId[] = ['chase', 'amex', 'c1', 'bilt', 'citi'];

export function BalancePanel() {
  const { selectedCards, cardBalances, setCardBalance } = useSelectedCards();
  const { isDark } = useTheme();
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Partial<Record<CardId, string>>>({});

  // Portals that have at least one selected card
  const activePortals = PORTAL_ORDER.filter(pid =>
    selectedCards.some(id => CARD_PORTAL_MAP[id] === pid)
  );

  if (activePortals.length === 0) return null;

  // Derive per-portal total from card-level balances
  function portalTotal(pid: PortalId): number {
    return selectedCards
      .filter(id => CARD_PORTAL_MAP[id] === pid)
      .reduce((sum, id) => sum + (cardBalances[id] ?? 0), 0);
  }

  const totalPts = selectedCards.reduce((sum, id) => sum + (cardBalances[id] ?? 0), 0);
  const totalUsd = Math.round(totalPts * CPP_ESTIMATE);

  function startEdit() {
    const d: Partial<Record<CardId, string>> = {};
    selectedCards.forEach(id => {
      const bal = cardBalances[id] ?? 0;
      d[id] = bal > 0 ? String(bal) : '';
    });
    setDrafts(d);
    setEditing(true);
  }

  function commitEdit() {
    selectedCards.forEach(id => {
      const val = parseInt((drafts[id] ?? '').replace(/,/g, ''), 10);
      setCardBalance(id, isNaN(val) ? 0 : Math.max(0, val));
    });
    setEditing(false);
    setDrafts({});
  }

  const panelBg  = isDark ? 'bg-gph-dark-bg'     : 'bg-gray-100';
  const inkCls   = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const mutedCls = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
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
            editing ? 'text-green-600 hover:text-green-700' : `${mutedCls} hover:text-green-600`
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

      {/* Per-portal sections */}
      <div className="space-y-4">
        {activePortals.map(pid => {
          const cardsForPortal = selectedCards.filter(id => CARD_PORTAL_MAP[id] === pid);
          const total = portalTotal(pid);

          return (
            <div key={pid}>
              {/* Portal header row */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ background: isDark && pid === 'bilt' ? '#f3f3f1' : PORTAL_COLOR[pid] }}
                />
                <span className={`text-xs font-medium flex-1 truncate ${inkCls}`}>
                  {PORTAL_LABEL[pid]}
                </span>
                {!editing && (
                  <span className={`text-xs font-bold font-mono tabular-nums ${total === 0 ? mutedCls : inkCls}`}>
                    {total.toLocaleString()}
                  </span>
                )}
              </div>

              {/* Per-card rows */}
              <div className="space-y-1.5 pl-5">
                {cardsForPortal.map(id => (
                  <div key={id} className="flex items-center gap-2">
                    <span className={`text-[11px] flex-1 truncate ${mutedCls}`}>
                      {CARD_NAMES[id]}
                    </span>
                    {editing ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={drafts[id] ?? ''}
                        placeholder="0"
                        onChange={e =>
                          setDrafts(prev => ({ ...prev, [id]: e.target.value.replace(/[^0-9]/g, '') }))
                        }
                        className={`w-24 text-right text-xs font-mono rounded-md px-2 py-1 border outline-none transition-colors ${inputCls}`}
                      />
                    ) : (
                      <span className={`text-[11px] font-mono tabular-nums ${(cardBalances[id] ?? 0) === 0 ? mutedCls : inkCls}`}>
                        {(cardBalances[id] ?? 0).toLocaleString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
