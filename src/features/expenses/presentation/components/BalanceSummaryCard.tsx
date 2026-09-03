import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import type { MemberBalance } from '../../domain/expense'
import { formatCents } from '../../domain/money'

type Props = {
  myBalance: MemberBalance | null
  totalSpentCents: number
}

export function BalanceSummaryCard({ myBalance, totalSpentCents }: Props) {
  const { t } = useTranslation()

  const netCents = myBalance?.netBalanceCents ?? 0
  const settled = netCents === 0
  const positive = netCents > 0

  const tone = settled
    ? 'text-content dark:text-content-dark'
    : positive
      ? 'text-success dark:text-success-dark'
      : 'text-danger dark:text-danger-dark'

  const caption = settled
    ? t('expenses.settledUp')
    : positive
      ? t('expenses.theyOweYou')
      : t('expenses.youOwe')

  const amount = settled ? '' : formatCents(Math.abs(netCents))

  return (
    <View className="gap-4 rounded-lg border border-line bg-surface p-5 dark:border-line-dark dark:bg-surface-dark">
      <Text className="text-xs font-semibold uppercase text-muted dark:text-muted-dark">
        {t('expenses.myBalance')}
      </Text>

      <View
        accessible
        accessibilityLabel={`${caption} ${amount}`}
        className="flex-row items-center gap-3"
      >
        <Text className="text-3xl">{settled ? '✅' : positive ? '📈' : '📉'}</Text>
        <View className="flex-1">
          {settled ? (
            <Text className={`text-2xl font-bold ${tone}`}>{caption}</Text>
          ) : (
            <>
              <Text className={`text-4xl font-bold ${tone}`}>{amount}</Text>
              <Text className={`text-base font-medium ${tone}`}>{caption}</Text>
            </>
          )}
        </View>
      </View>

      <View className="h-px bg-line dark:bg-line-dark" />

      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-muted dark:text-muted-dark">{t('expenses.totalSpent')}</Text>
        <Text className="text-sm font-semibold text-content dark:text-content-dark">
          {formatCents(totalSpentCents)}
        </Text>
      </View>
    </View>
  )
}
