# Fase 11 · Módulo de Recetas Compartidas y volcado a lista (RF-14)

- Estado: **completada** (código, base de datos PostgreSQL, RLS 61/61, tests unitarios 56/56 suites, tipado estricto y export Android Hermes superados).
- Inicio: 2026-09-06 · Cierre: 2026-09-06.
- Alcance técnico:
  - **Esquema relacional en PostgreSQL**: Tablas `recipes` y `recipe_ingredients` con políticas RLS para miembros de la comunidad, cascadas de integridad referencial y procedimientos almacenados atómicos (`save_recipe`, `delete_recipe`).
  - **Sincronización en tiempo real**: Tablas añadidas a `supabase_realtime` con `replica identity full` y hook `useRecipesRealtime`.
  - **Feature de Recetas (`src/features/recipes/`)**:
    - Dominio con validaciones, escalado proporcional de cantidades según comensales y formateo de ingredientes.
    - Repositorio con adaptador Supabase desacoplado.
    - Pantallas interactivas: listado con búsqueda en tiempo real, creación y edición con sugerencias del catálogo de Mercadona, y detalle con selector de comensales.
  - **Volcado a la lista de compra en un toque**: Selección de ingredientes y volcado en bloque a `items` con IDs de cliente (ADR-0010) y despacho de alertas push colaborativas (ADR-0020).
  - **Internacionalización**: Textos en español e inglés en `es.json` y `en.json`.
- Documento de diseño: [ADR-0021](../adr/ADR-0021-modulo-de-recetas-y-volcado-a-lista.md).

---

## Desglose de incrementos de trabajo

### Incremento 1 · Base de datos, RPCs y RLS

1. **Migración PostgreSQL (`supabase/migrations/20260906180000_recipes_schema.sql`):**
   - Tabla `recipes` vinculada a `communities` y `members`.
   - Tabla `recipe_ingredients` con cantidades numéricas, unidades opcionales y enlace foráneo a `catalog_products(id)`.
   - Políticas RLS completas (`select`, `insert`, `update`, `delete`) con filtro `member_community_ids()`.
   - RPC `save_recipe` atómico: inserta o actualiza cabecera y sustituye ingredientes en una transacción.
   - RPC `delete_recipe` con verificación de pertenencia a la comunidad.
2. **Despliegue a Supabase:**
   - Aplicado a la base de datos remota con `npx supabase db push --linked --yes`.
   - Regenerados tipos TypeScript en `src/shared/lib/db.types.ts`.

---

### Incremento 2 · Dominio y Datos (`src/features/recipes/`)

1. **Dominio (`domain/`):**
   - Entidades `Recipe`, `RecipeIngredient`, `NewRecipeInput`.
   - Funciones puras: `scaleIngredientQuantity(qty, baseServings, targetServings)`, `formatIngredientDisplay`, `isValidRecipeTitle`.
   - Tests unitarios en `src/features/recipes/domain/__tests__/recipe.test.ts`.
2. **Datos (`data/`):**
   - `supabase-recipe-repository.ts` implementa `RecipeRepository`: `list`, `getById`, `save`, `delete` y `subscribe` (Realtime).
   - Tests unitarios con mocks en `src/features/recipes/data/__tests__/supabase-recipe-repository.test.ts`.

---

### Incremento 3 · Presentación, Hooks y Volcado a Lista

1. **Hooks de datos:**
   - `useRecipes(communityId)` y `useRecipe(id)`.
   - `useRecipesRealtime(communityId)`.
   - `useSaveRecipe(communityId)` y `useDeleteRecipe(communityId)`.
2. **Volcado a la lista de la compra (`useAddRecipeToList`):**
   - Generación de UUIDs en cliente (`randomUuid()`).
   - Inserción en bloque mediante `supabaseItemRepository.addMany`.
   - Invalidación de caché de `items`.
   - Notificación push colaborativa a los miembros: *«Ingredientes añadidos: Se han añadido ingredientes de "{receta}" a la lista»*.
3. **Componentes y Pantallas:**
   - `IngredientInputRow`: fila con cantidad, unidad, nombre, botón de eliminación y autocompletado desde `CatalogSuggestions`.
   - `RecipesScreen`: listado con búsqueda y tarjetas de resumen.
   - `EditRecipeScreen`: formulario de creación/edición con lista dinámica de ingredientes.
   - `RecipeDetailScreen`: ajuste de comensales con escalado de raciones, checklist de ingredientes y botón de volcado a la lista.

---

### Incremento 4 · Rutas y Accesibilidad

1. **Rutas Expo Router (`src/app/recipes/`):**
   - `index.tsx` -> `RecipesScreen`.
   - `new.tsx` -> `EditRecipeScreen`.
   - `[id].tsx` -> `RecipeDetailScreen`.
   - `edit.tsx` -> `EditRecipeScreen`.
2. **Punto de entrada:**
   - Botón "Recetas" en la cabecera de `ItemsScreen.tsx` junto a los botones de PDF y Gastos.
3. **i18n:**
   - Claves añadidas a `es.json` y `en.json`.

---

## Resultados de validación técnica

1. **Batería de tests unitarios y de integración (`npm test`):**
   - **56 suites ejecutadas, 56 pasadas (100%)**.
   - **399 tests ejecutados, 399 pasados (100%)**.
2. **Tipado estricto (TypeScript strict):**
   - `npm run typecheck`: **0 errores**.
3. **Calidad de código y Linter:**
   - `npm run lint`: **0 errores / 0 warnings**.
4. **Seguridad y backend (RLS):**
   - `npm run test:rls`: **61/61 comprobaciones de aislamiento correctas**.
5. **Exportación y empaquetado Android (Hermes):**
   - Verificado con `npx expo export --platform android`.
