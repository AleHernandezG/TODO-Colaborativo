import { act, renderHook } from '@testing-library/react-native'

import { useSlowPending } from '../use-slow-pending'

const useSubject = ({ pending }: { pending: boolean }) => useSlowPending(pending, 3000)

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

it('no avisa antes de tiempo', async () => {
  const { result } = await renderHook(useSubject, { initialProps: { pending: true } })

  await act(async () => jest.advanceTimersByTime(2999))
  expect(result.current).toBe(false)
})

it('avisa cuando la espera pasa del límite', async () => {
  const { result } = await renderHook(useSubject, { initialProps: { pending: true } })

  await act(async () => jest.advanceTimersByTime(3000))
  expect(result.current).toBe(true)
})

it('se apaga en cuanto llega la respuesta', async () => {
  const { result, rerender } = await renderHook(useSubject, { initialProps: { pending: true } })

  await act(async () => jest.advanceTimersByTime(3000))
  await rerender({ pending: false })
  expect(result.current).toBe(false)
})

it('vuelve a contar desde cero en el siguiente intento', async () => {
  const { result, rerender } = await renderHook(useSubject, { initialProps: { pending: true } })

  await act(async () => jest.advanceTimersByTime(3000))
  await rerender({ pending: false })
  await rerender({ pending: true })
  await act(async () => jest.advanceTimersByTime(1000))
  expect(result.current).toBe(false)
})

it('no avisa si no hay nada en curso', async () => {
  const { result } = await renderHook(useSubject, { initialProps: { pending: false } })

  await act(async () => jest.advanceTimersByTime(10000))
  expect(result.current).toBe(false)
})
