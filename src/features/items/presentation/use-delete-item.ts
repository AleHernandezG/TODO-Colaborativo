import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { useSnackbar } from '../../../shared/hooks/use-snackbar'
import { OfflineError } from '../../../shared/lib/network'
import type { Item } from '../domain/item'
import { useDeletingItemsStore } from './deleting-items-store'
import type { ItemMutationVariables } from './item-mutations'
import { itemMutationKeys } from './item-mutations'
import { itemsKey } from './use-items'

export const deleteUndoWindowMs = 5000

export function useDeleteItem(communityId: string) {
  const queryClient = useQueryClient()
  const showSnackbar = useSnackbar()
  const { t } = useTranslation()

  const mutation = useMutation<void, Error, ItemMutationVariables>({
    mutationKey: itemMutationKeys.remove,
    onSuccess: (_result, { item }) => {
      const key = itemsKey(communityId)
      queryClient.setQueryData<Item[]>(key, (current = []) =>
        current.filter((i) => i.id !== item.id),
      )
      queryClient.invalidateQueries({ queryKey: key })
    },
    onError: (error) => {
      showSnackbar(
        error instanceof OfflineError ? t('errors.offline') : t('items.errors.deleteFailed'),
      )
    },
    onSettled: (_result, _error, { item }) => {
      useDeletingItemsStore.getState().clearDeleting(item.id)
    },
  })

  const remove = mutation.mutate

  return useCallback(
    (item: Item) => {
      const { markDeleting, clearDeleting } = useDeletingItemsStore.getState()

      markDeleting(item.id)

      let undone = false
      const timer = setTimeout(() => {
        if (undone) {
          return
        }
        remove({ communityId, item })
      }, deleteUndoWindowMs)

      showSnackbar(t('items.deleted', { name: item.name }), {
        label: t('common.undo'),
        onPress: () => {
          undone = true
          clearTimeout(timer)
          clearDeleting(item.id)
        },
      })
    },
    [remove, showSnackbar, t, communityId],
  )
}
