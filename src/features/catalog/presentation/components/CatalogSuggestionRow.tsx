import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'

import { minTouchTarget, radius } from '@/theme'

import type { CatalogProduct } from '../../domain/catalog-product'
import { currencySymbol, priceAge, priceAmount } from '../../domain/price'

const photoSize = 48

export function CatalogSuggestionRow({
  product,
  onPick,
}: {
  product: CatalogProduct
  onPick: () => void
}) {
  const { t } = useTranslation()

  const price =
    product.priceCents === null
      ? null
      : t('catalog.price', {
          amount: priceAmount(product.priceCents, t('catalog.decimalSeparator')),
          symbol: currencySymbol(product.currency),
        })

  const age =
    price === null || product.priceCheckedAt === null
      ? null
      : priceAge(product.priceCheckedAt, new Date())
  const seen = age === null ? null : t(`catalog.seen.${age.unit}`, { count: age.count })
  const footnote = [product.packageSize, seen].filter(Boolean).join(' · ')

  return (
    <Pressable
      onPress={onPick}
      accessibilityRole="button"
      accessibilityLabel={[product.name, product.packageSize, price, seen]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint={t('catalog.pickHint')}
      style={{ minHeight: minTouchTarget }}
      className="flex-row items-center gap-3 px-2 py-2 active:opacity-70"
    >
      <View accessible={false} importantForAccessibility="no-hide-descendants" className="shrink-0">
        {product.imageUrl === null ? (
          <View
            style={{ width: photoSize, height: photoSize, borderRadius: radius.sm }}
            className="items-center justify-center border border-dashed border-line-strong dark:border-line-strong-dark"
          >
            <Text className="text-lg">📷</Text>
          </View>
        ) : (
          <Image
            source={{ uri: product.imageUrl }}
            style={{ width: photoSize, height: photoSize, borderRadius: radius.sm }}
            contentFit="contain"
            cachePolicy="disk"
            transition={120}
          />
        )}
      </View>

      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        className="min-w-0 flex-1"
      >
        <Text numberOfLines={2} className="text-base text-content dark:text-content-dark">
          {product.name}
        </Text>
        {footnote === '' ? null : (
          <Text numberOfLines={1} className="text-sm text-muted dark:text-muted-dark">
            {footnote}
          </Text>
        )}
      </View>

      {price === null ? null : (
        <Text
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          className="shrink-0 text-base font-medium text-content dark:text-content-dark"
        >
          {price}
        </Text>
      )}
    </Pressable>
  )
}
