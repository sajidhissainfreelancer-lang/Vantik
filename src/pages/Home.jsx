import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import TiltCard from '../components/TiltCard'
import Reveal from '../components/Reveal'
import BrowserFrame from '../components/BrowserFrame'
import { INDUSTRIES } from '../data/industries'
import { SITE, WHATSAPP_LINK, MAIL_LINK } from '../data/site'
import { useSiteStats, useClientProjects } from '../lib/useSiteData'
import { useTheme } from '../lib/ThemeContext'
import { handleImgError } from '../lib/img'

const SERVICES = [
  {
    title: 'Business websites',
    body: 'A site built around what your business actually sells — not a stock template with your logo dropped in.',
  },
  {
    title: 'SaaS & web applications',
    body: 'Booking systems, dashboards, internal tools and full SaaS products — real backends, real logins, built to run in Chrome, Edge or any modern browser.',
  },
  {
    title: 'Ongoing changes',
    body: 'Need new pages, pricing updates or a redesign later? I keep working on it after launch, not just at handoff.',
  },
]

const TRUST_POINTS = [
  { title: 'Row-level security by default', body: 'Every database table is locked down so only signed-in requests can write — even a leaked public key can\u2019t change your data.' },
  { title: 'Free, auto-renewing SSL', body: 'Every site ships on HTTPS with certificates that renew themselves. No expired-padlock surprises.' },
  { title: 'You own every account', body: 'Your GitHub, your Render, your Supabase. I build on infrastructure you control \u2014 nothing sits in a developer\u2019s personal account you can lose access to.' },
]

const PROCESS = [
  { step: 'Understand the business', body: 'A short call about what you sell, who buys it, and what the site needs to do.' },
  { step: 'Design for the industry', body: 'Layout, copy and visuals built around your business, not a generic kit.' },
  { step: 'Build and connect', body: 'Real forms, real data — booking, inventory or orders wired to a working backend.' },
  { step: 'Launch and support', body: 'Deployed, handed over, and I stay reachable for changes after launch.' },
]

export default function Home() {
  const { stats } = useSiteStats()
  const { projects } = useClientProjects()
  const { theme } = useTheme()

  return (
    <div data-theme={theme} className="min-h-screen bg-ink text-text">
      <Navbar />

      {/* HERO */}
      <section
        className="theme-hero-bg hero-photo relative overflow-hidden"
        style={{ '--hero-photo-url': "url('https://picsum.photos/seed/rnexa-hero-webdev/1920/1080')" }}
      >
        <div className="absolute inset-0 bg-grid-fade" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:py-20 md:grid-cols-[1.2fr_0.8fr] md:py-28">
          <div>
            <span className="inline-block rounded-full border border-line px-3 py-1 text-xs text-text-muted">
              Freelance web developer · Chennai, India
            </span>
            <h1 className="theme-hero-title mt-5 font-display text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl md:text-6xl">
              I build websites that look like they belong to{' '}
              <span className="text-signal">your industry.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base text-text-muted md:text-lg">
              {SITE.owner} designs and codes websites and web applications for gyms, clinics, dealerships,
              restaurants and local businesses that need to show up online — properly.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href={WHATSAPP_LINK()}
                target="_blank"
                rel="noreferrer"
                className="theme-cta shine rounded-md bg-signal px-5 py-3 text-sm font-medium text-on-signal transition hover:bg-signal-bright"
              >
                Message on WhatsApp
              </a>
              <a href="#work" className="text-sm font-medium text-text-muted underline decoration-line underline-offset-4 hover:text-text">
                See sample builds
              </a>
            </div>

            <div className="mt-12 flex flex-wrap gap-10">
              <div>
                <div className="font-display text-3xl font-semibold text-volt">{stats.clients_count}+</div>
                <div className="mt-1 text-xs text-text-muted">clients served</div>
              </div>
              <div>
                <div className="font-display text-3xl font-semibold text-volt">{stats.projects_count}</div>
                <div className="mt-1 text-xs text-text-muted">projects shipped</div>
              </div>
              <div>
                <div className="font-display text-3xl font-semibold text-volt">{INDUSTRIES.length}</div>
                <div className="mt-1 text-xs text-text-muted">industries covered</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <TiltCard maxTilt={8} className="w-full max-w-xs">
              <div className="theme-panel border border-line bg-ink-2 p-3">
                <div className="overflow-hidden rounded-xl">
                  <img
                    src="/sajid.jpg"
                    alt={SITE.owner}
                    className="aspect-[4/5] w-full object-cover"
                  />
                </div>
                <div className="px-2 py-4">
                  <div className="font-display text-lg font-semibold">{SITE.owner}</div>
                  <div className="text-sm text-text-muted">{SITE.role} · {SITE.name}</div>
                </div>
              </div>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* WORK / INDUSTRY SHOWCASE */}
      <section id="work" className="mx-auto max-w-6xl px-5 py-14 sm:py-20 md:py-28">
        <div className="max-w-xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Pick your industry, see the pattern.
          </h2>
          <p className="mt-3 text-text-muted">
            Every card below is a sample site built to show how the layout, copy and features change by
            industry. Click one to open it full-size — this is the level of detail your own site gets.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {INDUSTRIES.map((industry) => (
            <Link key={industry.slug} to={`/demo/${industry.slug}`} className="group block">
              <TiltCard maxTilt={6}>
                <div className="h-56 transition group-hover:-translate-y-0.5">
                  <BrowserFrame industry={industry} compact />
                </div>
              </TiltCard>
              <div className="mt-3 flex items-center justify-between px-1">
                <span className="text-sm font-medium text-text">{industry.label}</span>
                <span className="text-xs text-text-muted transition group-hover:text-signal">
                  View sample →
                </span>
              </div>
            </Link>
          ))}
        </div>

        {projects.length > 0 && (
          <div className="mt-16">
            <h3 className="font-display text-xl font-semibold">Recent client work</h3>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <a
                  key={p.id}
                  href={p.live_url || '#'}
                  target={p.live_url ? '_blank' : undefined}
                  rel="noreferrer"
                  className="theme-panel block border border-line bg-ink-2 p-5 transition hover:border-signal"
                >
                  {p.image_url && (
                    <img src={p.image_url} alt={p.title} className="mb-4 aspect-video w-full rounded-lg object-cover" onError={handleImgError} />
                  )}
                  <div className="text-xs uppercase tracking-wide text-signal">{p.industry}</div>
                  <div className="mt-1 font-display font-semibold">{p.title}</div>
                  {p.description && <p className="mt-2 text-sm text-text-muted">{p.description}</p>}
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* SERVICES */}
      <section id="services" className="border-y border-line bg-ink-2">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20 md:py-28">
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">What I build</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {SERVICES.map((s) => (
              <div key={s.title} className="theme-panel border border-line bg-ink p-6">
                <h3 className="font-display text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{s.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-4">
            {PROCESS.map((p, i) => (
              <div key={p.step} className="border-t border-line pt-4">
                <div className="font-display text-sm text-signal">{String(i + 1).padStart(2, '0')}</div>
                <h4 className="mt-2 font-display text-sm font-semibold">{p.step}</h4>
                <p className="mt-1.5 text-xs leading-relaxed text-text-muted">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST / SECURITY */}
      <section className="relative overflow-hidden border-b border-line">
        <img
          src="https://picsum.photos/seed/rnexa-trust-servers/1920/700"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          onError={handleImgError}
        />
        <div className="absolute inset-0 bg-ink/90" />
        <div className="relative mx-auto max-w-6xl px-5 py-14 sm:py-20">
          <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
            Built on infrastructure you control
          </h2>
          <p className="mt-2 max-w-lg text-sm text-text-muted">
            Every site runs on your own GitHub, Render and Supabase accounts — not mine — with the
            database locked down from day one.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {TRUST_POINTS.map((t) => (
              <Reveal key={t.title}>
                <div className="theme-panel border border-line bg-ink-2/80 p-5 backdrop-blur">
                  <h3 className="font-display text-sm font-semibold text-text">{t.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-text-muted">{t.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="mx-auto max-w-6xl px-5 py-14 sm:py-20 md:py-28">
        <div className="grid gap-12 md:grid-cols-[0.8fr_1.2fr] md:items-center">
          <TiltCard maxTilt={6} className="mx-auto w-full max-w-xs">
            <div className="theme-panel overflow-hidden border border-line">
              <img src="/sajid.jpg" alt={SITE.owner} className="aspect-square w-full object-cover" />
            </div>
          </TiltCard>
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Hi, I'm {SITE.owner}.
            </h2>
            <p className="mt-4 text-text-muted">
              I'm a freelance web developer building websites and web applications for startups and
              local businesses that need to get online properly. Every project starts from the business
              itself — a gym site and a car dealership site should never look the same, and on {SITE.name}
              they don't.
            </p>
            <p className="mt-4 text-text-muted">
              Work runs on React on the frontend and Supabase on the backend, deployed on Render — fast to
              build, easy for me to update whenever you need a change.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {['React', 'Supabase', 'Web Apps', 'Booking Systems', 'E-commerce', 'Dashboards'].map((tag) => (
                <span key={tag} className="rounded-full border border-line px-3 py-1 text-xs text-text-muted">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="border-t border-line bg-ink-2">
        <div className="mx-auto max-w-6xl px-5 py-14 text-center sm:py-20 md:py-28">
          <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Ready to get your business online?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-text-muted">
            Tell me a bit about your business and what you need — I'll reply with a timeline and a
            plan built around your industry.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href={WHATSAPP_LINK()}
              target="_blank"
              rel="noreferrer"
              className="theme-cta shine rounded-md bg-signal px-6 py-3 text-sm font-medium text-on-signal transition hover:bg-signal-bright"
            >
              WhatsApp · {SITE.whatsappDisplay}
            </a>
            <a
              href={MAIL_LINK()}
              className="theme-panel border border-line px-6 py-3 text-sm font-medium text-text transition hover:border-signal"
            >
              {SITE.email}
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
