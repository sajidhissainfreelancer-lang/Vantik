import { Link } from 'react-router-dom'
import { useTheme } from '../lib/ThemeContext'

export default function NotFound() {
  const { theme } = useTheme()
  return (
    <div data-theme={theme} className="grid min-h-screen place-items-center bg-ink px-5 text-center text-text">
      <div>
        <div className="font-display text-6xl font-semibold text-signal">404</div>
        <p className="mt-3 text-text-muted">That page doesn't exist.</p>
        <Link to="/" className="theme-cta inline-block bg-signal px-5 py-2.5 text-sm font-medium text-on-signal mt-6">
          Back to home
        </Link>
      </div>
    </div>
  )
}
