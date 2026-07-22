import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { useSnackbar } from '../../../shared/hooks/use-snackbar'
import { OfflineError } from '../../../shared/lib/network'
import { supabaseItemRepository } from '../data/supabase-item-repository'
import { deleteItem } from '../domain/delete-item'
import type { Item } from '../domain/item'
import { itemsKey } from './use-items'

export const deleteUndoWindowMs = 5000

export function useDeleteItem(communityId: string) {
  const queryClient = useQueryClient()
  const showSnackbar = useSnackbar()
  const { t } = useTranslation()

  return useCallback(
    (item: Item) => {
      const key = itemsKey(communityId)
      const previous = queryClient.getQueryData<Item[]>(key)

      queryClient.setQueryData<Item[]>(key, (current = []) =>
        current.filter((i) => i.id !== item.id),
      )

      let undone = false
      const timer = setTimeout(() => {
        if (undone) {
          return
        }
        deleteItem(supabaseItemRepository, item.id).catch((error: unknown) => {
          queryClient.setQueryData<Item[]>(key, (current = []) =>
            current.some((i) => i.id === item.id) ? current : [item, ...current],
          )
          showSnackbar(
            error instanceof OfflineError ? t('errors.offline') : t('items.errors.deleteFailed'),
          )
        })
      }, deleteUndoWindowMs)

      showSnackbar(t('items.deleted', { name: item.name }), {
        label: t('common.undo'),
        onPress: () => {
          undone = true
          clearTimeout(timer)
          queryClient.setQueryData<Item[]>(key, previous ?? [])
        },
      })
    },
    [queryClient, showSnackbar, t, communityId],
  )
}
