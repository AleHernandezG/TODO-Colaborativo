import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'

import { minTouchTarget } from '@/theme'

import type { Membership } from '../../domain/community'

type MembershipListProps = {
  memberships: readonly Membership[]
  activeCommunityId: string | null
  onSelect: (membership: Membership) => void
}

const rowBorder = {
  active: 'border-primary dark:border-primary-dark',
  idle: 'border-line-strong dark:border-line-strong-dark',
}

export function MembershipList({ memberships, activeCommunityId, onSelect }: MembershipListProps) {
  const { t } = useTranslation()

  return (
    <View accessibilityRole="radiogroup" className="gap-2">
      {memberships.map((membership) => {
        const { community, username } = membership
        const active = community.id === activeCommunityId

        return (
          <Pressable
            key={community.id}
            onPress={() => onSelect(membership)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={t('lists.option', { name: community.name, username })}
            accessibilityHint={active ? undefined : t('lists.optionHint')}
            style={{ minHeight: minTouchTarget }}
            className={`flex-row items-center gap-3 rounded-md border bg-background px-3 py-2 active:opacity-70 dark:bg-background-dark ${
              active ? rowBorder.active : rowBorder.idle
            }`}
          >
            <View className="flex-1">
              <Text className="text-lg text-content dark:text-content-dark">{community.name}</Text>
              <Text className="text-sm text-muted dark:text-muted-dark">
                {t('lists.as', { username })}
              </Text>
            </View>
            {active ? (
              <Text className="text-sm font-semibold text-primary dark:text-primary-dark">
                ✓ {t('lists.openNow')}
              </Text>
            ) : null}
          </Pressable>
        )
      })}
    </View>
  )
}
