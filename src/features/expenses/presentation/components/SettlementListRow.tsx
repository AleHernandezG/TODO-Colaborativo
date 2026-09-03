import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'

import type { CommunityMember } from '@/features/community'

import type { Settlement } from '../../domain/expense'
import { formatCents } from '../../domain/money'

type Props = {
  settlement: Settlement
  members: CommunityMember[]
  onDelete?: (settlement: Settlement) => void
}

export function SettlementListRow({ settlement, members, onDelete }: Props) {
  const { t } = useTranslation()

  const from = members.find((m) => m.id === settlement.fromMemberId)
  const to = members.find((m) => m.id === settlement.toMemberId)

  const fromName = from?.isSelf
    ? t('expenses.you')
    : (from?.username ?? t('expenses.unknownMember'))
  const toName = to?.isSelf ? t('expenses.you') : (to?.username ?? t('expenses.unknownMember'))

  return (
    <View className="flex-row items-center justify-between rounded-lg border border-line bg-surface p-4 dark:border-line-dark dark:bg-surface-dark">
      <View className="flex-1 gap-1">
        <Text className="text-sm font-semibold text-content dark:text-content-dark">
          {t('expenses.settlementDone', { from: fromName, to: toName })}
        </Text>
        <Text className="text-xs text-muted dark:text-muted-dark">
          {t('expenses.settlementSubtitle')}
        </Text>
      </View>

      <View className="flex-row items-center gap-3">
        <Text className="text-base font-bold text-success dark:text-success-dark">
          {formatCents(settlement.amountCents)}
        </Text>

        {onDelete ? (
          <Pressable
            onPress={() => onDelete(settlement)}
            hitSlop={8}
            accessibilityLabel={t('expenses.deleteSettlement')}
            className="p-1 active:opacity-60"
          >
            <Text className="text-base text-danger dark:text-danger-dark">✕</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}
