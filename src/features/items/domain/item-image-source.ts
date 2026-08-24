import type { Item } from './item'

export type ItemImageSource =
  { kind: 'own'; path: string } | { kind: 'catalog'; productId: string } | { kind: 'none' }

export function itemImageSource(
  item: Pick<Item, 'imagePath' | 'catalogProductId'>,
): ItemImageSource {
  if (item.imagePath !== null) {
    return { kind: 'own', path: item.imagePath }
  }
  if (item.catalogProductId !== null) {
    return { kind: 'catalog', productId: item.catalogProductId }
  }
  return { kind: 'none' }
}

export function catalogImageProductIds(items: readonly Item[]): string[] {
  const ids = items.flatMap((item) => {
    const source = itemImageSource(item)
    return source.kind === 'catalog' ? [source.productId] : []
  })

  return [...new Set(ids)].sort()
}
