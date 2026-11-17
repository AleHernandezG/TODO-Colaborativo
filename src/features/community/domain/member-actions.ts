import type { CommunityMember } from './community-repository'

export function isOnlyActiveAdmin(members: readonly CommunityMember[]): boolean {
  const activeAdmins = members.filter(
    (member) => member.isAdmin && !member.isGuest && !member.removedAt,
  )
  return activeAdmins.length === 1 && activeAdmins[0].isSelf
}

function isOtherMemberWithSession(target: CommunityMember): boolean {
  return !target.isSelf && !target.isGuest && !target.removedAt
}

export function canToggleAdmin(viewer: CommunityMember | undefined, target: CommunityMember) {
  return Boolean(viewer?.isAdmin) && isOtherMemberWithSession(target)
}

export function canResetPin(viewer: CommunityMember | undefined, target: CommunityMember) {
  return Boolean(viewer?.isAdmin) && isOtherMemberWithSession(target)
}
