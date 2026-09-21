import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink px-5 text-center text-text">
      <div>
        <div className="font-display text-6xl font-semibold text-signal-bright">404</div>
        <p className="mt-3 text-text-muted">That page doesn't exist.</p>
        <Link to="/" className="mt-6 inline-block rounded-md bg-signal px-5 py-2.5 text-sm font-medium text-white">
          Back to home
        </Link>
      </div>
    </div>
  )
}
