export const itemNameMaxLength = 120

export function normalizeItemName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

export function isValidItemName(name: string): boolean {
  return name.length >= 1 && name.length <= itemNameMaxLength
}
