import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { supabaseRecipeRepository } from '../../data/supabase-recipe-repository'

export function recipesKey(communityId: string) {
  return ['recipes', communityId] as const
}

export function recipeDetailKey(id: string) {
  return ['recipe', id] as const
}

export function useRecipes(communityId: string) {
  return useQuery({
    queryKey: recipesKey(communityId),
    queryFn: () => supabaseRecipeRepository.list(communityId),
    meta: { persist: true },
  })
}

export function useRecipe(id: string) {
  return useQuery({
    queryKey: recipeDetailKey(id),
    queryFn: () => supabaseRecipeRepository.getById(id),
  })
}

export function useRecipesRealtime(communityId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const key = recipesKey(communityId)
    const unsubscribe = supabaseRecipeRepository.subscribe(communityId, {
      onChange: () => {
        void queryClient.invalidateQueries({ queryKey: key })
      },
    })

    return unsubscribe
  }, [communityId, queryClient])
}
