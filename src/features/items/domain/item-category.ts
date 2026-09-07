import type { Item } from './item'

export type ItemCategory =
  | 'fruits_vegetables'
  | 'dairy_eggs'
  | 'meat_fish'
  | 'bakery'
  | 'pantry'
  | 'drinks'
  | 'frozen'
  | 'cleaning_home'
  | 'personal_care'
  | 'other'

export type CategoryMetadata = {
  id: ItemCategory
  icon: string
  translationKey: string
  order: number
}

export const ITEM_CATEGORIES: readonly CategoryMetadata[] = [
  { id: 'fruits_vegetables', icon: '🍎', translationKey: 'items.categories.fruits_vegetables', order: 1 },
  { id: 'dairy_eggs', icon: '🥛', translationKey: 'items.categories.dairy_eggs', order: 2 },
  { id: 'meat_fish', icon: '🥩', translationKey: 'items.categories.meat_fish', order: 3 },
  { id: 'bakery', icon: '🥖', translationKey: 'items.categories.bakery', order: 4 },
  { id: 'pantry', icon: '🍝', translationKey: 'items.categories.pantry', order: 5 },
  { id: 'drinks', icon: '🧃', translationKey: 'items.categories.drinks', order: 6 },
  { id: 'frozen', icon: '🧊', translationKey: 'items.categories.frozen', order: 7 },
  { id: 'cleaning_home', icon: '🧼', translationKey: 'items.categories.cleaning_home', order: 8 },
  { id: 'personal_care', icon: '🧴', translationKey: 'items.categories.personal_care', order: 9 },
  { id: 'other', icon: '📦', translationKey: 'items.categories.other', order: 10 },
] as const

const categoryMap = new Map<ItemCategory, CategoryMetadata>(
  ITEM_CATEGORIES.map((cat) => [cat.id, cat]),
)

export function getCategoryMetadata(category: ItemCategory): CategoryMetadata {
  return categoryMap.get(category) ?? categoryMap.get('other')!
}

const keywordsByCategory: Record<Exclude<ItemCategory, 'other'>, string[]> = {
  fruits_vegetables: [
    'fruta', 'frutas', 'verdura', 'verduras', 'manzana', 'platano', 'banana', 'naranja', 'limon',
    'mandarina', 'pera', 'fresa', 'uva', 'melon', 'sandia', 'tomate', 'lechuga', 'cebolla',
    'patata', 'patatas', 'papa', 'zanahoria', 'pimiento', 'pepino', 'calabacin', 'berenjena',
    'ajo', 'champiñon', 'seta', 'espinaca', 'aguacate', 'brocoli', 'coliflor', 'judia', 'puerro',
    'ensalada', 'kiwi', 'melocoton', 'ciruela', 'cereza', 'apio', 'calabaza',
  ],
  dairy_eggs: [
    'leche', 'lacteo', 'queso', 'yogur', 'yogurt', 'mantequilla', 'nata', 'cuajada', 'kefir',
    'huevo', 'huevos', 'requeson', 'gouda', 'cheddar', 'mozzarella', 'parmesano', 'brie', 'flan',
    'natillas',
  ],
  meat_fish: [
    'carne', 'pollo', 'pavo', 'ternera', 'cerdo', 'lomo', 'jamon', 'bacon', 'salchicha',
    'chorizo', 'hamburguesa', 'picada', 'filete', 'costilla', 'solomillo', 'pescado', 'salmon',
    'atun', 'merluza', 'bacalao', 'gamba', 'langostino', 'mejillon', 'calamar', 'pulpo', 'sepia',
    'sardina', 'dorada', 'lubina', 'chuleta', 'alitas', 'pechuga', 'puchero',
  ],
  bakery: [
    'pan', 'barra', 'baguette', 'molde', 'hogaza', 'bollo', 'croissant', 'tostada', 'galleta',
    'galletas', 'bizcocho', 'magdalena', 'cereales', 'muesli', 'avena', 'bolleria', 'donut',
    'ensaimada', 'pico', 'colin', 'roscquilla',
  ],
  pantry: [
    'arroz', 'pasta', 'espagueti', 'macarron', 'fideo', 'harina', 'azucar', 'sal', 'pimienta',
    'especia', 'aceite', 'vinagre', 'legumbre', 'lenteja', 'garbanzo', 'alubia', 'tomate frito',
    'conserva', 'lata', 'mayonesa', 'mostaza', 'salsa', 'caldo', 'cafe', 'te', 'infusion',
    'chocolate', 'cacao', 'miel', 'mermelada', 'ketchup', 'oregano', 'perejil',
  ],
  drinks: [
    'agua', 'bebida', 'zumo', 'refresco', 'cola', 'cerveza', 'vino', 'tinto', 'blanco',
    'ginebra', 'ron', 'licor', 'tonica', 'gaseosa', 'isotonica', 'coca', 'fanta', 'sprite',
  ],
  frozen: [
    'congelado', 'helado', 'hielo', 'nuggets', 'varitas', 'croqueta', 'croquetas', 'pizza',
    'guisantes congelados', 'verduras congeladas',
  ],
  cleaning_home: [
    'limpieza', 'detergente', 'suavizante', 'lejia', 'lavavajillas', 'lavavajilla', 'fregar',
    'fregasuelos', 'bayeta', 'estropajo', 'esponja', 'papel higienico', 'papel cocina',
    'servilleta', 'servilletas', 'basura', 'bolsa', 'bolsas', 'insecticida', 'ambientador',
    'fairy', 'ariel',
  ],
  personal_care: [
    'champu', 'gel', 'jabon', 'desodorante', 'pasta de dientes', 'dentifrico', 'cepillo',
    'colutorio', 'crema', 'locion', 'afeitado', 'cuchilla', 'toallita', 'toallitas', 'pañal',
    'pañales', 'tampon', 'compresa', 'hidratante', 'colonia',
  ],
}

function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

type KeywordEntry = {
  keyword: string
  normalized: string
  isMultiWord: boolean
  category: Exclude<ItemCategory, 'other'>
}

const allKeywordEntries: KeywordEntry[] = Object.entries(keywordsByCategory).flatMap(
  ([category, keywords]) =>
    keywords.map((kw) => {
      const norm = stripAccents(kw.toLowerCase().trim())
      return {
        keyword: kw,
        normalized: norm,
        isMultiWord: norm.includes(' '),
        category: category as Exclude<ItemCategory, 'other'>,
      }
    }),
)

// Frases compuestas ordenadas de más larga a más corta
const multiWordEntries = allKeywordEntries
  .filter((e) => e.isMultiWord)
  .sort((a, b) => b.normalized.length - a.normalized.length)

// Palabras individuales
const singleWordEntries = allKeywordEntries.filter((e) => !e.isMultiWord)

export function inferItemCategory(name: string): ItemCategory {
  const normalized = stripAccents(name.trim().toLowerCase())
  if (!normalized) {
    return 'other'
  }

  // 1. Prioridad: frases compuestas exactas (ej. "pasta de dientes", "papel higienico", "tomate frito")
  for (const entry of multiWordEntries) {
    const escaped = entry.normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escaped}(?:es|s)?\\b`, 'i')
    if (regex.test(normalized)) {
      return entry.category
    }
  }

  // 2. Palabras individuales: en español el sustantivo principal (núcleo) va primero
  // (ej. "galletas de chocolate" -> "galletas" manda sobre "chocolate", "yogur de fresa" -> "yogur" manda sobre "fresa")
  let bestMatch: { index: number; category: Exclude<ItemCategory, 'other'> } | null = null

  for (const entry of singleWordEntries) {
    const escaped = entry.normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Acepta singular o plural común en español (+s o +es)
    const regex = new RegExp(`\\b${escaped}(?:es|s)?\\b`, 'i')
    const match = regex.exec(normalized)
    if (match) {
      const matchIndex = match.index
      if (bestMatch === null || matchIndex < bestMatch.index) {
        bestMatch = { index: matchIndex, category: entry.category }
        // Si coincide justo al principio (posición 0), es el núcleo sintáctico definitivo
        if (matchIndex === 0) {
          break
        }
      }
    }
  }

  if (bestMatch) {
    return bestMatch.category
  }

  return 'other'
}


export type AisleGroup = {
  category: ItemCategory
  metadata: CategoryMetadata
  items: Item[]
}

export function groupItemsByAisle(items: Item[]): AisleGroup[] {
  const groupsByCat = new Map<ItemCategory, Item[]>()

  for (const item of items) {
    const cat = item.category ?? 'other'
    const list = groupsByCat.get(cat) ?? []
    list.push(item)
    groupsByCat.set(cat, list)
  }

  const result: AisleGroup[] = []

  for (const meta of ITEM_CATEGORIES) {
    const catItems = groupsByCat.get(meta.id)
    if (catItems && catItems.length > 0) {
      result.push({
        category: meta.id,
        metadata: meta,
        items: catItems,
      })
    }
  }

  return result
}
