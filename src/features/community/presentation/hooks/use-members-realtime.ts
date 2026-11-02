import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useAppForeground } from '@/shared/hooks/use-app-foreground'

import { supabaseCommunityRepository } from '../../data/supabase-community-repository'
import type { MembersChannelStatus } from '../../domain/community-repository'
import { allCommunityMembersKey } from './use-community-members'

const eventCoalesceMs = 300
const subscribeSettleMs = 1500

export function useMembersRealtime(communityId: string | null | undefined) {
  const queryClient = useQueryClient()
  const [reported, setReported] = useState<{
    communityId: string
    status: MembersChannelStatus
  } | null>(null)
  const scheduleRefresh = useRef<(delay: number) => void>(() => {})

  useEffect(() => {
    if (!communityId) {
      return
    }

    const key = allCommunityMembersKey(communityId)
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    const refresh = () => {
      if (stopped) {
        return
      }
      if (queryClient.isMutating() > 0) {
        timer = setTimeout(refresh, eventCoalesceMs)
        return
      }
      void queryClient.invalidateQueries({ queryKey: key })
    }

    const schedule = (delay: number) => {
      if (stopped) {
        return
      }
      clearTimeout(timer)
      timer = setTimeout(refresh, delay)
    }

    scheduleRefresh.current = schedule

    const unsubscribe = supabaseCommunityRepository.subscribeMembers(communityId, {
      onChange: () => schedule(eventCoalesceMs),
      onStatus: (next) => {
        if (stopped) {
          return
        }
        setReported({ communityId, status: next })
        if (next === 'connected') {
          schedule(subscribeSettleMs)
        }
      },
    })

    return () => {
      stopped = true
      clearTimeout(timer)
      scheduleRefresh.current = () => {}
      unsubscribe()
    }
  }, [communityId, queryClient])

  useAppForeground(useCallback(() => scheduleRefresh.current(eventCoalesceMs), []))

  return reported && reported.communityId === communityId ? reported.status : 'connecting'
}
