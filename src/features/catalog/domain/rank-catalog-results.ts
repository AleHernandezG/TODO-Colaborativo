import type { CatalogCandidate } from './catalog-product'
import { normalizeCatalogName } from './normalized-name'

const exactName = 5
const nameStartsWithQuery = 4
const everyQueryWordMatchesAndNameLeadsWithIt = 3
const everyQueryWordStartsAWord = 2
const containedOrBrand = 1
const similarityOnly = 0

function words(value: string): string[] {
  return value === '' ? [] : value.split(' ')
}

function matchTier(candidate: CatalogCandidate, query: string): number {
  const name = candidate.normalizedName
  if (name === query) return exactName
  if (name.startsWith(query)) return nameStartsWithQuery

  const nameWords = words(name)
  const queryWords = words(query)
  const allWordsMatch = queryWords.every((queryWord) =>
    nameWords.some((nameWord) => nameWord.startsWith(queryWord)),
  )
  if (allWordsMatch) {
    return nameWords[0].startsWith(queryWords[0])
      ? everyQueryWordMatchesAndNameLeadsWithIt
      : everyQueryWordStartsAWord
  }

  if (name.includes(query)) return containedOrBrand

  const brand = candidate.brand === null ? '' : normalizeCatalogName(candidate.brand)
  if (brand !== '' && brand.startsWith(query)) return containedOrBrand

  return similarityOnly
}

function isPack(packageSize: string | null): boolean {
  return packageSize !== null && packageSize.includes(' x ')
}

export function rankCatalogResults(
  rawQuery: string,
  candidates: readonly CatalogCandidate[],
  limit: number,
): CatalogCandidate[] {
  const query = normalizeCatalogName(rawQuery)
  if (query === '' || limit < 1) return []

  return candidates
    .map((candidate) => ({ candidate, tier: matchTier(candidate, query) }))
    .sort((a, b) => {
      if (a.tier !== b.tier) return b.tier - a.tier

      const packs =
        Number(isPack(a.candidate.packageSize)) - Number(isPack(b.candidate.packageSize))
      if (packs !== 0) return packs

      if (a.candidate.similarity !== b.candidate.similarity) {
        return b.candidate.similarity - a.candidate.similarity
      }
      if (a.candidate.name.length !== b.candidate.name.length) {
        return a.candidate.name.length - b.candidate.name.length
      }

      const byName = a.candidate.name.localeCompare(b.candidate.name)
      return byName !== 0 ? byName : a.candidate.id.localeCompare(b.candidate.id)
    })
    .slice(0, limit)
    .map((scored) => scored.candidate)
}
