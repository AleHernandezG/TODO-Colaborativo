import type { CommunityMember, CommunityRepository } from '../community-repository'
import { resetMemberPin } from '../reset-member-pin'

const me: CommunityMember = {
  id: 'me',
  username: 'Ana',
  isSelf: true,
  isAdmin: true,
  isGuest: false,
  removedAt: null,
}
const bea: CommunityMember = { ...me, id: 'bea', username: 'Bea', isSelf: false, isAdmin: false }

function repository() {
  return {
    resetMemberPin: jest.fn().mockResolvedValue({ tempPin: '0427' }),
  } as unknown as jest.Mocked<CommunityRepository>
}

it('devuelve el PIN temporal de otro miembro', async () => {
  const repo = repository()

  await expect(
    resetMemberPin(repo, { communityId: 'c1', viewer: me, target: bea }),
  ).resolves.toEqual({ status: 'ok', tempPin: '0427' })
  expect(repo.resetMemberPin).toHaveBeenCalledWith('c1', 'bea')
})

it('no llama al servidor si no le toca', async () => {
  const repo = repository()

  await expect(
    resetMemberPin(repo, { communityId: 'c1', viewer: { ...me, isAdmin: false }, target: bea }),
  ).resolves.toEqual({ status: 'not_allowed' })
  await expect(
    resetMemberPin(repo, { communityId: 'c1', viewer: me, target: { ...bea, isGuest: true } }),
  ).resolves.toEqual({ status: 'not_allowed' })
  expect(repo.resetMemberPin).not.toHaveBeenCalled()
})
