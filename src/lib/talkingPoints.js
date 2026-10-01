import { INDUSTRIES } from '../data/industries'
import { SITE } from '../data/site'

/**
 * Matches a lead's free-text industry (from their uploaded Excel) against
 * our known industry list, loosely. Returns null if nothing matches well
 * enough — the script still works without a match, just more generic.
 */
function matchIndustry(freeText) {
  if (!freeText) return null
  const needle = freeText.toLowerCase().trim()
  return (
    INDUSTRIES.find((i) => i.label.toLowerCase().includes(needle) || needle.includes(i.label.toLowerCase())) ||
    INDUSTRIES.find((i) => i.slug.split('-').some((part) => needle.includes(part))) ||
    null
  )
}

/**
 * Builds a short, human-sounding call script from whatever the lead row
 * has — name, area, and a matched (or unmatched) industry. This is plain
 * template logic, not a live AI call — see the Leads tab's own notice.
 */
export function suggestTalkingPoints(lead) {
  const industry = matchIndustry(lead.industry)
  const areaPart = lead.area ? ` ${lead.area}` : ''
  const namePart = lead.name ? lead.name : 'there'

  const opener = `Hi ${namePart}, this is ${SITE.owner} from ${SITE.name} — we build websites and software for${areaPart} businesses. Do you already have a website or software set up for ${lead.industry ? `your ${lead.industry.toLowerCase()}` : 'your business'}?`

  const hook = industry
    ? `For ${industry.label.toLowerCase()} businesses, the usual wins are: ${industry.features.map((f) => f.title).join(', ')}.`
    : `We handle everything from a simple business website to a full booking or ordering system.`

  const closer = `Would it help to see a sample built for a business like yours? I can send a link on WhatsApp right now — no obligation.`

  return { opener, hook, closer, matchedIndustry: industry?.label || null }
}

export const LEAD_STATUSES = [
  { id: 'new', label: 'New', color: 'bg-ink-3 text-text-muted' },
  { id: 'contacted', label: 'Contacted', color: 'bg-signal/15 text-signal-bright' },
  { id: 'interested_website', label: 'Wants website', color: 'bg-emerald-500/15 text-emerald-300' },
  { id: 'interested_saas', label: 'Wants SaaS tool', color: 'bg-emerald-500/15 text-emerald-300' },
  { id: 'interested_upgrade', label: 'Wants an upgrade', color: 'bg-emerald-500/15 text-emerald-300' },
  { id: 'callback', label: 'Call back', color: 'bg-yellow-500/15 text-yellow-300' },
  { id: 'not_interested', label: 'Not interested', color: 'bg-red-500/15 text-red-300' },
  { id: 'no_answer', label: 'No answer', color: 'bg-ink-3 text-text-muted' },
]

export const statusMeta = (id) => LEAD_STATUSES.find((s) => s.id === id) || LEAD_STATUSES[0]
