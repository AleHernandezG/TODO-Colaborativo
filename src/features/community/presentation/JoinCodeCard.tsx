import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import { useSnackbar } from '../../../shared/hooks/use-snackbar'
import { OfflineError } from '../../../shared/lib/network'
import { copyToClipboard, shareText } from '../../../shared/lib/share'
import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'
import { joinCodeExpiry } from '../domain/join-code'
import { useJoinCode } from './use-join-code'
import { useRotateJoinCode } from './use-rotate-join-code'

type JoinCodeCardProps = {
  communityId: string
  communityName: string
}

export function JoinCodeCard({ communityId, communityName }: JoinCodeCardProps) {
  const { t } = useTranslation()
  const showSnackbar = useSnackbar()
  const { data, isLoading } = useJoinCode(communityId)
  const rotate = useRotateJoinCode(communityId)
  const [confirmingRotation, setConfirmingRotation] = useState(false)

  const expiry = data ? joinCodeExpiry(data.expiresAt, new Date()) : null
  const expired = expiry?.status === 'expired'
  const code = data?.code ?? ''

  const copy = () => {
    copyToClipboard(code)
      .then(() => showSnackbar(t('list.codeCopied')))
      .catch(() => showSnackbar(t('list.shareFailed')))
  }

  const share = () => {
    shareText(t('list.shareMessage', { name: communityName, code })).catch(() =>
      showSnackbar(t('list.shareFailed')),
    )
  }

  const confirmRotation = () => {
    setConfirmingRotation(false)
    rotate.mutate(undefined, {
      onSuccess: () => showSnackbar(t('list.rotate.done')),
      onError: (cause) =>
        showSnackbar(cause instanceof OfflineError ? t('errors.offline') : t('list.rotate.failed')),
    })
  }

  return (
    <View className="gap-2">
      <View className="gap-0.5">
        <Text className="text-xs text-muted dark:text-muted-dark">{t('list.joinCodeLabel')}</Text>

        {data ? (
          <>
            <Text
              accessibilityLabel={t('list.joinCodeAccessible', { code: code.split('').join(' ') })}
              className={`text-xl font-bold tracking-widest ${
                expired
                  ? 'text-muted line-through dark:text-muted-dark'
                  : 'text-content dark:text-content-dark'
              }`}
            >
              {code}
            </Text>
            <Text
              className={`text-xs ${expired ? 'font-medium text-danger dark:text-danger-dark' : 'text-muted dark:text-muted-dark'}`}
            >
              {expired
                ? t('list.joinCodeExpired')
                : expiry?.daysLeft === 0
                  ? t('list.joinCodeExpiresToday')
                  : t('list.joinCodeExpires', { count: expiry?.daysLeft ?? 0 })}
            </Text>
            {expired ? null : (
              <Text className="text-xs text-muted dark:text-muted-dark">
                {t('list.joinCodeHint')}
              </Text>
            )}
          </>
        ) : (
          <Text className="text-xs text-muted dark:text-muted-dark">
            {isLoading ? t('list.joinCodeLoading') : t('list.joinCodeUnavailable')}
          </Text>
        )}
      </View>

      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button
            label={t('list.copyCode')}
            onPress={copy}
            disabled={!data || expired}
            variant="secondary"
            size="sm"
            accessibilityHint={t('list.copyCodeHint')}
          />
        </View>
        <View className="flex-1">
          <Button
            label={t('list.shareCode')}
            onPress={share}
            disabled={!data || expired}
            variant="secondary"
            size="sm"
            accessibilityHint={t('list.shareCodeHint')}
          />
        </View>
      </View>

      <Button
        label={t('list.rotate.action')}
        onPress={() => setConfirmingRotation(true)}
        disabled={!data}
        loading={rotate.isPending}
        variant={expired ? 'primary' : 'secondary'}
        size="sm"
        accessibilityHint={t('list.rotate.actionHint')}
      />

      <Dialog
        visible={confirmingRotation}
        title={t('list.rotate.title')}
        onDismiss={() => setConfirmingRotation(false)}
        confirmLabel={t('list.rotate.confirm')}
        onConfirm={confirmRotation}
        cancelLabel={t('common.cancel')}
      >
        <Text className="text-base text-content dark:text-content-dark">
          {t('list.rotate.body')}
        </Text>
      </Dialog>
    </View>
  )
}
