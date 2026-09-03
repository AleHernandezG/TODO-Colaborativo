import { useMutation } from '@tanstack/react-query'

import { supabaseCommunityRepository } from '../../data/supabase-community-repository'
import { joinCommunity } from '../../domain/join-community'
import { useActiveCommunityStore } from '../stores/active-community-store'

export function useJoinCommunity() {
  const setMembership = useActiveCommunityStore((state) => state.setMembership)

  return useMutation({
    networkMode: 'always',
    mutationFn: (input: { joinCode: string; username: string; pin: string }) =>
      joinCommunity(supabaseCommunityRepository, input),
    onSuccess: (result) => {
      if (result.status === 'ok') {
        setMembership(result.membership)
      }
    },
  })
}
