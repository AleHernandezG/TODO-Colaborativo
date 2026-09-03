import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import type { CommunityMember } from '@/features/community'

import type { MemberBalance } from '../../domain/expense'
import { formatCents } from '../../domain/money'
import { MemberAvatar } from './MemberAvatar'

type Props = {
  balances: MemberBalance[]
  members: CommunityMember[]
}

export function MemberBalanceList({ balances, members }: Props) {
  const { t } = useTranslation()

  if (balances.length === 0) {
    return null
  }

  return (
    <View className="gap-3 rounded-lg border border-line bg-surface p-4 dark:border-line-dark dark:bg-surface-dark">
      <Text
        accessibilityRole="header"
        className="text-sm font-semibold uppercase text-muted dark:text-muted-dark"
      >
        {t('expenses.whoPaidWhatTitle')}
      </Text>

      {balances.map((balance) => {
        const isSelf = members.find((m) => m.id === balance.memberId)?.isSelf ?? false
        const net = balance.netBalanceCents
        const tone =
          net === 0
            ? 'text-muted dark:text-muted-dark'
            : net > 0
              ? 'text-success dark:text-success-dark'
              : 'text-danger dark:text-danger-dark'
        const mark = net === 0 ? '=' : net > 0 ? '▲' : '▼'
        const caption =
          net === 0
            ? t('expenses.memberSettled')
            : net > 0
              ? t('expenses.memberIsOwed')
              : t('expenses.memberOwes')

        return (
          <View
            key={balance.memberId}
            accessible
            accessibilityLabel={`${balance.username}. ${t('expenses.memberPaid', {
              amount: formatCents(balance.paidCents),
            })}. ${caption} ${net === 0 ? '' : formatCents(Math.abs(net))}`}
            className="flex-row items-center gap-3"
          >
            <MemberAvatar name={balance.username} highlighted={isSelf} />

            <View className="flex-1">
              <Text
                numberOfLines={1}
                className="text-base font-semibold text-content dark:text-content-dark"
              >
                {balance.username}
              </Text>
              <Text className="text-xs text-muted dark:text-muted-dark">
                {t('expenses.memberPaid', { amount: formatCents(balance.paidCents) })}
              </Text>
            </View>

            <View className="items-end">
              <Text className={`text-base font-bold ${tone}`}>
                {mark} {net === 0 ? '' : formatCents(Math.abs(net))}
              </Text>
              <Text className={`text-xs ${tone}`}>{caption}</Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}
