import type { CommunityMember } from '../community-repository'
import { canResetPin, canToggleAdmin, isOnlyActiveAdmin } from '../member-actions'

function member(overrides: Partial<CommunityMember>): CommunityMember {
  return {
    id: 'm',
    username: 'X',
    isSelf: false,
    isAdmin: false,
    isGuest: false,
    removedAt: null,
    ...overrides,
  }
}

const me = member({ id: 'me', isSelf: true, isAdmin: true })
const bea = member({ id: 'bea' })

describe('isOnlyActiveAdmin', () => {
  it('es cierto si soy la única persona admin', () => {
    expect(isOnlyActiveAdmin([me, bea])).toBe(true)
  })

  it('es falso si hay otra persona admin', () => {
    expect(isOnlyActiveAdmin([me, member({ id: 'b', isAdmin: true })])).toBe(false)
  })

  it('no cuenta a quien ya no está en la lista', () => {
    expect(
      isOnlyActiveAdmin([me, member({ id: 'b', isAdmin: true, removedAt: '2026-11-01' })]),
    ).toBe(true)
  })

  it('es falso si la única persona admin es otra', () => {
    expect(isOnlyActiveAdmin([member({ id: 'b', isAdmin: true }), { ...me, isAdmin: false }])).toBe(
      false,
    )
  })

  it('es falso con la lista vacía', () => {
    expect(isOnlyActiveAdmin([])).toBe(false)
  })
})

describe.each([
  ['canResetPin', canResetPin],
  ['canToggleAdmin', canToggleAdmin],
])('%s', (_name, can) => {
  it('deja a una persona admin con otro miembro con sesión', () => {
    expect(can(me, bea)).toBe(true)
  })

  it('no deja a quien no es admin', () => {
    expect(can({ ...me, isAdmin: false }, bea)).toBe(false)
  })

  it('no deja sobre una misma', () => {
    expect(can(me, me)).toBe(false)
  })

  it('no deja sobre un invitado sin sesión', () => {
    expect(can(me, member({ isGuest: true }))).toBe(false)
  })

  it('no deja sobre quien ya salió de la lista', () => {
    expect(can(me, member({ removedAt: '2026-11-01' }))).toBe(false)
  })

  it('no deja mientras no se sabe quién mira', () => {
    expect(can(undefined, bea)).toBe(false)
  })
})
