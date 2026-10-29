// The board's small line icons (currentColor, 1.6 stroke). Decorative: every
// use sits next to visible text or inside a button that has an aria-label.

export type BoardIconName =
  | 'up' | 'down' | 'reply' | 'msg' | 'share' | 'save' | 'ext' | 'link' | 'shield' | 'clock'
  | 'search' | 'x' | 'plus' | 'chev-l' | 'chev-r' | 'flag' | 'trash' | 'lock';

interface Props {
  name: BoardIconName;
  size?: number;
  className?: string;
  /** Fill the shape (a selected vote, a saved bookmark) */
  filled?: boolean;
}

export function BoardIcon({ name, size = 14, className, filled = false }: Props) {
  const common = {
    width: size, height: size, fill: filled ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: 1.6,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: `shrink-0 ${className ?? ''}`, 'aria-hidden': true,
  };
  switch (name) {
    case 'up': return <svg viewBox="0 0 16 16" {...common}><path d="M8 2.5 13.5 9H10v4.5H6V9H2.5Z" /></svg>;
    case 'down': return <svg viewBox="0 0 16 16" {...common} style={{ transform: 'rotate(180deg)' }}><path d="M8 2.5 13.5 9H10v4.5H6V9H2.5Z" /></svg>;
    case 'reply': return <svg viewBox="0 0 24 24" {...common}><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 6 6v4" /></svg>;
    case 'msg': return <svg viewBox="0 0 24 24" {...common}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /></svg>;
    case 'share': return <svg viewBox="0 0 24 24" {...common}><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" /></svg>;
    case 'save': return <svg viewBox="0 0 24 24" {...common}><path d="M6 3h12v18l-6-4-6 4Z" /></svg>;
    case 'ext': return <svg viewBox="0 0 24 24" {...common}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>;
    case 'link': return <svg viewBox="0 0 24 24" {...common}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>;
    case 'shield': return <svg viewBox="0 0 24 24" {...common}><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>;
    case 'clock': return <svg viewBox="0 0 24 24" {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case 'search': return <svg viewBox="0 0 24 24" {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
    case 'x': return <svg viewBox="0 0 24 24" {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
    case 'plus': return <svg viewBox="0 0 24 24" {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case 'chev-l': return <svg viewBox="0 0 24 24" {...common}><path d="m15 6-6 6 6 6" /></svg>;
    case 'chev-r': return <svg viewBox="0 0 24 24" {...common}><path d="m9 6 6 6-6 6" /></svg>;
    case 'flag': return <svg viewBox="0 0 24 24" {...common}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>;
    case 'trash': return <svg viewBox="0 0 24 24" {...common}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
    case 'lock': return <svg viewBox="0 0 24 24" {...common}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
  }
}
