import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'

import { supabaseExpenseRepository } from '../data/supabase-expense-repository'
import type { Settlement } from '../domain/expense'
import { visibleRows } from '../domain/visible-rows'
import { useDeletingRowsStore } from './deleting-rows-store'

export function settlementsKey(communityId: string) {
  return ['settlements', communityId] as const
}

export function useSettlements(communityId: string) {
  const deletingIds = useDeletingRowsStore((state) => state.ids)

  return useQuery({
    queryKey: settlementsKey(communityId),
    queryFn: () => supabaseExpenseRepository.listSettlements(communityId),
    select: useCallback(
      (settlements: Settlement[]) => visibleRows(settlements, deletingIds),
      [deletingIds],
    ),
    meta: { persist: true },
  })
}
