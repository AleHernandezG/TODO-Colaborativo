import Constants from 'expo-constants'
import * as Updates from 'expo-updates'

export type BuildInfo = {
  version: string
  updateId: string | null
}

export function buildInfo(): BuildInfo {
  return {
    version: Constants.expoConfig?.version ?? '?',
    updateId: Updates.isEmbeddedLaunch ? null : (Updates.updateId?.slice(0, 8) ?? null),
  }
}
