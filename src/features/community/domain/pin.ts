export const pinLength = 4

export function isValidPin(raw: string): boolean {
  return /^\d{4}$/.test(raw.trim())
}

export function normalizePin(raw: string): string {
  return raw.trim()
}
