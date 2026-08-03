import type { Item } from './item'
import type { ItemRepository } from './item-repository'

export async function deleteItem(repository: ItemRepository, item: Item): Promise<void> {
  if (item.imagePath) {
    await repository.removeImage(item.imagePath)
  }

  await repository.remove(item.id)
}
