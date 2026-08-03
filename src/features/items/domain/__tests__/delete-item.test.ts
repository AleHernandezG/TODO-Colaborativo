import { fakeItem, fakeItemRepository } from '../__fixtures__/item-repository'
import { deleteItem } from '../delete-item'

it('le pide al repositorio borrar el artículo', async () => {
  const repository = fakeItemRepository()

  await deleteItem(repository, fakeItem())

  expect(repository.remove).toHaveBeenCalledWith('i1')
  expect(repository.removeImage).not.toHaveBeenCalled()
})

it('borra la foto antes que la fila', async () => {
  const order: string[] = []
  const repository = fakeItemRepository({
    removeImage: jest.fn().mockImplementation(() => {
      order.push('image')
      return Promise.resolve()
    }),
    remove: jest.fn().mockImplementation(() => {
      order.push('row')
      return Promise.resolve()
    }),
  })

  await deleteItem(repository, fakeItem({ imagePath: 'c1/i1.jpg' }))

  expect(repository.removeImage).toHaveBeenCalledWith('c1/i1.jpg')
  expect(order).toEqual(['image', 'row'])
})

it('si la foto no se puede borrar, la fila se queda', async () => {
  const repository = fakeItemRepository({
    removeImage: jest.fn().mockRejectedValue(new Error('sin permiso')),
  })

  await expect(deleteItem(repository, fakeItem({ imagePath: 'c1/i1.jpg' }))).rejects.toThrow(
    'sin permiso',
  )
  expect(repository.remove).not.toHaveBeenCalled()
})
