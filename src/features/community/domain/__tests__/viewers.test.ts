import { othersViewing, summarizeViewers } from '../viewers'

describe('othersViewing', () => {
  it('se quita a uno mismo de la lista', () => {
    expect(othersViewing(['ana', 'luis'], 'ana')).toEqual(['luis'])
  })

  it('devuelve vacío cuando solo estás tú', () => {
    expect(othersViewing(['ana'], 'ana')).toEqual([])
  })

  it('ordena para que el texto no baile en cada sync', () => {
    expect(othersViewing(['luis', 'ana', 'marta'], 'yo')).toEqual(['ana', 'luis', 'marta'])
  })

  it('aguanta que no haya nadie', () => {
    expect(othersViewing([], 'ana')).toEqual([])
  })
})

describe('summarizeViewers', () => {
  it('enseña hasta tres nombres', () => {
    expect(summarizeViewers(['ana', 'luis', 'marta'])).toEqual({
      shown: ['ana', 'luis', 'marta'],
      hidden: 0,
    })
  })

  it('cuenta los que no caben', () => {
    expect(summarizeViewers(['ana', 'luis', 'marta', 'pepe', 'sara'])).toEqual({
      shown: ['ana', 'luis', 'marta'],
      hidden: 2,
    })
  })

  it('con nadie no esconde nada', () => {
    expect(summarizeViewers([])).toEqual({ shown: [], hidden: 0 })
  })
})
