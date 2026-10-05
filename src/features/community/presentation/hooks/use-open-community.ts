import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import type { Membership } from '../../domain/community'
import { findMembership } from '../../domain/my-memberships'
import { useActiveCommunityStore } from '../stores/active-community-store'
import { myCommunitiesKey } from './use-my-communities'

export function useOpenCommunity() {
  const queryClient = useQueryClient()

  return useCallback(
    (communityId: string): boolean => {
      const { membership, setMembership } = useActiveCommunityStore.getState()
      if (membership?.community.id === communityId) {
        return true
      }

      const mine = queryClient.getQueryData<Membership[]>(myCommunitiesKey) ?? []
      const target = findMembership(mine, communityId)
      if (!target) {
        return false
      }

      setMembership(target)
      return true
    },
    [queryClient],
  )
}
