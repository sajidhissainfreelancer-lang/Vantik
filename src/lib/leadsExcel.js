import * as XLSX from 'xlsx'

// Matches common header spellings to our fixed field names, case-insensitively.
const FIELD_ALIASES = {
  name: ['name', 'customer name', 'customer', 'contact', 'contact name'],
  phone: ['phone', 'phone number', 'mobile', 'mobile number', 'contact number', 'number'],
  industry: ['industry', 'business type', 'category', 'business'],
  area: ['area', 'location', 'city', 'region', 'address'],
}

function matchField(header) {
  const h = String(header).toLowerCase().trim()
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(h)) return field
  }
  return null
}

/**
 * Reads an uploaded .xlsx/.xls/.csv File and returns rows shaped as
 * { name, phone, industry, area }, skipping rows with no phone number.
 * Column headers are matched flexibly (e.g. "Mobile Number" → phone).
 */
export function parseLeadsFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
        if (rows.length === 0) {
          resolve({ leads: [], unmatchedHeaders: [] })
          return
        }

        const headers = Object.keys(rows[0])
        const headerMap = {}
        const unmatchedHeaders = []
        headers.forEach((h) => {
          const field = matchField(h)
          if (field) headerMap[h] = field
          else unmatchedHeaders.push(h)
        })

        const leads = rows
          .map((row) => {
            const lead = { name: '', phone: '', industry: '', area: '' }
            headers.forEach((h) => {
              const field = headerMap[h]
              if (field) lead[field] = String(row[h] ?? '').trim()
            })
            return lead
          })
          .filter((l) => l.phone)

        resolve({ leads, unmatchedHeaders })
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Exports the current leads (with status/remarks) back to a downloadable
 * .xlsx file the user can reopen in Excel or re-import later.
 */
export function exportLeadsToExcel(leads, statusLabel) {
  const rows = leads.map((l) => ({
    Name: l.name,
    Phone: l.phone,
    Industry: l.industry || '',
    Area: l.area || '',
    Status: statusLabel(l.status),
    Remarks: l.remarks || '',
    'Call back at': l.callback_at ? new Date(l.callback_at).toLocaleString('en-IN') : '',
  }))
  const sheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Leads')
  XLSX.writeFile(workbook, `rnexa-leads-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
