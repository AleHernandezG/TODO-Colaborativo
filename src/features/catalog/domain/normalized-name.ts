export const catalogNameMaxLength = 200

export function normalizeCatalogName(raw: string): string {
  const collapsed = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return collapsed.slice(0, catalogNameMaxLength).trimEnd()
}
