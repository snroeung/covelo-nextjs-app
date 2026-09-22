'use client';

import { useEffect } from 'react';
import type { TransferBonus, SpendingBonus } from '@/lib/types/offers';
import { buildModalCopy, isTransfer, daysUntil, ISSUER_LABELS } from '@/lib/discover/offerCopy';
import { gphTheme } from '@/lib/discover/theme';
import { PhotoPlaceholder } from '@/components/discover/PhotoPlaceholder';
import { useSelectedCards } from '@/contexts/SelectedCardsContext';
import { CARD_PORTAL_MAP } from '@/lib/points/types';

interface Props {
  offer: TransferBonus | SpendingBonus;
  isDark: boolean;
  onClose: () => void;
}

export function DiscoverOfferModal({ offer, isDark, onClose }: Props) {
  const { selectedCards, cardBalances } = useSelectedCards();
  const copy = buildModalCopy(offer);
  const transfer = isTransfer(offer);
  const issuerLabel = ISSUER_LABELS[offer.issuer] ?? offer.issuer;

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const issuerBalance = selectedCards
    .filter((id) => CARD_PORTAL_MAP[id] === offer.issuer)
    .reduce((sum, id) => sum + (cardBalances[id] ?? 0), 0);

  const afterBonus = transfer && offer.bonus_pct != null
    ? Math.round(issuerBalance * (offer.effective_ratio ?? 1 + offer.bonus_pct / 100))
    : null;

  const urgentDays = offer.end_date != null ? daysUntil(offer.end_date) : null;

  const { bg, cardBg, line, ink, muted, accent } = gphTheme(isDark);
  const plaqueBg  = isDark ? 'bg-gph-dark-action' : 'bg-gph-action';
  const plaqueInk = isDark ? 'text-gph-dark-bg'   : 'text-white';
  const ghostCls = isDark
    ? 'bg-gph-dark-card border border-gph-dark-line text-gph-dark-ink hover:bg-gph-dark-linesoft'
    : 'bg-gph-card border border-gph-line text-gph-ink hover:bg-gph-linesoft';
  const solidCls = isDark
    ? 'bg-gph-dark-action text-gph-dark-bg hover:bg-gph-dark-actionhi'
    : 'bg-gph-action text-white hover:bg-gph-actionhi';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={copy.headline}
        className={`relative w-full max-w-[900px] max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl ${cardBg} ${line}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <PhotoPlaceholder issuer={offer.issuer} label={copy.kicker} className="h-[180px] md:h-[210px]" />
          <div className="absolute top-4 left-4 flex items-center gap-2 flex-wrap max-w-[80%]">
            <span className="px-2.5 py-1 bg-white/92 text-gph-navy rounded text-[9.5px] font-mono font-extrabold tracking-[0.12em]">
              {copy.kicker}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 grid place-items-center text-white transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <div className={`absolute left-4 bottom-4 flex items-baseline gap-2 px-3.5 py-2 rounded ${plaqueBg}`}>
            <span className={`text-2xl md:text-[32px] font-mono font-extrabold tracking-tight leading-none ${plaqueInk}`}>{copy.value}</span>
            <span className={`text-[10px] font-mono font-bold tracking-[0.08em] ${isDark ? 'text-gph-dark-bg/65' : 'text-white/65'}`}>
              {copy.valueDetail.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1.35fr_1fr]">
          <div className="p-6 md:p-7">
            <h2 className={`text-2xl md:text-[30px] leading-tight font-extrabold tracking-tight ${ink}`} style={{ textWrap: 'pretty' }}>
              {copy.headline}
            </h2>
            <div className={`flex items-center gap-2.5 mt-3 text-[10px] font-mono font-extrabold tracking-[0.12em] ${muted}`}>
              <span>{copy.time}</span>
            </div>
            <p className={`mt-4 text-[14.5px] leading-relaxed ${ink}`} style={{ textWrap: 'pretty' }}>
              {copy.standfirst}
            </p>
            {offer.description && (
              <p className={`mt-3 text-sm leading-relaxed ${muted}`}>{offer.description}</p>
            )}

            <div className={`mt-5 pt-4 border-t ${line}`}>
              <div className={`text-[10px] font-mono font-extrabold tracking-[0.14em] mb-3 ${muted}`}>HOW IT WORKS</div>
              {copy.howItWorks.map((s) => (
                <div key={s.step} className={`grid grid-cols-[26px_1fr] gap-3 py-2.5 border-b ${line}`}>
                  <span className={`text-[11px] font-mono font-extrabold tracking-wide ${accent}`}>{s.step}</span>
                  <div>
                    <div className={`text-[13.5px] font-bold tracking-tight ${ink}`}>{s.title}</div>
                    <div className={`text-xs mt-1 leading-relaxed ${muted}`}>{s.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`p-6 md:p-7 border-t md:border-t-0 md:border-l flex flex-col gap-3.5 ${bg} ${line}`}>
            {transfer && (
              <div className={`p-4 rounded-lg border ${cardBg} ${line}`}>
                <div className={`text-[9px] font-mono font-extrabold tracking-[0.14em] ${muted}`}>
                  YOUR {issuerLabel.toUpperCase()} BALANCE
                </div>
                {issuerBalance > 0 ? (
                  <>
                    <div className={`text-2xl font-mono font-extrabold tracking-tight mt-1.5 leading-none ${ink}`}>
                      {issuerBalance.toLocaleString()}
                    </div>
                    {afterBonus != null && (
                      <div className={`flex items-baseline gap-2 mt-2.5 pt-2.5 border-t ${line}`}>
                        <span className="text-lg font-mono font-extrabold tracking-tight text-gph-good">{afterBonus.toLocaleString()}</span>
                        <span className={`text-[9px] font-mono font-extrabold tracking-[0.14em] ${muted}`}>AFTER BONUS</span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className={`text-xs leading-relaxed mt-1.5 ${muted}`}>
                    Add a {issuerLabel} card balance to see it here.
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {offer.source_url && (
                <a
                  href={offer.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md text-[13px] font-bold min-h-11 ${solidCls}`}
                >
                  View source
                  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 9.5l7-7M9.5 9.5V2.5H2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              )}
              <button type="button" className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md text-xs font-bold min-h-11 ${ghostCls}`}>
                <svg className="w-3 h-3" viewBox="0 0 14 14" fill="none">
                  <path d="M7 12.2S1.5 9 1.5 5.3A2.8 2.8 0 0 1 7 4.1a2.8 2.8 0 0 1 5.5 1.2C12.5 9 7 12.2 7 12.2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
                Save offer
              </button>
            </div>

            <div className={`p-4 rounded-lg border ${cardBg} ${line}`}>
              <div className={`text-[10px] font-mono font-extrabold tracking-[0.14em] pb-2.5 mb-0.5 border-b ${line} ${muted}`}>TERMS</div>
              {copy.terms.map((t) => (
                <div key={t.label} className={`flex items-baseline justify-between gap-2.5 py-1.5 border-b last:border-b-0 ${line}`}>
                  <span className={`text-[11.5px] ${muted}`}>{t.label}</span>
                  <span className={`text-[11.5px] font-mono font-bold text-right ${ink}`}>{t.value}</span>
                </div>
              ))}
              {urgentDays != null && urgentDays > 0 && urgentDays <= 7 && (
                <div className="text-[9px] font-mono font-extrabold tracking-[0.14em] mt-3 text-gph-warn">
                  ● ENDS IN {urgentDays} DAY{urgentDays === 1 ? '' : 'S'}
                </div>
              )}
            </div>

            <div className={`text-[10.5px] font-mono leading-relaxed tracking-wide ${muted}`}>
              Verified by the covelo desk against issuer terms. Rates and terms apply.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
