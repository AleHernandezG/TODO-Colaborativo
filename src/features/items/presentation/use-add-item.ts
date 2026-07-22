import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useSnackbar } from '../../../shared/hooks/use-snackbar'
import { OfflineError } from '../../../shared/lib/network'
import { supabaseItemRepository } from '../data/supabase-item-repository'
import { addItem } from '../domain/add-item'
import type { Item } from '../domain/item'
import { normalizeItemName } from '../domain/item-name'
import { itemsKey } from './use-items'

type MutationContext = { previous: Item[] | undefined }

export function useAddItem(communityId: string) {
  const queryClient = useQueryClient()
  const showSnackbar = useSnackbar()
  const { t } = useTranslation()
  const key = itemsKey(communityId)

  return useMutation({
    mutationFn: (input: { name: string; quantity: number }) =>
      addItem(supabaseItemRepository, { communityId, name: input.name, quantity: input.quantity }),
    onMutate: async (input): Promise<MutationContext> => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Item[]>(key)

      const optimistic: Item = {
        id: `optimistic-${Date.now()}`,
        name: normalizeItemName(input.name),
        quantity: input.quantity,
        isPurchased: false,
        createdAt: new Date().toISOString(),
      }

      queryClient.setQueryData<Item[]>(key, (current = []) => [optimistic, ...current])
      return { previous }
    },
    onError: (error, _input, context) => {
      queryClient.setQueryData<Item[]>(key, context?.previous ?? [])
      showSnackbar(
        error instanceof OfflineError ? t('errors.offline') : t('items.errors.addFailed'),
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}
