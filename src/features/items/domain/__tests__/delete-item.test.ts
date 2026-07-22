import { deleteItem } from '../delete-item'
import type { ItemRepository } from '../item-repository'

it('le pide al repositorio borrar el artículo', async () => {
  const repository: jest.Mocked<ItemRepository> = {
    list: jest.fn(),
    add: jest.fn(),
    setPurchased: jest.fn(),
    remove: jest.fn().mockResolvedValue(undefined),
  }

  await deleteItem(repository, 'i1')

  expect(repository.remove).toHaveBeenCalledWith('i1')
})
