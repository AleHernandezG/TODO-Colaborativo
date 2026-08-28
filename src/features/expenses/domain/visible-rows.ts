export function visibleRows<T extends { id: string }>(
  rows: T[],
  deletingIds: readonly string[],
): T[] {
  if (deletingIds.length === 0) {
    return rows
  }
  return rows.filter((row) => !deletingIds.includes(row.id))
}
