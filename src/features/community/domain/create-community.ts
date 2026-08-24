import type { Membership } from './community'
import type { CommunityRepository } from './community-repository'
import { isValidCommunityName, isValidUsername, normalizeName } from './names'
import { isValidPin, normalizePin } from './pin'

export type CreateCommunityResult =
  | { status: 'ok'; membership: Membership }
  | { status: 'invalid_name' }
  | { status: 'invalid_username' }
  | { status: 'invalid_pin' }

export async function createCommunity(
  repository: CommunityRepository,
  input: { name: string; username: string; pin: string },
): Promise<CreateCommunityResult> {
  const name = normalizeName(input.name)
  const username = normalizeName(input.username)
  const pin = normalizePin(input.pin)

  if (!isValidCommunityName(name)) {
    return { status: 'invalid_name' }
  }
  if (!isValidUsername(username)) {
    return { status: 'invalid_username' }
  }
  if (!isValidPin(pin)) {
    return { status: 'invalid_pin' }
  }

  return { status: 'ok', membership: await repository.create({ name, username, pin }) }
}
