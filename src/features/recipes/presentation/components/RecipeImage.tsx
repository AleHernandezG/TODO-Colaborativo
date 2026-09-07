import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Text, View } from 'react-native'

import { radius } from '@/theme'

import { useRecipeImageUrl } from '../hooks/use-recipe-image-url'

type RecipeImageProps = {
  path: string | null
  name: string
  size?: number
  width?: number | `${number}%`
  height?: number
  borderRadius?: number
  localUri?: string | null
  uploading?: boolean
  decorative?: boolean
}

export function RecipeImage({
  path,
  name,
  size,
  width,
  height,
  borderRadius = radius.md,
  localUri = null,
  uploading = false,
  decorative = false,
}: RecipeImageProps) {
  const { t } = useTranslation()
  const { data: signedUrl, isLoading } = useRecipeImageUrl(localUri ? null : path)
  const uri = localUri ?? signedUrl ?? null

  const resolvedWidth = size ?? width ?? 64
  const resolvedHeight = size ?? height ?? 64
  const boxStyle = {
    width: resolvedWidth,
    height: resolvedHeight,
    borderRadius,
  }

  const a11y = decorative
    ? ({ accessible: false, importantForAccessibility: 'no-hide-descendants' } as const)
    : ({ accessible: true } as const)

  if (uploading || (uri === null && isLoading)) {
    return (
      <View
        {...a11y}
        accessibilityLabel={decorative ? undefined : t('recipes.image.loading', { name })}
        style={boxStyle}
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
        accessibilityLabel={decorative ? undefined : t('recipes.image.empty')}
        style={boxStyle}
        className="items-center justify-center border border-dashed border-line-strong bg-surface dark:border-line-strong-dark dark:bg-surface-dark"
      >
        <Text className="text-2xl">🍲</Text>
      </View>
    )
  }

  return (
    <Image
      source={{ uri }}
      {...a11y}
      accessibilityLabel={decorative ? undefined : t('recipes.image.preview', { name })}
      style={boxStyle}
      contentFit="cover"
      cachePolicy="disk"
      transition={150}
    />
  )
}
