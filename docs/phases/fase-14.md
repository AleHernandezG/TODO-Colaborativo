# Fase 14: Modo Supermercado y Agrupación por Categorías/Pasillos (RF-16)

- **Fecha:** 2026-09-07
- **Estado:** Completada y verificada
- **Commit:** Pendiente de consolidación por el usuario

---

## 1. Contexto y Objetivos

El requisito RF-16 del roadmap y la especificación de funcionalidades establecen:
*«Facilitar la experiencia en la tienda física organizando los artículos por pasillos de supermercado y ofreciendo un modo de compra enfocado que impida el bloqueo de pantalla y optimice la usabilidad con una sola mano».*

### Objetivos Principales:
1. **Categorización Estándar e Inteligente de Artículos**:
   - 10 categorías/pasillos universales de supermercado (`fruits_vegetables`, `dairy_eggs`, `meat_fish`, `bakery`, `pantry`, `drinks`, `frozen`, `cleaning_home`, `personal_care`, `other`).
   - Motor de inferencia automática léxica en español con soporte para compuestos semánticos y prioridad de sustantivo núcleo inicial en construcciones «X de Y» (evitando falsos positivos).
   - Selector visual accesible para modificar o asignar categoría en alta (`AddItemBar`) y edición (`EditItemDialog`).
2. **Agrupación por Pasillos en la Lista Principal (`ItemsScreen`)**:
   - Agrupación opcional visual de la lista pendiente por pasillo mediante `groupItemsByAisle`.
   - Orden lógico secuencial típico de supermercado con emojis y conteo de artículos pendientes por pasillo.
3. **Modo Supermercado ("En la Tienda") (`/shopping-mode`)**:
   - Pantalla dedicada para la compra en la tienda física accesible mediante el botón «🛒 Modo Compra».
   - Bloqueo de suspensión de pantalla (`useKeepAwakeSafe` con `expo-keep-awake`) para evitar el bloqueo durante la compra.
   - Usabilidad ergonómica para una sola mano con filas táctiles grandes (≥60pt).
   - Indicador de progreso con porcentaje y barra visual en tiempo real.
   - Filtro segmentado: «Por comprar», «En el carro», «Todos».
   - Diálogo seguro de confirmación antes de finalizar y volver a la lista.

---

## 2. Implementación Técnica

### A. Base de Datos en Supabase
- **Migración**: `supabase/migrations/20260907180000_item_categories.sql`.
- **Columna `items.category`**: Campo `text not null default 'other'` con restricción `item_category_check`.
- **Actualización de Tipos**: Regenerado `src/shared/lib/db.types.ts` con la columna `category` tipada.

### B. Capa de Dominio (`src/features/items/domain/`)
- `item-category.ts`:
  - Definición del tipo unión `ItemCategory` con 10 categorías.
  - Constante de metadatos `ITEM_CATEGORIES` con claves de i18n, emojis e índices de orden de pasillo.
  - Función `inferItemCategory(name)` con análisis sintáctico por prioridad léxica.
  - Función `groupItemsByAisle(items)` para generación de estructuras `SectionListData`.
- `item.ts`, `item-repository.ts`, `add-item.ts`, `edit-item.ts`:
  - Campo `category` integrado en todas las entidades e interfaces del repositorio.
  - Fallback automático a inferencia semántica si no se proporciona categoría explícita.
- Tests unitarios: `item-category.test.ts`, `add-item.test.ts`, `edit-item.test.ts`.

### C. Capa de Datos (`src/features/items/data/`)
- `supabase-item-repository.ts`:
  - Soporte de `category` en columnas de consulta, mapper `toItem`, inserción individual y masiva (`add`, `addMany`) y edición (`edit`).
- Actualizado `supabase-item-repository.test.ts`.

### D. Integración en Recetas y Menús Semanales
- `use-add-recipe-to-list.ts` & `use-add-meal-plan-to-list.ts`:
  - Asignación automática de categoría inferida a los ingredientes agregados a la lista de la compra.

### E. Capa de Presentación (`src/features/items/presentation/`)
- `CategoryPickerModal.tsx`:
  - Modal selector con los 10 pasillos, iconos y comprobación activa, utilizando `@/shared/ui/Dialog` conforme a ADR-0004.
- `AddItemBar.tsx`:
  - Chip selector de categoría interactivo con auto-detección según el texto escrito y soporte de cambio manual.
- `EditItemDialog.tsx`:
  - Selector de pasillo/categoría con preselección del valor actual del artículo.
- `ItemsScreen.tsx`:
  - Botón de acceso directo «🛒 Modo Compra» en la barra de herramientas superior.
  - Interruptor de agrupación por pasillos para ordenar los artículos por sección.
- `ShoppingModeScreen.tsx`:
  - Pantalla completa de modo supermercado con `useKeepAwakeSafe`, barra de progreso visual, pestañas de filtrado, secciones por pasillo y diálogo de salida.
- `src/app/shopping-mode.tsx`:
  - Ruta de Expo Router configurada.
- Tests de presentación: `shopping-mode-screen.test.tsx` (4 tests pasando con cobertura completa).

### F. Internacionalización (`src/shared/lib/i18n/`)
- Traducidas todas las categorías, opciones de modo supermercado, diálogos y filtros en `es.json` y `en.json`.
- Validación de paridad al 100% en `translations.test.ts`.

---

## 3. Verificación y Resultados

1. **Pruebas Unitarias y de Integración**:
   - `npm test`: **60 suites pasadas, 431 tests pasando**.
2. **Chequeo de Tipos**:
   - `npm run typecheck`: **0 errores**.
2. **Análisis Estático (Lint)**:
   - `npm run lint`: **0 errores y 0 avisos**.
3. **Pruebas de Seguridad RLS en Supabase**:
   - `npm run test:rls`: **65/65 comprobaciones correctas**.
4. **Empaquetado Android de Producción**:
   - `npx expo export --platform android`: **Éxito (7.44 MB hbc bundle, 0 errores)**.
