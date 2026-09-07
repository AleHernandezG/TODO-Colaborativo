import type { Item } from './item'
import { isValidItemName, normalizeItemName } from './item-name'
import type { ItemRepository } from './item-repository'
import { isValidQuantity, minQuantity } from './quantity'

export type AddItemResult =
  { status: 'ok'; item: Item } | { status: 'invalid_name' } | { status: 'invalid_quantity' }

export async function addItem(
  repository: ItemRepository,
  input: {
    id: string
    communityId: string
    name: string
    quantity?: number
    catalogProductId?: string | null
    imageUri?: string | null
  },
): Promise<AddItemResult> {
  const name = normalizeItemName(input.name)
  const quantity = input.quantity ?? minQuantity

  if (!isValidItemName(name)) {
    return { status: 'invalid_name' }
  }
  if (!isValidQuantity(quantity)) {
    return { status: 'invalid_quantity' }
  }

  const imagePath = input.imageUri
    ? await repository.uploadImage({
        communityId: input.communityId,
        itemId: input.id,
        uri: input.imageUri,
      })
    : null

  return {
    status: 'ok',
    item: await repository.add({
      id: input.id,
      communityId: input.communityId,
      name,
      quantity,
      catalogProductId: input.catalogProductId ?? null,
      imagePath,
    }),
  }
}
