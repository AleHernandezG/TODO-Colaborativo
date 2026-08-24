import { useQuery } from '@tanstack/react-query'

import { supabaseExpenseRepository } from '../data/supabase-expense-repository'
import type { Settlement } from '../domain/expense'

export function useSettlements(communityId: string | null | undefined) {
  return useQuery({
    queryKey: ['settlements', communityId],
    queryFn: (): Promise<Settlement[]> => {
      if (!communityId) return Promise.resolve([])
      return supabaseExpenseRepository.listSettlements(communityId)
    },
    enabled: Boolean(communityId),
    networkMode: 'offlineFirst',
  })
}
