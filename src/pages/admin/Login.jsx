import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { SITE } from '../../data/site'

export default function Login() {
  const { user, signIn, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/admin" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error: signInError } = await signIn(email, password)
    setSubmitting(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    navigate('/admin')
  }

  return (
    <div className="grid min-h-screen place-items-center bg-ink px-5 text-text">
      <div className="w-full max-w-sm rounded-xl border border-line bg-ink-2 p-8">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-signal text-sm font-bold text-white font-display">
            V
          </span>
          <span className="font-display text-lg font-semibold">{SITE.name} admin</span>
        </div>
        <p className="mt-2 text-sm text-text-muted">Sign in to manage stats and portfolio projects.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs text-text-muted" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-text outline-none focus:border-signal"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-text outline-none focus:border-signal"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-signal px-4 py-2.5 text-sm font-medium text-white transition hover:bg-signal-bright disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-xs text-text-muted">
          Admin accounts are created from the Supabase dashboard (Authentication → Users) —
          there's no public sign-up here on purpose.
        </p>
      </div>
    </div>
  )
}
