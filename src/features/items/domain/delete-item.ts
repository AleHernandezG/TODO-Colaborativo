import type { ItemRepository } from './item-repository'

export function deleteItem(repository: ItemRepository, itemId: string): Promise<void> {
  return repository.remove(itemId)
}
