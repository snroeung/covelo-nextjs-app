'use client';

const REELS = [
  { label: '88k to Tokyo', dur: '0:45' },
  { label: 'Transfer in 60 seconds', dur: '1:02' },
  { label: 'Room tour · Aman Kyoto', dur: '0:38' },
  { label: 'Rent Day, explained', dur: '0:52' },
];

interface Props {
  isDark: boolean;
}

export function DiscoverCreatorBanner({ isDark }: Props) {
  const navyBg = isDark ? 'bg-gph-dark-navy' : 'bg-gph-navy';

  return (
    <div className={`relative overflow-hidden rounded-xl text-white grid grid-cols-1 md:grid-cols-[1.35fr_1fr] ${navyBg}`}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(900px 320px at 8% 120%, rgba(228,228,225,0.20), transparent 70%)' }}
      />

      <div className="relative p-7 md:p-9">
        <div className="flex items-center gap-2.5 flex-wrap mb-4">
          <span className="px-2.5 py-1 bg-gph-gold text-black rounded text-[9.5px] font-mono font-extrabold tracking-[0.12em]">
            COMING SOON
          </span>
          <span className="text-[10px] font-mono font-extrabold tracking-[0.14em] text-white/55">
            CREATOR PROGRAM · INVITE ONLY STAGE
          </span>
        </div>
        <h2 className="text-[28px] md:text-[38px] leading-[1.05] font-extrabold tracking-tight" style={{ textWrap: 'pretty' }}>
          Bring your audience to covelo<span className="text-gph-gold">.</span>
        </h2>
        <p className="mt-3.5 text-sm md:text-[14.5px] leading-relaxed text-white/70 max-w-[520px]">
          Creators will be able to publish short-form video, trip reports, and award-booking
          walkthroughs directly onto Discover — placed alongside the offers they reference, and
          paid on the bookings they drive.
        </p>
        <div className="flex items-center gap-2.5 flex-wrap mt-8 md:mt-16">
          <button type="button" className="flex items-center gap-1.5 px-5 py-2.5 rounded-md text-[13px] font-bold bg-white text-gph-navy min-h-11">
            Join the creator waitlist
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
              <path d="M2 6h8M6.5 2.5L10 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className="px-4 py-2.5 rounded-md text-[12.5px] font-bold border border-white/28 text-white min-h-11">
            How it works
          </button>
        </div>
      </div>

      <div className="relative p-6 pl-0 md:pl-0 flex flex-col justify-center gap-3 min-w-0">
        <div className="flex items-center justify-between gap-2.5 px-6 md:px-0">
          <div className="text-[9.5px] font-mono font-extrabold tracking-[0.12em] text-white/45">
            SHORT-FORM · COMING TO DISCOVER
          </div>
          <div className="flex gap-1.5">
            {['M2 2l-4 4 4 4', 'M2 2l4 4-4 4'].map((d) => (
              <span key={d} className="w-6 h-6 rounded-full border border-white/20 grid place-items-center opacity-40">
                <svg className="w-2.5 h-2.5" viewBox="0 0 8 8" fill="none">
                  <path d={d} stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            ))}
          </div>
        </div>
        <div
          className="flex gap-2.5 overflow-x-auto px-6 md:px-0 pb-1"
          style={{ WebkitOverflowScrolling: 'touch' }}
          tabIndex={0}
          role="group"
          aria-label="Short-form video previews"
        >
          {REELS.map((r, i) => (
            <div key={r.label} className="shrink-0 w-24 md:w-[124px]" style={{ opacity: i === 0 ? 1 : 0.55 }}>
              <div
                className="relative h-[170px] md:h-[220px] rounded-lg overflow-hidden border border-white/14 grid place-items-center"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 8px, transparent 8px 16px)',
                }}
              >
                <span className="w-8 h-8 rounded-full bg-white/16 border border-white/30 grid place-items-center">
                  <span className="block w-0 h-0 ml-0.5" style={{ borderLeft: '9px solid rgba(255,255,255,0.85)', borderTop: '6px solid transparent', borderBottom: '6px solid transparent' }} />
                </span>
                <span className="absolute bottom-2 left-2 text-[9px] font-mono font-bold text-white/60">{r.dur}</span>
              </div>
              <div className="text-[9.5px] md:text-[10.5px] font-mono font-bold leading-snug text-white/50 mt-2">{r.label}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 px-6 md:px-0">
          {[0, 1, 2, 3].map((d) => (
            <span key={d} className="h-1.5 rounded-full" style={{ width: d === 0 ? 16 : 5, background: d === 0 ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
