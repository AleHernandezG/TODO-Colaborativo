import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useErrorSnackbar } from '@/shared/hooks/use-error-snackbar'

import { supabaseRecipeRepository } from '../../data/supabase-recipe-repository'
import type { NewRecipeInput } from '../../domain/recipe'
import { recipeDetailKey, recipesKey } from './use-recipes'

export function useSaveRecipe(communityId: string) {
  const queryClient = useQueryClient()
  const showError = useErrorSnackbar()
  const { t } = useTranslation()

  return useMutation<string, Error, NewRecipeInput>({
    mutationFn: (recipe) => supabaseRecipeRepository.save(recipe),
    onSuccess: (savedId) => {
      void queryClient.invalidateQueries({ queryKey: recipesKey(communityId) })
      void queryClient.invalidateQueries({ queryKey: recipeDetailKey(savedId) })
    },
    onError: (error) => {
      showError(error, t('recipes.errors.saveFailed'))
    },
  })
}
