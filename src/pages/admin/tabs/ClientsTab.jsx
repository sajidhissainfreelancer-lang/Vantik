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
  notes: '',
}

const STATUS_STYLE = {
  lead: 'bg-yellow-500/15 text-yellow-300',
  active: 'bg-emerald-500/15 text-emerald-300',
  completed: 'bg-signal/15 text-signal-bright',
  lost: 'bg-red-500/15 text-red-300',
}

const PRODUCT_LABEL = { website: 'Website', saas: 'SaaS Tool', both: 'Website + SaaS' }

export default function ClientsTab() {
  const [clients, setClients] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false })
    setClients(data || [])
    setLoading(false)
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
      filtered.map((c) => ({
        name: c.name,
        business_name: c.business_name || '',
        email: c.email || '',
        phone: c.phone || '',
        product_type: PRODUCT_LABEL[c.product_type] || c.product_type,
        status: c.status,
        notes: c.notes || '',
        added: c.created_at?.slice(0, 10) || '',
      }))
    )
  }

  return (
    <div>
      <section className="rounded-xl border border-line bg-ink-2 p-6">
        <h2 className="font-display text-lg font-semibold">{editingId ? 'Edit client' : 'Add a client'}</h2>
        <p className="mt-1 text-sm text-text-muted">
          Your private client list — leads, active work, and past clients. Never shown on the public site.
        </p>

        <form onSubmit={submit} className="mt-4 grid gap-4 md:grid-cols-2">
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
          <div className="md:col-span-2">
            <label className="text-xs text-text-muted">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
              placeholder="Anything worth remembering — what they need, when you last spoke, etc."
            />
          </div>

          <div className="flex items-center gap-3 md:col-span-2">
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
          <div className="flex items-center gap-2">
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
            {filtered.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-ink-2 p-4">
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
                <div className="flex items-center gap-3">
                  <button onClick={() => startEdit(c)} className="text-xs text-signal-bright hover:underline">
                    Edit
                  </button>
                  <button onClick={() => remove(c.id)} className="text-xs text-red-400 hover:underline">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
