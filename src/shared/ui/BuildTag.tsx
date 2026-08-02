import { useTranslation } from 'react-i18next'
import { Text } from 'react-native'

import { buildInfo } from '../lib/build-info'

export function BuildTag() {
  const { t } = useTranslation()
  const { version, updateId } = buildInfo()

  const label = updateId
    ? t('build.withUpdate', { version, updateId })
    : t('build.embedded', { version })

  return (
    <Text
      accessible
      accessibilityLabel={
        updateId
          ? t('build.accessibleWithUpdate', { version, updateId: updateId.split('').join(' ') })
          : t('build.accessibleEmbedded', { version })
      }
      className="text-center text-xs text-muted dark:text-muted-dark"
    >
      {label}
    </Text>
  )
}
