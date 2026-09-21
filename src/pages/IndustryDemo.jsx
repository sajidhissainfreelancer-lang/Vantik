import { Link, useParams, Navigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import BrowserFrame from '../components/BrowserFrame'
import { INDUSTRIES, getIndustry } from '../data/industries'
import { WHATSAPP_LINK, SITE } from '../data/site'

export default function IndustryDemo() {
  const { slug } = useParams()
  const industry = getIndustry(slug)

  if (!industry) return <Navigate to="/" replace />

  const others = INDUSTRIES.filter((i) => i.slug !== slug).slice(0, 3)

  return (
    <div className="min-h-screen bg-ink text-text">
      <Navbar />

      <div className="mx-auto max-w-6xl px-5 py-10">
        <Link to="/#work" className="text-sm text-text-muted hover:text-text">
          ← Back to all samples
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-wide text-text-muted">Sample build</span>
            <h1 className="font-display text-3xl font-semibold md:text-4xl">{industry.label}</h1>
            <p className="mt-1 max-w-lg text-sm text-text-muted">{industry.tagline}</p>
          </div>
          <a
            href={WHATSAPP_LINK(`Hi Sajid, I saw the ${industry.label} sample and want something like this for my business.`)}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-signal px-5 py-3 text-sm font-medium text-white transition hover:bg-signal-bright"
          >
            Get a site like this
          </a>
        </div>

        <div className="mt-8">
          <BrowserFrame industry={industry} />
        </div>

        <p className="mt-4 text-center text-xs text-text-muted">
          This is a demo page showing how {SITE.name} approaches a {industry.label.toLowerCase()} site —
          not a real, currently operating business.
        </p>

        <div className="mt-16">
          <h3 className="font-display text-lg font-semibold">Explore other industries</h3>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            {others.map((i) => (
              <Link key={i.slug} to={`/demo/${i.slug}`} className="group block">
                <div className="h-40 overflow-hidden rounded-lg">
                  <BrowserFrame industry={i} compact />
                </div>
                <div className="mt-2 text-sm text-text-muted group-hover:text-text">{i.label}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
