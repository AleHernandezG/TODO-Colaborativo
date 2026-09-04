import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import { useErrorSnackbar } from '@/shared/hooks/use-error-snackbar'
import { useSnackbar } from '@/shared/hooks/use-snackbar'
import { Dialog } from '@/shared/ui/Dialog'

import type { CommunityMember } from '../../domain/community-repository'
import { useRemoveMember } from '../hooks/use-remove-member'

type Props = {
  communityId: string
  member: CommunityMember | null
  onDismiss: () => void
}

export function ConfirmRemoveMemberDialog({ communityId, member, onDismiss }: Props) {
  const { t } = useTranslation()
  const showSnackbar = useSnackbar()
  const showError = useErrorSnackbar()
  const removeMember = useRemoveMember(communityId)

  if (!member) return null

  const handleConfirm = () => {
    if (removeMember.isPending) return

    removeMember.mutate(member.id, {
      onSuccess: ({ status }) => {
        onDismiss()
        const message =
          status === 'deleted'
            ? t('members.removeMember') + ': ' + member.username
            : t('members.removeMember') + ' (' + member.username + ')'
        showSnackbar(message)
      },
      onError: (cause) => {
        showError(cause, t('members.errors.removeFailed'))
      },
    })
  }

  return (
    <Dialog
      visible={Boolean(member)}
      title={t('members.deleteTitle', { name: member.username })}
      onDismiss={onDismiss}
      confirmLabel={t('members.deleteConfirm')}
      onConfirm={handleConfirm}
      confirmDisabled={removeMember.isPending}
      cancelLabel={t('common.cancel')}
    >
      <View className="gap-2">
        <Text className="text-base text-content dark:text-content-dark">
          {t('members.deleteBodyClean')}
        </Text>
        <Text className="text-sm text-muted dark:text-muted-dark">
          {t('members.deleteBodyArchived')}
        </Text>
      </View>
    </Dialog>
  )
}
