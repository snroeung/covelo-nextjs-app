import type { AvatarTone } from '@/lib/board/avatar';

// Gradient ends are chosen so white initials clear 4.5:1 on both stops.
const TONES: Record<AvatarTone, string> = {
  blue: 'from-[#27272a] to-[#52525b]',
  warm: 'from-[#9a3412] to-[#c2410c]',
  green: 'from-[#166534] to-[#15803d]',
  iris: 'from-[#5b21b6] to-[#86198f]',
};

/** Decorative: the author's name is always printed beside it. */
export function Avatar({ initials, tone, size = 28 }: { initials: string; tone: AvatarTone; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-extrabold tracking-tight text-white ${TONES[tone]}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials}
    </span>
  );
}
