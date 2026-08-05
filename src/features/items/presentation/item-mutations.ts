import type { QueryClient } from '@tanstack/react-query'

import { useSnackbarStore } from '../../../shared/hooks/use-snackbar'
import i18n from '../../../shared/lib/i18n'
import { supabaseItemRepository } from '../data/supabase-item-repository'
import type { AddItemResult } from '../domain/add-item'
import { addItem } from '../domain/add-item'
import { deleteItem } from '../domain/delete-item'
import type { EditItemResult, ItemImageChange } from '../domain/edit-item'
import { editItem } from '../domain/edit-item'
import type { Item } from '../domain/item'
import { setPurchased } from '../domain/set-purchased'
import { itemsKey } from './use-items'

export type AddItemVariables = { communityId: string; name: string; quantity: number }

export type EditItemVariables = {
  communityId: string
  itemId: string
  name: string
  quantity: number
  image: ItemImageChange
  currentImagePath: string | null
}

export type ItemMutationVariables = { communityId: string; item: Item }

export const itemMutationKeys = {
  add: ['items', 'add'] as const,
  edit: ['items', 'edit'] as const,
  togglePurchased: ['items', 'toggle-purchased'] as const,
  remove: ['items', 'remove'] as const,
}

const itemMutationScope = { id: 'items' }

export function registerItemMutationDefaults(client: QueryClient) {
  const reconcile = (communityId: string) => {
    void client.invalidateQueries({ queryKey: itemsKey(communityId) })
  }

  const reportQueuedFailure = (communityId: string) => {
    useSnackbarStore.getState().show(i18n.t('items.errors.queuedFailed'))
    reconcile(communityId)
  }

  client.setMutationDefaults<AddItemResult, Error, AddItemVariables>(itemMutationKeys.add, {
    scope: itemMutationScope,
    mutationFn: (input) => addItem(supabaseItemRepository, input),
    onSuccess: (_result, input) => reconcile(input.communityId),
    onError: (_error, input) => reportQueuedFailure(input.communityId),
  })

  client.setMutationDefaults<EditItemResult, Error, EditItemVariables>(itemMutationKeys.edit, {
    scope: itemMutationScope,
    mutationFn: (input) => editItem(supabaseItemRepository, input),
    onSuccess: (_result, input) => reconcile(input.communityId),
    onError: (_error, input) => reportQueuedFailure(input.communityId),
  })

  client.setMutationDefaults<void, Error, ItemMutationVariables>(
    itemMutationKeys.togglePurchased,
    {
      scope: itemMutationScope,
      mutationFn: (input) =>
        setPurchased(supabaseItemRepository, input.item.id, !input.item.isPurchased),
      onSuccess: (_result, input) => reconcile(input.communityId),
      onError: (_error, input) => reportQueuedFailure(input.communityId),
    },
  )

  client.setMutationDefaults<void, Error, ItemMutationVariables>(itemMutationKeys.remove, {
    scope: itemMutationScope,
    mutationFn: (input) => deleteItem(supabaseItemRepository, input.item),
    onSuccess: (_result, input) => reconcile(input.communityId),
    onError: (_error, input) => reportQueuedFailure(input.communityId),
  })
}
