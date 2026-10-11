import type { Membership } from '../community'
import {
  checkActiveMembership,
  findMembership,
  sortMemberships,
  withMembership,
} from '../my-memberships'

function membership(id: string, name: string, username = 'Ana'): Membership {
  return { community: { id, name, joinCode: `CODE-${id}` }, username }
}

const casa = membership('c1', 'Casa')
const piso = membership('c2', 'piso de Madrid')
const trabajo = membership('c3', 'Trabajo')

describe('sortMemberships', () => {
  it('ordena por nombre sin distinguir mayúsculas ni tildes', () => {
    const arbol = membership('c4', 'Árbol')

    expect(sortMemberships([trabajo, piso, casa, arbol]).map((m) => m.community.name)).toEqual([
      'Árbol',
      'Casa',
      'piso de Madrid',
      'Trabajo',
    ])
  })

  it('desempata por id para que dos listas con el mismo nombre no bailen', () => {
    const twinB = membership('b', 'Casa')
    const twinA = membership('a', 'Casa')

    expect(sortMemberships([twinB, twinA]).map((m) => m.community.id)).toEqual(['a', 'b'])
    expect(sortMemberships([twinA, twinB]).map((m) => m.community.id)).toEqual(['a', 'b'])
  })

  it('no toca el array que recibe', () => {
    const input = [trabajo, casa]
    sortMemberships(input)
    expect(input).toEqual([trabajo, casa])
  })
})

describe('withMembership', () => {
  it('añade una lista nueva en su sitio', () => {
    expect(withMembership([casa, trabajo], piso)).toEqual([casa, piso, trabajo])
  })

  it('sustituye la que ya estaba en vez de duplicarla', () => {
    const renamed = membership('c1', 'Casa nueva', 'Anita')

    expect(withMembership([casa, trabajo], renamed)).toEqual([renamed, trabajo])
  })

  it('funciona sobre una lista vacía', () => {
    expect(withMembership([], casa)).toEqual([casa])
  })
})

describe('findMembership', () => {
  it('devuelve la lista con ese id', () => {
    expect(findMembership([casa, piso], 'c2')).toBe(piso)
  })

  it('devuelve null si no estoy en ella', () => {
    expect(findMembership([casa, piso], 'c9')).toBeNull()
  })
})

describe('checkActiveMembership', () => {
  it('no hace nada si no hay lista activa', () => {
    expect(checkActiveMembership(null, [casa])).toEqual({ status: 'unchanged' })
  })

  it('no hace nada si la activa sigue igual en el servidor', () => {
    expect(checkActiveMembership(casa, [membership('c1', 'Casa'), piso])).toEqual({
      status: 'unchanged',
    })
  })

  it('refresca la activa si el servidor trae otro nombre de lista', () => {
    const renamed = membership('c1', 'Casa de la playa')

    expect(checkActiveMembership(casa, [renamed, piso])).toEqual({
      status: 'refreshed',
      membership: renamed,
    })
  })

  it('refresca la activa si cambió el código de invitación', () => {
    const rotated: Membership = {
      community: { id: 'c1', name: 'Casa', joinCode: 'NUEVO-22' },
      username: 'Ana',
    }

    expect(checkActiveMembership(casa, [rotated])).toEqual({
      status: 'refreshed',
      membership: rotated,
    })
  })

  it('pasa a la primera lista que me queda si me quitaron de la activa', () => {
    expect(checkActiveMembership(casa, [trabajo, piso])).toEqual({
      status: 'replaced',
      membership: piso,
      lostCommunityName: 'Casa',
    })
  })

  it('se queda sin lista si me quitaron de la única que tenía', () => {
    expect(checkActiveMembership(casa, [])).toEqual({
      status: 'none',
      lostCommunityName: 'Casa',
    })
  })
})
