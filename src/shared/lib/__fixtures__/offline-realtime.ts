import { RealtimeClient } from '@supabase/supabase-js'

class SilentSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readonly url: string
  readyState = SilentSocket.CONNECTING
  binaryType = 'arraybuffer'
  onopen: (() => void) | null = null
  onclose: ((event: { code: number }) => void) | null = null
  onerror: ((error: unknown) => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null

  constructor(url: string) {
    this.url = url
  }

  send() {}

  close() {
    this.readyState = SilentSocket.CLOSED
  }
}

export function createOfflineRealtime() {
  const realtime = new RealtimeClient('ws://localhost:1/realtime/v1', {
    params: { apikey: 'test' },
    transport: SilentSocket as unknown as typeof WebSocket,
  })

  return {
    realtime,
    supabase: {
      channel: (topic: string) => realtime.channel(topic),
      removeChannel: (channel: ReturnType<RealtimeClient['channel']>) =>
        realtime.removeChannel(channel),
      getChannels: () => realtime.getChannels(),
    },
  }
}
