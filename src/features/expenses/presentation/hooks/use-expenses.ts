import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'

import { supabaseExpenseRepository } from '../../data/supabase-expense-repository'
import type { Expense } from '../../domain/expense'
import { visibleRows } from '../../domain/visible-rows'
import { useDeletingRowsStore } from '../stores/deleting-rows-store'

export function expensesKey(communityId: string) {
  return ['expenses', communityId] as const
}

export function useExpenses(communityId: string) {
  const deletingIds = useDeletingRowsStore((state) => state.ids)

  return useQuery({
    queryKey: expensesKey(communityId),
    queryFn: () => supabaseExpenseRepository.listExpenses(communityId),
    select: useCallback((expenses: Expense[]) => visibleRows(expenses, deletingIds), [deletingIds]),
    meta: { persist: true },
  })
}
