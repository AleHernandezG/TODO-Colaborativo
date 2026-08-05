import { supabase } from '../../../../shared/lib/supabase'
import { supabasePresenceRepository } from '../supabase-presence-repository'

jest.mock('../../../../shared/lib/supabase', () => ({
  supabase: {
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}))

const channel = supabase.channel as jest.Mock
const removeChannel = supabase.removeChannel as jest.Mock

type FakeChannel = {
  on: jest.Mock
  subscribe: jest.Mock
  track: jest.Mock
  untrack: jest.Mock
  presenceState: jest.Mock
}

function mockChannel(state: Record<string, { username?: string }[]>) {
  let syncHandler: (() => void) | undefined
  let statusCallback: ((status: string) => void) | undefined

  const built: FakeChannel = {
    on: jest.fn((_type: string, _filter: unknown, handler: () => void) => {
      syncHandler = handler
      return built
    }),
    subscribe: jest.fn((callback: (status: string) => void) => {
      statusCallback = callback
      return built
    }),
    track: jest.fn().mockResolvedValue(undefined),
    untrack: jest.fn().mockResolvedValue(undefined),
    presenceState: jest.fn(() => state),
  }

  channel.mockReturnValue(built)

  return {
    built,
    sync: () => syncHandler?.(),
    emitStatus: (status: string) => statusCallback?.(status),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
})

it('usa un canal propio por comunidad y se anuncia con su nombre', () => {
  const { built, emitStatus } = mockChannel({})

  const stop = supabasePresenceRepository.watch({ communityId: 'c1', username: 'ana' }, jest.fn())

  expect(channel).toHaveBeenCalledWith('presence:c1', {
    config: { presence: { key: 'ana', enabled: true } },
  })

  expect(built.track).not.toHaveBeenCalled()
  emitStatus('SUBSCRIBED')
  expect(built.track).toHaveBeenCalledWith({ username: 'ana' })

  stop()
})

it('se vuelve a anunciar por si el otro entró a la vez y no llegó a verlo', () => {
  const { built, emitStatus } = mockChannel({})

  const stop = supabasePresenceRepository.watch({ communityId: 'c1', username: 'ana' }, jest.fn())

  emitStatus('SUBSCRIBED')
  expect(built.track).toHaveBeenCalledTimes(1)

  jest.advanceTimersByTime(2000)
  expect(built.track).toHaveBeenCalledTimes(2)

  jest.advanceTimersByTime(10000)
  expect(built.track).toHaveBeenCalledTimes(2)

  stop()
})

it('al cerrar no queda pendiente el segundo anuncio', () => {
  const { built, emitStatus } = mockChannel({})

  const stop = supabasePresenceRepository.watch({ communityId: 'c1', username: 'ana' }, jest.fn())

  emitStatus('SUBSCRIBED')
  stop()

  jest.advanceTimersByTime(2000)
  expect(built.track).toHaveBeenCalledTimes(1)
})

it('traduce el estado de presencia a una lista de nombres', () => {
  const { sync } = mockChannel({
    ana: [{ username: 'ana' }],
    luis: [{ username: 'luis' }],
  })
  const onChange = jest.fn()

  supabasePresenceRepository.watch({ communityId: 'c1', username: 'ana' }, onChange)
  sync()

  expect(onChange).toHaveBeenCalledWith(['ana', 'luis'])
})

it('cuenta una sola vez a quien tiene dos dispositivos abiertos', () => {
  const { sync } = mockChannel({
    ana: [{ username: 'ana' }, { username: 'ana' }],
  })
  const onChange = jest.fn()

  supabasePresenceRepository.watch({ communityId: 'c1', username: 'luis' }, onChange)
  sync()

  expect(onChange).toHaveBeenCalledWith(['ana'])
})

it('descarta las entradas sin nombre en vez de pintar huecos', () => {
  const { sync } = mockChannel({
    ana: [{ username: 'ana' }],
    roto: [{}],
  })
  const onChange = jest.fn()

  supabasePresenceRepository.watch({ communityId: 'c1', username: 'luis' }, onChange)
  sync()

  expect(onChange).toHaveBeenCalledWith(['ana'])
})

it('vacía la lista cuando el canal se cae', () => {
  const { emitStatus } = mockChannel({ ana: [{ username: 'ana' }] })
  const onChange = jest.fn()

  supabasePresenceRepository.watch({ communityId: 'c1', username: 'luis' }, onChange)

  for (const status of ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']) {
    onChange.mockClear()
    emitStatus(status)
    expect(onChange).toHaveBeenCalledWith([])
  }
})

it('la función que devuelve se da de baja antes de cerrar el canal', () => {
  const { built } = mockChannel({})

  const stop = supabasePresenceRepository.watch({ communityId: 'c1', username: 'ana' }, jest.fn())

  expect(removeChannel).not.toHaveBeenCalled()
  stop()
  expect(built.untrack).toHaveBeenCalled()
  expect(removeChannel).toHaveBeenCalledWith(built)
  expect(built.untrack.mock.invocationCallOrder[0]).toBeLessThan(
    removeChannel.mock.invocationCallOrder[0],
  )
})

it('no espera a la baja para cerrar el canal', () => {
  const { built } = mockChannel({})
  built.untrack.mockReturnValue(new Promise(() => {}))

  const stop = supabasePresenceRepository.watch({ communityId: 'c1', username: 'ana' }, jest.fn())

  stop()
  expect(removeChannel).toHaveBeenCalledWith(built)
})
