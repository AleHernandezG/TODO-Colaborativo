import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import { Button } from '@/shared/ui/Button'

import type { DebtTransfer } from '../domain/expense'
import { formatCents } from '../domain/money'

type Props = {
  transfers: DebtTransfer[]
  onSettle: (transfer: DebtTransfer) => void
}

export function DebtTransfersCard({ transfers, onSettle }: Props) {
  const { t } = useTranslation()

  if (transfers.length === 0) {
    return (
      <View className="items-center justify-center rounded-lg border border-line bg-surface p-6 dark:border-line-dark dark:bg-surface-dark">
        <Text className="text-center text-sm text-muted dark:text-muted-dark">
          {t('expenses.noPendingDebts')}
        </Text>
      </View>
    )
  }

  return (
    <View className="gap-3 rounded-lg border border-line bg-surface p-4 dark:border-line-dark dark:bg-surface-dark">
      <Text className="text-sm font-semibold uppercase text-muted dark:text-muted-dark">
        {t('expenses.pendingDebtsTitle')}
      </Text>

      <View className="gap-3">
        {transfers.map((transfer) => (
          <View
            key={`${transfer.fromMemberId}-${transfer.toMemberId}`}
            className="flex-row items-center justify-between gap-3 rounded-md bg-background p-3 dark:bg-background-dark"
          >
            <View className="flex-1">
              <Text className="text-sm text-content dark:text-content-dark">
                <Text className="font-bold">{transfer.fromUsername}</Text> {t('expenses.paysTo')}{' '}
                <Text className="font-bold">{transfer.toUsername}</Text>
              </Text>
              <Text className="text-base font-bold text-primary dark:text-primary-dark">
                {formatCents(transfer.amountCents)}
              </Text>
            </View>

            <Button
              label={t('expenses.settle')}
              onPress={() => onSettle(transfer)}
              size="sm"
              variant="secondary"
            />
          </View>
        ))}
      </View>
    </View>
  )
}
