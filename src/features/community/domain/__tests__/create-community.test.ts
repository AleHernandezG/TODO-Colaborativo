import type { CommunityRepository } from '../community-repository'
import { createCommunity } from '../create-community'

function fakeRepository(): jest.Mocked<CommunityRepository> {
  return {
    create: jest.fn().mockResolvedValue({
      community: { id: 'c1', name: 'Casa', joinCode: 'PAN-42XK' },
      username: 'Ana',
    }),
    join: jest.fn(),
    getJoinCode: jest.fn(),
    rotateJoinCode: jest.fn(),
  }
}

it('crea la comunidad y devuelve la pertenencia', async () => {
  const repository = fakeRepository()

  const result = await createCommunity(repository, { name: 'Casa', username: 'Ana', pin: '1234' })

  expect(result).toEqual({
    status: 'ok',
    membership: { community: { id: 'c1', name: 'Casa', joinCode: 'PAN-42XK' }, username: 'Ana' },
  })
})

it('normaliza antes de llamar al repositorio', async () => {
  const repository = fakeRepository()

  await createCommunity(repository, { name: '  Casa  del   pueblo ', username: ' Ana ', pin: ' 1234 ' })

  expect(repository.create).toHaveBeenCalledWith({ name: 'Casa del pueblo', username: 'Ana', pin: '1234' })
})

it('rechaza un nombre de lista vacío sin tocar la red', async () => {
  const repository = fakeRepository()

  const result = await createCommunity(repository, { name: '   ', username: 'Ana', pin: '1234' })

  expect(result).toEqual({ status: 'invalid_name' })
  expect(repository.create).not.toHaveBeenCalled()
})

it('rechaza un nombre de usuario demasiado corto', async () => {
  const repository = fakeRepository()

  const result = await createCommunity(repository, { name: 'Casa', username: 'A', pin: '1234' })

  expect(result).toEqual({ status: 'invalid_username' })
  expect(repository.create).not.toHaveBeenCalled()
})

it('rechaza un pin que no tenga 4 dígitos numéricos', async () => {
  const repository = fakeRepository()

  const result = await createCommunity(repository, { name: 'Casa', username: 'Ana', pin: '123' })

  expect(result).toEqual({ status: 'invalid_pin' })
  expect(repository.create).not.toHaveBeenCalled()
})

