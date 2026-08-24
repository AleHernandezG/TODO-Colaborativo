import type { CommunityRepository } from '../community-repository'
import { joinCommunity } from '../join-community'

function fakeRepository(): jest.Mocked<CommunityRepository> {
  return {
    create: jest.fn(),
    join: jest.fn().mockResolvedValue({
      status: 'ok',
      membership: {
        community: { id: 'c1', name: 'Casa', joinCode: 'PAN-42XK' },
        username: 'Ana',
      },
    }),
    getJoinCode: jest.fn(),
    rotateJoinCode: jest.fn(),
    listMembers: jest.fn(),
  }
}

it('entra en la comunidad con el código normalizado', async () => {
  const repository = fakeRepository()

  const result = await joinCommunity(repository, { joinCode: ' pan42xk ', username: ' Ana ', pin: ' 1234 ' })

  expect(repository.join).toHaveBeenCalledWith({ joinCode: 'PAN-42XK', username: 'Ana', pin: '1234' })
  expect(result.status).toBe('ok')
})

it('rechaza un código incompleto sin gastar un intento del rate limit', async () => {
  const repository = fakeRepository()

  const result = await joinCommunity(repository, { joinCode: 'PAN-42', username: 'Ana', pin: '1234' })

  expect(result).toEqual({ status: 'invalid_join_code' })
  expect(repository.join).not.toHaveBeenCalled()
})

it('rechaza un nombre de usuario vacío', async () => {
  const repository = fakeRepository()

  const result = await joinCommunity(repository, { joinCode: 'PAN-42XK', username: ' ', pin: '1234' })

  expect(result).toEqual({ status: 'invalid_username' })
  expect(repository.join).not.toHaveBeenCalled()
})

it('rechaza un PIN inválido sin tocar el backend', async () => {
  const repository = fakeRepository()

  const result = await joinCommunity(repository, { joinCode: 'PAN-42XK', username: 'Ana', pin: 'abc' })

  expect(result).toEqual({ status: 'invalid_pin' })
  expect(repository.join).not.toHaveBeenCalled()
})

it('propaga el estado que devuelve el backend', async () => {
  const repository = fakeRepository()
  repository.join.mockResolvedValue({ status: 'username_taken' })

  const result = await joinCommunity(repository, { joinCode: 'PAN-42XK', username: 'Bruno', pin: '1234' })

  expect(result).toEqual({ status: 'username_taken' })
})

