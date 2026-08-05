import type { JoinCodeInfo } from './community'
import type { CommunityRepository } from './community-repository'

export function rotateJoinCode(
  repository: CommunityRepository,
  communityId: string,
): Promise<JoinCodeInfo> {
  return repository.rotateJoinCode(communityId)
}
