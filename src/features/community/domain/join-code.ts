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
