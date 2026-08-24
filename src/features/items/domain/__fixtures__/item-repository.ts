import type { Item } from '../item'
import type { ItemRepository } from '../item-repository'

export function fakeItemRepository(
  overrides: Partial<jest.Mocked<ItemRepository>> = {},
): jest.Mocked<ItemRepository> {
  return {
    list: jest.fn(),
    add: jest.fn(),
    edit: jest.fn().mockResolvedValue(undefined),
    setPurchased: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    uploadImage: jest.fn(),
    removeImage: jest.fn().mockResolvedValue(undefined),
    signImageUrl: jest.fn(),
    subscribe: jest.fn(),
    ...overrides,
  }
}

export function fakeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'i1',
    name: 'Leche',
    quantity: 1,
    isPurchased: false,
    imagePath: null,
    catalogProductId: null,
    createdAt: '2026-07-20T10:00:00.000Z',
    ...overrides,
  }
}
