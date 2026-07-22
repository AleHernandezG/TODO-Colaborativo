import type { Item } from './item'
import type { ItemRepository } from './item-repository'

export function listItems(repository: ItemRepository, communityId: string): Promise<Item[]> {
  return repository.list(communityId)
}
