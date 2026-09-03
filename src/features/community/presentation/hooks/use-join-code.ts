import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { useAppForeground } from '@/shared/hooks/use-app-foreground'

import { supabaseCommunityRepository } from '../../data/supabase-community-repository'
import { getJoinCode } from '../../domain/get-join-code'

export function joinCodeKey(communityId: string) {
  return ['join-code', communityId] as const
}

export function useJoinCode(communityId: string) {
  const queryClient = useQueryClient()

  useAppForeground(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: joinCodeKey(communityId) })
    }, [queryClient, communityId]),
  )

  return useQuery({
    queryKey: joinCodeKey(communityId),
    queryFn: () => getJoinCode(supabaseCommunityRepository, communityId),
    meta: { persist: true },
  })
}
