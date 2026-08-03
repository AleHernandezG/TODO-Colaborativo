import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import { useSnackbar } from '../../../shared/hooks/use-snackbar'
import { copyToClipboard, shareText } from '../../../shared/lib/share'
import { Button } from '../../../shared/ui/Button'

type JoinCodeCardProps = {
  communityName: string
  joinCode: string
}

export function JoinCodeCard({ communityName, joinCode }: JoinCodeCardProps) {
  const { t } = useTranslation()
  const showSnackbar = useSnackbar()

  const copy = () => {
    copyToClipboard(joinCode)
      .then(() => showSnackbar(t('list.codeCopied')))
      .catch(() => showSnackbar(t('list.shareFailed')))
  }

  const share = () => {
    shareText(t('list.shareMessage', { name: communityName, code: joinCode })).catch(() =>
      showSnackbar(t('list.shareFailed')),
    )
  }

  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text className="text-sm text-muted dark:text-muted-dark">{t('list.joinCodeLabel')}</Text>
        <Text
          accessibilityLabel={t('list.joinCodeAccessible', {
            code: joinCode.split('').join(' '),
          })}
          className="text-2xl font-bold tracking-widest text-content dark:text-content-dark"
        >
          {joinCode}
        </Text>
        <Text className="text-sm text-muted dark:text-muted-dark">{t('list.joinCodeHint')}</Text>
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button
            label={t('list.copyCode')}
            onPress={copy}
            variant="secondary"
            accessibilityHint={t('list.copyCodeHint')}
          />
        </View>
        <View className="flex-1">
          <Button
            label={t('list.shareCode')}
            onPress={share}
            variant="secondary"
            accessibilityHint={t('list.shareCodeHint')}
          />
        </View>
      </View>
    </View>
  )
}
