import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { supabaseCommunityRepository } from '../../data/supabase-community-repository'
import type { CommunityMember } from '../../domain/community-repository'

export function communityMembersKey(
  communityId: string | null | undefined,
  includeArchived = false,
) {
  return ['community-members', communityId, { includeArchived }] as const
}

export function useCommunityMembers(
  communityId: string | null | undefined,
  options?: { includeArchived?: boolean },
) {
  const queryClient = useQueryClient()
  const includeArchived = options?.includeArchived ?? false

  useEffect(() => {
    if (!communityId) return

    const unsubscribe = supabaseCommunityRepository.subscribeMembers(communityId, () => {
      void queryClient.invalidateQueries({
        queryKey: ['community-members', communityId],
      })
    })

    return () => {
      unsubscribe()
    }
  }, [communityId, queryClient])

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
