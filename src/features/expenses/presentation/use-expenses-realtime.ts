import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useAppForeground } from '../../../shared/hooks/use-app-foreground'
import { supabaseExpenseRepository } from '../data/supabase-expense-repository'
import type { ExpensesChannelStatus } from '../domain/expense-repository'
import { expensesKey } from './use-expenses'
import { settlementsKey } from './use-settlements'

const eventCoalesceMs = 300
const subscribeSettleMs = 1500

export function useExpensesRealtime(communityId: string) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<ExpensesChannelStatus>('connecting')
  const scheduleRefresh = useRef<(delay: number) => void>(() => {})

  useEffect(() => {
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
      void queryClient.invalidateQueries({ queryKey: expensesKey(communityId) })
      void queryClient.invalidateQueries({ queryKey: settlementsKey(communityId) })
    }

    const schedule = (delay: number) => {
      if (stopped) {
        return
      }
      clearTimeout(timer)
      timer = setTimeout(refresh, delay)
    }

    scheduleRefresh.current = schedule

    const unsubscribe = supabaseExpenseRepository.subscribe(communityId, {
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
