# ADR-0023: Foto opcional en alta de artículos y foto de portada en recetas

- **Fecha:** 2026-09-07
- **Estado:** Aceptado
- **Decisores:** Equipo de TODO-Recetas-Móvil

---

## Contexto

El documento `docs/funcionalidades.txt` establecía como requisito clave que:
*«al agregar un ingrediente a las listas el usuario tenga la posibilidad opcional de poder adjuntar una foto del mismo para que a la hora de hacer la compra sea más sencillo».*

Hasta la Fase 12:
1. En la lista de la compra, los artículos admitían imagen (`image_path`), pero dicha imagen solo podía adjuntarse editando el artículo a posteriori mediante `EditItemDialog`. En la barra de creación directa (`AddItemBar`) no existía opción para tomar o elegir una foto en el momento de crear el artículo.
2. En el módulo de Recetas (Fase 11 · RF-14), la tabla `recipes` carecía de soporte para fotos, privando a los miembros de disponer de una referencia visual apetecible y clara de los platos tanto en el listado (`RecipesScreen`) como en la pantalla de detalle (`RecipeDetailScreen`).

---

## Decisión

### 1. Foto opcional en `AddItemBar` (`src/features/items/`)
- Se integra el hook compartido `usePickImage` directamente en `AddItemBar`, permitiendo capturar fotos con la cámara o seleccionarlas de la galería.
- Si el usuario selecciona una imagen, se renderiza una tarjeta de previsualización compacta desmontable con botón de descarte (`items.image.remove`).
- La función de dominio `addItem` admite el parámetro opcional `imageUri?: string | null`. Si se proporciona, invoca `repository.uploadImage` para almacenar el archivo en Supabase Storage (`item-images`) con el formato `${communityId}/${itemId}-${Date.now()}.jpg`, antes de insertar la fila en `public.items`.
- Las mutaciones en cola offline y la reconciliación conservan la idempotencia y las políticas de rollback ante fallos de red.

### 2. Soporte de portadas en Recetas (`src/features/recipes/`)
- **Columna `image_path` en `public.recipes`**: Se añade `alter table public.recipes add column if not exists image_path text null;`.
- **Bucket `recipe-images`**: Se crea un bucket privado específico para recetas (`file_size_limit = 2097152`, MIME `image/jpeg`).
- **Aislamiento Multi-tenant RLS en Storage**: Se crean 4 políticas RLS (`recipe_images_select`, `insert`, `update`, `delete`) garantizando que los miembros solo puedan leer y escribir en la carpeta de su comunidad (`(storage.foldername(name))[1] in (select member_community_ids())`).
- **Prevención de PGRST203 en PostgREST**: Se elimina la firma previa de `save_recipe(uuid, uuid, text, integer, text, jsonb)` antes de crear la nueva versión que incorpora `p_image_path text default null`, evitando sobrecargas no resueltas en PostgREST (regla estricta de `CLAUDE.md`).
- **Componente `RecipeImage` y Hook `useRecipeImageUrl`**: Se provee un componente presentacional desacoplado con soporte de caché, URL firmada y fallback visual (`🍲`), mostrándose como hero en `RecipeDetailScreen`, miniatura en `RecipesScreen` y selector editable en `EditRecipeScreen`.

### 3. Hook compartido `usePickImage` (`src/shared/hooks/`)
- Para cumplir con la regla de arquitectura que prohíbe que una feature importe las tripas de otra (`eslint.config.js`), `usePickImage` se centraliza en `src/shared/hooks/use-pick-image.ts`, manteniendo el re-export en `src/features/items/` para compatibilidad retroactiva.

---

## Consecuencias

### Positivas
- Se cubre íntegramente el requisito de `docs/funcionalidades.txt` permitiendo fotos inmediatas desde el alta.
- La experiencia visual de Recetas y del Planificador Semanal mejora sustancialmente gracias a las miniaturas y fotos hero.
- Compatibilidad estricta con TypeScript `strict`, pruebas unitarias automáticas y aislamiento de seguridad RLS verificado.

### Negativas / Mitigaciones
- Mayor volumen de almacenamiento de imágenes en Supabase: mitigado mediante compresión obligatoria en cliente (`compressForUpload`) antes de la subida y límite de 2MB por archivo en Storage.
