import { useQuery } from '@tanstack/react-query'

import { supabaseExpenseRepository } from '../data/supabase-expense-repository'
import type { Expense } from '../domain/expense'

export function useExpenses(communityId: string | null | undefined) {
  return useQuery({
    queryKey: ['expenses', communityId],
    queryFn: (): Promise<Expense[]> => {
      if (!communityId) return Promise.resolve([])
      return supabaseExpenseRepository.listExpenses(communityId)
    },
    enabled: Boolean(communityId),
    networkMode: 'offlineFirst',
  })
}
