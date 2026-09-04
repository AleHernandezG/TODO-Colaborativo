import type { JoinCodeInfo, Membership } from './community'

export type JoinOutcome =
  | { status: 'ok'; membership: Membership }
  | { status: 'invalid_join_code' }
  | { status: 'expired_join_code' }
  | { status: 'username_taken' }
  | { status: 'invalid_pin' }
  | { status: 'wrong_pin' }
  | { status: 'too_many_attempts' }

export type CommunityMember = {
  id: string
  username: string
  isSelf: boolean
  isAdmin: boolean
  isGuest: boolean
  removedAt?: string | null
}

export interface CommunityRepository {
  create(input: { name: string; username: string; pin: string }): Promise<Membership>
  join(input: { joinCode: string; username: string; pin: string }): Promise<JoinOutcome>
  getJoinCode(communityId: string): Promise<JoinCodeInfo>
  rotateJoinCode(communityId: string): Promise<JoinCodeInfo>
  listMembers(
    communityId: string,
    options?: { includeArchived?: boolean },
  ): Promise<CommunityMember[]>
  removeMember(
    communityId: string,
    memberId: string,
  ): Promise<{ status: 'deleted' | 'archived' }>
  setMemberAdmin(
    communityId: string,
    memberId: string,
    isAdmin: boolean,
  ): Promise<void>
  addGuestMember(
    communityId: string,
    username: string,
  ): Promise<CommunityMember>
  subscribeMembers(communityId: string, onChange: () => void): () => void
}
