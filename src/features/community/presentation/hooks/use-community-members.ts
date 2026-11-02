import { useQuery } from '@tanstack/react-query'

import { supabaseCommunityRepository } from '../../data/supabase-community-repository'
import type { CommunityMember } from '../../domain/community-repository'

export function allCommunityMembersKey(communityId: string | null | undefined) {
  return ['community-members', communityId] as const
}

export function communityMembersKey(
  communityId: string | null | undefined,
  includeArchived = false,
) {
  return [...allCommunityMembersKey(communityId), { includeArchived }] as const
}

export function useCommunityMembers(
  communityId: string | null | undefined,
  options?: { includeArchived?: boolean },
) {
  const includeArchived = options?.includeArchived ?? false

  return useQuery({
    queryKey: communityMembersKey(communityId, includeArchived),
    queryFn: (): Promise<CommunityMember[]> => {
      if (!communityId) return Promise.resolve([])
      return supabaseCommunityRepository.listMembers(communityId, { includeArchived })
    },
    enabled: Boolean(communityId),
    networkMode: 'offlineFirst',
  })
}
