import { fakeItemRepository } from '../__fixtures__/item-repository'
import { setPurchased } from '../set-purchased'

it('le pide al repositorio marcar el estado indicado', async () => {
  const repository = fakeItemRepository()

  await setPurchased(repository, 'i1', true)

  expect(repository.setPurchased).toHaveBeenCalledWith('i1', true)
})
