import { serverError } from '@/shared/lib/errors'
import { assertOnline } from '@/shared/lib/network'
import { supabase } from '@/shared/lib/supabase'
import { randomUuid } from '@/shared/lib/uuid'

import type { NewRecipeInput, Recipe, RecipeIngredient } from '../domain/recipe'
import type { RecipeRepository } from '../domain/recipe-repository'

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

export const supabaseRecipeRepository: RecipeRepository = {
  async list(communityId: string): Promise<Recipe[]> {
    await assertOnline()

    const { data, error } = await supabase
      .from('recipes')
      .select('*, recipe_ingredients(*)')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })

    if (error) {
      throw serverError('recipes.select', error)
    }

    return (data as unknown as RecipeRow[] ?? []).map(toRecipe)
  },

  async getById(id: string): Promise<Recipe | null> {
    await assertOnline()

    const { data, error } = await supabase
      .from('recipes')
      .select('*, recipe_ingredients(*)')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      throw serverError('recipes.getById', error)
    }

    if (!data) {
      return null
    }

    return toRecipe(data as unknown as RecipeRow)
  },

  async save(recipe: NewRecipeInput): Promise<string> {
    await assertOnline()

    const payloadIngredients = recipe.ingredients.map((ing, idx) => ({
      id: ing.id,
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit ?? null,
      catalog_product_id: ing.catalogProductId ?? null,
      sort_order: ing.sortOrder ?? idx,
    }))

    const { data, error } = await supabase.rpc('save_recipe', {
      p_id: recipe.id ?? randomUuid(),
      p_community_id: recipe.communityId,
      p_title: recipe.title,
      p_servings: recipe.servings,
      p_instructions: recipe.instructions,
      p_ingredients: payloadIngredients,
    })

    if (error || !data) {
      throw serverError('recipes.save_recipe', error)
    }

    return data as string
  },

  async delete(id: string): Promise<void> {
    await assertOnline()

    const { error } = await supabase.rpc('delete_recipe', {
      p_id: id,
    })

    if (error) {
      throw serverError('recipes.delete_recipe', error)
    }
  },

  subscribe(communityId: string, { onChange }: { onChange: () => void }): () => void {
    const channel = supabase
      .channel(`recipes:${communityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recipes',
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
