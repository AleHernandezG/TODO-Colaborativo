import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useSnackbar } from '../../../shared/hooks/use-snackbar'
import { OfflineError } from '../../../shared/lib/network'
import { supabaseItemRepository } from '../data/supabase-item-repository'
import type { Item } from '../domain/item'
import { setPurchased } from '../domain/set-purchased'
import { itemsKey } from './use-items'

type MutationContext = { previous: Item[] | undefined }

export function useTogglePurchased(communityId: string) {
  const queryClient = useQueryClient()
  const showSnackbar = useSnackbar()
  const { t } = useTranslation()
  const key = itemsKey(communityId)

  return useMutation({
    mutationFn: (item: Item) => setPurchased(supabaseItemRepository, item.id, !item.isPurchased),
    onMutate: async (item): Promise<MutationContext> => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Item[]>(key)

      queryClient.setQueryData<Item[]>(key, (current = []) =>
        current.map((i) => (i.id === item.id ? { ...i, isPurchased: !i.isPurchased } : i)),
      )
      return { previous }
    },
    onError: (error, _item, context) => {
      queryClient.setQueryData<Item[]>(key, context?.previous ?? [])
      showSnackbar(
        error instanceof OfflineError ? t('errors.offline') : t('items.errors.updateFailed'),
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}
