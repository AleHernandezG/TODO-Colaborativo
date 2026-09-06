import { Recipe, scaleIngredientQuantity } from '@/features/recipes'

export type MealType = 'lunch' | 'dinner'

export type MealPlanSlot = {
  id: string
  communityId: string
  date: string // YYYY-MM-DD
  mealType: MealType
  recipeId: string | null
  customDishName: string | null
  servings: number
  notes: string | null
  createdByMemberId: string | null
  createdAt: string
  updatedAt: string
}

export type MealPlanSlotWithRecipe = MealPlanSlot & {
  recipe?: Recipe | null
}

export type UpsertMealSlotInput = {
  communityId: string
  date: string // YYYY-MM-DD
  mealType: MealType
  recipeId?: string | null
  customDishName?: string | null
  servings?: number
  notes?: string | null
}

export type ConsolidatedIngredient = {
  name: string
  quantity: number
  unit: string | null
  catalogProductId: string | null
  recipeSources: string[]
}

export const defaultMealServings = 4
export const minMealServings = 1
export const maxMealServings = 100

export function isValidMealServings(servings: number): boolean {
  return Number.isInteger(servings) && servings >= minMealServings && servings <= maxMealServings
}

export function formatDateIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateIso(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export type WeekDayInfo = {
  date: string // YYYY-MM-DD
  dayIndex: number // 0 = Lunes, 6 = Domingo
  isToday: boolean
}

export type WeekRange = {
  monday: string
  sunday: string
  days: WeekDayInfo[]
}

export function getWeekDates(reference: Date | string = new Date()): WeekRange {
  const refDate = typeof reference === 'string' ? parseDateIso(reference) : new Date(reference)

  // En JS getDay(): 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  // Lo convertimos a 0 = Lunes, 6 = Domingo
  const day = refDate.getDay()
  const distanceToMonday = (day + 6) % 7

  const mondayDate = new Date(refDate)
  mondayDate.setDate(refDate.getDate() - distanceToMonday)

  const todayIso = formatDateIso(new Date())
  const days: WeekDayInfo[] = []

  for (let i = 0; i < 7; i++) {
    const d = new Date(mondayDate)
    d.setDate(mondayDate.getDate() + i)
    const dateStr = formatDateIso(d)
    days.push({
      date: dateStr,
      dayIndex: i,
      isToday: dateStr === todayIso,
    })
  }

  const monday = days[0]?.date ?? formatDateIso(mondayDate)
  const sunday = days[6]?.date ?? monday

  return { monday, sunday, days }
}

export function consolidateMealPlanIngredients(
  slots: MealPlanSlotWithRecipe[],
): ConsolidatedIngredient[] {
  const map = new Map<string, ConsolidatedIngredient>()

  for (const slot of slots) {
    const recipe = slot.recipe
    if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) {
      continue
    }

    const slotServings = slot.servings || recipe.servings || defaultMealServings
    const recipeServings = recipe.servings || defaultMealServings

    for (const ing of recipe.ingredients) {
      const normalizedName = ing.name.trim().toLowerCase()
      const normalizedUnit = (ing.unit ?? '').trim().toLowerCase()
      const catalogId = ing.catalogProductId ?? ''
      const key = `${normalizedName}___${normalizedUnit}___${catalogId}`

      const scaled = scaleIngredientQuantity(ing.quantity, recipeServings, slotServings)

      const existing = map.get(key)
      if (existing) {
        existing.quantity = Math.round((existing.quantity + scaled) * 100) / 100
        if (recipe.title && !existing.recipeSources.includes(recipe.title)) {
          existing.recipeSources.push(recipe.title)
        }
      } else {
        map.set(key, {
          name: ing.name.trim(),
          quantity: Math.round(scaled * 100) / 100,
          unit: ing.unit ? ing.unit.trim() : null,
          catalogProductId: ing.catalogProductId ?? null,
          recipeSources: recipe.title ? [recipe.title] : [],
        })
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
}
