import { fakeItem, fakeItemRepository } from '../__fixtures__/item-repository'
import { addItem } from '../add-item'

function repositoryThatAdds() {
  return fakeItemRepository({ add: jest.fn().mockResolvedValue(fakeItem()) })
}

it('añade el artículo y devuelve lo que guardó el repositorio', async () => {
  const repository = repositoryThatAdds()

  const result = await addItem(repository, { id: 'i1', communityId: 'c1', name: 'Leche' })

  expect(result).toEqual({ status: 'ok', item: fakeItem() })
})

it('normaliza el nombre y usa cantidad 1 por defecto', async () => {
  const repository = repositoryThatAdds()

  await addItem(repository, { id: 'i1', communityId: 'c1', name: '  pan   de   molde ' })

  expect(repository.add).toHaveBeenCalledWith({
    id: 'i1',
    communityId: 'c1',
    name: 'pan de molde',
    quantity: 1,
    catalogProductId: null,
    imagePath: null,
    category: 'bakery',
  })
})

it('pasa la cantidad indicada al repositorio', async () => {
  const repository = repositoryThatAdds()

  await addItem(repository, { id: 'i1', communityId: 'c1', name: 'Huevos', quantity: 12 })

  expect(repository.add).toHaveBeenCalledWith({
    id: 'i1',
    communityId: 'c1',
    name: 'Huevos',
    quantity: 12,
    catalogProductId: null,
    imagePath: null,
    category: 'dairy_eggs',
  })
})

it('enlaza el producto del catálogo cuando el alta viene de una sugerencia', async () => {
  const repository = repositoryThatAdds()

  await addItem(repository, {
    id: 'i1',
    communityId: 'c1',
    name: 'Leche entera Hacendado',
    catalogProductId: 'prod-1',
  })

  expect(repository.add).toHaveBeenCalledWith(
    expect.objectContaining({ catalogProductId: 'prod-1', imagePath: null, category: 'dairy_eggs' }),
  )
})

it('respeta la categoría explícita sin inferir', async () => {
  const repository = repositoryThatAdds()

  await addItem(repository, {
    id: 'i1',
    communityId: 'c1',
    name: 'Manzana',
    category: 'drinks',
  })

  expect(repository.add).toHaveBeenCalledWith(
    expect.objectContaining({ category: 'drinks' }),
  )
})

it('sube la imagen opcional antes de insertar el artículo si se proporciona imageUri', async () => {
  const repository = fakeItemRepository({
    add: jest.fn().mockResolvedValue(fakeItem({ imagePath: 'c1/i1-123.jpg' })),
    uploadImage: jest.fn().mockResolvedValue('c1/i1-123.jpg'),
  })

  const result = await addItem(repository, {
    id: 'i1',
    communityId: 'c1',
    name: 'Tomates',
    imageUri: 'file:///tmp/tomate.jpg',
  })

  expect(repository.uploadImage).toHaveBeenCalledWith({
    communityId: 'c1',
    itemId: 'i1',
    uri: 'file:///tmp/tomate.jpg',
  })
  expect(repository.add).toHaveBeenCalledWith({
    id: 'i1',
    communityId: 'c1',
    name: 'Tomates',
    quantity: 1,
    catalogProductId: null,
    imagePath: 'c1/i1-123.jpg',
    category: 'fruits_vegetables',
  })
  expect(result).toEqual({
    status: 'ok',
    item: expect.objectContaining({ imagePath: 'c1/i1-123.jpg' }),
  })
})

it('rechaza un nombre vacío sin tocar la red', async () => {
  const repository = repositoryThatAdds()

  const result = await addItem(repository, { id: 'i1', communityId: 'c1', name: '   ' })

  expect(result).toEqual({ status: 'invalid_name' })
  expect(repository.add).not.toHaveBeenCalled()
})

it('rechaza una cantidad menor que 1', async () => {
  const repository = repositoryThatAdds()

  const result = await addItem(repository, {
    id: 'i1',
    communityId: 'c1',
    name: 'Pan',
    quantity: 0,
  })

  expect(result).toEqual({ status: 'invalid_quantity' })
  expect(repository.add).not.toHaveBeenCalled()
})
