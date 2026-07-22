import NetInfo from '@react-native-community/netinfo'

export const requestTimeoutMs = 12_000

export class OfflineError extends Error {
  constructor() {
    super('No hay conexión a internet.')
    this.name = 'OfflineError'
  }
}

export async function assertOnline(): Promise<void> {
  const state = await NetInfo.fetch()
  if (state.isConnected === false) {
    throw new OfflineError()
  }
}

export function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs)

  init?.signal?.addEventListener('abort', () => controller.abort())

  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}
