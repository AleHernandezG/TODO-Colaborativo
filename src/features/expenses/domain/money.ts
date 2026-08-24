export const maxAmountCents = 100_000_000 // 1.000.000,00 €

export function isValidAmountCents(cents: number): boolean {
  return Number.isInteger(cents) && cents > 0 && cents <= maxAmountCents
}

export function parseCurrencyToCents(input: string): number | null {
  const trimmed = input.trim().replace(/\s/g, '').replace('€', '')
  if (!trimmed) return null

  // Acepta formato "12.34" o "12,34" o "12"
  const normalized = trimmed.replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null

  const num = Number.parseFloat(normalized)
  if (Number.isNaN(num) || num <= 0) return null

  const cents = Math.round(num * 100)
  return isValidAmountCents(cents) ? cents : null
}

export function formatCents(cents: number, currency: string = 'EUR'): string {
  const euros = cents / 100
  const symbol = currency === 'EUR' ? '€' : currency
  return `${euros.toFixed(2).replace('.', ',')} ${symbol}`
}

/**
 * Divide un importe en céntimos entre N miembros de forma exacta y determinista.
 * Los céntimos sobrantes del redondeo se reparten secuencialmente entre los primeros participantes.
 */
export function splitEvenly(totalCents: number, memberIds: string[]): Record<string, number> {
  if (memberIds.length === 0 || !isValidAmountCents(totalCents)) {
    return {}
  }

  // Ordenar IDs para que el reparto del céntimo residual sea 100% determinista
  const sortedMembers = [...memberIds].sort()
  const count = sortedMembers.length
  const baseShare = Math.floor(totalCents / count)
  const remainder = totalCents % count

  const result: Record<string, number> = {}
  sortedMembers.forEach((memberId, index) => {
    result[memberId] = baseShare + (index < remainder ? 1 : 0)
  })

  return result
}
