import type { ItemRepository } from './item-repository'

export const imageUrlTtlSeconds = 7 * 24 * 60 * 60

export function itemImageUrl(repository: ItemRepository, path: string): Promise<string> {
  return repository.signImageUrl(path)
}
