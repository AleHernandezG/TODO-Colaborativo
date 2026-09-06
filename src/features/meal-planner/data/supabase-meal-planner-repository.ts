import { Recipe, RecipeIngredient } from '@/features/recipes'
import { serverError } from '@/shared/lib/errors'
import { assertOnline } from '@/shared/lib/network'
import { supabase } from '@/shared/lib/supabase'

import type {
  MealPlanSlotWithRecipe,
  MealType,
  UpsertMealSlotInput,
} from '../domain/meal-plan'
import type { MealPlannerRepository } from '../domain/meal-planner-repository'

type RecipeIngredientRow = {
  id: string
  recipe_id: string
  name: string
  quantity: number
  unit: string | null
  catalog_product_id: string | null
  sort_order: number
  created_at: string
}

type RecipeRow = {
  id: string
  community_id: string
  created_by_member_id: string | null
  title: string
  servings: number
  instructions: string
  created_at: string
  updated_at: string
  recipe_ingredients: RecipeIngredientRow[]
}

type MealPlanSlotRow = {
  id: string
  community_id: string
  date: string
  meal_type: MealType
  recipe_id: string | null
  custom_dish_name: string | null
  servings: number
  notes: string | null
  created_by_member_id: string | null
  created_at: string
  updated_at: string
  recipe: RecipeRow | null
}

function toIngredient(row: RecipeIngredientRow): RecipeIngredient {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    name: row.name,
    quantity: Number(row.quantity),
    unit: row.unit,
    catalogProductId: row.catalog_product_id,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }
}

function toRecipe(row: RecipeRow): Recipe {
  const sortedIngredients = [...(row.recipe_ingredients ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  )
  return {
    id: row.id,
    communityId: row.community_id,
    createdByMemberId: row.created_by_member_id,
    title: row.title,
    servings: row.servings,
    instructions: row.instructions,
    ingredients: sortedIngredients.map(toIngredient),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toSlotWithRecipe(row: MealPlanSlotRow): MealPlanSlotWithRecipe {
  return {
    id: row.id,
    communityId: row.community_id,
    date: row.date,
    mealType: row.meal_type,
    recipeId: row.recipe_id,
    customDishName: row.custom_dish_name,
    servings: row.servings,
    notes: row.notes,
    createdByMemberId: row.created_by_member_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    recipe: row.recipe ? toRecipe(row.recipe) : null,
  }
}

export const supabaseMealPlannerRepository: MealPlannerRepository = {
  async getWeekSlots(
    communityId: string,
    startDate: string,
    endDate: string,
  ): Promise<MealPlanSlotWithRecipe[]> {
    await assertOnline()

    const { data, error } = await supabase
      .from('meal_plan_slots')
      .select('*, recipe:recipes(*, recipe_ingredients(*))')
      .eq('community_id', communityId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })

    if (error) {
      throw serverError('meal_plan_slots.select', error)
    }

    return ((data as unknown as MealPlanSlotRow[]) ?? []).map(toSlotWithRecipe)
  },

  async upsertSlot(input: UpsertMealSlotInput): Promise<string> {
    await assertOnline()

    const { data, error } = await supabase.rpc('upsert_meal_slot', {
      p_community_id: input.communityId,
      p_date: input.date,
      p_meal_type: input.mealType,
      p_recipe_id: input.recipeId ?? undefined,
      p_custom_dish_name: input.customDishName ?? undefined,
      p_servings: input.servings ?? 4,
      p_notes: input.notes ?? undefined,
    })

    if (error || !data) {
      throw serverError('meal_plan_slots.upsert', error)
    }

    return data as string
  },

  async deleteSlot(communityId: string, date: string, mealType: 'lunch' | 'dinner'): Promise<void> {
    await assertOnline()

    const { error } = await supabase.rpc('delete_meal_slot', {
      p_community_id: communityId,
      p_date: date,
      p_meal_type: mealType,
    })

    if (error) {
      throw serverError('meal_plan_slots.delete', error)
    }
  },

  subscribe(communityId: string, { onChange }: { onChange: () => void }): () => void {
    const channel = supabase
      .channel(`meal_plan_slots:${communityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meal_plan_slots',
          filter: `community_id=eq.${communityId}`,
        },
        () => onChange(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  },
}
