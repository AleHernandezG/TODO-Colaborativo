import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'

import type { CommunityMember } from '@/features/community'
import { minTouchTarget } from '@/theme'

import { formatCents } from '../../domain/money'
import type { Movement } from '../../domain/movements'
import { timeOf } from '../../domain/movements'
import { useMemberName, useMemberUsername } from '../hooks/use-member-name'
import { MemberAvatar } from './MemberAvatar'

type Props = {
  movement: Movement
  members: CommunityMember[]
  onOpen?: () => void
  onDelete?: () => void
}

export function MovementRow({ movement, members, onOpen, onDelete }: Props) {
  const { t } = useTranslation()
  const nameOf = useMemberName(members)
  const usernameOf = useMemberUsername(members)

  const time = timeOf(movement.at)

  if (movement.kind === 'settlement') {
    const { settlement } = movement
    const title = t('expenses.settlementDone', {
      from: nameOf(settlement.fromMemberId),
      to: nameOf(settlement.toMemberId),
    })

    return (
      <View className="flex-row items-center gap-3 rounded-lg border border-line bg-surface p-3 dark:border-line-dark dark:bg-surface-dark">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-background dark:bg-background-dark">
          <Text className="text-base">🤝</Text>
        </View>

        <View className="flex-1 gap-0.5">
          <Text className="text-base font-semibold text-content dark:text-content-dark">
            {title}
          </Text>
          <Text className="text-xs text-muted dark:text-muted-dark">
            {t('expenses.settlementKind')}
            {time ? ` · ${time}` : ''}
          </Text>
        </View>

        <Text className="text-base font-bold text-success dark:text-success-dark">
          {formatCents(settlement.amountCents)}
        </Text>

        {onDelete ? (
          <Pressable
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={t('expenses.deleteSettlement')}
            accessibilityHint={t('expenses.deleteExpenseHint')}
            style={{ minWidth: minTouchTarget, minHeight: minTouchTarget }}
            className="items-center justify-center rounded-md active:opacity-60"
          >
            <Text className="text-lg text-danger dark:text-danger-dark">✕</Text>
          </Pressable>
        ) : null}
      </View>
    )
  }

  const { expense } = movement
  const payer = nameOf(expense.paidByMemberId)
  const subtitle = `${t('expenses.paidBy', { name: payer })} · ${t('expenses.splitBetween', {
    count: expense.shares.length,
  })}${time ? ` · ${time}` : ''}`

  return (
    <Pressable
      onPress={onOpen}
      disabled={!onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${expense.description}, ${formatCents(expense.amountCents)}, ${subtitle}`}
      accessibilityHint={onOpen ? t('expenses.openExpenseHint') : undefined}
      style={{ minHeight: minTouchTarget }}
      className="flex-row items-center gap-3 rounded-lg border border-line bg-surface p-3 dark:border-line-dark dark:bg-surface-dark active:opacity-70"
    >
      <MemberAvatar name={usernameOf(expense.paidByMemberId)} size="sm" />

      <View className="flex-1 gap-0.5">
        <Text
          numberOfLines={1}
          className="text-base font-semibold text-content dark:text-content-dark"
        >
          {expense.description}
        </Text>
        <Text numberOfLines={1} className="text-xs text-muted dark:text-muted-dark">
          {subtitle}
        </Text>
      </View>

      <Text className="text-base font-bold text-content dark:text-content-dark">
        {formatCents(expense.amountCents)}
      </Text>

      {onOpen ? <Text className="text-lg text-muted dark:text-muted-dark">›</Text> : null}
    </Pressable>
  )
}
