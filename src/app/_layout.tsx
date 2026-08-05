import '../global.css'
import '../shared/lib/i18n'

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'
import { PaperProvider, Portal } from 'react-native-paper'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { registerItemMutationDefaults } from '../features/items/presentation/item-mutations'
import { SessionGate } from '../features/session/presentation/SessionGate'
import { queryClient } from '../shared/lib/query-client'
import { persistOptions } from '../shared/lib/query-persister'
import { SnackbarHost } from '../shared/ui/SnackbarHost'
import { paperDarkTheme, paperLightTheme } from '../theme'

registerItemMutationDefaults(queryClient)

export default function RootLayout() {
  const scheme = useColorScheme()
  const theme = scheme === 'dark' ? paperDarkTheme : paperLightTheme

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
      onSuccess={() => queryClient.resumePausedMutations()}
    >
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <Portal.Host>
            <StatusBar style="auto" />
            <SessionGate>
              <Stack screenOptions={{ headerShown: false }} />
              <SnackbarHost />
            </SessionGate>
          </Portal.Host>
        </PaperProvider>
      </SafeAreaProvider>
    </PersistQueryClientProvider>
  )
}
