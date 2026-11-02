import AsyncStorage from '@react-native-async-storage/async-storage'

import { useActiveCommunityStore } from '../active-community-store'

const savedBy120 = {
  state: {
    membership: {
      community: { id: 'c1', name: 'Casa Alejes', joinCode: 'ABC-DEFG' },
      username: 'Jose1',
    },
  },
  version: 0,
}

describe('useActiveCommunityStore', () => {
  afterEach(async () => {
    await AsyncStorage.clear()
    useActiveCommunityStore.setState({ membership: null })
  })

  it('lee la lista activa que guardó la 1.2.0 sin perderla', async () => {
    await AsyncStorage.setItem('active-community', JSON.stringify(savedBy120))

    await useActiveCommunityStore.persist.rehydrate()

    expect(useActiveCommunityStore.getState().membership).toEqual(savedBy120.state.membership)
    expect(JSON.parse((await AsyncStorage.getItem('active-community')) ?? 'null')).toEqual(
      savedBy120,
    )
  })
})
