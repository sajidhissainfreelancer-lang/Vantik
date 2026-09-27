import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { downloadCSV } from '../../../lib/csv'
import { INDUSTRIES } from '../../../data/industries'

const EMPTY_PROJECT = {
  title: '',
  industry: INDUSTRIES[0].label,
  description: '',
  image_url: '',
  live_url: '',
  tags: '',
  featured: false,
}

export default function ProjectsTab() {
  const [projects, setProjects] = useState([])
  const [form, setForm] = useState(EMPTY_PROJECT)
  const [editingId, setEditingId] = useState(null)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    setProjects(data || [])
    setLoading(false)
  }

  function startEdit(p) {
    setEditingId(p.id)
    setForm({
      title: p.title || '',
      industry: p.industry || INDUSTRIES[0].label,
      description: p.description || '',
      image_url: p.image_url || '',
      live_url: p.live_url || '',
      tags: (p.tags || []).join(', '),
      featured: !!p.featured,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_PROJECT)
  }

  async function submit(e) {
    e.preventDefault()
    setMsg('')
    const payload = {
      title: form.title,
      industry: form.industry,
      description: form.description,
      image_url: form.image_url,
      live_url: form.live_url,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      featured: form.featured,
    }
    const { error } = editingId
      ? await supabase.from('projects').update(payload).eq('id', editingId)
      : await supabase.from('projects').insert(payload)

    if (error) {
      setMsg(`Error: ${error.message}`)
      return
    }
    setMsg(editingId ? 'Project updated.' : 'Project added.')
    resetForm()
    load()
  }

  async function remove(id) {
    if (!confirm('Delete this project?')) return
    await supabase.from('projects').delete().eq('id', id)
    load()
  }

  function exportCSV() {
    downloadCSV(
      `rnexa-projects-${new Date().toISOString().slice(0, 10)}.csv`,
      projects.map((p) => ({
        title: p.title,
        industry: p.industry,
        description: p.description || '',
        live_url: p.live_url || '',
        tags: (p.tags || []).join('; '),
        featured: p.featured ? 'yes' : 'no',
        added: p.created_at?.slice(0, 10) || '',
      }))
    )
  }

  return (
    <div>
      {/* FORM */}
      <section className="rounded-xl border border-line bg-ink-2 p-6">
        <h2 className="font-display text-lg font-semibold">
          {editingId ? 'Edit project' : 'Add a client project'}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          These show under "Recent client work" on the homepage, below the sample industry grid.
        </p>

        <form onSubmit={submit} className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs text-text-muted">Title</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
              placeholder="e.g. Coastal CrossFit — booking site"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted">Industry</label>
            <select
              value={form.industry}
              onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
            >
              {INDUSTRIES.map((i) => (
                <option key={i.slug} value={i.label}>{i.label}</option>
              ))}
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-text-muted">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
              placeholder="One or two lines about what you built."
            />
          </div>
          <div>
            <label className="text-xs text-text-muted">Image URL</label>
            <input
              value={form.image_url}
              onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
              placeholder="https://…"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted">Live URL</label>
            <input
              value={form.live_url}
              onChange={(e) => setForm((f) => ({ ...f, live_url: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
              placeholder="https://client-site.com"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-text-muted">Tags (comma separated)</label>
            <input
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-signal"
              placeholder="React, Supabase, Booking"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-text-muted">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
            />
            Featured
          </label>

          <div className="flex items-center gap-3 md:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-bright"
            >
              {editingId ? 'Update project' : 'Add project'}
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
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Existing projects</h2>
          {projects.length > 0 && (
            <button onClick={exportCSV} className="text-xs text-signal-bright hover:underline">
              ⭳ Export CSV
            </button>
          )}
        </div>
        {loading ? (
          <p className="mt-3 text-sm text-text-muted">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No client projects added yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {projects.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-line bg-ink-2 p-4">
                <div>
                  <div className="text-sm font-medium">{p.title}</div>
                  <div className="text-xs text-text-muted">{p.industry}</div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => startEdit(p)} className="text-xs text-signal-bright hover:underline">
                    Edit
                  </button>
                  <button onClick={() => remove(p.id)} className="text-xs text-red-400 hover:underline">
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
