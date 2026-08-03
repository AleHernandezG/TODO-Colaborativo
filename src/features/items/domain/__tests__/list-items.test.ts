import { fakeItem, fakeItemRepository } from '../__fixtures__/item-repository'
import { listItems } from '../list-items'

it('pide al repositorio los artículos de la comunidad', async () => {
  const items = [fakeItem()]
  const repository = fakeItemRepository({ list: jest.fn().mockResolvedValue(items) })

  await expect(listItems(repository, 'c1')).resolves.toBe(items)
  expect(repository.list).toHaveBeenCalledWith('c1')
})
