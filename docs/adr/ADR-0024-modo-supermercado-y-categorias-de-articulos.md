# ADR-0024: Modo Supermercado y Categorización de Artículos por Pasillos

- **Fecha:** 2026-09-07
- **Estado:** Aceptado
- **Decisores:** Equipo de TODO-Recetas-Móvil

---

## Contexto

El requisito RF-16 y la Fase 14 del roadmap establecen la necesidad de optimizar la experiencia física en la tienda:
1. En listas de compra extensas, los artículos se mostraban desordenados o en orden de inserción, obligando al usuario a subir y bajar repetidamente la pantalla y recorrer el supermercado de forma caótica.
2. Durante la compra en la tienda física, la pantalla del móvil tiende a apagarse por inactividad tras 30-60 segundos, requiriendo desbloquear continuamente el dispositivo con manos ocupadas.
3. Los elementos táctiles convencionales pueden resultar pequeños o incómodos para operar el teléfono con una sola mano en movimiento mientras se empuja el carro de la compra.

---

## Decisión

### 1. Categorización de Artículos (`src/features/items/domain/item-category.ts`)
- **10 Categorías Estándar**: Se definen 10 pasillos/categorías universales que cubren la disposición típica de cualquier supermercado:
  - `fruits_vegetables` (🍎 Frutas y Verduras)
  - `dairy_eggs` (🧀 Lácteos y Huevos)
  - `meat_fish` (🥩 Carnicería y Pescadería)
  - `bakery` (🥖 Panadería y Bollería)
  - `pantry` (🥫 Despensa y Conservas)
  - `drinks` (🥤 Bebidas)
  - `frozen` (❄️ Congelados)
  - `cleaning_home` (🧹 Limpieza del Hogar)
  - `personal_care` (🧴 Cuidado Personal)
  - `other` (📦 Otros)
- **Inferencia Semántica Inteligente (`inferItemCategory`)**:
  - Implementa un motor léxico en español basado en prioridades sintácticas:
    - **Paso 1**: Búsqueda de compuestos léxicos completos (ej. "pasta de dientes" → `personal_care`, "aceite de oliva" → `pantry`, "tomate frito" → `pantry`).
    - **Paso 2**: En construcciones del tipo *"X de Y"* (ej. "galletas de chocolate", "helado de vainilla"), evalúa primero el sustantivo núcleo inicial (*"galletas"* → `bakery`, *"helado"* → `frozen`), evitando falsos positivos causados por el modificador secundario.
    - **Paso 3**: Normalización de acentos, minúsculas y sufijos de plural regular en español (`-es`, `-s`).
- **Base de Datos y Migración Supabase**:
  - Migración `20260907180000_item_categories.sql` con columna `category text not null default 'other'` y constraint `item_category_check`.
  - Actualización de tipos generados en `src/shared/lib/db.types.ts`.
  - Integración en `add-item`, `edit-item`, y volcado de ingredientes desde recetas (`use-add-recipe-to-list`) y menús semanales (`use-add-meal-plan-to-list`).

### 2. Agrupación por Pasillos en la Lista Principal (`ItemsScreen.tsx`)
- Selector de vista agrupada mediante un switch táctil accesible.
- Función de dominio `groupItemsByAisle(items)` que agrupa en secciones `SectionListData` ordenadas por pasillo lógico del supermercado, manteniendo orden alfabético interno y conteos de artículos pendientes por pasillo.

### 3. Modo Supermercado ("En la Tienda") (`/shopping-mode`)
- **Ruta dedicada Expo Router**: `/shopping-mode` vinculada al botón «🛒 Modo Compra» en la cabecera de `ItemsScreen`.
- **Prevención de apagado de pantalla (`keep-awake`)**:
  - Envoltorio seguro `useKeepAwakeSafe` con `expo-keep-awake` que se activa al entrar en `/shopping-mode` y se desactiva al salir, con salvaguarda silenciosa en caso de entorno web/test.
- **Ergonomía de una sola mano**:
  - Fila de artículo con altura mínima de 60pt (superando los 48-56pt de WCAG AAA) para marcado rápido y sin errores.
  - Indicador de progreso visual en tiempo real (% y barra de progreso calculada sobre `purchasedCount / totalCount`).
  - Filtro táctil segmentado: "Por comprar", "En el carro", "Todos".
  - Agrupación visual por pasillos con emojis representativos y colapsado automático de pasillos vacíos.
  - Diálogo de finalización de compra (`shoppingMode.finishModal`) con confirmación segura antes de volver a la vista principal.

---

## Consecuencias

### Positivas
- Reducción drástica del tiempo necesario para completar la compra física en el supermercado.
- Navegación natural y sin distracciones gracias a la pantalla encendida (`useKeepAwakeSafe`) y controles grandes de fácil pulsación con una sola mano.
- Auto-categorización transparente para el usuario en más del 90% de productos habituales en español.
- Cumplimiento estricto de ADR-0004 (componente `Dialog` de `@/shared/ui/Dialog` sin importar `react-native-paper` fuera de la capa UI compartida).

### Negativas / Mitigaciones
- Mayor consumo de batería por `keep-awake`: mitigado restringiendo su ciclo de vida estrictamente a la pantalla de `/shopping-mode` (se desactiva automáticamente al navegar a cualquier otra pantalla o cerrar la app).
