import type { JoinCodeInfo } from './community'
import type { CommunityRepository } from './community-repository'

export function getJoinCode(
  repository: CommunityRepository,
  communityId: string,
): Promise<JoinCodeInfo> {
  return repository.getJoinCode(communityId)
}
