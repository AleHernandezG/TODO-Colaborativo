export const usernameMaxLength = 20
export const communityNameMaxLength = 40

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

export function isValidUsername(name: string): boolean {
  return name.length >= 2 && name.length <= usernameMaxLength
}

export function isValidCommunityName(name: string): boolean {
  return name.length >= 2 && name.length <= communityNameMaxLength
}
