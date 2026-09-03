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

  return (
    <View className="gap-3 rounded-lg border border-line bg-surface p-4 dark:border-line-dark dark:bg-surface-dark">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-medium text-muted dark:text-muted-dark">
          {t('expenses.totalSpent')}
        </Text>
        <Text className="text-sm font-semibold text-content dark:text-content-dark">
          {formatCents(totalSpentCents)}
        </Text>
      </View>

      <View className="h-px bg-line dark:bg-line-dark" />

      <View className="gap-1">
        <Text className="text-xs font-medium uppercase text-muted dark:text-muted-dark">
          {t('expenses.myBalance')}
        </Text>

        {netCents > 0 ? (
          <View className="flex-row items-baseline gap-2">
            <Text className="text-2xl font-bold text-success dark:text-success-dark">
              +{formatCents(netCents)}
            </Text>
            <Text className="text-sm text-success dark:text-success-dark">
              {t('expenses.theyOweYou')}
            </Text>
          </View>
        ) : netCents < 0 ? (
          <View className="flex-row items-baseline gap-2">
            <Text className="text-2xl font-bold text-danger dark:text-danger-dark">
              {formatCents(netCents)}
            </Text>
            <Text className="text-sm text-danger dark:text-danger-dark">
              {t('expenses.youOwe')}
            </Text>
          </View>
        ) : (
          <Text className="text-lg font-semibold text-content dark:text-content-dark">
            {t('expenses.settledUp')}
          </Text>
        )}
      </View>
    </View>
  )
}
