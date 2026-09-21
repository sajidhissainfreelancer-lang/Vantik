import { Link } from 'react-router-dom'
import { SITE, WHATSAPP_LINK, MAIL_LINK } from '../data/site'

export default function Footer() {
  return (
    <footer className="border-t border-line bg-ink-2">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-signal text-xs font-bold text-white font-display">
                V
              </span>
              <span className="font-display text-base font-semibold">{SITE.name}</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-text-muted">
              {SITE.owner} designs and builds websites and web apps for local businesses and startups —
              one industry-specific build at a time.
            </p>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold text-text">Get in touch</h4>
            <ul className="mt-3 space-y-2 text-sm text-text-muted">
              <li>
                <a href={WHATSAPP_LINK()} target="_blank" rel="noreferrer" className="hover:text-text">
                  WhatsApp · {SITE.whatsappDisplay}
                </a>
              </li>
              <li>
                <a href={MAIL_LINK()} className="hover:text-text">
                  {SITE.email}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold text-text">Site</h4>
            <ul className="mt-3 space-y-2 text-sm text-text-muted">
              <li>
                <a href="/#work" className="hover:text-text">Sample work</a>
              </li>
              <li>
                <a href="/#services" className="hover:text-text">Services</a>
              </li>
              <li>
                <Link to="/admin/login" className="hover:text-text">Admin</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-xs text-text-muted md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} {SITE.name}. Built by {SITE.owner}.</span>
          <span>Every sample site on this page is a demo built to show the pattern — not a live client.</span>
        </div>
      </div>
    </footer>
  )
}
