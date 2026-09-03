import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { useErrorSnackbar } from '@/shared/hooks/use-error-snackbar'
import { useSnackbar } from '@/shared/hooks/use-snackbar'

import type { Item } from '../../domain/item'
import type { ItemMutationVariables } from '../mutations/item-mutations'
import { itemMutationKeys } from '../mutations/item-mutations'
import { useDeletingItemsStore } from '../stores/deleting-items-store'
import { itemsKey } from './use-items'

export const deleteUndoWindowMs = 5000

export function useDeleteItem(communityId: string) {
  const queryClient = useQueryClient()
  const showSnackbar = useSnackbar()
  const showError = useErrorSnackbar()
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
      showError(error, t('items.errors.deleteFailed'))
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
