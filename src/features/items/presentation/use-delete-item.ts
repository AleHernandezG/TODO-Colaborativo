import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { useSnackbar } from '../../../shared/hooks/use-snackbar'
import { OfflineError } from '../../../shared/lib/network'
import { supabaseItemRepository } from '../data/supabase-item-repository'
import { deleteItem } from '../domain/delete-item'
import type { Item } from '../domain/item'
import { useDeletingItemsStore } from './deleting-items-store'
import { itemsKey } from './use-items'

export const deleteUndoWindowMs = 5000

export function useDeleteItem(communityId: string) {
  const queryClient = useQueryClient()
  const showSnackbar = useSnackbar()
  const { t } = useTranslation()

  return useCallback(
    (item: Item) => {
      const key = itemsKey(communityId)
      const { markDeleting, clearDeleting } = useDeletingItemsStore.getState()

      markDeleting(item.id)

      let undone = false
      const timer = setTimeout(() => {
        if (undone) {
          return
        }
        deleteItem(supabaseItemRepository, item.id)
          .then(() => {
            queryClient.setQueryData<Item[]>(key, (current = []) =>
              current.filter((i) => i.id !== item.id),
            )
            void queryClient.invalidateQueries({ queryKey: key })
          })
          .catch((error: unknown) => {
            showSnackbar(
              error instanceof OfflineError ? t('errors.offline') : t('items.errors.deleteFailed'),
            )
          })
          .finally(() => {
            clearDeleting(item.id)
          })
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
    [queryClient, showSnackbar, t, communityId],
  )
}
