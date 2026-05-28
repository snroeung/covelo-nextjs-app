'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedCards } from '@/contexts/SelectedCardsContext';
import { CARD_NAMES, type CardId, type PortalId } from '@/lib/points/types';

const CARD_GROUPS: { label: string; portal: PortalId; cards: CardId[] }[] = [
  { label: 'Chase',            portal: 'chase',       cards: ['chase_reserve', 'chase_preferred', 'chase_freedom_unlimited'] },
  { label: 'American Express', portal: 'amex',        cards: ['amex_platinum', 'amex_gold', 'amex_green'] },
  { label: 'Capital One',      portal: 'capital_one', cards: ['c1_venture_x', 'c1_venture', 'c1_savor'] },
  { label: 'Bilt',             portal: 'bilt',        cards: ['bilt_blue', 'bilt_obsidian', 'bilt_palladium'] },
  { label: 'Citi',             portal: 'citi',        cards: ['citi_strata_premier', 'citi_strata_elite'] },
];

const KNOWN_CARD_IDS = new Set(CARD_GROUPS.flatMap(g => g.cards));

interface ProfilePopupProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}

export function ProfilePopup({ anchorRef, onClose }: ProfilePopupProps) {
  const { isDark } = useTheme();
  const { user, profile, signOut, updateProfile } = useAuth();
  const { selectedCards, toggleCard, initCards, cardBalances, setCardBalance } = useSelectedCards();

  const popupRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing]         = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [balanceDrafts, setBalanceDrafts] = useState<Partial<Record<CardId, string>>>({});
  const [saving, setSaving]           = useState(false);

  // Seed context from Supabase profile on first load if localStorage is empty
  useEffect(() => {
    if (profile?.preferred_cards && selectedCards.length === 0 && profile.preferred_cards.length > 0) {
      initCards(profile.preferred_cards.filter(id => KNOWN_CARD_IDS.has(id)) as CardId[]);
    }
    setDisplayName(profile?.display_name ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [anchorRef, onClose]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function startEditing() {
    const drafts: Partial<Record<CardId, string>> = {};
    selectedCards.forEach(id => {
      const bal = cardBalances[id] ?? 0;
      drafts[id] = bal > 0 ? String(bal) : '';
    });
    setBalanceDrafts(drafts);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    Object.entries(balanceDrafts).forEach(([cardId, raw]) => {
      const val = parseInt((raw ?? '').replace(/,/g, ''), 10);
      setCardBalance(cardId as CardId, isNaN(val) ? 0 : Math.max(0, val));
    });
    await updateProfile({ display_name: displayName || null, preferred_cards: selectedCards });
    setSaving(false);
    setEditing(false);
  }

  const bg          = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const textPrimary = isDark ? 'text-white'          : 'text-gray-900';
  const textMuted   = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const divider     = isDark ? 'border-gph-dark-line' : 'border-gray-100';
  const inputCls    = isDark
    ? 'bg-gph-dark-bg border-gph-dark-line text-white placeholder-gph-dark-muted'
    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400';
  const labelCls = `text-[10px] font-semibold uppercase tracking-widest ${textMuted}`;

  const initials = profile?.display_name
    ? profile.display_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  const activeGroups = CARD_GROUPS.map(g => ({
    ...g,
    activeCards: g.cards.filter(id => selectedCards.includes(id)),
  })).filter(g => g.activeCards.length > 0);

  const grandTotal = selectedCards.reduce((sum, id) => sum + (cardBalances[id] ?? 0), 0);

  return (
    <div
      ref={popupRef}
      className={`absolute right-0 top-full mt-2 w-80 rounded-2xl border shadow-xl z-50 flex flex-col max-h-[min(32rem,calc(100vh-5rem))] ${bg}`}
      role="dialog"
      aria-label="Profile"
    >
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-4 border-b shrink-0 ${divider}`}>
        <div className="w-10 h-10 rounded-full bg-green-700 flex items-center justify-center text-white text-sm font-bold shrink-0 select-none">
          {initials}
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-semibold truncate ${textPrimary}`}>
            {profile?.display_name || 'Traveler'}
          </p>
          <p className={`text-xs truncate ${textMuted}`}>{user?.email}</p>
        </div>
        <button
          onClick={() => editing ? (setEditing(false), setBalanceDrafts({})) : startEditing()}
          className={`ml-auto shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
            editing
              ? isDark ? 'bg-gph-dark-bg text-gph-dark-muted' : 'bg-gray-100 text-gray-500'
              : isDark ? 'bg-gph-dark-bg text-white hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {/* Scrollable body */}
      <div className="px-4 py-4 flex flex-col gap-4 overflow-y-auto flex-1 min-h-0">
        {editing ? (
          <>
            {/* Display name */}
            <div>
              <label className={`block mb-1 ${labelCls}`}>Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputCls}`}
              />
            </div>

            {/* Cards + per-card point inputs */}
            <div>
              <label className={`block mb-2 ${labelCls}`}>Cards & points</label>
              <div className="flex flex-col gap-4">
                {CARD_GROUPS.map(({ label, cards }) => (
                  <div key={label}>
                    <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${textMuted}`}>{label}</p>
                    <div className="flex flex-col gap-1">
                      {cards.map(id => {
                        const checked = selectedCards.includes(id);
                        return (
                          <div key={id}>
                            <button
                              type="button"
                              onClick={() => toggleCard(id)}
                              className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-sm text-left transition-colors ${
                                checked
                                  ? isDark ? 'bg-blue-600/20 text-white' : 'bg-blue-50 text-blue-700'
                                  : isDark ? 'hover:bg-white/5 text-gph-dark-muted' : 'hover:bg-gray-50 text-gray-600'
                              }`}
                            >
                              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                checked ? 'bg-blue-600 border-blue-600' : isDark ? 'border-gph-dark-line' : 'border-gray-300'
                              }`}>
                                {checked && (
                                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </span>
                              <span className="flex-1 truncate">{CARD_NAMES[id]}</span>
                            </button>
                            {/* Points input inline under selected card */}
                            {checked && (
                              <div className="flex items-center gap-2 mt-1 ml-6 pl-0.5">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={balanceDrafts[id] ?? ''}
                                  placeholder="0"
                                  onChange={e =>
                                    setBalanceDrafts(prev => ({ ...prev, [id]: e.target.value.replace(/[^0-9]/g, '') }))
                                  }
                                  className={`w-full text-right text-xs font-mono rounded-md px-2 py-1 border outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${inputCls}`}
                                />
                                <span className={`text-xs shrink-0 ${textMuted}`}>pts</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${
                isDark ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gray-900 hover:bg-gray-700 text-white'
              }`}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </>
        ) : (
          <>
            {/* Grand total */}
            {activeGroups.length > 0 && (
              <div className={`rounded-xl px-4 py-3 ${isDark ? 'bg-gph-dark-bg' : 'bg-gray-50'}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${textMuted}`}>Total points</p>
                <p className={`text-2xl font-bold font-mono tabular-nums ${textPrimary}`}>
                  {grandTotal.toLocaleString()}
                </p>
              </div>
            )}

            {/* Per-issuer breakdown */}
            <div>
              <p className={`mb-3 ${labelCls}`}>Preferred cards</p>
              {activeGroups.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {activeGroups.map(({ label, activeCards }) => {
                    const issuerTotal = activeCards.reduce((sum, id) => sum + (cardBalances[id] ?? 0), 0);
                    return (
                      <div key={label}>
                        {/* Issuer row: label + subtotal */}
                        <div className="flex items-center justify-between mb-1.5">
                          <p className={`text-[10px] font-semibold uppercase tracking-widest ${textMuted}`}>{label}</p>
                          <span className={`text-[10px] font-mono font-bold tabular-nums ${
                            issuerTotal > 0
                              ? isDark ? 'text-lime-400' : 'text-lime-700'
                              : textMuted
                          }`}>
                            {issuerTotal > 0 ? issuerTotal.toLocaleString() + ' pts' : '— pts'}
                          </span>
                        </div>
                        {/* Per-card rows */}
                        <div className="flex flex-col gap-1">
                          {activeCards.map(id => {
                            const bal = cardBalances[id] ?? 0;
                            return (
                              <div key={id} className="flex items-center justify-between">
                                <span className={`text-xs truncate ${textPrimary}`}>{CARD_NAMES[id]}</span>
                                <span className={`text-xs font-mono tabular-nums ml-2 shrink-0 ${bal > 0 ? textPrimary : textMuted}`}>
                                  {bal > 0 ? bal.toLocaleString() : '—'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={`text-sm ${textMuted}`}>No cards selected — click Edit to add them.</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Sign out */}
      <div className={`border-t px-4 py-3 shrink-0 ${divider}`}>
        <button
          onClick={signOut}
          className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
            isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'
          }`}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
