# Fase 13: Foto Opcional en Alta de Artículos y Portada en Recetas

- **Fecha:** 2026-09-07
- **Estado:** Completada y verificada
- **Commit:** Pendiente de consolidación

---

## 1. Contexto y Objetivos

Dando cumplimiento al punto 1 de `docs/funcionalidades.txt`:
*«Es necesario que al agregar un ingrediente a las listas el usuario tenga la posibilidad opcional de poder adjuntar una foto del mismo para que a la hora de hacer la compra sea más sencillo».*

Además, se aprovecha la infraestructura de Storage para dotar al módulo de Recetas de fotos de portada atractivas.

### Objetivos Principales:
1. **Foto directa en `AddItemBar`**: Permitir tomar foto con la cámara o seleccionarla de la galería directamente en el componente de alta rápida de artículos.
2. **Previsualización y Descarte**: Mostrar una miniatura de preview de la foto seleccionada con botón para retirarla antes de pulsar «Añadir».
3. **Subida en mutación optimista**: Integrar la compresión y la subida a Supabase Storage (`item-images`) con compatibilidad para la cola offline y rollback ante errores.
4. **Foto de portada en Recetas**: Columna `image_path` en `recipes`, nuevo bucket `recipe-images` con RLS estricto y RPC `save_recipe` actualizado sin provocar sobrecargas PostgREST `PGRST203`.
5. **UI enriquecida en Recetas**: Miniatura de portada en las tarjetas de `RecipesScreen`, hero visual en `RecipeDetailScreen` y selector interactivo en `EditRecipeScreen`.

---

## 2. Implementación Técnica

### A. Base de Datos y Storage en Supabase
- **Migración**: `supabase/migrations/20260907170000_recipe_cover_photo.sql`.
- **Columna `recipes.image_path`**: Campo de texto nullable para la ruta interna del bucket.
- **Bucket `recipe-images`**: Bucket privado en Supabase Storage (límite 2MB, `image/jpeg`).
- **Políticas RLS en Storage**: 4 políticas (`recipe_images_select`, `insert`, `update`, `delete`) restringidas a miembros de la comunidad mediante `member_community_ids()`.
- **Procedimiento Almacenado `save_recipe`**: Se ejecuta `drop function if exists public.save_recipe(uuid, uuid, text, integer, text, jsonb)` previo a la creación con `p_image_path text default null`, salvaguardando a los clientes instalados del error `PGRST203`.

### B. Capa Compartida (`src/shared/hooks/`)
- `use-pick-image.ts`: Hook centralizado y desacoplado para cámara y galería con permisos, compresión optimizada (`compressForUpload`) y notificación de errores.
- Re-exportado en `src/features/items/` para compatibilidad de importaciones existente.

### C. Módulo de Artículos (`src/features/items/`)
- `item-repository.ts`: Soporte de `imagePath?: string | null` en el método `add`.
- `add-item.ts`: Acepta `imageUri?: string | null`, realiza la subida previa a Storage y suministra el `imagePath` resultante a `repository.add`.
- `supabase-item-repository.ts`: Persiste `image_path` en el `insert` de PostgREST.
- `item-mutations.ts` & `use-add-item.ts`: Variables y mutación optimista ampliadas con `imageUri`.
- `AddItemBar.tsx`: Botones accesibles de cámara y galería, miniatura de preview y descarte.
- `add-item.test.ts`: Tests unitarios validando la subida y persistencia de imagen.

### D. Módulo de Recetas (`src/features/recipes/`)
- `recipe.ts`: Entidad `Recipe` y `NewRecipeInput` con `imagePath`. Definición del tipo `RecipeImageChange`.
- `recipe-image.ts`: Constante `recipeImageUrlTtlSeconds = 604800` (7 días) y función `recipeImageUrl`.
- `recipe-repository.ts` & `supabase-recipe-repository.ts`: Implementación de `uploadImage`, `removeImage` y `signImageUrl` sobre el bucket `recipe-images`.
- `use-recipe-image-url.ts`: Hook con TanStack Query para consulta y caché de URL firmada.
- `RecipeImage.tsx`: Componente presentacional desacoplado con carga, transiciones y fallback accesible (`🍲`).
- `EditRecipeScreen.tsx`: Selector y preview de portada con subida y reemplazo transaccional.
- `RecipeDetailScreen.tsx`: Portada hero en la cabecera del detalle.
- `RecipesScreen.tsx`: Miniatura de portada en las tarjetas de la lista.

### E. Internacionalización (`src/shared/lib/i18n/`)
- Añadidas claves de fotos adjuntas y portadas de receta en `es.json` y `en.json`, con verificación de paridad completa en `translations.test.ts`.

---

## 3. Verificación y Resultados

| Comprobación | Herramienta | Resultado |
| :--- | :--- | :--- |
| **Tests unitarios y de integración** | `npm test` | **58 suites pasadas / 410 tests pasados (100%)** |
| **Aislamiento RLS en backend real** | `npm run test:rls` | **65/65 comprobaciones correctas** |
| **Tipado estricto TypeScript** | `npm run typecheck` | **0 errores** (`tsc --noEmit`) |
| **Linter** | `npm run lint` | **0 errores / 0 advertencias** (`expo lint`) |
| **Exportación Android (Hermes)** | `npx expo export --platform android` | **Bundle generado limpiamente** |

---

## 4. Decisiones de Arquitectura

- Registrado en [ADR-0023: Foto opcional en alta de artículos y foto de portada en recetas](file:///c:/Users/usuario/Desktop/Proyectos/TODO-Recetas-Movil/docs/adr/ADR-0023-foto-en-alta-de-articulos-y-portada-de-recetas.md).
