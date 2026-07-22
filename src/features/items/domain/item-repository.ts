import type { Item } from './item'

export interface ItemRepository {
  list(communityId: string): Promise<Item[]>
  add(input: { communityId: string; name: string; quantity: number }): Promise<Item>
  setPurchased(itemId: string, isPurchased: boolean): Promise<void>
  remove(itemId: string): Promise<void>
}
