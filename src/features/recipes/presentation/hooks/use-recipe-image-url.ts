import { useQuery } from '@tanstack/react-query'

import { supabaseRecipeRepository } from '../../data/supabase-recipe-repository'
import { recipeImageUrl, recipeImageUrlTtlSeconds } from '../../domain/recipe-image'

const reuseWindowMs = recipeImageUrlTtlSeconds * 1000 * 0.9

export function recipeImageUrlKey(path: string) {
  return ['recipe-image-url', path] as const
}

export function useRecipeImageUrl(path: string | null) {
  return useQuery({
    queryKey: recipeImageUrlKey(path ?? ''),
    queryFn: () => recipeImageUrl(supabaseRecipeRepository, path ?? ''),
    enabled: path !== null && path.length > 0,
    staleTime: reuseWindowMs,
    gcTime: reuseWindowMs,
    meta: { persist: true },
  })
}
