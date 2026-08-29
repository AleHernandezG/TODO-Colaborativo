import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { useErrorSnackbar } from '@/shared/hooks/use-error-snackbar'
import { useSnackbar } from '@/shared/hooks/use-snackbar'

import type { Expense } from '../domain/expense'
import { deleteUndoWindowMs, useDeletingRowsStore } from './deleting-rows-store'
import type { DeleteExpenseVariables } from './expense-mutations'
import { expenseMutationKeys } from './expense-mutations'
import { expensesKey } from './use-expenses'

export function useDeleteExpense(communityId: string) {
  const queryClient = useQueryClient()
  const showSnackbar = useSnackbar()
  const showError = useErrorSnackbar()
  const { t } = useTranslation()

  const mutation = useMutation<void, Error, DeleteExpenseVariables>({
    mutationKey: expenseMutationKeys.removeExpense,
    onSuccess: (_result, { expenseId }) => {
      const key = expensesKey(communityId)
      queryClient.setQueryData<Expense[]>(key, (current = []) =>
        current.filter((expense) => expense.id !== expenseId),
      )
      queryClient.invalidateQueries({ queryKey: key })
    },
    onError: (error) => {
      showError(error, t('expenses.errors.deleteFailed'))
    },
    onSettled: (_result, _error, { expenseId }) => {
      useDeletingRowsStore.getState().clearDeleting(expenseId)
    },
  })

  const remove = mutation.mutate

  return useCallback(
    (expense: Expense) => {
      const { markDeleting, clearDeleting } = useDeletingRowsStore.getState()

      markDeleting(expense.id)

      let undone = false
      const timer = setTimeout(() => {
        if (undone) {
          return
        }
        remove({ communityId, expenseId: expense.id })
      }, deleteUndoWindowMs)

      showSnackbar(t('expenses.deleted', { description: expense.description }), {
        label: t('common.undo'),
        onPress: () => {
          undone = true
          clearTimeout(timer)
          clearDeleting(expense.id)
        },
      })
    },
    [remove, showSnackbar, t, communityId],
  )
}
