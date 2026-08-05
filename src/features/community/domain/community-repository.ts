import type { JoinCodeInfo, Membership } from './community'

export type JoinOutcome =
  | { status: 'ok'; membership: Membership }
  | { status: 'invalid_join_code' }
  | { status: 'expired_join_code' }
  | { status: 'username_taken' }
  | { status: 'too_many_attempts' }

export interface CommunityRepository {
  create(input: { name: string; username: string }): Promise<Membership>
  join(input: { joinCode: string; username: string }): Promise<JoinOutcome>
  getJoinCode(communityId: string): Promise<JoinCodeInfo>
  rotateJoinCode(communityId: string): Promise<JoinCodeInfo>
}
