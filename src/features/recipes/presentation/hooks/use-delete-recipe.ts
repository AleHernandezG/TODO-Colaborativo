import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useErrorSnackbar } from '@/shared/hooks/use-error-snackbar'

import { supabaseRecipeRepository } from '../../data/supabase-recipe-repository'
import { recipesKey } from './use-recipes'

export function useDeleteRecipe(communityId: string) {
  const queryClient = useQueryClient()
  const showError = useErrorSnackbar()
  const { t } = useTranslation()

  return useMutation<void, Error, string>({
    mutationFn: (id) => supabaseRecipeRepository.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: recipesKey(communityId) })
    },
    onError: (error) => {
      showError(error, t('recipes.errors.deleteFailed'))
    },
  })
}
