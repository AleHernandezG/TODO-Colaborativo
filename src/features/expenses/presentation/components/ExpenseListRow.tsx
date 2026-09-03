import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'

import type { CommunityMember } from '@/features/community'

import type { Expense } from '../../domain/expense'
import { formatCents } from '../../domain/money'

type Props = {
  expense: Expense
  members: CommunityMember[]
  onDelete?: (expense: Expense) => void
}

export function ExpenseListRow({ expense, members, onDelete }: Props) {
  const { t } = useTranslation()

  const payer = members.find((m) => m.id === expense.paidByMemberId)
  const payerName = payer?.isSelf
    ? t('expenses.you')
    : (payer?.username ?? t('expenses.unknownMember'))

  return (
    <View className="flex-row items-center justify-between rounded-lg border border-line bg-surface p-4 dark:border-line-dark dark:bg-surface-dark">
      <View className="flex-1 gap-1">
        <Text className="text-base font-semibold text-content dark:text-content-dark">
          {expense.description}
        </Text>
        <Text className="text-xs text-muted dark:text-muted-dark">
          {t('expenses.paidBy', { name: payerName })} •{' '}
          {t('expenses.splitBetween', { count: expense.shares.length })}
        </Text>
      </View>

      <View className="flex-row items-center gap-3">
        <Text className="text-lg font-bold text-content dark:text-content-dark">
          {formatCents(expense.amountCents)}
        </Text>

        {onDelete ? (
          <Pressable
            onPress={() => onDelete(expense)}
            hitSlop={8}
            accessibilityLabel={t('expenses.deleteExpense')}
            className="p-1 active:opacity-60"
          >
            <Text className="text-base text-danger dark:text-danger-dark">✕</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}
