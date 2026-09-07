export { supabaseItemRepository } from './data/supabase-item-repository'
export type { Item } from './domain/item'
export type { AisleGroup, CategoryMetadata, ItemCategory } from './domain/item-category'
export {
  getCategoryMetadata,
  groupItemsByAisle,
  inferItemCategory,
  ITEM_CATEGORIES,
} from './domain/item-category'
export { itemsKey } from './presentation/hooks/use-items'
export { registerItemMutationDefaults } from './presentation/mutations/item-mutations'
export { ItemsScreen } from './presentation/screens/ItemsScreen'
export { ShoppingModeScreen } from './presentation/screens/ShoppingModeScreen'


