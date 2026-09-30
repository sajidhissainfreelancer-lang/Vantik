import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'
import { supabase } from '../../../lib/supabaseClient'
import { downloadCSV } from '../../../lib/csv'
import { getRangeBounds, inRange, pickGranularity, bucketKey, bucketLabel } from '../../../lib/dateRange'

const money = (n) => `\u20b9${Number(n || 0).toLocaleString('en-IN')}`

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom' },
]

const EXPENSE_CATEGORIES = [
  { id: 'software', label: 'Software & Tools' },
  { id: 'hosting', label: 'Hosting & Domains' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'other', label: 'Other' },
]

const EMPTY_EXPENSE = {
  title: '',
  category: 'other',
  amount: '',
  expense_date: new Date().toISOString().slice(0, 10),
  notes: '',
}

const CHART_TOOLTIP_STYLE = {
  background: '#121620',
  border: '1px solid #232838',
  borderRadius: 8,
  fontSize: 12,
  color: '#E7E9EE',
}
const AXIS_TICK = { fontSize: 11, fill: '#8B93A7' }

export default function FinanceTab() {
  const [invoices, setInvoices] = useState([])
  const [clients, setClients] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  const [preset, setPreset] = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const [form, setForm] = useState(EMPTY_EXPENSE)
  const [editingId, setEditingId] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const [invRes, cliRes, expRes] = await Promise.all([
      supabase.from('invoices').select('id, client_id, title, amount, status, issue_date'),
      supabase.from('clients').select('id, name, business_name'),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
    ])
    setInvoices(invRes.data || [])
    setClients(cliRes.data || [])
    setExpenses(expRes.data || [])
    setLoading(false)
  }

  const { from, to } = useMemo(() => getRangeBounds(preset, customFrom, customTo), [preset, customFrom, customTo])

  const incomeInRange = useMemo(
    () => invoices.filter((i) => i.status === 'paid' && inRange(i.issue_date, from, to)),
    [invoices, from, to]
  )
  const expensesInRange = useMemo(
    () => expenses.filter((e) => inRange(e.expense_date, from, to)),
    [expenses, from, to]
  )

  const totals = useMemo(() => {
    const income = incomeInRange.reduce((s, i) => s + Number(i.amount || 0), 0)
    const expense = expensesInRange.reduce((s, e) => s + Number(e.amount || 0), 0)
    return {
      income,
      expense,
      profit: income - expense,
      salesCount: incomeInRange.length,
      avgDeal: incomeInRange.length ? income / incomeInRange.length : 0,
    }
  }, [incomeInRange, expensesInRange])

  const chartData = useMemo(() => {
    const granularity = pickGranularity(from, to)
    const buckets = {}
    incomeInRange.forEach((i) => {
      const key = bucketKey(i.issue_date, granularity)
      buckets[key] = buckets[key] || { key, income: 0, expenses: 0 }
      buckets[key].income += Number(i.amount || 0)
    })
    expensesInRange.forEach((e) => {
      const key = bucketKey(e.expense_date, granularity)
      buckets[key] = buckets[key] || { key, income: 0, expenses: 0 }
      buckets[key].expenses += Number(e.amount || 0)
    })
    return Object.values(buckets)
      .sort((a, b) => (a.key < b.key ? -1 : 1))
      .map((b) => ({ ...b, label: bucketLabel(b.key, granularity) }))
  }, [incomeInRange, expensesInRange, from, to])

  const topClients = useMemo(() => {
    const byClient = {}
    incomeInRange.forEach((i) => {
      if (!i.client_id) return
      byClient[i.client_id] = (byClient[i.client_id] || 0) + Number(i.amount || 0)
    })
    const clientName = (id) => {
      const c = clients.find((c) => c.id === id)
      return c ? c.business_name || c.name : 'Unknown'
    }
    return Object.entries(byClient)
      .map(([id, total]) => ({ id, name: clientName(id), total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [incomeInRange, clients])

  function startEdit(e) {
    setEditingId(e.id)
    setForm({
      title: e.title || '',
      category: e.category || 'other',
      amount: e.amount ?? '',
      expense_date: e.expense_date || new Date().toISOString().slice(0, 10),
      notes: e.notes || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_EXPENSE)
  }

  async function submit(e) {
    e.preventDefault()
    setMsg('')
    const payload = {
      title: form.title,
      category: form.category,
      amount: Number(form.amount) || 0,
      expense_date: form.expense_date,
      notes: form.notes,
    }
    const { error } = editingId
      ? await supabase.from('expenses').update(payload).eq('id', editingId)
      : await supabase.from('expenses').insert(payload)

    if (error) {
      setMsg(`Error: ${error.message}`)
      return
    }
    setMsg(editingId ? 'Expense updated.' : 'Expense added.')
    resetForm()
    load()
  }

  async function removeExpense(id) {
    if (!confirm('Delete this expense?')) return
    await supabase.from('expenses').delete().eq('id', id)
    load()
  }

  function exportIncome() {
    downloadCSV(
      `rnexa-income-${preset}-${new Date().toISOString().slice(0, 10)}.csv`,
      incomeInRange.map((i) => ({
        title: i.title,
        amount: i.amount,
        issue_date: i.issue_date,
      }))
    )
  }

  function exportExpenses() {
    downloadCSV(
      `rnexa-expenses-${preset}-${new Date().toISOString().slice(0, 10)}.csv`,
      expensesInRange.map((e) => ({
        title: e.title,
        category: EXPENSE_CATEGORIES.find((c) => c.id === e.category)?.label || e.category,
        amount: e.amount,
        date: e.expense_date,
        notes: e.notes || '',
      }))
    )
  }

  return (
    <div>
      {/* DATE RANGE */}
      <section className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition sm:text-sm ${
              preset === p.id ? 'bg-signal text-white' : 'border border-line text-text-muted hover:text-text'
            }`}
          >
            {p.label}
          </button>
        ))}
        {preset === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-md border border-line bg-ink px-2 py-1.5 text-xs outline-none focus:border-signal sm:text-sm"
            />
            <span className="text-xs text-text-muted">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-md border border-line bg-ink px-2 py-1.5 text-xs outline-none focus:border-signal sm:text-sm"
            />
          </div>
        )}
      </section>

      {/* SUMMARY */}
      <section className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-line bg-ink-2 p-4 sm:p-5">
          <div className="text-[11px] text-text-muted sm:text-xs">Income</div>
          <div className="mt-1 font-display text-lg font-semibold text-emerald-400 sm:text-2xl">{money(totals.income)}</div>
        </div>
        <div className="rounded-xl border border-line bg-ink-2 p-4 sm:p-5">
          <div className="text-[11px] text-text-muted sm:text-xs">Expenses</div>
          <div className="mt-1 font-display text-lg font-semibold text-red-400 sm:text-2xl">{money(totals.expense)}</div>
        </div>
        <div className="rounded-xl border border-line bg-ink-2 p-4 sm:p-5">
          <div className="text-[11px] text-text-muted sm:text-xs">Net profit</div>
          <div className={`mt-1 font-display text-lg font-semibold sm:text-2xl ${totals.profit >= 0 ? 'text-signal-bright' : 'text-red-400'}`}>
            {money(totals.profit)}
          </div>
        </div>
        <div className="rounded-xl border border-line bg-ink-2 p-4 sm:p-5">
          <div className="text-[11px] text-text-muted sm:text-xs">Sales</div>
          <div className="mt-1 font-display text-lg font-semibold sm:text-2xl">{totals.salesCount}</div>
        </div>
        <div className="rounded-xl border border-line bg-ink-2 p-4 sm:p-5">
          <div className="text-[11px] text-text-muted sm:text-xs">Avg. deal</div>
          <div className="mt-1 font-display text-lg font-semibold sm:text-2xl">{money(totals.avgDeal)}</div>
        </div>
      </section>

      {/* CHART */}
      <section className="mt-8 rounded-xl border border-line bg-ink-2 p-4 sm:p-6">
        <h2 className="font-display text-base font-semibold sm:text-lg">Income vs. expenses</h2>
        {loading ? (
          <p className="mt-3 text-sm text-text-muted">Loading…</p>
        ) : chartData.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No income or expenses recorded in this range yet.</p>
        ) : (
          <div className="mt-4 h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232838" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: '#232838' }} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v) => money(v)} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#8B93A7' }} />
                <Bar dataKey="income" fill="#34D399" radius={[4, 4, 0, 0]} name="Income" />
                <Bar dataKey="expenses" fill="#F87171" radius={[4, 4, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* TOP CLIENTS THIS PERIOD */}
      {topClients.length > 0 && (
        <section className="mt-8 rounded-xl border border-line bg-ink-2 p-4 sm:p-6">
          <h2 className="font-display text-base font-semibold sm:text-lg">Top clients this period</h2>
          <div className="mt-3 space-y-2">
            {topClients.map((c, i) => (
              <div key={c.id} className="flex items-center justify-between rounded-md bg-ink px-3 py-2 text-sm">
                <span className="text-text-muted">
                  <span className="mr-2 text-xs text-signal-bright">#{i + 1}</span>
                  {c.name}
                </span>
                <span className="font-medium">{money(c.total)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* EXPORTS */}
      <section className="mt-6 flex flex-wrap gap-3">
        <button onClick={exportIncome} className="text-xs text-signal-bright hover:underline sm:text-sm">
          ⭳ Export income (this range)
        </button>
        <button onClick={exportExpenses} className="text-xs text-signal-bright hover:underline sm:text-sm">
          ⭳ Export expenses (this range)
        </button>
      </section>

      {/* EXPENSE FORM */}
      <section className="mt-8 rounded-xl border border-line bg-ink-2 p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">{editingId ? 'Edit expense' : 'Add an expense'}</h2>
        <p className="mt-1 text-sm text-text-muted">Business costs — tools, hosting, marketing — tracked against income above.</p>

        <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-text-muted">Title</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
              placeholder="e.g. Supabase Pro plan"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
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
            <label className="text-xs text-text-muted">Date</label>
            <input
              type="date"
              value={form.expense_date}
              onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-text-muted">Notes</label>
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-bright"
            >
              {editingId ? 'Update expense' : 'Add expense'}
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

      {/* EXPENSE LIST (this range) */}
      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold">Expenses in this range ({expensesInRange.length})</h2>
        {expensesInRange.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No expenses logged in this range.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {expensesInRange.map((e) => (
              <div key={e.id} className="flex flex-col gap-2 rounded-lg border border-line bg-ink-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{e.title}</span>
                    <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-text-muted">
                      {EXPENSE_CATEGORIES.find((c) => c.id === e.category)?.label || e.category}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-text-muted">{e.expense_date}{e.notes ? ` · ${e.notes}` : ''}</div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <span className="font-display text-base font-semibold text-red-400">{money(e.amount)}</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => startEdit(e)} className="text-xs text-signal-bright hover:underline">
                      Edit
                    </button>
                    <button onClick={() => removeExpense(e.id)} className="text-xs text-red-400 hover:underline">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
