import type { ItemRepository } from '../item-repository'
import { setPurchased } from '../set-purchased'

it('le pide al repositorio marcar el estado indicado', async () => {
  const repository: jest.Mocked<ItemRepository> = {
    list: jest.fn(),
    add: jest.fn(),
    setPurchased: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn(),
    subscribe: jest.fn(),
  }

  await setPurchased(repository, 'i1', true)

  expect(repository.setPurchased).toHaveBeenCalledWith('i1', true)
})
