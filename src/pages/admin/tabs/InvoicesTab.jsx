import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { downloadCSV } from '../../../lib/csv'

const EMPTY = {
  client_id: '',
  title: '',
  amount: '',
  status: 'pending',
  issue_date: new Date().toISOString().slice(0, 10),
  due_date: '',
  notes: '',
}

const STATUS_STYLE = {
  paid: 'bg-emerald-500/15 text-emerald-300',
  pending: 'bg-yellow-500/15 text-yellow-300',
  overdue: 'bg-red-500/15 text-red-300',
}

const money = (n) => `\u20b9${Number(n || 0).toLocaleString('en-IN')}`
const refNo = (id) => `INV-${id.slice(0, 6).toUpperCase()}`

function daysOverdue(inv) {
  if (inv.status === 'paid' || !inv.due_date) return 0
  const due = new Date(inv.due_date)
  const today = new Date()
  const diff = Math.floor((today - due) / (1000 * 60 * 60 * 24))
  return diff > 0 ? diff : 0
}

export default function InvoicesTab() {
  const [invoices, setInvoices] = useState([])
  const [clients, setClients] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const [invRes, cliRes] = await Promise.all([
      supabase.from('invoices').select('*').order('issue_date', { ascending: false }),
      supabase.from('clients').select('id, name, business_name').order('name'),
    ])
    setInvoices(invRes.data || [])
    setClients(cliRes.data || [])
    setLoading(false)
  }

  const clientName = (id) => {
    const c = clients.find((c) => c.id === id)
    return c ? c.business_name || c.name : '— unlinked —'
  }

  function startEdit(inv) {
    setEditingId(inv.id)
    setForm({
      client_id: inv.client_id || '',
      title: inv.title || '',
      amount: inv.amount ?? '',
      status: inv.status || 'pending',
      issue_date: inv.issue_date || new Date().toISOString().slice(0, 10),
      due_date: inv.due_date || '',
      notes: inv.notes || '',
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
    const payload = {
      client_id: form.client_id || null,
      title: form.title,
      amount: Number(form.amount) || 0,
      status: form.status,
      issue_date: form.issue_date,
      due_date: form.due_date || null,
      notes: form.notes,
    }
    const { error } = editingId
      ? await supabase.from('invoices').update(payload).eq('id', editingId)
      : await supabase.from('invoices').insert(payload)

    if (error) {
      setMsg(`Error: ${error.message}`)
      return
    }
    setMsg(editingId ? 'Invoice updated.' : 'Invoice added.')
    resetForm()
    load()
  }

  async function remove(id) {
    if (!confirm('Delete this invoice?')) return
    await supabase.from('invoices').delete().eq('id', id)
    load()
  }

  async function markPaid(inv) {
    await supabase.from('invoices').update({ status: 'paid' }).eq('id', inv.id)
    load()
  }

  const filtered = invoices
    .filter((i) => statusFilter === 'all' || i.status === statusFilter)
    .filter((i) => clientFilter === 'all' || i.client_id === clientFilter)

  const totals = useMemo(() => {
    const paid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.amount || 0), 0)
    const pending = invoices
      .filter((i) => i.status === 'pending' || i.status === 'overdue')
      .reduce((s, i) => s + Number(i.amount || 0), 0)
    const overdueCount = invoices.filter((i) => daysOverdue(i) > 0).length
    return { paid, pending, overdueCount }
  }, [invoices])

  function exportCSV() {
    downloadCSV(
      `rnexa-invoices-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((i) => ({
        title: i.title,
        client: clientName(i.client_id),
        amount: i.amount,
        status: i.status,
        issue_date: i.issue_date || '',
        due_date: i.due_date || '',
        notes: i.notes || '',
      }))
    )
  }

  return (
    <div>
      {/* REVENUE SUMMARY */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-ink-2 p-5">
          <div className="text-xs text-text-muted">Total received</div>
          <div className="mt-1 font-display text-2xl font-semibold text-emerald-400">{money(totals.paid)}</div>
        </div>
        <div className="rounded-xl border border-line bg-ink-2 p-5">
          <div className="text-xs text-text-muted">Pending / overdue</div>
          <div className="mt-1 font-display text-2xl font-semibold text-yellow-400">{money(totals.pending)}</div>
        </div>
        <div className="rounded-xl border border-line bg-ink-2 p-5">
          <div className="text-xs text-text-muted">Overdue invoices</div>
          <div className={`mt-1 font-display text-2xl font-semibold ${totals.overdueCount > 0 ? 'text-red-400' : 'text-text'}`}>
            {totals.overdueCount}
          </div>
        </div>
      </section>

      {/* FORM */}
      <section className="mt-8 rounded-xl border border-line bg-ink-2 p-6">
        <h2 className="font-display text-lg font-semibold">{editingId ? 'Edit invoice' : 'Add an invoice'}</h2>
        <p className="mt-1 text-sm text-text-muted">Your private billing record — never shown on the public site.</p>

        <form onSubmit={submit} className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs text-text-muted">Client</label>
            <select
              value={form.client_id}
              onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
            >
              <option value="">— no client linked —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.business_name || c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted">Title</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
              placeholder="e.g. Website build — final payment"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted">Amount (\u20b9)</label>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
            >
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted">Issue date</label>
            <input
              type="date"
              value={form.issue_date}
              onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted">Due date</label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-text-muted">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
            />
          </div>

          <div className="flex items-center gap-3 md:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-bright"
            >
              {editingId ? 'Update invoice' : 'Add invoice'}
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

      {/* LIST */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold">Invoices ({filtered.length})</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-line bg-ink px-2 py-1 text-xs text-text-muted outline-none"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="rounded-md border border-line bg-ink px-2 py-1 text-xs text-text-muted outline-none"
            >
              <option value="all">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.business_name || c.name}</option>
              ))}
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
          <p className="mt-3 text-sm text-text-muted">No invoices here yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {filtered.map((inv) => {
              const overdue = daysOverdue(inv)
              return (
                <div key={inv.id} className="flex flex-col gap-3 rounded-lg border border-line bg-ink-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-mono text-text-muted">{refNo(inv.id)}</span>
                      <span className="text-sm font-medium">{inv.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[inv.status] || ''}`}>
                        {inv.status}
                      </span>
                      {overdue > 0 && (
                        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-300">
                          {overdue}d overdue
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-text-muted">
                      {clientName(inv.client_id)} · issued {inv.issue_date}{inv.due_date ? ` · due ${inv.due_date}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="font-display text-base font-semibold">{money(inv.amount)}</span>
                    <div className="flex items-center gap-3">
                      {inv.status !== 'paid' && (
                        <button onClick={() => markPaid(inv)} className="text-xs text-emerald-400 hover:underline">
                          Mark paid
                        </button>
                      )}
                      <button onClick={() => startEdit(inv)} className="text-xs text-signal-bright hover:underline">
                        Edit
                      </button>
                      <button onClick={() => remove(inv.id)} className="text-xs text-red-400 hover:underline">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
