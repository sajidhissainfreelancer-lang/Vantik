import { useState } from 'react'
import { useTheme } from '../../../lib/ThemeContext'
import { THEMES } from '../../../data/themes'

export default function ThemeTab() {
  const { theme, setTheme } = useTheme()
  const [saving, setSaving] = useState(null)

  async function handleSelect(id) {
    setSaving(id)
    await setTheme(id)
    setSaving(null)
  }

  return (
    <section className="rounded-xl border border-line bg-ink-2 p-6">
      <h2 className="font-display text-lg font-semibold">Website design style</h2>
      <p className="mt-1 text-sm text-text-muted">
        Changes the look of your public site — colors, fonts, corners and a few signature effects.
        Applies instantly and saves automatically. The sample industry sites inside the browser
        previews keep their own per-industry branding either way, and your Rnexa logo mark stays
        black-and-gold no matter which style is active.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {THEMES.map((t) => {
          const active = theme === t.id
          return (
            <button
              key={t.id}
              onClick={() => handleSelect(t.id)}
              disabled={saving === t.id}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                active ? 'border-signal bg-signal/10' : 'border-line bg-ink hover:border-signal/60'
              }`}
            >
              <span className="mt-0.5 flex shrink-0 -space-x-1.5">
                {t.swatches.map((c, i) => (
                  <span key={i} className="h-5 w-5 rounded-full border border-ink-2" style={{ background: c }} />
                ))}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-text">{t.name}</span>
                  {active && <span className="text-[10px] text-signal-bright">· active</span>}
                  {saving === t.id && <span className="text-[10px] text-text-muted">saving…</span>}
                </span>
                <span className="mt-0.5 block text-xs text-text-muted">{t.desc}</span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
