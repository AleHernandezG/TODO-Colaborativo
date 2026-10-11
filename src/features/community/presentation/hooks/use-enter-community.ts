import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import type { Membership } from '../../domain/community'
import { withMembership } from '../../domain/my-memberships'
import { useActiveCommunityStore } from '../stores/active-community-store'
import { myCommunitiesKey } from './use-my-communities'

export function useEnterCommunity() {
  const queryClient = useQueryClient()
  const setMembership = useActiveCommunityStore((state) => state.setMembership)

  return useCallback(
    async (membership: Membership) => {
      await queryClient.cancelQueries({ queryKey: myCommunitiesKey })
      queryClient.setQueryData<Membership[]>(myCommunitiesKey, (current = []) =>
        withMembership(current, membership),
      )
      setMembership(membership)
      void queryClient.invalidateQueries({ queryKey: myCommunitiesKey })
    },
    [queryClient, setMembership],
  )
}
