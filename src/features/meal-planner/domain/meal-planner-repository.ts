import { MealPlanSlotWithRecipe, UpsertMealSlotInput } from './meal-plan'

export type MealPlannerRepository = {
  getWeekSlots(
    communityId: string,
    startDate: string,
    endDate: string,
  ): Promise<MealPlanSlotWithRecipe[]>

  upsertSlot(input: UpsertMealSlotInput): Promise<string>

  deleteSlot(communityId: string, date: string, mealType: 'lunch' | 'dinner'): Promise<void>

  subscribe(communityId: string, listener: { onChange: () => void }): () => void
}
