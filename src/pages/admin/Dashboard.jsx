import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../lib/AuthContext'
import { INDUSTRIES } from '../../data/industries'
import { SITE } from '../../data/site'

const EMPTY_PROJECT = {
  title: '',
  industry: INDUSTRIES[0].label,
  description: '',
  image_url: '',
  live_url: '',
  tags: '',
  featured: false,
}

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState({ clients_count: '', projects_count: '' })
  const [statsSaving, setStatsSaving] = useState(false)
  const [statsMsg, setStatsMsg] = useState('')

  const [projects, setProjects] = useState([])
  const [form, setForm] = useState(EMPTY_PROJECT)
  const [editingId, setEditingId] = useState(null)
  const [projectMsg, setProjectMsg] = useState('')
  const [loadingProjects, setLoadingProjects] = useState(true)

  useEffect(() => {
    loadStats()
    loadProjects()
  }, [])

  async function loadStats() {
    const { data } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle()
    if (data) setStats({ clients_count: data.clients_count, projects_count: data.projects_count })
  }

  async function loadProjects() {
    setLoadingProjects(true)
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    setProjects(data || [])
    setLoadingProjects(false)
  }

  async function saveStats(e) {
    e.preventDefault()
    setStatsSaving(true)
    setStatsMsg('')
    const { error } = await supabase.from('settings').upsert({
      id: 1,
      clients_count: Number(stats.clients_count) || 0,
      projects_count: Number(stats.projects_count) || 0,
      updated_at: new Date().toISOString(),
    })
    setStatsSaving(false)
    setStatsMsg(error ? `Error: ${error.message}` : 'Saved.')
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

  async function submitProject(e) {
    e.preventDefault()
    setProjectMsg('')
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
      setProjectMsg(`Error: ${error.message}`)
      return
    }
    setProjectMsg(editingId ? 'Project updated.' : 'Project added.')
    resetForm()
    loadProjects()
  }

  async function deleteProject(id) {
    if (!confirm('Delete this project?')) return
    await supabase.from('projects').delete().eq('id', id)
    loadProjects()
  }

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen bg-ink text-text">
      <header className="sticky top-0 z-10 border-b border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <div>
            <div className="font-display text-lg font-semibold">{SITE.name} admin</div>
            <div className="text-xs text-text-muted">{user?.email}</div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="text-sm text-text-muted hover:text-text">View site</a>
            <button
              onClick={handleSignOut}
              className="rounded-md border border-line px-3 py-1.5 text-sm text-text-muted hover:text-text"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10">
        {/* STATS */}
        <section className="rounded-xl border border-line bg-ink-2 p-6">
          <h2 className="font-display text-lg font-semibold">Homepage counters</h2>
          <p className="mt-1 text-sm text-text-muted">
            These numbers show on the homepage hero ("19+ clients", "21 projects").
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
              disabled={statsSaving}
              className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-bright disabled:opacity-60"
            >
              {statsSaving ? 'Saving…' : 'Save'}
            </button>
            {statsMsg && <span className="text-xs text-text-muted">{statsMsg}</span>}
          </form>
        </section>

        {/* PROJECT FORM */}
        <section className="mt-8 rounded-xl border border-line bg-ink-2 p-6">
          <h2 className="font-display text-lg font-semibold">
            {editingId ? 'Edit project' : 'Add a client project'}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            These show under "Recent client work" on the homepage, below the sample industry grid.
          </p>

          <form onSubmit={submitProject} className="mt-4 grid gap-4 md:grid-cols-2">
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
              {projectMsg && <span className="text-xs text-text-muted">{projectMsg}</span>}
            </div>
          </form>
        </section>

        {/* PROJECT LIST */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold">Existing projects</h2>
          {loadingProjects ? (
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
                    <button onClick={() => deleteProject(p.id)} className="text-xs text-red-400 hover:underline">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
