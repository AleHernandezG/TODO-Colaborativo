import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { useAppForeground } from '@/shared/hooks/use-app-foreground'

import { supabaseCommunityRepository } from '../../data/supabase-community-repository'
import { sortMemberships } from '../../domain/my-memberships'

export const myCommunitiesKey = ['my-communities'] as const

export function useMyCommunities() {
  const queryClient = useQueryClient()

  useAppForeground(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: myCommunitiesKey })
    }, [queryClient]),
  )

  return useQuery({
    queryKey: myCommunitiesKey,
    queryFn: () => supabaseCommunityRepository.listMine(),
    select: sortMemberships,
    meta: { persist: true },
  })
}
