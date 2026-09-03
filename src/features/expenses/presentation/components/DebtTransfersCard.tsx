import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import { Button } from '@/shared/ui/Button'

import type { DebtTransfer } from '../../domain/expense'
import { formatCents } from '../../domain/money'
import { MemberAvatar } from './MemberAvatar'

type Props = {
  transfers: DebtTransfer[]
  onSettle: (transfer: DebtTransfer) => void
}

export function DebtTransfersCard({ transfers, onSettle }: Props) {
  const { t } = useTranslation()

  return (
    <View className="gap-3 rounded-lg border border-line bg-surface p-4 dark:border-line-dark dark:bg-surface-dark">
      <Text
        accessibilityRole="header"
        className="text-sm font-semibold uppercase text-muted dark:text-muted-dark"
      >
        {t('expenses.pendingDebtsTitle')}
      </Text>

      {transfers.length === 0 ? (
        <Text className="py-2 text-base text-muted dark:text-muted-dark">
          {t('expenses.noPendingDebts')}
        </Text>
      ) : (
        transfers.map((transfer) => (
          <View
            key={`${transfer.fromMemberId}-${transfer.toMemberId}`}
            className="gap-3 rounded-md bg-background p-3 dark:bg-background-dark"
          >
            <View className="flex-row items-center gap-2">
              <MemberAvatar name={transfer.fromUsername} size="sm" />
              <Text className="text-lg text-muted dark:text-muted-dark">→</Text>
              <MemberAvatar name={transfer.toUsername} size="sm" />

              <View className="flex-1 pl-1">
                <Text numberOfLines={2} className="text-sm text-content dark:text-content-dark">
                  <Text className="font-bold">{transfer.fromUsername}</Text> {t('expenses.paysTo')}{' '}
                  <Text className="font-bold">{transfer.toUsername}</Text>
                </Text>
                <Text className="text-lg font-bold text-primary dark:text-primary-dark">
                  {formatCents(transfer.amountCents)}
                </Text>
              </View>
            </View>

            <Button
              label={t('expenses.settle')}
              onPress={() => onSettle(transfer)}
              variant="secondary"
              size="sm"
              accessibilityHint={t('expenses.settleDebtDescription', {
                from: transfer.fromUsername,
                to: transfer.toUsername,
                amount: formatCents(transfer.amountCents),
              })}
            />
          </View>
        ))
      )}
    </View>
  )
}
