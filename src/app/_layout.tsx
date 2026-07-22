import '../global.css'
import '../shared/lib/i18n'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'
import { PaperProvider, Portal } from 'react-native-paper'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { SessionGate } from '../features/session/presentation/SessionGate'
import { SnackbarHost } from '../shared/ui/SnackbarHost'
import { paperDarkTheme, paperLightTheme } from '../theme'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2 },
  },
})

export default function RootLayout() {
  const scheme = useColorScheme()
  const theme = scheme === 'dark' ? paperDarkTheme : paperLightTheme

  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  )
}
