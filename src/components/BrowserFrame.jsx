import Reveal from './Reveal'
import TiltCard from './TiltCard'
import { handleImgError } from '../lib/img'

export default function BrowserFrame({ industry, compact = false }) {
  const { domain, brand, accent, hero, icon, heroImage } = industry

  if (compact) {
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
        <div className="relative h-full">
          <img src={heroImage} alt={brand} className="absolute inset-0 h-full w-full object-cover" loading="lazy" onError={handleImgError} />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-transparent" />
          <div className="relative flex h-full flex-col justify-end p-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">{icon}</span>
              <span className="font-display font-semibold" style={{ color: accent }}>{brand}</span>
            </div>
            <h3 className="mt-1.5 font-display text-base font-semibold leading-tight text-text">
              {hero.title}
            </h3>
            <span
              className="mt-2 inline-block w-fit rounded-md px-2.5 py-1 text-[11px] font-medium text-ink"
              style={{ background: accent }}
            >
              {hero.cta}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return <FullSite industry={industry} />
}

function FullSite({ industry }) {
  const { domain, brand, accent, hero, features, testimonial, icon, heroImage, gallery, stats, badges, pricing } = industry

  return (
    <div className="browser-chrome w-full">
      <div className="browser-chrome-bar">
        <span className="browser-dot" style={{ background: '#FF5F57' }} />
        <span className="browser-dot" style={{ background: '#FEBC2E' }} />
        <span className="browser-dot" style={{ background: '#28C840' }} />
        <div className="ml-3 flex-1 truncate rounded bg-ink px-3 py-1 text-[11px] text-text-muted">
          {domain}
        </div>
      </div>

      {/* HERO — full-bleed image */}
      <div className="relative overflow-hidden">
        <img src={heroImage} alt={brand} className="h-[340px] w-full object-cover md:h-[440px]" loading="lazy" onError={handleImgError} />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/80 via-ink/20 to-transparent" />

        <div className="relative flex h-full flex-col justify-end p-6 md:p-10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{icon}</span>
            <span className="font-display font-semibold" style={{ color: accent }}>{brand}</span>
          </div>

          <span
            className="mt-4 inline-block w-fit rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{ background: `${accent}22`, color: accent }}
          >
            {hero.kicker}
          </span>
          <h3 className="mt-2 max-w-lg font-display text-2xl font-semibold leading-tight text-text md:text-4xl">
            {hero.title}
          </h3>
          <p className="mt-3 max-w-md text-sm text-text-muted md:text-base">{hero.body}</p>

          <div className="mt-6 flex items-center gap-4">
            <span
              className="shine cursor-default rounded-md px-5 py-2.5 text-sm font-medium text-ink"
              style={{ background: accent }}
            >
              {hero.cta}
            </span>
          </div>
        </div>

        {/* Floating 3D stat badge */}
        <div className="absolute right-6 top-6 hidden md:block">
          <TiltCard maxTilt={14}>
            <div
              className="float-el rounded-xl border border-line bg-ink-2/90 px-4 py-3 text-center shadow-xl backdrop-blur"
              style={{ '--float-rot': '-4deg' }}
            >
              <div className="font-display text-xl font-semibold" style={{ color: accent }}>
                {hero.stat.value}
              </div>
              <div className="text-[11px] text-text-muted">{hero.stat.label}</div>
            </div>
          </TiltCard>
        </div>
      </div>

      {/* TRUST BADGE MARQUEE */}
      <div className="marquee-wrap overflow-hidden border-y border-line bg-ink py-3">
        <div className="marquee-track">
          {[...badges, ...badges].map((b, i) => (
            <span key={i} className="mx-4 flex shrink-0 items-center gap-2 text-xs text-text-muted">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
              {b}
            </span>
          ))}
        </div>
      </div>

      <div className="p-6 md:p-10">
        {/* STATS STRIP */}
        <Reveal>
          <div className="grid grid-cols-3 gap-3 rounded-xl border border-line bg-ink p-4 sm:gap-4 sm:p-5">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-display text-lg font-semibold text-text sm:text-xl md:text-2xl">{s.value}</div>
                <div className="mt-1 text-[10px] text-text-muted sm:text-[11px] md:text-xs">{s.label}</div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* FEATURES */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 100}>
              <div className="overflow-hidden rounded-lg border border-line bg-ink">
                <img src={f.image} alt={f.title} className="h-28 w-full object-cover sm:h-32" loading="lazy" onError={handleImgError} />
                <div className="p-4">
                  <div className="h-1.5 w-8 rounded-full" style={{ background: accent }} />
                  <h4 className="mt-3 font-display text-sm font-semibold text-text">{f.title}</h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-text-muted">{f.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* GALLERY */}
        <Reveal delay={100}>
          <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            {gallery.map((src, i) => (
              <div key={i} className="aspect-square overflow-hidden rounded-lg border border-line">
                <img src={src} alt="" className="h-full w-full object-cover transition duration-500 hover:scale-110" loading="lazy" onError={handleImgError} />
              </div>
            ))}
          </div>
        </Reveal>

        {/* TESTIMONIAL */}
        <Reveal delay={150}>
          <div className="mt-8 flex items-start gap-4 rounded-lg border border-line bg-ink p-5">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-sm font-semibold text-ink"
              style={{ background: accent }}
            >
              {testimonial.name.charAt(0)}
            </div>
            <div>
              <p className="text-sm italic text-text-muted">&ldquo;{testimonial.quote}&rdquo;</p>
              <p className="mt-2 text-xs font-medium text-text">{testimonial.name}</p>
            </div>
          </div>
        </Reveal>

        {/* PRICING */}
        <div className="mt-10">
          <h4 className="text-center font-display text-lg font-semibold text-text">Pricing</h4>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {pricing.map((tier, i) => (
              <Reveal key={tier.name} delay={i * 100}>
                <div
                  className="flex h-full flex-col rounded-xl border p-5"
                  style={{
                    borderColor: tier.highlight ? accent : '#232838',
                    background: tier.highlight ? `${accent}0D` : '#121620',
                  }}
                >
                  {tier.highlight && (
                    <span
                      className="mb-2 inline-block w-fit rounded-full px-2 py-0.5 text-[10px] font-medium text-ink"
                      style={{ background: accent }}
                    >
                      Most popular
                    </span>
                  )}
                  <div className="font-display text-sm font-semibold text-text">{tier.name}</div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="font-display text-2xl font-semibold text-text">{tier.price}</span>
                    <span className="text-xs text-text-muted">{tier.period}</span>
                  </div>
                  <ul className="mt-3 flex-1 space-y-1.5">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-text-muted">
                        <span style={{ color: accent }}>✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <span
                    className="mt-4 rounded-md px-3 py-2 text-center text-xs font-medium text-ink"
                    style={{ background: tier.highlight ? accent : '#232838', color: tier.highlight ? '#0B0E14' : '#E7E9EE' }}
                  >
                    Choose {tier.name}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
