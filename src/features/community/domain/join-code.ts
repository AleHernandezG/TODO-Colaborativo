const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const shape = new RegExp(`^[${alphabet}]{3}-[${alphabet}]{4}$`)

export function normalizeJoinCode(raw: string): string {
  const letters = raw
    .toUpperCase()
    .split('')
    .filter((character) => alphabet.includes(character))
    .join('')
    .slice(0, 7)

  return letters.length > 3 ? `${letters.slice(0, 3)}-${letters.slice(3)}` : letters
}

export function isValidJoinCode(code: string): boolean {
  return shape.test(code)
}

export type JoinCodeExpiry = { status: 'expired' } | { status: 'valid'; daysLeft: number }

const dayMs = 86_400_000

export function joinCodeExpiry(expiresAt: string, now: Date): JoinCodeExpiry {
  const remaining = new Date(expiresAt).getTime() - now.getTime()

  if (!Number.isFinite(remaining) || remaining <= 0) {
    return { status: 'expired' }
  }

  return { status: 'valid', daysLeft: Math.floor(remaining / dayMs) }
}
