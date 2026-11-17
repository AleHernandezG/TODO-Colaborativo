import type { CommunityMember } from '../community-repository'
import { pinReminderFor } from '../pin-reminder'

const me: CommunityMember = {
  id: 'me',
  username: 'Ana',
  isSelf: true,
  isAdmin: true,
  isGuest: false,
  removedAt: null,
}
const bea: CommunityMember = { ...me, id: 'bea', username: 'Bea', isSelf: false, isAdmin: false }

it('no avisa a quien ya tiene PIN', () => {
  expect(pinReminderFor('set', [me, bea])).toEqual({ kind: 'none' })
})

it('pide un PIN sin dejar cerrarlo a la única persona admin', () => {
  expect(pinReminderFor('none', [me, bea])).toEqual({ kind: 'set_pin', dismissible: false })
})

it('pide un PIN y deja cerrarlo a los demás', () => {
  expect(
    pinReminderFor('none', [
      { ...me, isAdmin: false },
      { ...bea, isAdmin: true },
    ]),
  ).toEqual({
    kind: 'set_pin',
    dismissible: true,
  })
})

it('pide cambiar un PIN que estuvo a la vista', () => {
  expect(pinReminderFor('exposed', [me, { ...bea, isAdmin: true }])).toEqual({
    kind: 'change_pin',
    dismissible: true,
  })
  expect(pinReminderFor('exposed', [me, bea])).toEqual({ kind: 'change_pin', dismissible: false })
})
