import type { Membership } from './community'
import type { CommunityRepository } from './community-repository'
import { isValidCommunityName, isValidUsername, normalizeName } from './names'

export type CreateCommunityResult =
  | { status: 'ok'; membership: Membership }
  | { status: 'invalid_name' }
  | { status: 'invalid_username' }

export async function createCommunity(
  repository: CommunityRepository,
  input: { name: string; username: string },
): Promise<CreateCommunityResult> {
  const name = normalizeName(input.name)
  const username = normalizeName(input.username)

  if (!isValidCommunityName(name)) {
    return { status: 'invalid_name' }
  }
  if (!isValidUsername(username)) {
    return { status: 'invalid_username' }
  }

  return { status: 'ok', membership: await repository.create({ name, username }) }
}
