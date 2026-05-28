'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { CARD_NAMES, type CardId } from '@/lib/points/types';

const CARD_GROUPS: { label: string; cards: CardId[] }[] = [
  { label: 'Chase',            cards: ['chase_reserve', 'chase_preferred', 'chase_freedom_unlimited'] },
  { label: 'American Express', cards: ['amex_platinum', 'amex_gold', 'amex_green'] },
  { label: 'Capital One',      cards: ['c1_venture_x', 'c1_venture', 'c1_savor'] },
  { label: 'Bilt',             cards: ['bilt_blue', 'bilt_obsidian', 'bilt_palladium'] },
  { label: 'Citi',             cards: ['citi_strata_premier', 'citi_strata_elite'] },
];

const KNOWN_CARD_IDS = new Set(CARD_GROUPS.flatMap(g => g.cards));

interface ProfilePopupProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}

export function ProfilePopup({ anchorRef, onClose }: ProfilePopupProps) {
  const { isDark } = useTheme();
  const { user, profile, signOut, updateProfile } = useAuth();

  const popupRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing]         = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [selectedCards, setSelectedCards] = useState<CardId[]>(
    (profile?.preferred_cards ?? []).filter(id => KNOWN_CARD_IDS.has(id))
  );
  const [saving, setSaving]           = useState(false);

  // Sync local state when profile loads
  useEffect(() => {
    setDisplayName(profile?.display_name ?? '');
    setSelectedCards((profile?.preferred_cards ?? []).filter(id => KNOWN_CARD_IDS.has(id)));
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

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  async function handleSave() {
    setSaving(true);
    await updateProfile({ display_name: displayName || null, preferred_cards: selectedCards });
    setSaving(false);
    setEditing(false);
  }

  function toggleCard(id: CardId) {
    setSelectedCards((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  const bg     = isDark ? 'bg-gph-dark-card border-gph-dark-line'  : 'bg-white border-gray-200';
  const textPrimary = isDark ? 'text-white'           : 'text-gray-900';
  const textMuted   = isDark ? 'text-gph-dark-muted'  : 'text-gray-500';
  const divider     = isDark ? 'border-gph-dark-line'  : 'border-gray-100';
  const inputCls    = isDark
    ? 'bg-gph-dark-bg border-gph-dark-line text-white placeholder-gph-dark-muted'
    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400';
  const labelCls = `text-[10px] font-semibold uppercase tracking-widest ${textMuted}`;

  const initials = profile?.display_name
    ? profile.display_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div
      ref={popupRef}
      className={`absolute right-0 top-full mt-2 w-80 rounded-2xl border shadow-xl z-50 flex flex-col max-h-[min(32rem,calc(100vh-5rem))] ${bg}`}
      role="dialog"
      aria-label="Profile"
    >
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-4 border-b ${divider}`}>
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
          onClick={() => { setEditing((v) => !v); }}
          className={`ml-auto shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
            editing
              ? isDark ? 'bg-gph-dark-bg text-gph-dark-muted' : 'bg-gray-100 text-gray-500'
              : isDark ? 'bg-gph-dark-bg text-white hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4 overflow-y-auto flex-1 min-h-0">
        {editing ? (
          <>
            {/* Display Name */}
            <div>
              <label className={`block mb-1 ${labelCls}`}>Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputCls}`}
              />
            </div>

            {/* Preferred cards */}
            <div>
              <label className={`block mb-2 ${labelCls}`}>Preferred cards</label>
              <div className="flex flex-col gap-3">
                {CARD_GROUPS.map(({ label, cards }) => (
                  <div key={label}>
                    <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${textMuted}`}>{label}</p>
                    <div className="flex flex-col gap-1">
                      {cards.map((id) => {
                        const checked = selectedCards.includes(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => toggleCard(id)}
                            className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-sm text-left transition-colors ${
                              checked
                                ? isDark ? 'bg-blue-600/20 text-white' : 'bg-blue-50 text-blue-700'
                                : isDark ? 'hover:bg-white/5 text-gph-dark-muted' : 'hover:bg-gray-50 text-gray-600'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              checked
                                ? 'bg-blue-600 border-blue-600'
                                : isDark ? 'border-gph-dark-line' : 'border-gray-300'
                            }`}>
                              {checked && (
                                <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </span>
                            {CARD_NAMES[id]}
                          </button>
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
            {/* Preferred cards read view */}
            <div>
              <p className={`mb-2 ${labelCls}`}>Preferred cards</p>
              {profile?.preferred_cards && profile.preferred_cards.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {profile.preferred_cards.map((id) => (
                    <span
                      key={id}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        isDark ? 'bg-blue-600/20 text-blue-300' : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {CARD_NAMES[id as CardId]}
                    </span>
                  ))}
                </div>
              ) : (
                <p className={`text-sm ${textMuted}`}>No cards selected — click Edit to add them.</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Sign out */}
      <div className={`border-t px-4 py-3 ${divider}`}>
        <button
          onClick={signOut}
          className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
            isDark
              ? 'text-red-400 hover:bg-red-500/10'
              : 'text-red-600 hover:bg-red-50'
          }`}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
