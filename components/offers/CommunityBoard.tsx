'use client';

const PREVIEW_THREADS = [
  { init: 'MN', author: 'milesnerd',    time: '2h ago',  brand: 'Amex Platinum',   value: '50k MR',  votes: 142, status: 'verified' as const },
  { init: 'PP', author: 'pointsplease', time: '5h ago',  brand: 'World of Hyatt',  value: '2× pts',  votes: 88,  status: 'verified' as const },
  { init: 'SS', author: 'sapphireSteve', time: '8h ago', brand: 'Capital One',     value: '+20%',    votes: 64,  status: 'verified' as const },
];

interface Props {
  isDark: boolean;
}

export function CommunityBoard({ isDark }: Props) {
  const card  = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const ink   = isDark ? 'text-gph-dark-ink'   : 'text-gray-900';
  const muted = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const sub   = isDark ? 'bg-gph-dark-bg border-gph-dark-line' : 'bg-gray-50 border-gray-200';
  const line  = isDark ? 'border-gph-dark-line' : 'border-gray-200';

  return (
    <section className={`rounded-2xl border overflow-hidden ${card}`}>
      {/* Header */}
      <div className="p-6 md:p-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-400 text-black">
            COMING SOON
          </span>
          <span className={`text-[10px] font-mono font-bold tracking-widest ${muted}`}>BETA · INVITE ONLY</span>
        </div>
        <h2 className={`text-2xl md:text-3xl font-bold tracking-tight ${ink}`}>
          Community board<span className={isDark ? 'text-gph-dark-muted' : 'text-gray-400'}>.</span>
        </h2>
        <p className={`mt-2 text-sm leading-relaxed max-w-xl ${muted}`}>
          Verified members post deals they spot in the wild — targeted offers, transfer bonuses, glitch fares.
          Our team double-checks each one. Launching summer 2026.
        </p>

        <div className={`flex items-center gap-6 mt-5 pt-5 border-t ${line}`}>
          <div>
            <div className={`text-xl font-bold font-mono tabular-nums ${ink}`}>~6h</div>
            <div className={`text-[10px] font-mono font-bold tracking-widest mt-0.5 ${muted}`}>AVG VERIFY</div>
          </div>
          <div className={`w-px h-8 ${isDark ? 'bg-gph-dark-line' : 'bg-gray-200'}`} />
          <div>
            <div className="text-xl font-bold font-mono tabular-nums text-green-500">100%</div>
            <div className={`text-[10px] font-mono font-bold tracking-widest mt-0.5 ${muted}`}>HUMAN-CHECKED</div>
          </div>
        </div>
      </div>

      {/* Preview rows — blurred */}
      <div className={`border-t relative ${line}`}>
        <div className="flex flex-col divide-y divide-current">
          {PREVIEW_THREADS.map((thread, i) => (
            <div
              key={thread.author}
              className={`flex items-center gap-4 px-6 py-4 transition-opacity ${sub} ${
                i === 0 ? 'opacity-100' : i === 1 ? 'opacity-50 blur-[1px]' : 'opacity-30 blur-[2px]'
              }`}
              aria-hidden={i > 0}
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-sky-400 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                {thread.init}
              </div>
              {/* Body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                    thread.status === 'verified'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {thread.status === 'verified' ? '✓ VERIFIED' : 'NEW'}
                  </span>
                  <span className={`text-[10px] font-mono font-bold tracking-widest ${muted}`}>
                    {thread.brand.toUpperCase()}
                  </span>
                </div>
                <p className={`text-sm font-semibold truncate ${ink}`}>{thread.author}</p>
                <p className={`text-[10px] font-mono ${muted}`}>{thread.time} · +{thread.votes} heat</p>
              </div>
              {/* Value */}
              <div className={`text-lg font-bold font-mono tabular-nums shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                {thread.value}
              </div>
            </div>
          ))}
        </div>

        {/* Fade + CTA overlay */}
        <div className={`absolute inset-x-0 bottom-0 h-24 pointer-events-none ${
          isDark
            ? 'bg-gradient-to-t from-gph-dark-card to-transparent'
            : 'bg-gradient-to-t from-white to-transparent'
        }`} />
        <div className="absolute inset-x-0 bottom-4 flex justify-center pointer-events-none">
          <div className={`flex items-center gap-3 px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg ${
            isDark ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
          }`}>
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Launching summer 2026 · verified members only
          </div>
        </div>
      </div>
    </section>
  );
}
