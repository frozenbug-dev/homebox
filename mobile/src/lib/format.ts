/** Go zero dates ("0001-01-01T00:00:00Z") and empty strings mean "not set". */
export function parseDate(value?: string | null) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1900) return null
  return d
}

export function formatDate(value?: string | null) {
  const d = parseDate(value)
  return d ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null
}

/** Price in the collection's currency (ISO code), or a plain number without one. */
export function formatPrice(value?: number | null, currency?: string) {
  if (!value) return null
  if (currency) {
    try {
      return value.toLocaleString(undefined, { style: 'currency', currency, maximumFractionDigits: 2 })
    } catch {
      // Unknown currency code: fall through to a plain number.
    }
  }
  return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function pluralize(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`
}
