import { VerifyLegendBadge } from '@/components/board/post/Badges';

const RULES = [
  'Link a covelo offer, or create one for an admin to review.',
  'No referral or affiliate links.',
  'Say if a deal is dead and we’ll archive it.',
];

const CARD = 'rounded-[10px] border border-gph-line bg-gph-card p-[18px]';
const HEAD = 'mb-3.5 border-b border-gph-line pb-3 font-mono text-[10px] font-extrabold tracking-[0.12em] text-gph-muted';

export function BoardSidebar() {
  return (
    <aside aria-label="About the board" className="sticky top-4 hidden flex-col gap-3.5 lg:flex">
      <section className={CARD}>
        <h2 className={HEAD}>OFFER VERIFICATION</h2>
        <div className="flex flex-col gap-3.5">
          <div>
            <VerifyLegendBadge verified />
            <p className="mt-1.5 text-xs leading-normal text-gph-muted">An admin matched the post to a live covelo offer and confirmed terms and expiry.</p>
          </div>
          <div>
            <VerifyLegendBadge verified={false} />
            <p className="mt-1.5 text-xs leading-normal text-gph-muted">Posted by a member, not yet checked. Read the linked offer before acting.</p>
          </div>
        </div>
      </section>

      <section className={CARD}>
        <h2 className={`${HEAD} !mb-2.5`}>BOARD RULES</h2>
        <ol>
          {RULES.map((r, i) => (
            <li key={r} className="grid grid-cols-[20px_1fr] gap-2 py-[5px] text-xs leading-normal text-gph-muted">
              <span aria-hidden="true" className="font-mono text-[10.5px] font-extrabold text-gph-ink">{String(i + 1).padStart(2, '0')}</span>
              <span>{r}</span>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
