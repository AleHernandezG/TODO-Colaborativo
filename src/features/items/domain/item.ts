import type { ItemCategory } from './item-category'

export type Item = {
  id: string
  name: string
  quantity: number
  isPurchased: boolean
  imagePath: string | null
  catalogProductId: string | null
  category: ItemCategory
  createdAt: string
}

