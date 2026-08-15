import { catalogNameMaxLength, normalizeCatalogName } from '../normalized-name'

it('pasa a minúsculas', () => {
  expect(normalizeCatalogName('Leche Entera')).toBe('leche entera')
})

it('quita los acentos', () => {
  expect(normalizeCatalogName('Plátano de Canarias')).toBe('platano de canarias')
})

it('deja la eñe como ene, que es como la escribe quien busca deprisa', () => {
  expect(normalizeCatalogName('Piña')).toBe('pina')
})

it('convierte en espacio cualquier signo', () => {
  expect(normalizeCatalogName('Aceite de oliva virgen extra, 1 L.')).toBe(
    'aceite de oliva virgen extra 1 l',
  )
})

it('conserva los números', () => {
  expect(normalizeCatalogName('Yogur natural 6 x 125 g')).toBe('yogur natural 6 x 125 g')
})

it('recorta y colapsa los espacios', () => {
  expect(normalizeCatalogName('  pan   de   molde ')).toBe('pan de molde')
})

it('devuelve cadena vacía cuando no queda nada que buscar', () => {
  expect(normalizeCatalogName('!!! ¿¿¿')).toBe('')
})

it('el nombre normalizado más largo del catálogo cabe en la columna', () => {
  const long = normalizeCatalogName('a'.repeat(catalogNameMaxLength + 50))

  expect(long).toHaveLength(catalogNameMaxLength)
})

it('no deja un espacio suelto al final tras cortar por el máximo', () => {
  const long = normalizeCatalogName(`${'a'.repeat(catalogNameMaxLength - 1)} bcd`)

  expect(long).toBe('a'.repeat(catalogNameMaxLength - 1))
})

it('normalizar dos veces da lo mismo que normalizar una', () => {
  const once = normalizeCatalogName('Café Molido Mezcla, 250 g')

  expect(normalizeCatalogName(once)).toBe(once)
})
