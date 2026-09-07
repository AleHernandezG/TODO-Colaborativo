import type { RecipeRepository } from './recipe-repository'

export const recipeImageUrlTtlSeconds = 7 * 24 * 60 * 60

export function recipeImageUrl(repository: RecipeRepository, path: string): Promise<string> {
  return repository.signImageUrl(path)
}
