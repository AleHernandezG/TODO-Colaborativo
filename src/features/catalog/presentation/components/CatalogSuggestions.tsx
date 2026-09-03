import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import { type CatalogProduct, defaultSupermarketName } from '../../domain/catalog-product'
import { useCatalogSearch } from '../hooks/use-catalog-search'
import { CatalogSuggestionRow } from './CatalogSuggestionRow'

export function CatalogSuggestions({
  query,
  onPick,
}: {
  query: string
  onPick: (product: CatalogProduct) => void
}) {
  const { t } = useTranslation()
  const { suggestions, loading, problem } = useCatalogSearch(query)

  if (problem !== null && suggestions.length === 0) {
    return (
      <Text className="px-2 text-sm text-muted dark:text-muted-dark">
        {t(`catalog.${problem}`)}
      </Text>
    )
  }

  if (suggestions.length === 0) {
    return loading ? (
      <Text className="px-2 text-sm text-muted dark:text-muted-dark">{t('catalog.searching')}</Text>
    ) : null
  }

  return (
    <View className="gap-1">
      <View
        accessibilityRole="list"
        accessibilityLabel={t('catalog.suggestions', { count: suggestions.length })}
        className="overflow-hidden rounded-md border border-line bg-surface dark:border-line-dark dark:bg-surface-dark"
      >
        {suggestions.map((product, index) => (
          <View
            key={product.id}
            className={index === 0 ? '' : 'border-t border-line dark:border-line-dark'}
          >
            <CatalogSuggestionRow product={product} onPick={() => onPick(product)} />
          </View>
        ))}
      </View>
      <Text className="px-2 text-xs text-muted dark:text-muted-dark">
        {t('catalog.source', { supermarket: defaultSupermarketName })}
      </Text>
    </View>
  )
}
