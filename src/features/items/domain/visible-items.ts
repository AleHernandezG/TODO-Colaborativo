import type { Item } from './item'

export function visibleItems(items: Item[], deletingIds: readonly string[]): Item[] {
  if (deletingIds.length === 0) {
    return items
  }
  return items.filter((item) => !deletingIds.includes(item.id))
}
