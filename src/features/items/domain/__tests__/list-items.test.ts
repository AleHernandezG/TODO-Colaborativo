import type { ItemRepository } from '../item-repository'
import { listItems } from '../list-items'

it('pide al repositorio los artículos de la comunidad', async () => {
  const items = [
    {
      id: 'i1',
      name: 'Leche',
      quantity: 1,
      isPurchased: false,
      createdAt: '2026-07-20T10:00:00.000Z',
    },
  ]
  const repository: jest.Mocked<ItemRepository> = {
    list: jest.fn().mockResolvedValue(items),
    add: jest.fn(),
    setPurchased: jest.fn(),
    remove: jest.fn(),
  }

  await expect(listItems(repository, 'c1')).resolves.toBe(items)
  expect(repository.list).toHaveBeenCalledWith('c1')
})
