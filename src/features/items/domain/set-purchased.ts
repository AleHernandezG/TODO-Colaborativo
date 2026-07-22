import type { ItemRepository } from './item-repository'

export function setPurchased(
  repository: ItemRepository,
  itemId: string,
  isPurchased: boolean,
): Promise<void> {
  return repository.setPurchased(itemId, isPurchased)
}
