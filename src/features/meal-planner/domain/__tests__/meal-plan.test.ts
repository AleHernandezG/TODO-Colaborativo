import {
  consolidateMealPlanIngredients,
  formatDateIso,
  getWeekDates,
  isValidMealServings,
  MealPlanSlotWithRecipe,
  parseDateIso,
} from '../meal-plan'

describe('meal-plan domain', () => {
  describe('isValidMealServings', () => {
    it('accepts integers between 1 and 100', () => {
      expect(isValidMealServings(1)).toBe(true)
      expect(isValidMealServings(4)).toBe(true)
      expect(isValidMealServings(100)).toBe(true)
    })

    it('rejects invalid values', () => {
      expect(isValidMealServings(0)).toBe(false)
      expect(isValidMealServings(-1)).toBe(false)
      expect(isValidMealServings(101)).toBe(false)
      expect(isValidMealServings(2.5)).toBe(false)
      expect(isValidMealServings(NaN)).toBe(false)
    })
  })

  describe('date utilities', () => {
    it('formatDateIso and parseDateIso work consistently', () => {
      const date = new Date(2026, 8, 7) // 7 de Septiembre de 2026 (Lunes)
      const iso = formatDateIso(date)
      expect(iso).toBe('2026-09-07')

      const parsed = parseDateIso('2026-09-07')
      expect(parsed.getFullYear()).toBe(2026)
      expect(parsed.getMonth()).toBe(8)
      expect(parsed.getDate()).toBe(7)
    })

    it('getWeekDates returns Monday to Sunday for any date in the week', () => {
      // Miércoles 9 de Septiembre de 2026
      const range = getWeekDates('2026-09-09')
      expect(range.monday).toBe('2026-09-07')
      expect(range.sunday).toBe('2026-09-13')
      expect(range.days).toHaveLength(7)
      expect(range.days[0]?.date).toBe('2026-09-07')
      expect(range.days[0]?.dayIndex).toBe(0)
      expect(range.days[6]?.date).toBe('2026-09-13')
      expect(range.days[6]?.dayIndex).toBe(6)

      // Domingo 13 de Septiembre de 2026 debe pertenecer a la misma semana
      const rangeSunday = getWeekDates('2026-09-13')
      expect(rangeSunday.monday).toBe('2026-09-07')
      expect(rangeSunday.sunday).toBe('2026-09-13')
    })
  })

  describe('consolidateMealPlanIngredients', () => {
    it('returns empty array if no slots or recipes', () => {
      expect(consolidateMealPlanIngredients([])).toEqual([])

      const emptySlot: MealPlanSlotWithRecipe = {
        id: '1',
        communityId: 'c1',
        date: '2026-09-07',
        mealType: 'lunch',
        recipeId: null,
        customDishName: 'Ensalada rápida',
        servings: 2,
        notes: null,
        createdByMemberId: 'm1',
        createdAt: '2026-09-07T00:00:00Z',
        updatedAt: '2026-09-07T00:00:00Z',
      }
      expect(consolidateMealPlanIngredients([emptySlot])).toEqual([])
    })

    it('scales and consolidates duplicate ingredients across recipes', () => {
      const slot1: MealPlanSlotWithRecipe = {
        id: 'slot-1',
        communityId: 'c1',
        date: '2026-09-07',
        mealType: 'lunch',
        recipeId: 'rec-1',
        customDishName: null,
        servings: 4, // base es 4 -> factor 1
        notes: null,
        createdByMemberId: 'm1',
        createdAt: '2026-09-07T00:00:00Z',
        updatedAt: '2026-09-07T00:00:00Z',
        recipe: {
          id: 'rec-1',
          communityId: 'c1',
          createdByMemberId: 'm1',
          title: 'Tortilla de patatas',
          servings: 4,
          instructions: 'Freir y cuajar',
          createdAt: '2026-09-07T00:00:00Z',
          updatedAt: '2026-09-07T00:00:00Z',
          ingredients: [
            {
              id: 'ing-1',
              recipeId: 'rec-1',
              name: 'Huevos',
              quantity: 6,
              unit: 'ud',
              catalogProductId: 'cat-huevo',
              sortOrder: 0,
              createdAt: '2026-09-07T00:00:00Z',
            },
            {
              id: 'ing-2',
              recipeId: 'rec-1',
              name: 'Patatas',
              quantity: 1,
              unit: 'kg',
              catalogProductId: null,
              sortOrder: 1,
              createdAt: '2026-09-07T00:00:00Z',
            },
          ],
        },
      }

      const slot2: MealPlanSlotWithRecipe = {
        id: 'slot-2',
        communityId: 'c1',
        date: '2026-09-08',
        mealType: 'dinner',
        recipeId: 'rec-2',
        customDishName: null,
        servings: 2, // base es 4 -> factor 0.5
        notes: null,
        createdByMemberId: 'm1',
        createdAt: '2026-09-07T00:00:00Z',
        updatedAt: '2026-09-07T00:00:00Z',
        recipe: {
          id: 'rec-2',
          communityId: 'c1',
          createdByMemberId: 'm1',
          title: 'Bizcocho casero',
          servings: 4,
          instructions: 'Hornear',
          createdAt: '2026-09-07T00:00:00Z',
          updatedAt: '2026-09-07T00:00:00Z',
          ingredients: [
            {
              id: 'ing-3',
              recipeId: 'rec-2',
              name: 'Huevos', // mismo producto con cat-huevo
              quantity: 4, // a 2 raciones = 2 ud
              unit: 'ud',
              catalogProductId: 'cat-huevo',
              sortOrder: 0,
              createdAt: '2026-09-07T00:00:00Z',
            },
            {
              id: 'ing-4',
              recipeId: 'rec-2',
              name: 'Harina de trigo',
              quantity: 250, // a 2 raciones = 125 g
              unit: 'g',
              catalogProductId: null,
              sortOrder: 1,
              createdAt: '2026-09-07T00:00:00Z',
            },
          ],
        },
      }

      const consolidated = consolidateMealPlanIngredients([slot1, slot2])

      expect(consolidated).toHaveLength(3)

      // Harina
      const harina = consolidated.find((c) => c.name === 'Harina de trigo')
      expect(harina).toBeDefined()
      expect(harina?.quantity).toBe(125)
      expect(harina?.unit).toBe('g')
      expect(harina?.recipeSources).toEqual(['Bizcocho casero'])

      // Huevos (6 de la tortilla + 2 del bizcocho = 8)
      const huevos = consolidated.find((c) => c.name === 'Huevos')
      expect(huevos).toBeDefined()
      expect(huevos?.quantity).toBe(8)
      expect(huevos?.unit).toBe('ud')
      expect(huevos?.catalogProductId).toBe('cat-huevo')
      expect(huevos?.recipeSources).toEqual(['Tortilla de patatas', 'Bizcocho casero'])

      // Patatas (1 kg)
      const patatas = consolidated.find((c) => c.name === 'Patatas')
      expect(patatas).toBeDefined()
      expect(patatas?.quantity).toBe(1)
      expect(patatas?.unit).toBe('kg')
      expect(patatas?.recipeSources).toEqual(['Tortilla de patatas'])
    })
  })
})
