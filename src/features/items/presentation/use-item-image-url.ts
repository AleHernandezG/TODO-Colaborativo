import { useQuery } from '@tanstack/react-query'

import { supabaseItemRepository } from '../data/supabase-item-repository'
import { imageUrlTtlSeconds, itemImageUrl } from '../domain/item-image'

const reuseWindowMs = imageUrlTtlSeconds * 1000 * 0.9

export function itemImageUrlKey(path: string) {
  return ['item-image-url', path] as const
}

export function useItemImageUrl(path: string | null) {
  return useQuery({
    queryKey: itemImageUrlKey(path ?? ''),
    queryFn: () => itemImageUrl(supabaseItemRepository, path ?? ''),
    enabled: path !== null,
    staleTime: reuseWindowMs,
    gcTime: reuseWindowMs,
  })
}
