import { supabase } from '@/shared/lib/supabase'

import { supabaseMealPlannerRepository } from '../supabase-meal-planner-repository'

jest.mock('@/shared/lib/network', () => ({
  assertOnline: jest.fn().mockResolvedValue(undefined),
}))

describe('SupabaseMealPlannerRepository', () => {
  const communityId = '11111111-1111-4111-8111-111111111111'
  const slotId = '22222222-2222-4222-8222-222222222222'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('queries slots within date range and maps to domain', async () => {
    const mockData = [
      {
        id: slotId,
        community_id: communityId,
        date: '2026-09-07',
        meal_type: 'lunch',
        recipe_id: 'rec-1',
        custom_dish_name: null,
        servings: 4,
        notes: 'Almuerzo familiar',
        created_by_member_id: null,
        created_at: '2026-09-06T12:00:00Z',
        updated_at: '2026-09-06T12:00:00Z',
        recipe: {
          id: 'rec-1',
          community_id: communityId,
          created_by_member_id: null,
          title: 'Tortilla de patatas',
          servings: 4,
          instructions: 'Cuajar',
          created_at: '2026-09-06T12:00:00Z',
          updated_at: '2026-09-06T12:00:00Z',
          recipe_ingredients: [
            {
              id: 'ing-1',
              recipe_id: 'rec-1',
              name: 'Huevos',
              quantity: 6,
              unit: 'ud',
              catalog_product_id: null,
              sort_order: 0,
              created_at: '2026-09-06T12:00:00Z',
            },
          ],
        },
      },
    ]

    const orderMock = jest.fn().mockResolvedValue({ data: mockData, error: null })
    const lteMock = jest.fn().mockReturnValue({ order: orderMock })
    const gteMock = jest.fn().mockReturnValue({ lte: lteMock })
    const eqMock = jest.fn().mockReturnValue({ gte: gteMock })
    const selectMock = jest.fn().mockReturnValue({ eq: eqMock })
    jest.spyOn(supabase, 'from').mockReturnValue({ select: selectMock } as never)

    const result = await supabaseMealPlannerRepository.getWeekSlots(
      communityId,
      '2026-09-07',
      '2026-09-13',
    )

    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-09-07')
    expect(result[0].mealType).toBe('lunch')
    expect(result[0].recipe?.title).toBe('Tortilla de patatas')
    expect(result[0].recipe?.ingredients).toHaveLength(1)
  })

  it('upserts slot via upsert_meal_slot RPC', async () => {
    jest.spyOn(supabase, 'rpc').mockResolvedValue({ data: slotId, error: null } as never)

    const savedId = await supabaseMealPlannerRepository.upsertSlot({
      communityId,
      date: '2026-09-07',
      mealType: 'lunch',
      recipeId: 'rec-1',
      servings: 4,
    })

    expect(savedId).toBe(slotId)
    expect(supabase.rpc).toHaveBeenCalledWith('upsert_meal_slot', {
      p_community_id: communityId,
      p_date: '2026-09-07',
      p_meal_type: 'lunch',
      p_recipe_id: 'rec-1',
      p_custom_dish_name: undefined,
      p_servings: 4,
      p_notes: undefined,
    })
  })

  it('deletes slot via delete_meal_slot RPC', async () => {
    jest.spyOn(supabase, 'rpc').mockResolvedValue({ data: null, error: null } as never)

    await supabaseMealPlannerRepository.deleteSlot(communityId, '2026-09-07', 'lunch')

    expect(supabase.rpc).toHaveBeenCalledWith('delete_meal_slot', {
      p_community_id: communityId,
      p_date: '2026-09-07',
      p_meal_type: 'lunch',
    })
  })
})
