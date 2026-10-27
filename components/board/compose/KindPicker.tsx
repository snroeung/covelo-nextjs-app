'use client';

export type PostKind = 'tip' | 'offer';

const OPTIONS: ReadonlyArray<readonly [PostKind, string, string]> = [
  ['tip', 'Travel tip', 'Advice, tricks, trip reports'],
  ['offer', 'Offer', 'Share a deal from covelo'],
];

export function KindPicker({ value, onChange }: { value: PostKind; onChange: (k: PostKind) => void }) {
  return (
    <div role="group" aria-label="What are you posting?" className="grid grid-cols-2 gap-2">
      {OPTIONS.map(([key, title, hint]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={`min-h-11 rounded-lg border-[1.5px] px-3.5 py-3 text-left text-gph-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gph-ink ${
            value === key ? 'border-gph-ink bg-gph-linesoft' : 'border-gph-line bg-gph-card hover:bg-gph-linesoft'
          }`}
        >
          <span className="block text-[13.5px] font-bold">{title}</span>
          <span className="mt-0.5 block text-[11.5px] text-gph-muted">{hint}</span>
        </button>
      ))}
    </div>
  );
}
