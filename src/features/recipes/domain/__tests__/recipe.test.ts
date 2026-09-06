import {
  formatIngredientDisplay,
  isValidRecipeTitle,
  isValidServings,
  normalizeRecipeTitle,
  scaleIngredientQuantity,
} from '../recipe'

describe('Recipe Domain', () => {
  describe('normalizeRecipeTitle', () => {
    it('trims leading/trailing spaces and collapses inner spaces', () => {
      expect(normalizeRecipeTitle('  Arroz   con   pollo  ')).toBe('Arroz con pollo')
    })
  })

  describe('isValidRecipeTitle', () => {
    it('accepts valid titles with at least 2 characters', () => {
      expect(isValidRecipeTitle('Paella')).toBe(true)
      expect(isValidRecipeTitle('Té')).toBe(true)
    })

    it('rejects empty or single character titles', () => {
      expect(isValidRecipeTitle('')).toBe(false)
      expect(isValidRecipeTitle(' ')).toBe(false)
      expect(isValidRecipeTitle('A')).toBe(false)
    })

    it('rejects titles longer than 100 characters', () => {
      const longTitle = 'a'.repeat(101)
      expect(isValidRecipeTitle(longTitle)).toBe(false)
    })
  })

  describe('isValidServings', () => {
    it('accepts integer servings between 1 and 100', () => {
      expect(isValidServings(1)).toBe(true)
      expect(isValidServings(4)).toBe(true)
      expect(isValidServings(100)).toBe(true)
    })

    it('rejects numbers less than 1, greater than 100, or non-integers', () => {
      expect(isValidServings(0)).toBe(false)
      expect(isValidServings(-2)).toBe(false)
      expect(isValidServings(101)).toBe(false)
      expect(isValidServings(2.5)).toBe(false)
    })
  })

  describe('scaleIngredientQuantity', () => {
    it('scales quantity linearly based on servings', () => {
      // 500g for 4 people -> 1000g for 8 people
      expect(scaleIngredientQuantity(500, 4, 8)).toBe(1000)
      // 500g for 4 people -> 250g for 2 people
      expect(scaleIngredientQuantity(500, 4, 2)).toBe(250)
    })

    it('handles decimal results and rounds to 2 decimals', () => {
      // 1 unit for 3 people scaled to 2 people -> 0.67
      expect(scaleIngredientQuantity(1, 3, 2)).toBe(0.67)
    })

    it('returns base quantity on invalid arguments', () => {
      expect(scaleIngredientQuantity(100, 0, 4)).toBe(100)
      expect(scaleIngredientQuantity(100, 4, 0)).toBe(100)
    })
  })

  describe('formatIngredientDisplay', () => {
    it('formats ingredient with unit', () => {
      expect(
        formatIngredientDisplay({ name: 'Harina', quantity: 250, unit: 'g' }),
      ).toBe('250 g Harina')
    })

    it('formats ingredient without unit', () => {
      expect(
        formatIngredientDisplay({ name: 'Huevos', quantity: 3, unit: null }),
      ).toBe('3 Huevos')
    })
  })
})
