import type { Mutation, Query } from '@tanstack/react-query'

import { buildInfo } from '../build-info'
import { cacheBuster, shouldPersistMutation, shouldPersistQuery } from '../query-persister'

jest.mock('../build-info', () => ({
  buildInfo: jest.fn(() => ({ version: '0.0.0', updateId: null })),
}))

const buildInfoMock = buildInfo as jest.Mock

function fakeQuery(status: string, meta?: Record<string, unknown>): Query {
  return { state: { status }, meta } as unknown as Query
}

it('persiste solo las queries marcadas', () => {
  expect(shouldPersistQuery(fakeQuery('success', { persist: true }))).toBe(true)
  expect(shouldPersistQuery(fakeQuery('success'))).toBe(false)
  expect(shouldPersistQuery(fakeQuery('success', { persist: false }))).toBe(false)
})

it('no persiste una query que falló ni una que aún no tiene datos', () => {
  expect(shouldPersistQuery(fakeQuery('error', { persist: true }))).toBe(false)
  expect(shouldPersistQuery(fakeQuery('pending', { persist: true }))).toBe(false)
})

function fakeMutation(status: string, isPaused: boolean): Mutation {
  return { state: { status, isPaused } } as unknown as Mutation
}

it('guarda las mutaciones en pausa y ninguna más', () => {
  expect(shouldPersistMutation(fakeMutation('pending', true))).toBe(true)
  expect(shouldPersistMutation(fakeMutation('pending', false))).toBe(false)
  expect(shouldPersistMutation(fakeMutation('success', false))).toBe(false)
  expect(shouldPersistMutation(fakeMutation('error', false))).toBe(false)
})

it('el buster distingue el bundle del APK de un update por aire', () => {
  buildInfoMock.mockReturnValue({ version: '1.2.0', updateId: null })
  const embedded = cacheBuster()

  buildInfoMock.mockReturnValue({ version: '1.2.0', updateId: 'a1b2c3d4' })

  expect(cacheBuster()).not.toBe(embedded)
})

it('el buster cambia al subir de versión', () => {
  buildInfoMock.mockReturnValue({ version: '1.2.0', updateId: null })
  const before = cacheBuster()

  buildInfoMock.mockReturnValue({ version: '1.3.0', updateId: null })

  expect(cacheBuster()).not.toBe(before)
})
