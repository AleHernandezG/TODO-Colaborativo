import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useSnackbar } from '@/shared/hooks/use-snackbar'

import { supabaseCommunityRepository } from '../../data/supabase-community-repository'
import { changeMyPin } from '../../domain/change-my-pin'
import type { PinFormInput } from '../../domain/pin-form'
import { myPinStateKey } from './use-my-pin-state'

export function useSetMyPin(communityId: string) {
  const queryClient = useQueryClient()
  const showSnackbar = useSnackbar()
  const { t } = useTranslation()

  return useMutation({
    networkMode: 'always',
    mutationFn: (input: PinFormInput) =>
      changeMyPin(supabaseCommunityRepository, { ...input, communityId }),
    onSuccess: (result) => {
      if (result.status === 'ok') {
        showSnackbar(t('members.pin.changed'))
      }
      if (result.status !== 'invalid_form') {
        void queryClient.invalidateQueries({ queryKey: myPinStateKey(communityId) })
      }
    },
  })
}
