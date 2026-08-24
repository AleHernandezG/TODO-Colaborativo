import type { CommunityRepository, JoinOutcome } from './community-repository'
import { isValidJoinCode, normalizeJoinCode } from './join-code'
import { isValidUsername, normalizeName } from './names'
import { isValidPin, normalizePin } from './pin'

export type JoinCommunityResult =
  | JoinOutcome
  | { status: 'invalid_username' }
  | { status: 'invalid_pin' }

export async function joinCommunity(
  repository: CommunityRepository,
  input: { joinCode: string; username: string; pin: string },
): Promise<JoinCommunityResult> {
  const joinCode = normalizeJoinCode(input.joinCode)
  const username = normalizeName(input.username)
  const pin = normalizePin(input.pin)

  if (!isValidJoinCode(joinCode)) {
    return { status: 'invalid_join_code' }
  }
  if (!isValidUsername(username)) {
    return { status: 'invalid_username' }
  }
  if (!isValidPin(pin)) {
    return { status: 'invalid_pin' }
  }

  return repository.join({ joinCode, username, pin })
}
