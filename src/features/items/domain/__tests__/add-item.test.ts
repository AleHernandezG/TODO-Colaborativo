import { addItem } from '../add-item'
import type { ItemRepository } from '../item-repository'

function fakeRepository(): jest.Mocked<ItemRepository> {
  return {
    add: jest.fn().mockResolvedValue({
      id: 'i1',
      name: 'Leche',
      quantity: 1,
      isPurchased: false,
      createdAt: '2026-07-20T10:00:00.000Z',
    }),
    list: jest.fn(),
    setPurchased: jest.fn(),
    remove: jest.fn(),
  }
}

it('añade el artículo y devuelve lo que guardó el repositorio', async () => {
  const repository = fakeRepository()

  const result = await addItem(repository, { communityId: 'c1', name: 'Leche' })

  expect(result).toEqual({
    status: 'ok',
    item: {
      id: 'i1',
      name: 'Leche',
      quantity: 1,
      isPurchased: false,
      createdAt: '2026-07-20T10:00:00.000Z',
    },
  })
})

it('normaliza el nombre y usa cantidad 1 por defecto', async () => {
  const repository = fakeRepository()

  await addItem(repository, { communityId: 'c1', name: '  pan   de   molde ' })

  expect(repository.add).toHaveBeenCalledWith({
    communityId: 'c1',
    name: 'pan de molde',
    quantity: 1,
  })
})

it('pasa la cantidad indicada al repositorio', async () => {
  const repository = fakeRepository()

  await addItem(repository, { communityId: 'c1', name: 'Huevos', quantity: 12 })

  expect(repository.add).toHaveBeenCalledWith({
    communityId: 'c1',
    name: 'Huevos',
    quantity: 12,
  })
})

it('rechaza un nombre vacío sin tocar la red', async () => {
  const repository = fakeRepository()

  const result = await addItem(repository, { communityId: 'c1', name: '   ' })

  expect(result).toEqual({ status: 'invalid_name' })
  expect(repository.add).not.toHaveBeenCalled()
})

it('rechaza una cantidad menor que 1', async () => {
  const repository = fakeRepository()

  const result = await addItem(repository, { communityId: 'c1', name: 'Pan', quantity: 0 })

  expect(result).toEqual({ status: 'invalid_quantity' })
  expect(repository.add).not.toHaveBeenCalled()
})
