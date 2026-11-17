import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import { useFailureMessage } from '@/shared/hooks/use-failure-message'
import { useSlowPending } from '@/shared/hooks/use-slow-pending'
import { useSnackbar } from '@/shared/hooks/use-snackbar'
import { copyToClipboard } from '@/shared/lib/share'
import { Dialog } from '@/shared/ui/Dialog'
import { tabularNums } from '@/theme'

import type { CommunityMember } from '../../domain/community-repository'
import { useResetMemberPin } from '../hooks/use-reset-member-pin'
import { useIssuedPinStore } from '../stores/issued-pin-store'

type ResetMemberPinDialogProps = {
  communityId: string
  viewer: CommunityMember | undefined
  target: CommunityMember | null
  onDismiss: () => void
}

export function ResetMemberPinDialog({
  communityId,
  viewer,
  target,
  onDismiss,
}: ResetMemberPinDialogProps) {
  const { t } = useTranslation()
  const showSnackbar = useSnackbar()
  const failureMessage = useFailureMessage()
  const resetPin = useResetMemberPin(communityId)
  const waitingLong = useSlowPending(resetPin.isPending)
  const [resetProblem, setResetProblem] = useState<string | null>(null)
  const issued = useIssuedPinStore((state) =>
    state.issued?.communityId === communityId ? state.issued : null,
  )
  const clearIssued = useIssuedPinStore((state) => state.clear)

  const close = () => {
    clearIssued()
    setResetProblem(null)
    onDismiss()
  }

  if (issued) {
    const spacedPin = issued.tempPin.split('').join(' ')
    const unbreakablePin = issued.tempPin.split('').join('\u00A0')

    const copyTempPin = () => {
      copyToClipboard(issued.tempPin).then(
        () => showSnackbar(t('members.tempPinCopied')),
        () => showSnackbar(t('members.errors.copyFailed')),
      )
    }

    return (
      <Dialog
        visible
        dismissable={false}
        title={t('members.tempPinTitle', { name: issued.name })}
        onDismiss={close}
        onCancel={copyTempPin}
        cancelLabel={t('members.tempPinCopy')}
        onConfirm={close}
        confirmLabel={t('members.tempPinDone')}
      >
        <View className="gap-4">
          <Text
            testID="temp-pin"
            selectable
            accessibilityLabel={spacedPin}
            style={tabularNums}
            className="text-center text-4xl font-bold tracking-widest text-content dark:text-content-dark"
          >
            {unbreakablePin}
          </Text>
          <Text className="text-base text-content dark:text-content-dark">
            {t('members.tempPinBody', { name: issued.name })}
          </Text>
        </View>
      </Dialog>
    )
  }

  if (!target) {
    return null
  }

  const name = target.username

  const confirmReset = () => {
    if (resetPin.isPending) {
      return
    }
    setResetProblem(null)
    resetPin.mutate(
      { viewer, target },
      {
        onSuccess: (result) => {
          if (result.status === 'not_allowed') {
            close()
            showSnackbar(t('members.errors.forbidden'))
          }
        },
        onError: (cause) =>
          setResetProblem(
            failureMessage(cause, t('members.errors.resetFailed'), {
              timeout: t('members.errors.resetUncertain'),
              unreachable: t('members.errors.resetUncertain'),
            }),
          ),
      },
    )
  }

  return (
    <Dialog
      visible
      dismissable={!resetPin.isPending}
      title={t('members.resetConfirmTitle', { name })}
      onDismiss={close}
      confirmLabel={t('members.resetConfirm')}
      onConfirm={confirmReset}
      confirmLoading={resetPin.isPending}
      confirmLoadingLabel={waitingLong ? t('members.pin.waiting') : undefined}
      cancelLabel={t('common.cancel')}
      cancelDisabled={resetPin.isPending}
    >
      <View className="gap-3">
        <Text className="text-base text-content dark:text-content-dark">
          {t('members.resetConfirmBody', { name })}
        </Text>
        {resetProblem ? (
          <Text
            accessibilityLiveRegion="polite"
            className="text-base text-danger dark:text-danger-dark"
          >
            {resetProblem}
          </Text>
        ) : null}
      </View>
    </Dialog>
  )
}
