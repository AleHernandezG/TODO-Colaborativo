import type { Membership } from './community'

export function sortMemberships(memberships: readonly Membership[]): Membership[] {
  return [...memberships].sort((a, b) => {
    const byName = a.community.name.localeCompare(b.community.name, undefined, {
      sensitivity: 'base',
    })
    if (byName !== 0) {
      return byName
    }
    return a.community.id < b.community.id ? -1 : a.community.id > b.community.id ? 1 : 0
  })
}

export function withMembership(
  memberships: readonly Membership[],
  added: Membership,
): Membership[] {
  const others = memberships.filter((m) => m.community.id !== added.community.id)
  return sortMemberships([...others, added])
}

export function findMembership(
  memberships: readonly Membership[],
  communityId: string,
): Membership | null {
  return memberships.find((m) => m.community.id === communityId) ?? null
}

export type ActiveMembershipCheck =
  | { status: 'unchanged' }
  | { status: 'refreshed'; membership: Membership }
  | { status: 'replaced'; membership: Membership; lostCommunityName: string }
  | { status: 'none'; lostCommunityName: string }

export function checkActiveMembership(
  active: Membership | null,
  mine: readonly Membership[],
): ActiveMembershipCheck {
  if (!active) {
    return { status: 'unchanged' }
  }

  const current = findMembership(mine, active.community.id)

  if (current) {
    const same =
      current.username === active.username &&
      current.community.name === active.community.name &&
      current.community.joinCode === active.community.joinCode
    return same ? { status: 'unchanged' } : { status: 'refreshed', membership: current }
  }

  const fallback = sortMemberships(mine)[0]
  if (!fallback) {
    return { status: 'none', lostCommunityName: active.community.name }
  }

  return {
    status: 'replaced',
    membership: fallback,
    lostCommunityName: active.community.name,
  }
}
