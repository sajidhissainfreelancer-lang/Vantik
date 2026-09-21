import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink text-text-muted">
        Loading…
      </div>
    )
  }

  if (!user) return <Navigate to="/admin/login" replace />

  return children
}
