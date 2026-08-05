import { fallbackLanguage, resolveLanguage } from '../resolve-language'

describe('resolveLanguage', () => {
  it('picks the first supported language of the device', () => {
    expect(resolveLanguage(['en'])).toBe('en')
    expect(resolveLanguage(['es'])).toBe('es')
  })

  it('ignores the region', () => {
    expect(resolveLanguage(['en-GB'])).toBe('en')
    expect(resolveLanguage(['es-419'])).toBe('es')
  })

  it('is case insensitive', () => {
    expect(resolveLanguage(['EN-US'])).toBe('en')
  })

  it('skips unsupported languages and keeps looking', () => {
    expect(resolveLanguage(['fr', 'de', 'en'])).toBe('en')
  })

  it('falls back to Spanish when nothing matches', () => {
    expect(resolveLanguage(['fr', 'de'])).toBe(fallbackLanguage)
  })

  it('survives an empty or unknown locale list', () => {
    expect(resolveLanguage([])).toBe(fallbackLanguage)
    expect(resolveLanguage([null, undefined, ''])).toBe(fallbackLanguage)
  })
})
