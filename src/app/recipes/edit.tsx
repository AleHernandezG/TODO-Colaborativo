import { useLocalSearchParams } from 'expo-router'

import { EditRecipeScreen } from '@/features/recipes'

export default function EditRecipeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <EditRecipeScreen recipeId={id ?? ''} />
}
