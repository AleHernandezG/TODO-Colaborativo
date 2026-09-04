import type { CommunityRepository } from '../community-repository'
import { getJoinCode } from '../get-join-code'
import { rotateJoinCode } from '../rotate-join-code'

function fakeRepository(): jest.Mocked<CommunityRepository> {
  return {
    create: jest.fn(),
    join: jest.fn(),
    getJoinCode: jest
      .fn()
      .mockResolvedValue({ code: 'PAN-42XK', expiresAt: '2026-08-12T10:00:00Z' }),
    rotateJoinCode: jest
      .fn()
      .mockResolvedValue({ code: 'TRE-88MW', expiresAt: '2026-08-12T10:00:00Z' }),
    listMembers: jest.fn(),
    removeMember: jest.fn(),
    setMemberAdmin: jest.fn(),
    addGuestMember: jest.fn(),
    subscribeMembers: jest.fn(),
  }
}

it('pide al repositorio el código de la comunidad', async () => {
  const repository = fakeRepository()

  await expect(getJoinCode(repository, 'c1')).resolves.toEqual({
    code: 'PAN-42XK',
    expiresAt: '2026-08-12T10:00:00Z',
  })
  expect(repository.getJoinCode).toHaveBeenCalledWith('c1')
})

it('pide al repositorio un código nuevo', async () => {
  const repository = fakeRepository()

  await expect(rotateJoinCode(repository, 'c1')).resolves.toEqual({
    code: 'TRE-88MW',
    expiresAt: '2026-08-12T10:00:00Z',
  })
  expect(repository.rotateJoinCode).toHaveBeenCalledWith('c1')
})
