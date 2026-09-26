const GOLD = '#D4AF37'

/**
 * The Rnexa logo mark: a fixed black-and-gold monogram badge (stays the
 * same across every design theme, like a real logo would) plus the
 * "Rnexa" wordmark next to it — R always gold, "nexa" in the theme's
 * text color so it stays readable whether the active theme is light or
 * dark.
 */
export default function Brand({ size = 'md', className = '' }) {
  const badge = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-8 w-8 text-sm'
  const word = size === 'sm' ? 'text-base' : 'text-lg'

  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <span
        className={`grid ${badge} place-items-center rounded-md font-display font-bold`}
        style={{ background: '#0A0A0A', color: GOLD }}
      >
        R
      </span>
      <span className={`font-display ${word} font-semibold tracking-tight`}>
        <span style={{ color: GOLD }}>R</span>
        <span className="text-text">nexa</span>
      </span>
    </span>
  )
}

export { GOLD }
