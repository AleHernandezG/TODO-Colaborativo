export const maxViewersShown = 3

export function othersViewing(usernames: readonly string[], me: string): string[] {
  return usernames.filter((username) => username !== me).sort((a, b) => a.localeCompare(b))
}

export function summarizeViewers(names: readonly string[]) {
  return {
    shown: names.slice(0, maxViewersShown),
    hidden: Math.max(0, names.length - maxViewersShown),
  }
}
