import type { Item } from './item'

export type ItemsChannelStatus = 'connecting' | 'connected' | 'disconnected'

export type ItemsSubscriptionHandlers = {
  onChange: () => void
  onStatus: (status: ItemsChannelStatus) => void
}

export interface ItemRepository {
  list(communityId: string): Promise<Item[]>
  add(input: { id: string; communityId: string; name: string; quantity: number }): Promise<Item>
  edit(
    itemId: string,
    input: { name: string; quantity: number; imagePath?: string | null },
  ): Promise<void>
  setPurchased(itemId: string, isPurchased: boolean): Promise<void>
  remove(itemId: string): Promise<void>
  uploadImage(input: { communityId: string; itemId: string; uri: string }): Promise<string>
  removeImage(path: string): Promise<void>
  signImageUrl(path: string): Promise<string>
  subscribe(communityId: string, handlers: ItemsSubscriptionHandlers): () => void
}
