import { useMutation, useQueryClient } from '@tanstack/react-query'

import { supabaseCommunityRepository } from '../data/supabase-community-repository'
import type { JoinCodeInfo } from '../domain/community'
import { rotateJoinCode } from '../domain/rotate-join-code'
import { joinCodeKey } from './use-join-code'

export function useRotateJoinCode(communityId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    networkMode: 'always',
    mutationFn: () => rotateJoinCode(supabaseCommunityRepository, communityId),
    onSuccess: (info: JoinCodeInfo) => {
      queryClient.setQueryData(joinCodeKey(communityId), info)
    },
  })
}
