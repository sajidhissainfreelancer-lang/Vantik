export default function BrowserFrame({ industry, compact = false }) {
  const { domain, brand, accent, hero, features, testimonial, icon } = industry

  return (
    <div className="browser-chrome h-full w-full">
      <div className="browser-chrome-bar">
        <span className="browser-dot" style={{ background: '#FF5F57' }} />
        <span className="browser-dot" style={{ background: '#FEBC2E' }} />
        <span className="browser-dot" style={{ background: '#28C840' }} />
        <div className="ml-3 flex-1 truncate rounded bg-ink px-3 py-1 text-[11px] text-text-muted">
          {domain}
        </div>
      </div>

      <div className={compact ? 'p-4' : 'p-6 md:p-10'}>
        <div className="flex items-center gap-2">
          <span className={compact ? 'text-lg' : 'text-2xl'}>{icon}</span>
          <span className="font-display font-semibold" style={{ color: accent }}>
            {brand}
          </span>
        </div>

        <div className={compact ? 'mt-3' : 'mt-6'}>
          <span
            className="inline-block rounded-full px-2.5 py-1 text-[10px] font-medium"
            style={{ background: `${accent}22`, color: accent }}
          >
            {hero.kicker}
          </span>
          <h3 className={`mt-2 font-display font-semibold leading-tight text-text ${compact ? 'text-base' : 'text-2xl md:text-3xl'}`}>
            {hero.title}
          </h3>
          {!compact && <p className="mt-3 max-w-md text-sm text-text-muted">{hero.body}</p>}

          <div className={`flex items-center gap-3 ${compact ? 'mt-3' : 'mt-5'}`}>
            <span
              className={`rounded-md font-medium text-ink ${compact ? 'px-2.5 py-1 text-[11px]' : 'px-4 py-2 text-sm'}`}
              style={{ background: accent }}
            >
              {hero.cta}
            </span>
            {!compact && (
              <span className="text-sm text-text-muted">
                <strong className="text-text">{hero.stat.value}</strong> {hero.stat.label}
              </span>
            )}
          </div>
        </div>

        {!compact && (
          <>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {features.map((f) => (
                <div key={f.title} className="rounded-lg border border-line bg-ink p-4">
                  <div className="h-1.5 w-8 rounded-full" style={{ background: accent }} />
                  <h4 className="mt-3 font-display text-sm font-semibold text-text">{f.title}</h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-text-muted">{f.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-lg border border-line bg-ink p-5">
              <p className="text-sm italic text-text-muted">“{testimonial.quote}”</p>
              <p className="mt-2 text-xs font-medium text-text">{testimonial.name}</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
