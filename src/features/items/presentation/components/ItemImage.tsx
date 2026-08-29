import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Text, View } from 'react-native'

import { radius } from '@/theme'

import { useItemImageUrl } from '../use-item-image-url'

type ItemImageProps = {
  path: string | null
  name: string
  size: number
  localUri?: string | null
  catalogUrl?: string | null
  uploading?: boolean
  decorative?: boolean
}

export function ItemImage({
  path,
  name,
  size,
  localUri = null,
  catalogUrl = null,
  uploading = false,
  decorative = false,
}: ItemImageProps) {
  const { t } = useTranslation()
  const { data: signedUrl, isLoading } = useItemImageUrl(localUri ? null : path)
  const ownPhoto = localUri !== null || path !== null
  const uri = localUri ?? signedUrl ?? (ownPhoto ? null : catalogUrl)
  const box = { width: size, height: size, borderRadius: radius.sm }
  const a11y = decorative
    ? ({ accessible: false, importantForAccessibility: 'no-hide-descendants' } as const)
    : ({ accessible: true } as const)

  if (uploading || (uri === null && isLoading)) {
    return (
      <View
        {...a11y}
        accessibilityLabel={decorative ? undefined : t('items.image.uploading', { name })}
        style={box}
        className="items-center justify-center bg-surface dark:bg-surface-dark"
      >
        <ActivityIndicator />
      </View>
    )
  }

  if (uri === null) {
    return (
      <View
        {...a11y}
        accessibilityLabel={decorative ? undefined : t('items.image.empty')}
        style={box}
        className="items-center justify-center border border-dashed border-line-strong dark:border-line-strong-dark"
      >
        <Text className="text-xl">📷</Text>
      </View>
    )
  }

  return (
    <Image
      source={{ uri }}
      {...a11y}
      accessibilityLabel={decorative ? undefined : t('items.image.preview', { name })}
      style={box}
      contentFit="cover"
      cachePolicy="disk"
      transition={150}
    />
  )
}
