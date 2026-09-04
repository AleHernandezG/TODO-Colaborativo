import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { useErrorSnackbar } from '@/shared/hooks/use-error-snackbar'
import { useSnackbar } from '@/shared/hooks/use-snackbar'
import { Dialog } from '@/shared/ui/Dialog'
import { Input } from '@/shared/ui/Input'

import { useAddGuest } from '../hooks/use-add-guest'

type Props = {
  communityId: string
  visible: boolean
  onDismiss: () => void
}

export function AddGuestDialog({ communityId, visible, onDismiss }: Props) {
  const { t } = useTranslation()
  const showSnackbar = useSnackbar()
  const showError = useErrorSnackbar()
  const [name, setName] = useState('')
  const addGuest = useAddGuest(communityId)

  const trimmed = name.trim()
  const isValid = trimmed.length >= 1 && trimmed.length <= 40

  const handleConfirm = () => {
    if (!isValid || addGuest.isPending) return

    addGuest.mutate(trimmed, {
      onSuccess: () => {
        setName('')
        onDismiss()
        showSnackbar(t('members.badgeGuest') + ': ' + trimmed)
      },
      onError: (cause) => {
        showError(cause, t('members.errors.addGuestFailed'))
      },
    })
  }

  const handleDismiss = () => {
    setName('')
    onDismiss()
  }

  return (
    <Dialog
      visible={visible}
      title={t('members.addGuestTitle')}
      onDismiss={handleDismiss}
      confirmLabel={t('common.retry') === 'Reintentar' ? 'Añadir' : 'Add'}
      onConfirm={handleConfirm}
      confirmDisabled={!isValid || addGuest.isPending}
      cancelLabel={t('common.cancel')}
    >
      <View className="gap-2">
        <Input
          label={t('members.guestNameLabel')}
          placeholder={t('members.guestNamePlaceholder')}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoFocus
          maxLength={40}
          returnKeyType="done"
          onSubmitEditing={handleConfirm}
        />
      </View>
    </Dialog>
  )
}
