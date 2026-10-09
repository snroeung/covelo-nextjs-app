// Values live in app/globals.css as --color-issuer-* — referenced here via
// var() since the issuer is a runtime string, not a static Tailwind class.
const ISSUER_TONE: Record<string, string> = {
  chase: 'var(--color-issuer-chase)',
  amex:  'var(--color-issuer-amex)',
  c1:    'var(--color-issuer-c1)',
  bilt:  'var(--color-issuer-bilt)',
  citi:  'var(--color-issuer-citi)',
};

// Same crosshatch texture the old offer cards used over a flat issuer tone —
// there's no editorial photography asset for these offers, so this stands in
// for one rather than shipping a blank tile.
const CROSSHATCH = `repeating-linear-gradient(
  45deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 13px
), repeating-linear-gradient(
  -45deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 13px
)`;

interface Props {
  issuer: string;
  label: string;
  className?: string;
}

export function PhotoPlaceholder({ issuer, label, className = '' }: Props) {
  const bg = ISSUER_TONE[issuer] ?? 'var(--color-issuer-bilt)';
  return (
    <div
      role="img"
      aria-label={label}
      className={`relative overflow-hidden ${className}`}
      style={{ backgroundColor: bg, backgroundImage: CROSSHATCH }}
    />
  );
}
