import { fakeItemRepository } from '../__fixtures__/item-repository'
import { editItem } from '../edit-item'

const base = { itemId: 'i1', communityId: 'c1', name: 'Pan', quantity: 1 }
const keep = { kind: 'keep' } as const

it('guarda el nombre normalizado y la cantidad', async () => {
  const repository = fakeItemRepository()

  const result = await editItem(repository, {
    ...base,
    name: '  pan   de   molde ',
    quantity: 3,
    image: keep,
  })

  expect(repository.edit).toHaveBeenCalledWith('i1', {
    name: 'pan de molde',
    quantity: 3,
    imagePath: undefined,
  })
  expect(result).toEqual({ status: 'ok', name: 'pan de molde' })
})

it('rechaza un nombre vacío sin tocar la red', async () => {
  const repository = fakeItemRepository()

  const result = await editItem(repository, { ...base, name: '   ', image: keep })

  expect(result).toEqual({ status: 'invalid_name' })
  expect(repository.edit).not.toHaveBeenCalled()
})

it('rechaza una cantidad menor que 1', async () => {
  const repository = fakeItemRepository()

  const result = await editItem(repository, { ...base, quantity: 0, image: keep })

  expect(result).toEqual({ status: 'invalid_quantity' })
  expect(repository.edit).not.toHaveBeenCalled()
})

it('rechaza una cantidad con decimales', async () => {
  const repository = fakeItemRepository()

  const result = await editItem(repository, { ...base, quantity: 2.5, image: keep })

  expect(result).toEqual({ status: 'invalid_quantity' })
  expect(repository.edit).not.toHaveBeenCalled()
})

it('no sube nada ni toca image_path cuando la foto no cambia', async () => {
  const repository = fakeItemRepository()

  await editItem(repository, { ...base, image: keep })

  expect(repository.uploadImage).not.toHaveBeenCalled()
  expect(repository.edit).toHaveBeenCalledWith('i1', {
    name: 'Pan',
    quantity: 1,
    imagePath: undefined,
  })
})

it('sube la foto nueva y guarda la ruta que devuelve el repositorio', async () => {
  const repository = fakeItemRepository({
    uploadImage: jest.fn().mockResolvedValue('c1/i1.jpg'),
  })

  await editItem(repository, { ...base, image: { kind: 'replace', uri: 'file:///tmp/foto.jpg' } })

  expect(repository.uploadImage).toHaveBeenCalledWith({
    communityId: 'c1',
    itemId: 'i1',
    uri: 'file:///tmp/foto.jpg',
  })
  expect(repository.edit).toHaveBeenCalledWith('i1', {
    name: 'Pan',
    quantity: 1,
    imagePath: 'c1/i1.jpg',
  })
})

it('quitar la foto deja image_path a null sin borrar el fichero', async () => {
  const repository = fakeItemRepository()

  await editItem(repository, { ...base, image: { kind: 'clear' } })

  expect(repository.edit).toHaveBeenCalledWith('i1', {
    name: 'Pan',
    quantity: 1,
    imagePath: null,
  })
  expect(repository.removeImage).not.toHaveBeenCalled()
})

it('si la subida falla, no guarda nada', async () => {
  const repository = fakeItemRepository({
    uploadImage: jest.fn().mockRejectedValue(new Error('bucket lleno')),
  })

  await expect(
    editItem(repository, { ...base, image: { kind: 'replace', uri: 'file:///tmp/foto.jpg' } }),
  ).rejects.toThrow('bucket lleno')
  expect(repository.edit).not.toHaveBeenCalled()
})
