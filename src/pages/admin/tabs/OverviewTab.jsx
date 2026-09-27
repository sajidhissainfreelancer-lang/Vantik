import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

const money = (n) => `\u20b9${Number(n || 0).toLocaleString('en-IN')}`

export default function OverviewTab() {
  const [stats, setStats] = useState({ clients_count: '', projects_count: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    loadStats()
    loadSummary()
  }, [])

  async function loadStats() {
    const { data } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle()
    if (data) setStats({ clients_count: data.clients_count, projects_count: data.projects_count })
  }

  async function loadSummary() {
    const [clientsRes, invoicesRes, projectsRes] = await Promise.all([
      supabase.from('clients').select('status, product_type'),
      supabase.from('invoices').select('amount, status'),
      supabase.from('projects').select('id'),
    ])
    const clients = clientsRes.data || []
    const invoices = invoicesRes.data || []
    const projects = projectsRes.data || []

    setSummary({
      activeClients: clients.filter((c) => c.status === 'active').length,
      totalClients: clients.length,
      websiteClients: clients.filter((c) => c.product_type === 'website' || c.product_type === 'both').length,
      saasClients: clients.filter((c) => c.product_type === 'saas' || c.product_type === 'both').length,
      revenuePaid: invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.amount || 0), 0),
      revenuePending: invoices
        .filter((i) => i.status === 'pending' || i.status === 'overdue')
        .reduce((s, i) => s + Number(i.amount || 0), 0),
      projectsShipped: projects.length,
    })
  }

  async function saveStats(e) {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    const { error } = await supabase.from('settings').upsert({
      id: 1,
      clients_count: Number(stats.clients_count) || 0,
      projects_count: Number(stats.projects_count) || 0,
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    setMsg(error ? `Error: ${error.message}` : 'Saved.')
  }

  return (
    <div>
      {/* BUSINESS SNAPSHOT */}
      {summary && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-line bg-ink-2 p-5">
            <div className="text-xs text-text-muted">Active clients</div>
            <div className="mt-1 font-display text-2xl font-semibold">{summary.activeClients}</div>
            <div className="mt-0.5 text-[11px] text-text-muted">{summary.totalClients} total in CRM</div>
          </div>
          <div className="rounded-xl border border-line bg-ink-2 p-5">
            <div className="text-xs text-text-muted">Revenue received</div>
            <div className="mt-1 font-display text-2xl font-semibold text-emerald-400">{money(summary.revenuePaid)}</div>
            <div className="mt-0.5 text-[11px] text-text-muted">{money(summary.revenuePending)} pending</div>
          </div>
          <div className="rounded-xl border border-line bg-ink-2 p-5">
            <div className="text-xs text-text-muted">Website clients</div>
            <div className="mt-1 font-display text-2xl font-semibold">{summary.websiteClients}</div>
            <div className="mt-0.5 text-[11px] text-text-muted">website-building product line</div>
          </div>
          <div className="rounded-xl border border-line bg-ink-2 p-5">
            <div className="text-xs text-text-muted">SaaS tool clients</div>
            <div className="mt-1 font-display text-2xl font-semibold">{summary.saasClients}</div>
            <div className="mt-0.5 text-[11px] text-text-muted">SaaS-building product line</div>
          </div>
        </section>
      )}

      {/* HOMEPAGE COUNTERS */}
      <section className="mt-8 rounded-xl border border-line bg-ink-2 p-6">
        <h2 className="font-display text-lg font-semibold">Homepage counters</h2>
        <p className="mt-1 text-sm text-text-muted">
          These numbers show on the public homepage hero ("19+ clients", "21 projects"). They're set
          manually here rather than pulled live from the CRM, so you control exactly what visitors see.
        </p>
        <form onSubmit={saveStats} className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs text-text-muted">Clients served</label>
            <input
              type="number"
              min="0"
              value={stats.clients_count}
              onChange={(e) => setStats((s) => ({ ...s, clients_count: e.target.value }))}
              className="mt-1 w-32 rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted">Projects shipped</label>
            <input
              type="number"
              min="0"
              value={stats.projects_count}
              onChange={(e) => setStats((s) => ({ ...s, projects_count: e.target.value }))}
              className="mt-1 w-32 rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-bright disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {msg && <span className="text-xs text-text-muted">{msg}</span>}
        </form>
      </section>
    </div>
  )
}
