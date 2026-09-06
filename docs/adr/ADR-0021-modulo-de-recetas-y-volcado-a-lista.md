# ADR-0021: Módulo de Recetas Compartidas y volcado de ingredientes a la lista de compra

- Estado: Aceptado y verificado (migración aplicada, Jest 56/56 suites en verde, export Hermes limpio)
- Fecha: 2026-09-06

## Contexto

En los hogares que comparten una lista de la compra, muchas de las compras responden a recetas o menús planificados para la semana. Hasta ahora, los usuarios tenían que transcribir manualmente cada ingrediente uno por uno en la lista de compras común.

Para resolver esto y cumplir con el propósito fundacional del proyecto (`TODO-Recetas-Movil`), se requiere un módulo de **Recetas Compartidas (RF-14)** que:
1. Permita crear, editar y consultar recetas dentro de la comunidad activa (título, comensales, ingredientes estructurados e instrucciones).
2. Se integre con el catálogo de supermercado existente (Mercadona) para asociar fotos y precios de referencia a los ingredientes de forma opcional.
3. Permita ajustar interactivamente los comensales antes de cocinar o comprar, escalando las cantidades de los ingredientes de forma proporcional.
4. Permita seleccionar qué ingredientes hacen falta y volcarlos en bloque a la lista de la compra de la comunidad en un solo toque.
5. Respete la arquitectura desacoplada, la generación de IDs en el cliente (ADR-0010), el soporte offline y las notificaciones push colaborativas (ADR-0020).

## Decisión

### 1. Modelo de Datos Normalizado en PostgreSQL (`recipes` y `recipe_ingredients`)

- Se crean dos tablas relacionales vinculadas a la comunidad:
  - `recipes`: `id` (uuid), `community_id` (uuid references communities on delete cascade), `created_by_member_id` (uuid references members on delete set null), `title` (text >= 2 chars), `servings` (int entre 1 y 100), `instructions` (text), `created_at`, `updated_at`.
  - `recipe_ingredients`: `id` (uuid), `recipe_id` (uuid references recipes on delete cascade), `name` (text), `quantity` (numeric > 0), `unit` (text, e.g. 'g', 'ml', 'unidades'), `catalog_product_id` (uuid references catalog_products on delete set null), `sort_order` (int), `created_at`.
- Aislamiento RLS en ambas tablas garantizando que ningún usuario ajeno a la comunidad pueda leer, crear, modificar o eliminar recetas.
- Se implementa el procedimiento almacenado atómico `save_recipe` (`SECURITY DEFINER`) para crear o actualizar la cabecera y reemplazar el lote de ingredientes en una sola transacción ACID.
- Se añade `delete_recipe` con verificación de pertenencia a la comunidad y borrado en cascada de los ingredientes.

### 2. Sincronización Realtime

- Se habilitan `recipes` y `recipe_ingredients` en la publicación `supabase_realtime` con `replica identity full`.
- El hook `useRecipesRealtime(communityId)` invalida la clave de TanStack Query `['recipes', communityId]` ante cualquier cambio remoto.

### 3. Volcado a la Lista de la Compra (Cumplimiento de ADR-0010 y ADR-0020)

- El hook `useAddRecipeToList(communityId)`:
  - Recibe los ingredientes seleccionados con sus cantidades escaladas al número de comensales elegido.
  - Genera UUIDs en el cliente (`randomUuid()`) para cada artículo a comprar.
  - Invoca el método en bloque `supabaseItemRepository.addMany(items)` en una sola petición de red.
  - Invalida la consulta de TanStack Query de la lista (`['items', communityId]`).
  - Despacha una notificación push a los demás miembros de la comunidad vía `supabaseNotificationsRepository.notifyCommunity`: *«Ingredientes añadidos: Se han añadido ingredientes de "{receta}" a la lista»*.
  - Redirige al usuario a la pantalla `/list`.

## Consecuencias

- **Positivas:**
  - Flujo de usuario cerrado: desde la idea de la receta hasta la compra en el supermercado en un toque.
  - Cero inconsistencias: el escalado y formateo de cantidades (`scaleIngredientQuantity`, `formatIngredientDisplay`) se realiza con funciones puras y probadas en Jest.
  - Compatibilidad total con el catálogo de productos y el buscador difuso de Mercadona.
  - Soporte offline y colas de mutación transparentes.
- **Negativas / Obligaciones:**
  - Al escalar recetas con unidades como "cucharadas" o "pellizcos", los redondeos se aplican a nivel de visualización; se recomienda revisar las cantidades antes de comprar.
