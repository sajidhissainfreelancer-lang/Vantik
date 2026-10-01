import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { parseLeadsFile, exportLeadsToExcel } from '../../../lib/leadsExcel'
import { suggestTalkingPoints, LEAD_STATUSES, statusMeta } from '../../../lib/talkingPoints'

export default function LeadsTab() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [remarkDraft, setRemarkDraft] = useState('')
  const [callbackDraft, setCallbackDraft] = useState('')

  const [uploadMsg, setUploadMsg] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    setLeads(data || [])
    setLoading(false)
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadMsg('')
    try {
      const { leads: parsed, unmatchedHeaders } = await parseLeadsFile(file)
      if (parsed.length === 0) {
        setUploadMsg('No rows with a phone number were found in that file.')
        setUploading(false)
        return
      }
      const { error } = await supabase.from('leads').insert(
        parsed.map((l) => ({ name: l.name || 'Unknown', phone: l.phone, industry: l.industry, area: l.area }))
      )
      if (error) {
        setUploadMsg(`Error: ${error.message}`)
      } else {
        setUploadMsg(
          `Imported ${parsed.length} lead${parsed.length === 1 ? '' : 's'}.` +
            (unmatchedHeaders.length ? ` Ignored columns: ${unmatchedHeaders.join(', ')}.` : '')
        )
        load()
      }
    } catch (err) {
      setUploadMsg(`Couldn't read that file: ${err.message}`)
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function startWorking(lead) {
    setExpandedId(expandedId === lead.id ? null : lead.id)
    setRemarkDraft(lead.remarks || '')
    setCallbackDraft(lead.callback_at ? lead.callback_at.slice(0, 16) : '')
  }

  async function logOutcome(lead, status) {
    const payload = {
      status,
      remarks: remarkDraft,
      callback_at: status === 'callback' && callbackDraft ? new Date(callbackDraft).toISOString() : null,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('leads').update(payload).eq('id', lead.id)
    setExpandedId(null)
    load()
  }

  async function removeLead(id) {
    if (!confirm('Delete this lead?')) return
    await supabase.from('leads').delete().eq('id', id)
    load()
  }

  async function clearAllLeads() {
    if (!confirm('Delete ALL leads? This can\u2019t be undone \u2014 export first if you want a backup.')) return
    await supabase.from('leads').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    load()
  }

  const filtered = useMemo(() => {
    const list = statusFilter === 'all' ? leads : leads.filter((l) => l.status === statusFilter)
    // Callbacks due soonest first, then new leads, then everything else, each by recency.
    return [...list].sort((a, b) => {
      const rank = (l) => (l.status === 'callback' ? 0 : l.status === 'new' ? 1 : 2)
      const r = rank(a) - rank(b)
      if (r !== 0) return r
      if (a.status === 'callback' && b.status === 'callback') {
        return (a.callback_at || '').localeCompare(b.callback_at || '')
      }
      return (b.created_at || '').localeCompare(a.created_at || '')
    })
  }, [leads, statusFilter])

  const stats = useMemo(() => {
    const total = leads.length
    const newCount = leads.filter((l) => l.status === 'new').length
    const contacted = leads.filter((l) => l.status !== 'new').length
    const interested = leads.filter((l) => l.status.startsWith('interested_')).length
    const callbacksDue = leads.filter((l) => l.status === 'callback').length
    return { total, newCount, contacted, interested, callbacksDue }
  }, [leads])

  return (
    <div>
      {/* HONEST NOTICE */}
      <section className="rounded-xl border border-signal/30 bg-signal/5 p-4 text-sm text-text-muted sm:p-5">
        <strong className="text-text">How this works:</strong> this doesn't place calls for you — no
        software can dial a real phone number for free. What it does: turns your spreadsheet into a
        worked call queue, gives you a one-tap "Call" button that opens your own phone's dialer, suggests
        what to say based on the lead's industry, and logs your outcome after each call so you can export
        the results back to Excel.
      </section>

      {/* UPLOAD */}
      <section className="mt-6 rounded-xl border border-line bg-ink-2 p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">Upload leads</h2>
        <p className="mt-1 text-sm text-text-muted">
          An .xlsx, .xls or .csv file with columns for name, phone, industry and area (any header names
          close to those work — e.g. "Mobile Number", "Business Type").
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-md bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-bright">
            {uploading ? 'Importing\u2026' : 'Choose file'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              disabled={uploading}
              className="hidden"
            />
          </label>
          {leads.length > 0 && (
            <button
              onClick={() => exportLeadsToExcel(leads, (id) => statusMeta(id).label)}
              className="text-xs text-signal-bright hover:underline sm:text-sm"
            >
              ⭳ Export all leads
            </button>
          )}
          {leads.length > 0 && (
            <button onClick={clearAllLeads} className="text-xs text-red-400 hover:underline sm:text-sm">
              Clear all leads
            </button>
          )}
        </div>
        {uploadMsg && <p className="mt-3 text-xs text-text-muted">{uploadMsg}</p>}
      </section>

      {/* STATS */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard label="Total leads" value={stats.total} />
        <StatCard label="Not yet called" value={stats.newCount} />
        <StatCard label="Contacted" value={stats.contacted} />
        <StatCard label="Interested" value={stats.interested} accent="text-emerald-400" />
        <StatCard label="Callbacks due" value={stats.callbacksDue} accent="text-yellow-400" />
      </section>

      {/* QUEUE */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Call queue ({filtered.length})</h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-line bg-ink px-2 py-1 text-xs text-text-muted outline-none"
          >
            <option value="all">All statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="mt-3 text-sm text-text-muted">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">
            {leads.length === 0 ? 'Upload an Excel file above to build your call queue.' : 'No leads match this filter.'}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {filtered.map((lead) => {
              const isOpen = expandedId === lead.id
              const meta = statusMeta(lead.status)
              const script = suggestTalkingPoints(lead)
              return (
                <div key={lead.id} className="rounded-lg border border-line bg-ink-2">
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <button onClick={() => startWorking(lead)} className="min-w-0 flex-1 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{lead.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.color}`}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-text-muted">
                        {lead.phone}
                        {lead.industry && ` · ${lead.industry}`}
                        {lead.area && ` · ${lead.area}`}
                        {lead.status === 'callback' && lead.callback_at && (
                          <span className="text-yellow-400"> · call back {new Date(lead.callback_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </div>
                    </button>
                    <div className="flex items-center gap-3">
                      <a
                        href={`tel:${lead.phone}`}
                        className="rounded-md bg-signal px-3 py-1.5 text-xs font-medium text-white hover:bg-signal-bright"
                      >
                        ☎ Call
                      </a>
                      <button onClick={() => startWorking(lead)} className="text-xs text-signal-bright hover:underline">
                        {isOpen ? 'Close' : 'Open'}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-line p-4">
                      <h4 className="text-xs font-medium uppercase tracking-wide text-text-muted">Suggested talking points</h4>
                      <div className="mt-2 space-y-2 rounded-md bg-ink p-3 text-xs text-text-muted">
                        <p><span className="text-text">Open:</span> {script.opener}</p>
                        <p><span className="text-text">Mention:</span> {script.hook}</p>
                        <p><span className="text-text">Close:</span> {script.closer}</p>
                      </div>

                      <h4 className="mt-4 text-xs font-medium uppercase tracking-wide text-text-muted">Log the outcome</h4>
                      <textarea
                        rows={2}
                        value={remarkDraft}
                        onChange={(e) => setRemarkDraft(e.target.value)}
                        placeholder="Any notes from the call…"
                        className="mt-2 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
                      />

                      <div className="mt-3 flex flex-wrap gap-2">
                        {LEAD_STATUSES.filter((s) => s.id !== 'new').map((s) => (
                          <button
                            key={s.id}
                            onClick={() => logOutcome(lead, s.id)}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition hover:opacity-80 ${s.color}`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <label className="text-xs text-text-muted">Call back at:</label>
                        <input
                          type="datetime-local"
                          value={callbackDraft}
                          onChange={(e) => setCallbackDraft(e.target.value)}
                          className="rounded-md border border-line bg-ink px-2 py-1.5 text-xs outline-none focus:border-signal"
                        />
                        <span className="text-[11px] text-text-muted">(only used if you pick "Call back" above)</span>
                      </div>

                      <button onClick={() => removeLead(lead.id)} className="mt-4 text-xs text-red-400 hover:underline">
                        Delete this lead
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value, accent = 'text-text' }) {
  return (
    <div className="rounded-xl border border-line bg-ink-2 p-4 sm:p-5">
      <div className="text-[11px] text-text-muted sm:text-xs">{label}</div>
      <div className={`mt-1 font-display text-lg font-semibold sm:text-2xl ${accent}`}>{value}</div>
    </div>
  )
}
