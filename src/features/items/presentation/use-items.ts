import { useQuery } from '@tanstack/react-query'

import { supabaseItemRepository } from '../data/supabase-item-repository'
import { listItems } from '../domain/list-items'

export function itemsKey(communityId: string) {
  return ['items', communityId] as const
}

export function useItems(communityId: string) {
  return useQuery({
    queryKey: itemsKey(communityId),
    queryFn: () => listItems(supabaseItemRepository, communityId),
  })
}
