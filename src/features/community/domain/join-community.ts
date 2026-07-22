import type { CommunityRepository, JoinOutcome } from './community-repository'
import { isValidJoinCode, normalizeJoinCode } from './join-code'
import { isValidUsername, normalizeName } from './names'

export type JoinCommunityResult = JoinOutcome | { status: 'invalid_username' }

export async function joinCommunity(
  repository: CommunityRepository,
  input: { joinCode: string; username: string },
): Promise<JoinCommunityResult> {
  const joinCode = normalizeJoinCode(input.joinCode)
  const username = normalizeName(input.username)

  if (!isValidJoinCode(joinCode)) {
    return { status: 'invalid_join_code' }
  }
  if (!isValidUsername(username)) {
    return { status: 'invalid_username' }
  }

  return repository.join({ joinCode, username })
}
