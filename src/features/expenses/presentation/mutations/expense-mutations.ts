import type { QueryClient } from '@tanstack/react-query'

import { useSnackbarStore } from '@/shared/hooks/use-snackbar'
import i18n from '@/shared/lib/i18n'

import { supabaseExpenseRepository } from '../../data/supabase-expense-repository'
import { createExpense } from '../../domain/create-expense'
import { createSettlement } from '../../domain/create-settlement'
import type { CreateExpenseInput, CreateSettlementInput } from '../../domain/expense-repository'
import { expensesKey } from '../hooks/use-expenses'
import { settlementsKey } from '../hooks/use-settlements'

export type CreateExpenseVariables = CreateExpenseInput
export type CreateSettlementVariables = CreateSettlementInput
export type DeleteExpenseVariables = { communityId: string; expenseId: string }
export type DeleteSettlementVariables = { communityId: string; settlementId: string }

export const expenseMutationKeys = {
  addExpense: ['expenses', 'add'] as const,
  removeExpense: ['expenses', 'remove'] as const,
  addSettlement: ['settlements', 'add'] as const,
  removeSettlement: ['settlements', 'remove'] as const,
}

const expenseMutationScope = { id: 'expenses' }

export function registerExpenseMutationDefaults(client: QueryClient) {
  const reconcileExpenses = (communityId: string) => {
    void client.invalidateQueries({ queryKey: expensesKey(communityId) })
  }

  const reconcileSettlements = (communityId: string) => {
    void client.invalidateQueries({ queryKey: settlementsKey(communityId) })
  }

  const reportQueuedFailure = (reconcile: () => void) => {
    useSnackbarStore.getState().show(i18n.t('expenses.errors.queuedFailed'))
    reconcile()
  }

  client.setMutationDefaults<void, Error, CreateExpenseVariables>(expenseMutationKeys.addExpense, {
    scope: expenseMutationScope,
    mutationFn: (input) => createExpense(supabaseExpenseRepository, input),
    onSuccess: (_result, input) => reconcileExpenses(input.communityId),
    onError: (_error, input) => reportQueuedFailure(() => reconcileExpenses(input.communityId)),
  })

  client.setMutationDefaults<void, Error, DeleteExpenseVariables>(
    expenseMutationKeys.removeExpense,
    {
      scope: expenseMutationScope,
      mutationFn: (input) => supabaseExpenseRepository.deleteExpense(input.expenseId),
      onSuccess: (_result, input) => reconcileExpenses(input.communityId),
      onError: (_error, input) => reportQueuedFailure(() => reconcileExpenses(input.communityId)),
    },
  )

  client.setMutationDefaults<void, Error, CreateSettlementVariables>(
    expenseMutationKeys.addSettlement,
    {
      scope: expenseMutationScope,
      mutationFn: (input) => createSettlement(supabaseExpenseRepository, input),
      onSuccess: (_result, input) => reconcileSettlements(input.communityId),
      onError: (_error, input) => reportQueuedFailure(() => reconcileSettlements(input.communityId)),
    },
  )

  client.setMutationDefaults<void, Error, DeleteSettlementVariables>(
    expenseMutationKeys.removeSettlement,
    {
      scope: expenseMutationScope,
      mutationFn: (input) => supabaseExpenseRepository.deleteSettlement(input.settlementId),
      onSuccess: (_result, input) => reconcileSettlements(input.communityId),
      onError: (_error, input) => reportQueuedFailure(() => reconcileSettlements(input.communityId)),
    },
  )
}
