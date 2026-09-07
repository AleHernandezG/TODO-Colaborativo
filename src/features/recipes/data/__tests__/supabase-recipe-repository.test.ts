import { supabase } from '@/shared/lib/supabase'

import { supabaseRecipeRepository } from '../supabase-recipe-repository'

jest.mock('@/shared/lib/network', () => ({
  assertOnline: jest.fn().mockResolvedValue(undefined),
}))

describe('SupabaseRecipeRepository', () => {
  const communityId = '11111111-1111-4111-8111-111111111111'
  const recipeId = '22222222-2222-4222-8222-222222222222'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('lists recipes mapped to domain including imagePath', async () => {
    const mockData = [
      {
        id: recipeId,
        community_id: communityId,
        created_by_member_id: null,
        title: 'Tortilla',
        servings: 4,
        instructions: 'Freír',
        image_path: 'community/recipe.jpg',
        created_at: '2026-09-06T12:00:00Z',
        updated_at: '2026-09-06T12:00:00Z',
        recipe_ingredients: [
          {
            id: '33333333-3333-4333-8333-333333333333',
            recipe_id: recipeId,
            name: 'Huevos',
            quantity: 4,
            unit: 'uds',
            catalog_product_id: null,
            sort_order: 0,
            created_at: '2026-09-06T12:00:00Z',
          },
        ],
      },
    ]

    const orderMock = jest.fn().mockResolvedValue({ data: mockData, error: null })
    const eqMock = jest.fn().mockReturnValue({ order: orderMock })
    const selectMock = jest.fn().mockReturnValue({ eq: eqMock })
    jest.spyOn(supabase, 'from').mockReturnValue({ select: selectMock } as never)

    const result = await supabaseRecipeRepository.list(communityId)

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Tortilla')
    expect(result[0].imagePath).toBe('community/recipe.jpg')
    expect(result[0].ingredients).toHaveLength(1)
    expect(result[0].ingredients[0].name).toBe('Huevos')
    expect(result[0].ingredients[0].quantity).toBe(4)
  })

  it('saves recipe via save_recipe RPC with optional imagePath', async () => {
    jest.spyOn(supabase, 'rpc').mockResolvedValue({ data: recipeId, error: null } as never)

    const savedId = await supabaseRecipeRepository.save({
      communityId,
      title: 'Ensalada',
      servings: 2,
      instructions: 'Mezclar',
      imagePath: 'community/ensalada.jpg',
      ingredients: [{ name: 'Tomate', quantity: 2, unit: 'uds' }],
    })

    expect(savedId).toBe(recipeId)
    expect(supabase.rpc).toHaveBeenCalledWith(
      'save_recipe',
      expect.objectContaining({
        p_community_id: communityId,
        p_title: 'Ensalada',
        p_servings: 2,
        p_image_path: 'community/ensalada.jpg',
      }),
    )
  })

  it('deletes recipe via delete_recipe RPC', async () => {
    jest.spyOn(supabase, 'rpc').mockResolvedValue({ data: null, error: null } as never)

    await supabaseRecipeRepository.delete(recipeId)

    expect(supabase.rpc).toHaveBeenCalledWith('delete_recipe', { p_id: recipeId })
  })

  it('uploads, removes and signs cover image in recipe-images bucket', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    } as never)

    const uploadMock = jest.fn().mockResolvedValue({ data: { path: 'path' }, error: null })
    const removeMock = jest.fn().mockResolvedValue({ data: [], error: null })
    const createSignedUrlMock = jest
      .fn()
      .mockResolvedValue({ data: { signedUrl: 'https://signed.url' }, error: null })

    jest.spyOn(supabase.storage, 'from').mockReturnValue({
      upload: uploadMock,
      remove: removeMock,
      createSignedUrl: createSignedUrlMock,
    } as never)

    const path = await supabaseRecipeRepository.uploadImage({
      communityId,
      recipeId,
      uri: 'file:///image.jpg',
    })

    expect(path).toContain(`${communityId}/${recipeId}-`)
    expect(uploadMock).toHaveBeenCalled()

    await supabaseRecipeRepository.removeImage(path)
    expect(removeMock).toHaveBeenCalledWith([path])

    const url = await supabaseRecipeRepository.signImageUrl(path)
    expect(url).toBe('https://signed.url')
  })
})
