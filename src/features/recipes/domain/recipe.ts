export type RecipeIngredient = {
  id: string
  recipeId: string
  name: string
  quantity: number
  unit: string | null
  catalogProductId: string | null
  sortOrder: number
  createdAt: string
}

export type Recipe = {
  id: string
  communityId: string
  createdByMemberId: string | null
  title: string
  servings: number
  instructions: string
  ingredients: RecipeIngredient[]
  createdAt: string
  updatedAt: string
}

export type NewRecipeIngredientInput = {
  id?: string
  name: string
  quantity: number
  unit?: string | null
  catalogProductId?: string | null
  sortOrder?: number
}

export type NewRecipeInput = {
  id?: string
  communityId: string
  title: string
  servings: number
  instructions: string
  ingredients: NewRecipeIngredientInput[]
}

export const recipeTitleMinLength = 2
export const recipeTitleMaxLength = 100
export const defaultServings = 4
export const minServings = 1
export const maxServings = 100

export function normalizeRecipeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ')
}

export function isValidRecipeTitle(title: string): boolean {
  const normalized = normalizeRecipeTitle(title)
  return normalized.length >= recipeTitleMinLength && normalized.length <= recipeTitleMaxLength
}

export function isValidServings(servings: number): boolean {
  return Number.isInteger(servings) && servings >= minServings && servings <= maxServings
}

export function scaleIngredientQuantity(
  baseQuantity: number,
  baseServings: number,
  targetServings: number,
): number {
  if (baseServings <= 0 || targetServings <= 0 || baseQuantity <= 0) {
    return baseQuantity
  }
  const factor = targetServings / baseServings
  const scaled = baseQuantity * factor
  // Redondear a un máximo de 2 decimales para que no salgan números periódicos como 3.333333333
  return Math.round(scaled * 100) / 100
}

export function formatIngredientDisplay(ingredient: {
  name: string
  quantity: number
  unit?: string | null
}): string {
  const q = ingredient.quantity
  const quantityStr = Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, '')
  const unitStr = ingredient.unit ? ` ${ingredient.unit}` : ''
  return `${quantityStr}${unitStr} ${ingredient.name}`.trim()
}
