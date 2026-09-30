import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { downloadCSV } from '../../../lib/csv'

const EMPTY = {
  name: '',
  business_name: '',
  email: '',
  phone: '',
  product_type: 'website',
  status: 'lead',
  source: '',
  address: '',
  gstin: '',
  notes: '',
}

const SOURCE_LABEL = { referral: 'Referral', instagram: 'Instagram', whatsapp: 'WhatsApp', google: 'Google', other: 'Other' }

const STATUS_STYLE = {
  lead: 'bg-yellow-500/15 text-yellow-300',
  active: 'bg-emerald-500/15 text-emerald-300',
  completed: 'bg-signal/15 text-signal-bright',
  lost: 'bg-red-500/15 text-red-300',
}

const INVOICE_STATUS_STYLE = {
  paid: 'bg-emerald-500/15 text-emerald-300',
  pending: 'bg-yellow-500/15 text-yellow-300',
  overdue: 'bg-red-500/15 text-red-300',
}

const PRODUCT_LABEL = { website: 'Website', saas: 'SaaS Tool', both: 'Website + SaaS' }
const money = (n) => `\u20b9${Number(n || 0).toLocaleString('en-IN')}`
const refNo = (id) => `INV-${id.slice(0, 6).toUpperCase()}`

export default function ClientsTab() {
  const [clients, setClients] = useState([])
  const [invoices, setInvoices] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const [cliRes, invRes] = await Promise.all([
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase.from('invoices').select('id, client_id, title, amount, status, issue_date'),
    ])
    setClients(cliRes.data || [])
    setInvoices(invRes.data || [])
    setLoading(false)
  }

  function invoicesFor(clientId) {
    return invoices.filter((i) => i.client_id === clientId)
  }

  function clientTotals(clientId) {
    const list = invoicesFor(clientId)
    const billed = list.reduce((s, i) => s + Number(i.amount || 0), 0)
    const paid = list.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.amount || 0), 0)
    return { billed, paid, outstanding: billed - paid, count: list.length }
  }

  function startEdit(c) {
    setEditingId(c.id)
    setForm({
      name: c.name || '',
      business_name: c.business_name || '',
      email: c.email || '',
      phone: c.phone || '',
      product_type: c.product_type || 'website',
      status: c.status || 'lead',
      source: c.source || '',
      address: c.address || '',
      gstin: c.gstin || '',
      notes: c.notes || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY)
  }

  async function submit(e) {
    e.preventDefault()
    setMsg('')
    const { error } = editingId
      ? await supabase.from('clients').update(form).eq('id', editingId)
      : await supabase.from('clients').insert(form)

    if (error) {
      setMsg(`Error: ${error.message}`)
      return
    }
    setMsg(editingId ? 'Client updated.' : 'Client added.')
    resetForm()
    load()
  }

  async function remove(id) {
    if (!confirm('Delete this client? Their invoices will stay but show as unlinked.')) return
    await supabase.from('clients').delete().eq('id', id)
    load()
  }

  const filtered = statusFilter === 'all' ? clients : clients.filter((c) => c.status === statusFilter)

  function exportCSV() {
    downloadCSV(
      `rnexa-clients-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((c) => {
        const t = clientTotals(c.id)
        return {
          name: c.name,
          business_name: c.business_name || '',
          email: c.email || '',
          phone: c.phone || '',
          product_type: PRODUCT_LABEL[c.product_type] || c.product_type,
          status: c.status,
          source: SOURCE_LABEL[c.source] || c.source || '',
          gstin: c.gstin || '',
          address: c.address || '',
          invoices: t.count,
          total_billed: t.billed,
          total_paid: t.paid,
          outstanding: t.outstanding,
          notes: c.notes || '',
          added: c.created_at?.slice(0, 10) || '',
        }
      })
    )
  }

  return (
    <div>
      <section className="rounded-xl border border-line bg-ink-2 p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">{editingId ? 'Edit client' : 'Add a client'}</h2>
        <p className="mt-1 text-sm text-text-muted">
          Your private client list — leads, active work, and past clients. Never shown on the public site.
        </p>

        <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-text-muted">Contact name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
              placeholder="e.g. Dr. Kantha"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted">Business name</label>
            <input
              value={form.business_name}
              onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
              placeholder="e.g. Kantha Dental Care"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted">Phone</label>
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted">Product</label>
            <select
              value={form.product_type}
              onChange={(e) => setForm((f) => ({ ...f, product_type: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
            >
              <option value="website">Website</option>
              <option value="saas">SaaS Tool</option>
              <option value="both">Website + SaaS</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
            >
              <option value="lead">Lead</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="lost">Lost</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted">Source</label>
            <select
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
            >
              <option value="">— not set —</option>
              <option value="referral">Referral</option>
              <option value="instagram">Instagram</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="google">Google</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted">GSTIN (if registered)</label>
            <input
              value={form.gstin}
              onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm uppercase outline-none focus:border-signal"
              placeholder="22AAAAA0000A1Z5"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-text-muted">Billing address</label>
            <input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
              placeholder="For invoices — street, city, state, PIN"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-text-muted">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
              placeholder="Anything worth remembering — what they need, when you last spoke, etc."
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-bright"
            >
              {editingId ? 'Update client' : 'Add client'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-sm text-text-muted hover:text-text">
                Cancel edit
              </button>
            )}
            {msg && <span className="text-xs text-text-muted">{msg}</span>}
          </div>
        </form>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold">Clients ({filtered.length})</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-line bg-ink px-2 py-1 text-xs text-text-muted outline-none"
            >
              <option value="all">All statuses</option>
              <option value="lead">Lead</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="lost">Lost</option>
            </select>
          </div>
          {filtered.length > 0 && (
            <button onClick={exportCSV} className="text-xs text-signal-bright hover:underline">
              ⭳ Export CSV
            </button>
          )}
        </div>

        {loading ? (
          <p className="mt-3 text-sm text-text-muted">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No clients here yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {filtered.map((c) => {
              const isOpen = expandedId === c.id
              const totals = clientTotals(c.id)
              const clientInvoices = invoicesFor(c.id)
              return (
                <div key={c.id} className="rounded-lg border border-line bg-ink-2">
                  <button
                    onClick={() => setExpandedId(isOpen ? null : c.id)}
                    className="flex w-full flex-col gap-2 p-4 text-left sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{c.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[c.status] || ''}`}>
                          {c.status}
                        </span>
                        <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-text-muted">
                          {PRODUCT_LABEL[c.product_type] || c.product_type}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-text-muted">
                        {c.business_name && <span>{c.business_name} · </span>}
                        {c.email || c.phone || 'No contact info yet'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      <span>{totals.count} invoice{totals.count === 1 ? '' : 's'}</span>
                      {totals.outstanding > 0 && (
                        <span className="text-yellow-400">{money(totals.outstanding)} due</span>
                      )}
                      <span className="text-signal-bright">{isOpen ? 'Hide ▲' : 'View ▾'}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-line p-4">
                      <div className="grid grid-cols-3 gap-3 rounded-lg border border-line bg-ink p-3 text-center sm:gap-4 sm:p-4">
                        <div>
                          <div className="font-display text-base font-semibold sm:text-lg">{money(totals.billed)}</div>
                          <div className="text-[10px] text-text-muted sm:text-[11px]">total billed</div>
                        </div>
                        <div>
                          <div className="font-display text-base font-semibold text-emerald-400 sm:text-lg">{money(totals.paid)}</div>
                          <div className="text-[10px] text-text-muted sm:text-[11px]">received</div>
                        </div>
                        <div>
                          <div className="font-display text-base font-semibold text-yellow-400 sm:text-lg">{money(totals.outstanding)}</div>
                          <div className="text-[10px] text-text-muted sm:text-[11px]">outstanding</div>
                        </div>
                      </div>

                      {c.notes && (
                        <p className="mt-3 rounded-md bg-ink px-3 py-2 text-xs text-text-muted">{c.notes}</p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-3 text-xs">
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="text-signal-bright hover:underline">✉ {c.email}</a>
                        )}
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="text-signal-bright hover:underline">☎ {c.phone}</a>
                        )}
                        {c.source && (
                          <span className="text-text-muted">via {SOURCE_LABEL[c.source] || c.source}</span>
                        )}
                      </div>

                      {(c.gstin || c.address) && (
                        <div className="mt-2 space-y-0.5 text-xs text-text-muted">
                          {c.gstin && <div>GSTIN: <span className="font-mono">{c.gstin}</span></div>}
                          {c.address && <div>{c.address}</div>}
                        </div>
                      )}

                      <h4 className="mt-4 text-xs font-medium uppercase tracking-wide text-text-muted">
                        Invoice history
                      </h4>
                      {clientInvoices.length === 0 ? (
                        <p className="mt-2 text-xs text-text-muted">No invoices for this client yet — add one from the Invoices tab.</p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {clientInvoices
                            .slice()
                            .sort((a, b) => (a.issue_date < b.issue_date ? 1 : -1))
                            .map((inv) => (
                              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-ink px-3 py-2 text-xs">
                                <span className="text-text-muted">{refNo(inv.id)} · {inv.title}</span>
                                <span className="flex items-center gap-2">
                                  <span className="font-medium">{money(inv.amount)}</span>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${INVOICE_STATUS_STYLE[inv.status] || ''}`}>
                                    {inv.status}
                                  </span>
                                </span>
                              </div>
                            ))}
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button onClick={() => startEdit(c)} className="text-xs text-signal-bright hover:underline">
                          Edit client
                        </button>
                        <button onClick={() => remove(c.id)} className="text-xs text-red-400 hover:underline">
                          Delete client
                        </button>
                      </div>
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
