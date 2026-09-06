import { useLocalSearchParams } from 'expo-router'

import { RecipeDetailScreen } from '@/features/recipes'

export default function RecipeDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <RecipeDetailScreen recipeId={id ?? ''} />
}
