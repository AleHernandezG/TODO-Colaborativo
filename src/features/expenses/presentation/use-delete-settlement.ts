import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { useErrorSnackbar } from '@/shared/hooks/use-error-snackbar'
import { useSnackbar } from '@/shared/hooks/use-snackbar'

import type { Settlement } from '../domain/expense'
import { deleteUndoWindowMs, useDeletingRowsStore } from './deleting-rows-store'
import type { DeleteSettlementVariables } from './expense-mutations'
import { expenseMutationKeys } from './expense-mutations'
import { settlementsKey } from './use-settlements'

export function useDeleteSettlement(communityId: string) {
  const queryClient = useQueryClient()
  const showSnackbar = useSnackbar()
  const showError = useErrorSnackbar()
  const { t } = useTranslation()

  const mutation = useMutation<void, Error, DeleteSettlementVariables>({
    mutationKey: expenseMutationKeys.removeSettlement,
    onSuccess: (_result, { settlementId }) => {
      const key = settlementsKey(communityId)
      queryClient.setQueryData<Settlement[]>(key, (current = []) =>
        current.filter((settlement) => settlement.id !== settlementId),
      )
      queryClient.invalidateQueries({ queryKey: key })
    },
    onError: (error) => {
      showError(error, t('expenses.errors.deleteFailed'))
    },
    onSettled: (_result, _error, { settlementId }) => {
      useDeletingRowsStore.getState().clearDeleting(settlementId)
    },
  })

  const remove = mutation.mutate

  return useCallback(
    (settlement: Settlement) => {
      const { markDeleting, clearDeleting } = useDeletingRowsStore.getState()

      markDeleting(settlement.id)

      let undone = false
      const timer = setTimeout(() => {
        if (undone) {
          return
        }
        remove({ communityId, settlementId: settlement.id })
      }, deleteUndoWindowMs)

      showSnackbar(t('expenses.settlementDeleted'), {
        label: t('common.undo'),
        onPress: () => {
          undone = true
          clearTimeout(timer)
          clearDeleting(settlement.id)
        },
      })
    },
    [remove, showSnackbar, t, communityId],
  )
}
