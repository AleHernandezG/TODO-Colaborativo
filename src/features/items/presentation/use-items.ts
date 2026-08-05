import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'

import { supabaseItemRepository } from '../data/supabase-item-repository'
import type { Item } from '../domain/item'
import { listItems } from '../domain/list-items'
import { visibleItems } from '../domain/visible-items'
import { useDeletingItemsStore } from './deleting-items-store'

export function itemsKey(communityId: string) {
  return ['items', communityId] as const
}

export function useItems(communityId: string) {
  const deletingIds = useDeletingItemsStore((state) => state.ids)

  return useQuery({
    queryKey: itemsKey(communityId),
    queryFn: () => listItems(supabaseItemRepository, communityId),
    select: useCallback((items: Item[]) => visibleItems(items, deletingIds), [deletingIds]),
    meta: { persist: true },
  })
}
