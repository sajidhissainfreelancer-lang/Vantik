import { useRef } from 'react'

/**
 * Wraps children in a card that tilts in 3D toward the pointer.
 * Pure CSS custom-property driven — no animation library needed.
 */
export default function TiltCard({ children, className = '', maxTilt = 10 }) {
  const ref = useRef(null)

  const handleMove = (e) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width // 0..1
    const py = (e.clientY - rect.top) / rect.height // 0..1
    const ry = (px - 0.5) * maxTilt * 2
    const rx = (0.5 - py) * maxTilt * 2
    el.style.setProperty('--rx', `${rx}deg`)
    el.style.setProperty('--ry', `${ry}deg`)
  }

  const handleLeave = () => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`tilt-card ${className}`}
    >
      <div className="tilt-card-inner">{children}</div>
    </div>
  )
}
