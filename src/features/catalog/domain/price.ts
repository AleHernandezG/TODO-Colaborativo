const symbols: Record<string, string> = { EUR: '€', USD: '$', GBP: '£' }

export function priceAmount(cents: number, decimalSeparator: string): string {
  return (Math.round(cents) / 100).toFixed(2).replace('.', decimalSeparator)
}

export function currencySymbol(currency: string): string {
  return symbols[currency.toUpperCase()] ?? currency.toUpperCase()
}

export type PriceAgeUnit = 'today' | 'day' | 'week' | 'month'

export type PriceAge = {
  unit: PriceAgeUnit
  count: number
}

const dayMs = 24 * 60 * 60 * 1000

export function priceAge(checkedAt: string, now: Date): PriceAge | null {
  const checked = Date.parse(checkedAt)
  if (Number.isNaN(checked)) {
    return null
  }

  const days = Math.floor((now.getTime() - checked) / dayMs)

  if (days < 1) {
    return { unit: 'today', count: 0 }
  }
  if (days < 7) {
    return { unit: 'day', count: days }
  }
  if (days < 30) {
    return { unit: 'week', count: Math.floor(days / 7) }
  }
  return { unit: 'month', count: Math.floor(days / 30) }
}
