import en from '../en.json'
import es from '../es.json'

type Tree = { [key: string]: string | Tree }

function flatten(tree: Tree, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? [[path, value] as [string, string]] : flatten(value, path)
  })
}

const texts = [
  ...flatten(es as Tree).map(([key, value]) => ({ key: `es:${key}`, value })),
  ...flatten(en as Tree).map(([key, value]) => ({ key: `en:${key}`, value })),
]

const syncClaims = [
  /sincronizad[oa]s?/i,
  /\bsynced\b/i,
  /\bsync(ed|hroni[sz]ed)? (complete|done)\b/i,
  /se mantiene actualizad[oa]/i,
  /\bup to date for\b/i,
  /guardad[oa]s? en el servidor/i,
  /\bsaved (to|on) the server\b/i,
  /todo (está )?guardado/i,
  /\ball (changes )?saved\b/i,
]

const priceClaims = [
  /precio (actual|real|exacto|de hoy)/i,
  /\b(current|actual|exact|today'?s) price/i,
]

describe('regla 6: lo que la app nunca dice', () => {
  it('never claims that a change reached the server or the group', () => {
    const offenders = texts.filter(({ value }) => syncClaims.some((claim) => claim.test(value)))
    expect(offenders).toEqual([])
  })

  it('never presents a catalog price as the current one', () => {
    const offenders = texts.filter(({ value }) => priceClaims.some((claim) => claim.test(value)))
    expect(offenders).toEqual([])
  })

  it('keeps the reference-only notice next to catalog prices', () => {
    expect(es.catalog.source).toMatch(/orientativ/i)
    expect(en.catalog.source).toMatch(/for reference only/i)
  })

  it('keeps the age of the catalog price visible', () => {
    expect(Object.keys(es.catalog.seen).length).toBeGreaterThan(0)
    expect(Object.keys(en.catalog.seen)).toEqual(Object.keys(es.catalog.seen))
  })
})
