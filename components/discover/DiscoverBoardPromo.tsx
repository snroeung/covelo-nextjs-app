'use client';

// Static, illustrative content — there is no live community-board backend in
// this app yet (the board it links to isn't built either, per scope). Mirrors
// what CommunityBoard.tsx already showed, minus the blur/fade/"launching"
// treatment: presented as live rather than as a coming-soon teaser.
const HOT_THREADS = [
  { id: 't-1', flair: 'SPENDING OFFER', author: 'milesnerd', time: '2h', title: 'Targeted: Amex Platinum 50k MR after $5k spend in 6 months — check your offers tab', value: '50k MR', votes: 142, comments: 38 },
  { id: 't-2', flair: 'TRAVEL TIP', author: 'pointsplease', time: '5h', title: 'The Hyatt Q2 promo registration page is broken on mobile — here’s the workaround', value: '2× pts', votes: 88, comments: 21 },
  { id: 't-3', flair: 'TRANSFER BONUS', author: 'sapphireSteve', time: '8h', title: 'Capital One → Avianca LifeMiles 20% bonus is live, screenshots inside', value: '+20%', votes: 64, comments: 12 },
];

const FLAIR_STYLE: Record<string, string> = {
  'SPENDING OFFER': 'bg-amber-100 text-amber-800',
  'TRAVEL TIP': 'bg-green-100 text-green-800',
  'TRANSFER BONUS': '',
};

function Flair({ label, isDark }: { label: string; isDark: boolean }) {
  const cls = FLAIR_STYLE[label] || (isDark ? 'bg-gph-dark-actionsoft text-gph-dark-action' : 'bg-gph-actionsoft text-gph-action');
  return (
    <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-extrabold tracking-[0.12em] ${cls}`}>
      {label}
    </span>
  );
}

interface Props {
  isDark: boolean;
}

export function DiscoverBoardPromo({ isDark }: Props) {
  const cardBg = isDark ? 'bg-gph-dark-card' : 'bg-gph-card';
  const bg     = isDark ? 'bg-gph-dark-bg'   : 'bg-gph-bg';
  const rule   = isDark ? 'border-gph-dark-ink'  : 'border-gph-ink';
  const line   = isDark ? 'border-gph-dark-line' : 'border-gph-line';
  const ink    = isDark ? 'text-gph-dark-ink'    : 'text-gph-ink';
  const muted  = isDark ? 'text-gph-dark-muted'  : 'text-gph-muted';
  const accent = isDark ? 'text-gph-dark-action' : 'text-gph-action';
  // Large 24px bold text only needs 3:1 contrast, so the shared "good" token
  // (#0f9d58) is fine there — but the 13px bold vote count needs 4.5:1, which
  // that token misses against the light bg (#f5f5f4 → 3.21:1). Darker green
  // for that small-text usage only.
  const good     = 'text-gph-good';
  const voteGood = isDark ? 'text-gph-good' : 'text-green-800';
  const ghostCls = isDark
    ? 'bg-gph-dark-card border border-gph-dark-line text-gph-dark-ink hover:bg-gph-dark-linesoft'
    : 'bg-gph-card border border-gph-line text-gph-ink hover:bg-gph-linesoft';
  const solidCls = isDark
    ? 'bg-gph-dark-action text-gph-dark-bg hover:bg-gph-dark-actionhi'
    : 'bg-gph-action text-white hover:bg-gph-actionhi';

  return (
    <div className={`grid grid-cols-1 md:grid-cols-[1fr_1.15fr] rounded-xl border-[1.5px] overflow-hidden ${rule} ${cardBg}`}>
      <div className="p-7 md:p-8">
        <div className={`text-[10px] font-mono font-extrabold tracking-[0.14em] mb-3 ${muted}`}>
          COMMUNITY · 4,812 MEMBERS · 38 POSTS TODAY
        </div>
        <h2 className={`text-[28px] md:text-[34px] leading-[1.05] font-extrabold tracking-tight ${ink}`}>
          The board<span className={accent}>.</span>
        </h2>
        <p className={`mt-3 text-[14.5px] leading-relaxed max-w-[440px] ${muted}`} style={{ textWrap: 'pretty' }}>
          Members post the deals they find and the tricks that got them booked. Every offer is
          checked by a covelo admin before it carries a verified mark — tips and questions post
          freely.
        </p>
        <div className="flex gap-7 mt-6">
          {([['~6h', 'AVG REVIEW', ink], ['100%', 'HUMAN-CHECKED', good], ['312', 'VERIFIED · 30D', accent]] as const).map(([v, l, c]) => (
            <div key={l}>
              <div className={`text-2xl font-mono font-extrabold tracking-tight leading-none ${c}`}>{v}</div>
              <div className={`text-[9px] font-mono font-extrabold tracking-[0.14em] mt-1.5 ${muted}`}>{l}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2.5 mt-7">
          <a
            href="/discover/board"
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-md text-[13px] font-bold min-h-11 ${solidCls}`}
          >
            Open the board
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
              <path d="M2 6h8M6.5 2.5L10 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <button type="button" className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-md text-xs font-bold min-h-11 ${ghostCls}`}>
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
              <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            New post
          </button>
        </div>
      </div>

      <div className={`p-6 md:p-7 border-t md:border-t-0 md:border-l ${line} ${bg}`}>
        <div className={`flex items-baseline justify-between pb-2.5 mb-1 border-b ${line}`}>
          <span className={`text-[10px] font-mono font-extrabold tracking-[0.14em] ${muted}`}>HOTTEST TODAY</span>
          <span className={`text-[10px] font-mono font-extrabold tracking-[0.14em] ${accent}`}>SEE ALL →</span>
        </div>
        {HOT_THREADS.map((c) => (
          <div
            key={c.id}
            className={`grid grid-cols-[auto_1fr_auto] gap-3.5 items-center py-3 border-b transition-transform hover:translate-x-1 ${line}`}
          >
            <div className="text-center min-w-[34px]">
              <div
                className="mx-auto mb-0.5"
                style={{
                  width: 0, height: 0,
                  borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
                  borderBottom: `7px solid ${c.votes > 50 ? 'var(--color-gph-good)' : isDark ? 'var(--color-gph-dark-muted)' : 'var(--color-gph-muted)'}`,
                }}
              />
              <div className={`text-[13px] font-mono font-extrabold tracking-tight ${c.votes > 50 ? voteGood : ink}`}>{c.votes}</div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <Flair label={c.flair} isDark={isDark} />
              </div>
              <div className={`text-[13.5px] font-bold leading-snug tracking-tight ${ink}`} style={{ textWrap: 'pretty' }}>
                {c.title}
              </div>
              <div className={`text-[9px] font-mono font-extrabold tracking-[0.1em] mt-1.5 ${muted}`}>
                {c.author.toUpperCase()} · {c.time.toUpperCase()} AGO · {c.comments} REPLIES
              </div>
            </div>
            <div className={`text-[17px] font-mono font-extrabold tracking-tight ${accent}`}>{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
