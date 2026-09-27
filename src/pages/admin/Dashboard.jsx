import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { SITE } from '../../data/site'
import OverviewTab from './tabs/OverviewTab'
import ClientsTab from './tabs/ClientsTab'
import InvoicesTab from './tabs/InvoicesTab'
import ProjectsTab from './tabs/ProjectsTab'
import ThemeTab from './tabs/ThemeTab'

const TABS = [
  { id: 'overview', label: 'Overview', component: OverviewTab },
  { id: 'clients', label: 'Clients', component: ClientsTab },
  { id: 'invoices', label: 'Invoices', component: InvoicesTab },
  { id: 'projects', label: 'Projects', component: ProjectsTab },
  { id: 'theme', label: 'Theme', component: ThemeTab },
]

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login')
  }

  const Active = TABS.find((t) => t.id === activeTab)?.component || OverviewTab

  return (
    <div className="min-h-screen bg-ink text-text">
      <header className="sticky top-0 z-10 border-b border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <div className="font-display text-base font-semibold sm:text-lg">{SITE.name} business dashboard</div>
            <div className="truncate text-xs text-text-muted">{user?.email}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <a href="/" className="text-xs text-text-muted hover:text-text sm:text-sm">View site</a>
            <button
              onClick={handleSignOut}
              className="rounded-md border border-line px-2.5 py-1.5 text-xs text-text-muted hover:text-text sm:px-3 sm:text-sm"
            >
              Sign out
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-5 pb-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition sm:px-3 sm:text-sm ${
                activeTab === t.id
                  ? 'bg-signal text-white'
                  : 'text-text-muted hover:bg-ink-2 hover:text-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10">
        <Active />
      </main>
    </div>
  )
}
