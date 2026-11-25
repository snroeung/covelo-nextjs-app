'use client';

import { useTheme } from '@/contexts/ThemeContext';

interface Props {
  show: boolean;
  /** What is unavailable, e.g. "Location search" — forms the headline. */
  subject: string;
  /** Optional guidance shown after the headline. */
  detail?: string;
}

/**
 * Reusable full-width warning for when some capability is unavailable. Rendered in normal
 * flow as the top-most element of the layout (above the nav), so it pushes the page down
 * rather than overlaying it. role="alert", filled amber (dark text, ≥4.5:1 in both themes),
 * NOT dismissible — it stays until the capability recovers. The headline reads
 * "<subject> is temporarily unavailable." Wrap it per feature (e.g. LocationUnavailableBanner)
 * to supply the subject + detail.
 */
export function UnavailableBanner({ show, subject, detail }: Props) {
  const { isDark } = useTheme();
  if (!show) return null;

  const wrap = isDark ? 'bg-amber-500 border-amber-600 text-amber-950' : 'bg-amber-400 border-amber-500 text-amber-950';

  return (
    <div role="alert" className={`w-full shrink-0 border-b shadow-sm ${wrap}`}>
      <div className="mx-auto flex max-w-6xl items-end gap-3 px-4 py-2.5 md:px-8">
        <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
        <p className="flex-1 text-sm leading-snug">
          <span className="font-semibold">{subject} is temporarily unavailable.</span>
          {detail && <span className="opacity-90"> {detail}</span>}
        </p>
      </div>
    </div>
  );
}
