import type { CommunityMember, CommunityRepository } from './community-repository'
import { canResetPin } from './member-actions'

export type ResetMemberPinResult = { status: 'ok'; tempPin: string } | { status: 'not_allowed' }

export async function resetMemberPin(
  repository: CommunityRepository,
  input: { communityId: string; viewer: CommunityMember | undefined; target: CommunityMember },
): Promise<ResetMemberPinResult> {
  if (!canResetPin(input.viewer, input.target)) {
    return { status: 'not_allowed' }
  }

  const { tempPin } = await repository.resetMemberPin(input.communityId, input.target.id)
  return { status: 'ok', tempPin }
}
