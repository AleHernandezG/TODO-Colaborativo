import en from '../en.json'
import es from '../es.json'

type Tree = { [key: string]: string | Tree }

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      acc[path] = value
    } else {
      Object.assign(acc, flatten(value, path))
    }
    return acc
  }, {})
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort()
}

const spanish = flatten(es as Tree)
const english = flatten(en as Tree)

describe('translations', () => {
  it('has the same keys in both languages', () => {
    expect(Object.keys(english).sort()).toEqual(Object.keys(spanish).sort())
  })

  it('has no empty strings', () => {
    for (const [key, value] of Object.entries(english)) {
      expect(value.trim()).not.toBe('')
      expect(spanish[key].trim()).not.toBe('')
    }
  })

  it('keeps the same interpolation placeholders in every key', () => {
    for (const [key, value] of Object.entries(spanish)) {
      expect({ key, placeholders: placeholders(english[key]) }).toEqual({
        key,
        placeholders: placeholders(value),
      })
    }
  })

  it('keeps both plural forms wherever one language has them', () => {
    const pluralBases = new Set(
      [...Object.keys(spanish), ...Object.keys(english)]
        .filter((key) => key.endsWith('_one') || key.endsWith('_other'))
        .map((key) => key.replace(/_(one|other)$/, '')),
    )

    for (const base of pluralBases) {
      for (const suffix of ['_one', '_other']) {
        expect(Object.keys(spanish)).toContain(`${base}${suffix}`)
        expect(Object.keys(english)).toContain(`${base}${suffix}`)
      }
    }
  })
})
