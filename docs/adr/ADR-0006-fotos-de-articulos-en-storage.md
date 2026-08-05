# ADR-0006: Fotos de artículos en un bucket privado con ruta determinista

- Estado: Aceptado, con la ruta superseded por
  [ADR-0007](ADR-0007-ruta-versionada-de-las-fotos.md)
- Fecha: 2026-08-03

## Contexto

RF-4 pide poder adjuntar una imagen de referencia a un artículo. En una lista compartida es
más útil de lo que parece: «champú» no le dice a quien está en el pasillo cuál de los seis
botes es el de casa, y una foto lo resuelve sin escribir una descripción.

La tabla `items` tenía desde la Fase 0 una columna `image_url text` que nunca se escribió. Al
llegar el momento de usarla hay que decidir tres cosas que no son independientes entre sí:

1. **Dónde se guardan los bytes.** Supabase Storage es la respuesta obvia (ya está en el stack,
   entra en el plan Free con 1 GB), pero un bucket tiene que ser público o privado y eso cambia
   todo lo demás.
2. **Qué se guarda en la columna.** Una URL o una ruta.
3. **Cómo se aísla una comunidad de otra.** El resto de la app lo resuelve con RLS sobre
   `member_community_ids()` ([ADR-0002](ADR-0002-modelo-de-sesion-y-rls.md)). Storage es otro
   esquema con otra tabla (`storage.objects`) y hay que decidir si se le aplica la misma regla
   o se confía en que las URLs no se adivinen.

El punto 3 es el que manda. El `join_code` es el único secreto que protege una lista, y toda la
Fase 0 se dedicó a que nadie pudiera leer datos de otra comunidad. Si las fotos fueran públicas,
ese trabajo quedaría a medias: las fotos de la compra de una casa dicen bastante sobre esa casa.

## Decisión

**Bucket privado `item-images`, ruta determinista `<community_id>/<item_id>.jpg`, columna
`image_path` con la ruta, y URL firmada de 7 días al pintarla.**

La migración es `supabase/migrations/20260803120000_item_images_storage.sql`.

**El bucket es privado**, con `file_size_limit` de 2 MB y `allowed_mime_types` limitado a
`image/jpeg`. Los límites los impone la base de datos, no el cliente: el cliente ya comprime a
1280 px, pero una app modificada no debe poder llenar el plan Free con un vídeo.

**Cuatro políticas sobre `storage.objects`** (select, insert, update, delete), todas `to
authenticated` y todas con la misma condición:

```sql
bucket_id = 'item-images'
and (storage.foldername(name))[1] in (
  select c.community_id::text from public.member_community_ids() as c(community_id)
)
```

Es la misma función `security definer` que sostiene las políticas de `items`, así que el
aislamiento de fotos y el de datos son **una** regla, no dos parecidas que se puedan
desincronizar. `update` lleva `using` y `with check` por el mismo motivo que `items_update`: sin
`with check` se podría mover un objeto propio a la carpeta de otra comunidad.

La comparación es texto contra texto (`community_id::text`) en vez de castear la carpeta a
`uuid`. Un objeto con una ruta que no sea un uuid haría fallar el cast con un error de tipo en
mitad de la política; comparando como texto simplemente no coincide y se deniega.

**La columna se llama `image_path`, no `image_url`.** En un bucket privado no existe una URL
estable: lo que persiste es la ruta, y la URL se firma en el momento de pintarla. Un nombre que
diga `url` invita a que alguien guarde ahí una URL firmada, que caduca, y a depurar meses después
por qué las fotos viejas dan 400.

**La ruta no lleva timestamp ni uuid aleatorio.** Un artículo tiene como mucho una foto y
sustituirla es un `upsert` sobre la misma ruta.

**La firma dura 7 días** (`imageUrlTtlSeconds` en `domain/`), y la query que la envuelve
refresca al 90 % de ese plazo para no pintar nunca un enlace muerto.

## Alternativas consideradas

**Bucket público.** Es lo que sale en todos los tutoriales y ahorra el paso de firmar: la URL es
estable, se guarda en la columna y `expo-image` la cachea sin más. Se descarta por seguridad. La
URL pública de Storage se deriva del nombre del objeto, y el nombre contiene el `community_id` y
el `item_id`, que son ids que viajan en los eventos de Realtime y en cualquier respuesta de la
API. Quien tuviera uno podría leer la foto sin ser miembro. No es un ataque teórico: es la misma
clase de fallo que evitar RLS.

**Ruta con uuid aleatorio o timestamp** (`<community_id>/<uuid>.jpg`). Es lo habitual cuando un
recurso admite varias imágenes o hay que conservar el historial. Aquí obliga a borrar el objeto
viejo en cada sustitución (una operación de red más que puede fallar y dejar huérfanos) a cambio
de nada, porque un artículo de la compra no necesita galería. La ruta determinista además hace
que la caché por URL de `expo-image` se invalide sola: la firma es nueva aunque la ruta sea la
misma.

**Guardar la foto como `bytea` en Postgres.** Quita Storage de la ecuación y hereda RLS gratis.
Se descarta porque infla la tabla que más se consulta, rompe el `select *` de la lista (cada
lectura arrastraría megas) y Postgres no es un CDN: no hay caché, ni rangos, ni transformaciones.

**Referenciar la foto desde `items` con una tabla `item_images` aparte.** Preparado para varias
fotos por artículo. Es diseño para un caso que no existe, y añade un join a la consulta más
caliente de la app. Si algún día hacen falta varias, la migración es directa desde aquí.

**Firmar en lote al cargar la lista** con `createSignedUrls` (plural). Menos peticiones, pero
obliga a que la pantalla de lista sepa de firmas y a refirmar la lista entera cuando cambia un
artículo. Una query por ruta deja que cada miniatura se ocupe de lo suyo, TanStack Query
deduplica, y una lista sin fotos no hace ni una petición.

## Consecuencias

**A favor**

- Una comunidad no puede leer las fotos de otra, y la regla que lo impide es literalmente la
  misma que protege los artículos. Se prueba igual y se rompe igual (o sea, no por separado).
- No se acumulan objetos huérfanos al sustituir una foto.
- El coste de Storage se mantiene bajo control: 1280 px y calidad 0.7 dejan una foto de móvil
  en 150-250 KB.

**En contra**

- **Toda visualización cuesta una petición de firma.** Se mitiga con `staleTime` alto y la caché
  de disco de `expo-image`, pero es tráfico que un bucket público no tendría.
- **Las URLs firmadas no se pueden compartir fuera de la app** más allá de 7 días. Cuando llegue
  RF-8 (exportar a PDF) habrá que incrustar la imagen en el documento, no enlazarla.
- **Quitar la foto deja el objeto en el bucket.** Se decidió así para que «quitar la foto» no
  tenga un modo de fallo de red propio; la siguiente foto de ese artículo pisa el huérfano. El
  desperdicio máximo es un JPEG por artículo al que se le quitó la foto y nunca se le puso otra.
  Borrar el artículo sí borra el objeto, y en ese orden: foto primero, fila después, para que un
  fallo deje el reintento seguro.
- **`expo-image-picker` y `expo-image-manipulator` son módulos nativos**, así que este cambio no
  se puede entregar con `eas update`. Obliga a un APK nuevo y a subir la `version` de `app.json`.

## Notas

El detalle de implementación (compresión, estados de la miniatura, cómo se prueba) está en
`docs/phases/fase-3.md`, incremento 3. El patrón de políticas de Storage, para reutilizarlo en
el siguiente bucket, está en la skill `supabase-data`.
