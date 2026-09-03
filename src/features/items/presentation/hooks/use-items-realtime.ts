import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useAppForeground } from '@/shared/hooks/use-app-foreground'

import { supabaseItemRepository } from '../../data/supabase-item-repository'
import type { ItemsChannelStatus } from '../../domain/item-repository'
import { itemsKey } from './use-items'

const eventCoalesceMs = 300
const subscribeSettleMs = 1500

export function useItemsRealtime(communityId: string) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<ItemsChannelStatus>('connecting')
  const scheduleRefresh = useRef<(delay: number) => void>(() => {})

  useEffect(() => {
    const key = itemsKey(communityId)
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

    const unsubscribe = supabaseItemRepository.subscribe(communityId, {
      onChange: () => schedule(eventCoalesceMs),
      onStatus: (next) => {
        if (stopped) {
          return
        }
        setStatus(next)
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

  return status
}
