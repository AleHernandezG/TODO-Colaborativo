import { isValidItemName, normalizeItemName } from './item-name'
import type { ItemRepository } from './item-repository'
import { isValidQuantity } from './quantity'

export type ItemImageChange = { kind: 'keep' } | { kind: 'clear' } | { kind: 'replace'; uri: string }

export type EditItemInput = {
  itemId: string
  communityId: string
  name: string
  quantity: number
  image: ItemImageChange
  currentImagePath: string | null
}

export type EditItemResult =
  | { status: 'ok'; name: string }
  | { status: 'invalid_name' }
  | { status: 'invalid_quantity' }

export async function editItem(
  repository: ItemRepository,
  input: EditItemInput,
): Promise<EditItemResult> {
  const name = normalizeItemName(input.name)

  if (!isValidItemName(name)) {
    return { status: 'invalid_name' }
  }
  if (!isValidQuantity(input.quantity)) {
    return { status: 'invalid_quantity' }
  }

  const imagePath = await nextImagePath(repository, input)
  await repository.edit(input.itemId, { name, quantity: input.quantity, imagePath })

  if (imagePath !== undefined && input.currentImagePath && input.currentImagePath !== imagePath) {
    await discardStaleImage(repository, input.currentImagePath)
  }

  return { status: 'ok', name }
}

function discardStaleImage(repository: ItemRepository, path: string): Promise<void> {
  return repository.removeImage(path).catch(() => undefined)
}

function nextImagePath(
  repository: ItemRepository,
  input: EditItemInput,
): Promise<string | null | undefined> {
  if (input.image.kind === 'keep') {
    return Promise.resolve(undefined)
  }
  if (input.image.kind === 'clear') {
    return Promise.resolve(null)
  }

  return repository.uploadImage({
    communityId: input.communityId,
    itemId: input.itemId,
    uri: input.image.uri,
  })
}
