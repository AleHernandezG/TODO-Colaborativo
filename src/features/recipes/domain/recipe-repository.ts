import type { NewRecipeInput, Recipe } from './recipe'

export interface RecipeRepository {
  list(communityId: string): Promise<Recipe[]>
  getById(id: string): Promise<Recipe | null>
  save(recipe: NewRecipeInput): Promise<string>
  delete(id: string): Promise<void>
  uploadImage(input: { communityId: string; recipeId: string; uri: string }): Promise<string>
  removeImage(path: string): Promise<void>
  signImageUrl(path: string): Promise<string>
  subscribe(communityId: string, listener: { onChange: () => void }): () => void
}
