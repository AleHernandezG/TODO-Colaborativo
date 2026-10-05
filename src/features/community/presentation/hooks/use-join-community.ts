import { useMutation } from '@tanstack/react-query'

import { supabaseCommunityRepository } from '../../data/supabase-community-repository'
import { joinCommunity } from '../../domain/join-community'
import { useEnterCommunity } from './use-enter-community'

export function useJoinCommunity() {
  const enterCommunity = useEnterCommunity()

  return useMutation({
    networkMode: 'always',
    mutationFn: (input: { joinCode: string; username: string; pin: string }) =>
      joinCommunity(supabaseCommunityRepository, input),
    onSuccess: async (result) => {
      if (result.status === 'ok') {
        await enterCommunity(result.membership)
      }
    },
  })
}
