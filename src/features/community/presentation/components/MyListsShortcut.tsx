import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import { useMyCommunities } from '../hooks/use-my-communities'
import { useActiveCommunityStore } from '../stores/active-community-store'
import { MembershipList } from './MembershipList'

export function MyListsShortcut() {
  const { t } = useTranslation()
  const setMembership = useActiveCommunityStore((state) => state.setMembership)
  const { data } = useMyCommunities()

  if (!data || data.length === 0) {
    return null
  }

  return (
    <View className="gap-2">
      <Text
        accessibilityRole="header"
        className="text-xl font-semibold text-content dark:text-content-dark"
      >
        {t('lists.backToYours')}
      </Text>
      <MembershipList memberships={data} activeCommunityId={null} onSelect={setMembership} />
    </View>
  )
}
