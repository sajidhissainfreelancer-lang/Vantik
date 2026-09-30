const startOfDay = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
const endOfDay = (d) => {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

/**
 * Turns a preset ('today' | 'week' | 'month' | 'year' | 'all' | 'custom')
 * into concrete from/to Date objects. 'week' is the current Mon–today.
 */
export function getRangeBounds(preset, customFrom, customTo) {
  const now = new Date()

  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) }
    case 'week': {
      const day = now.getDay() // 0 = Sunday
      const diffToMonday = (day === 0 ? -6 : 1) - day
      const monday = new Date(now)
      monday.setDate(now.getDate() + diffToMonday)
      return { from: startOfDay(monday), to: endOfDay(now) }
    }
    case 'month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: startOfDay(first), to: endOfDay(now) }
    }
    case 'year': {
      const first = new Date(now.getFullYear(), 0, 1)
      return { from: startOfDay(first), to: endOfDay(now) }
    }
    case 'custom':
      return {
        from: customFrom ? startOfDay(new Date(customFrom)) : null,
        to: customTo ? endOfDay(new Date(customTo)) : null,
      }
    case 'all':
    default:
      return { from: null, to: null }
  }
}

export function inRange(dateStr, from, to) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

/** 'day' bucketing for ranges up to ~45 days, 'month' bucketing beyond that. */
export function pickGranularity(from, to) {
  if (!from || !to) return 'month'
  const days = (to - from) / (1000 * 60 * 60 * 24)
  return days <= 45 ? 'day' : 'month'
}

export function bucketKey(dateStr, granularity) {
  const d = new Date(dateStr)
  if (granularity === 'day') return d.toISOString().slice(0, 10)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function bucketLabel(key, granularity) {
  if (granularity === 'day') {
    const d = new Date(key)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  }
  const [y, m] = key.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}
