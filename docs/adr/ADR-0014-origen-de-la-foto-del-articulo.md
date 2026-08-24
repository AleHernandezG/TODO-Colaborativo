# ADR-0014: La foto propia manda sobre la del catálogo

- Estado: Aceptado
- Fecha: 2026-08-16
- Matiza el apartado 2 de [ADR-0012](ADR-0012-catalogo-de-productos-de-supermercado.md). El resto de
  aquel documento sigue vigente tal cual.

## Contexto

ADR-0012 dejó escrito cómo se sabe de dónde sale la foto de un artículo:

> Si está a `null`, `image_url` es una ruta de nuestro bucket privado y hay que firmarla, que es lo
> que pasa hoy. Si tiene valor, `image_url` es una URL pública y se usa tal cual.

Es decir: una sola columna (`items.image_path`) que a veces guarda una ruta de Storage y a veces
una URL del CDN de Mercadona, y `catalog_product_id` como la bandera que dice cuál de las dos cosas
es.

Al implementar el incremento se ve que esa regla se cae sola. `EditItemDialog` deja hacerle una foto
a cualquier artículo, incluido uno que vino de una sugerencia del catálogo. En ese momento el
artículo tiene `catalog_product_id` con valor y `image_path` con una ruta del bucket, que es
exactamente la combinación que la regla declara imposible. La foto propia se firmaría como si fuera
una URL pública, o se leería la URL pública como si fuera una ruta del bucket: en los dos sentidos
sale mal.

Y no es un caso raro. Es el caso bueno: alguien se molestó en fotografiar su producto de verdad.

## Decisión

**`items.image_path` guarda solo rutas de nuestro bucket. Nunca una URL.** La foto del catálogo no
se copia a `items` en ninguna forma: se saca del producto enlazado en el momento de pintar.

La regla completa, que vive en `src/features/items/domain/item-image-source.ts` como función pura:

| `image_path` | `catalog_product_id` | Qué se pinta                              |
| ------------ | -------------------- | ----------------------------------------- |
| `null`       | `null`               | El hueco de la cámara, como siempre       |
| `null`       | uuid                 | La foto del CDN, sin firmar               |
| ruta         | lo que sea           | La foto propia, firmada. **Siempre gana** |

```ts
export function itemImageSource(item: Pick<Item, 'imagePath' | 'catalogProductId'>): ItemImageSource
```

Que la foto propia gane no es una preferencia estética. Poner una foto es la única señal explícita
que tiene el usuario para decir «esta es la mía»; que el atajo la tape sería descartar trabajo
manual a favor de un dato automático. Y borrar la foto propia hace reaparecer la del catálogo sola,
sin tener que reconstruir el enlace, porque el enlace nunca se rompió.

Sin migración: `catalog_product_id` ya está en la tabla desde
`20260807120000_catalog_schema.sql` y `image_path` no cambia de tipo. Lo que cambia es lo que se
puede guardar dentro, y eso no lo estaba imponiendo la BD (era una convención escrita en un ADR),
así que no hay `check` que reescribir. Tampoco hay filas que arreglar: hasta hoy ningún artículo
tenía `catalog_product_id`.

## Alternativas consideradas

**Copiar la URL del CDN a `image_path` al elegir la sugerencia**, que es lo que decía ADR-0012.
Ahorra la consulta al catálogo cuando se pinta la lista. A cambio deja una columna con dos tipos de
contenido distinguibles solo por otra columna, se rompe en cuanto alguien hace su propia foto, y
congela una URL que puede cambiar cuando el supermercado reorganice su CDN: el artículo se quedaría
con un enlace muerto y sin forma de recuperar el bueno. Es la misma clase de copia denormalizada que
ADR-0012 rechaza para el precio, con los mismos argumentos.

**Una columna más, `image_source text check (image_source in ('own','catalog'))`.** Hace explícito
lo que hoy se deduce. Pero es un tercer estado que hay que mantener sincronizado a mano con los
otros dos, y las combinaciones incoherentes (`'own'` con `image_path` nulo) pasan a ser posibles.
Deducirlo de dos columnas que ya existen no tiene ese problema.

**Que la foto del catálogo gane a la propia**, o preguntarle al usuario cuál quiere. Lo primero
tira trabajo de alguien a la basura. Lo segundo es un diálogo más en el camino de una app cuyo
usuario objetivo es novato, para resolver un empate que casi nunca se da y que tiene una respuesta
obvia.

## Consecuencias

**A favor**

- Se pueden tener las dos fotos a la vez sin que ninguna estorbe. Borrar la propia devuelve la del
  catálogo.
- `image_path` vuelve a significar una sola cosa, que es lo que ya asumen `uploadImage`,
  `removeImage`, `signImageUrl` y la ruta versionada de
  [ADR-0007](ADR-0007-ruta-versionada-de-las-fotos.md).
- La URL del CDN se lee del catálogo en cada pintado, así que la ingesta semanal la corrige sola si
  cambia.

**En contra**

- Pintar la lista necesita los productos del catálogo, que es una consulta más. Se hace **una sola
  para toda la lista** (`byIds` con un `in`, con la clave de consulta ordenada para que no dependa
  del orden de la lista), no una por fila, y es la única consulta del catálogo que se persiste en
  AsyncStorage: sin eso, la lista cacheada se vería sin fotos al abrir la app sin red.
- Un artículo con foto de catálogo y sin red en el primer arranque tras instalar sale con el hueco
  de la cámara. Es el mismo comportamiento que ya tiene la foto propia, que también necesita red
  para firmarse.
