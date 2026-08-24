import { act, renderHook } from '@testing-library/react-native'

import { useDebouncedValue } from '../use-debounced-value'

const withInitial = (value: string) => ({ initialProps: { value } })
const useSubject = ({ value }: { value: string }) => useDebouncedValue(value, 250)

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('useDebouncedValue', () => {
  it('el primer valor sale ya, sin esperar', async () => {
    const { result } = await renderHook(useSubject, withInitial('leche'))

    expect(result.current).toBe('leche')
  })

  it('mantiene el valor anterior hasta que pasa el tiempo', async () => {
    const { result, rerender } = await renderHook(useSubject, withInitial('lec'))

    await rerender({ value: 'leche' })
    expect(result.current).toBe('lec')

    await act(async () => jest.advanceTimersByTime(250))
    expect(result.current).toBe('leche')
  })

  it('escribiendo seguido solo se queda la última tecla', async () => {
    const { result, rerender } = await renderHook(useSubject, withInitial('l'))

    for (const value of ['le', 'lec', 'lech', 'leche']) {
      await act(async () => jest.advanceTimersByTime(100))
      await rerender({ value })
    }

    expect(result.current).toBe('l')

    await act(async () => jest.advanceTimersByTime(250))
    expect(result.current).toBe('leche')
  })

  it('desmontar a media espera no revienta cuando vence el plazo', async () => {
    const { rerender, unmount } = await renderHook(useSubject, withInitial('lec'))

    await rerender({ value: 'leche' })
    await unmount()

    expect(() => jest.advanceTimersByTime(250)).not.toThrow()
  })
})
