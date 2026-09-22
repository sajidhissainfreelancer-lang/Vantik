import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SITE, WHATSAPP_LINK } from '../data/site'

const links = [
  { to: '/#work', label: 'Work' },
  { to: '/#services', label: 'Services' },
  { to: '/#about', label: 'About' },
  { to: '/#contact', label: 'Contact' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-ink/85 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-signal text-sm font-bold text-white font-display">
            V
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">{SITE.name}</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a key={l.to} href={l.to} className="text-sm text-text-muted transition hover:text-text">
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:block">
          <a
            href={WHATSAPP_LINK()}
            target="_blank"
            rel="noreferrer"
            className="theme-cta shine rounded-md bg-signal px-4 py-2 text-sm font-medium text-white transition hover:bg-signal-bright"
          >
            Start a project
          </a>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="grid h-9 w-9 place-items-center rounded-md border border-line md:hidden"
          aria-label="Toggle menu"
        >
          <span className="text-lg">{open ? '×' : '≡'}</span>
        </button>
      </nav>

      {open && (
        <div className="border-t border-line bg-ink px-5 pb-5 md:hidden">
          <div className="flex flex-col gap-4 pt-4">
            {links.map((l) => (
              <a key={l.to} href={l.to} onClick={() => setOpen(false)} className="text-sm text-text-muted">
                {l.label}
              </a>
            ))}
            <a
              href={WHATSAPP_LINK()}
              target="_blank"
              rel="noreferrer"
              className="rounded-md bg-signal px-4 py-2 text-center text-sm font-medium text-white"
            >
              Start a project
            </a>
          </div>
        </div>
      )}
    </header>
  )
}
