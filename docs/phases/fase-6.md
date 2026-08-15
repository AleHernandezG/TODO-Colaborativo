# Fase 6 · Catálogo de productos y reparto de gastos

- Estado: **abierta**, solo el bloque A. Incrementos A.1, A.2 y A.3 hechos
- Inicio: 2026-08-07
- Bloque A (catálogo, RF-10): 4.957 productos de Mercadona en la tabla desde el 2026-08-15, y la
  Action que los refresca escrita. Faltan buscar y enseñar
- Pendiente que no es mío: el secret `SUPABASE_SECRET_KEY` del repo, sin el cual la Action no corre
- Bloque B (reparto de gastos, RF-9): **no empieza**, tiene un requisito de entrada sin cumplir

> **La Fase 5 sigue abierta.** Le queda el incremento 4, la pasada con TalkBack, que es prueba
> manual en el dispositivo. Esta fase avanza en paralelo porque su primer trabajo es SQL y no
> compite por el móvil, pero **no se publica nada de aquí antes de cerrar aquello**. La regla de
> `CLAUDE.md` de no saltar de fase sin cerrar la anterior se dobla lo justo para no tener a nadie
> parado, no se rompe.

## Los dos bloques, y por qué solo empieza uno

**Bloque A · Catálogo de productos (RF-10).** Escribir «leche» y que salga la foto ya hecha y el
precio de referencia. Diseñado entero en
[ADR-0012](../adr/ADR-0012-catalogo-de-productos-de-supermercado.md) y con la fuente elegida en
[ADR-0013](../adr/ADR-0013-fuente-del-catalogo-mercadona.md). Es lo que se hace ahora.

**Bloque B · Reparto de gastos (RF-9).** Quién debe qué a quién. **No empieza**, y no es por falta
de tiempo: [ADR-0005](../adr/ADR-0005-reparto-de-gastos.md) le puso un requisito de entrada, que la
identidad no sea suplantable. Hoy se entra con un código y un nombre escrito a mano, así que
cualquiera puede ser cualquiera. Repartir dinero encima de eso es construir sobre arena. Ese ADR se
lee entero antes de tocar nada de gastos.

El bloque A además le allana el camino: la Fase 6 con catálogo arranca con los importes
prerrellenados en vez de con un teclado numérico por artículo.

---

## De dónde viene esto ya decidido

Nada de lo de abajo se decide durante la fase, ya está cerrado y escrito:

| Qué                             | Dónde                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| El diseño entero del catálogo   | [ADR-0012](../adr/ADR-0012-catalogo-de-productos-de-supermercado.md)                  |
| La fuente y la forma de ingerir | [ADR-0013](../adr/ADR-0013-fuente-del-catalogo-mercadona.md)                          |
| Qué fuentes hay y qué dan       | [`fuentes-de-datos-del-catalogo.md`](../guias/fuentes-de-datos-del-catalogo.md)       |
| Cómo se midieron                | [`medicion-de-fuentes-del-catalogo.md`](../guias/medicion-de-fuentes-del-catalogo.md) |

En una línea: **el catálogo sale del dataset público de Mercadona en Hugging Face, solo Mercadona,
con una GitHub Action semanal los martes.** La app nunca habla con el supermercado; lee una tabla
nuestra.

---

## Incrementos del bloque A

El orden importa: cada uno es verificable solo y ninguno depende del siguiente. Del A.4 en adelante,
sin escribir.

### A.1 · El esquema — hecho el 2026-08-14

`supabase/migrations/20260807120000_catalog_schema.sql`, aplicada al proyecto remoto con
`npx supabase db push --linked --yes`. Las dos tablas, los tres índices, las dos políticas y la
columna nueva en `items`, todo en la misma migración, como manda `CLAUDE.md`.

El SQL salió del borrador de ADR-0012 casi tal cual. La medición ya había confirmado que los campos
del dataset mapean uno a uno, así que no hubo que rediseñar nada. Lo que sí se añadió, y no estaba
en aquel borrador, son cuatro cosas.

**`check (price_cents is null or price_checked_at is not null)`.** ADR-0012 obliga a enseñar la
antigüedad del precio en pantalla. Si la fila admite precio sin fecha, la pantalla acaba teniendo
que decidir qué pinta cuando falta, y por ahí es por donde entra el precio sin fecha que ese mismo
ADR llama «una afirmación que se vuelve falsa sola». Lo impide la base de datos, que es donde
`CLAUDE.md` dice que van las invariantes.

**La fila de Mercadona se inserta en la propia migración.** Es dato de referencia fijo, una fila, y
sin ella la ingesta no tiene FK a la que apuntar. La alternativa era que la creara el script de
ingesta, y eso reparte en dos sitios lo que es una constante.

**Trigger `catalog_products_touch_updated_at`**, reusando la función `touch_updated_at()` que ya
existía desde la Fase 0. Efecto asumido: reingerir mueve `updated_at` aunque no cambie ni un campo.
Da igual, porque el que se enseña al usuario es `price_checked_at`. `updated_at` responde a otra
pregunta, y es justo la que querrás hacerte el día que sospeches que la Action lleva semanas rota:
cuándo tocó la ingesta esta fila por última vez.

**El operador del índice gin va cualificado**, `extensions.gin_trgm_ops` y no `gin_trgm_ops` a
secas. ADR-0012 pide `pg_trgm` en el esquema `extensions`; sin cualificar, que el índice se cree o
no depende del `search_path` de quien aplique la migración, y eso es un fallo que funciona en una
máquina y revienta en otra.

Y una que no lleva: **`catalog_products` no entra en la publicación `supabase_realtime`.** Una tabla
que cambia una vez por semana no tiene por qué empujar eventos a cuarenta móviles.

Después: `db.types.ts` regenerado con `gen types --linked` (ya trae `catalog_products`,
`supermarkets` y el `catalog_product_id` de `items`), `npm test` 190/190, `typecheck` y `lint`
limpios.

#### El test de RLS pasa de 24 a 27

Es la primera vez que este proyecto tiene tablas **sin `community_id`**, y todo el resto de
`scripts/rls-isolation-test.mjs` está escrito para comprobar lo contrario: que nadie ve lo ajeno.
Tres comprobaciones nuevas, y ninguna sobra:

| Comprobación                                                     | Qué afirma                                                           |
| ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| Un miembro lee el catálogo, que no pertenece a ninguna comunidad | `supermarkets` trae la fila de Mercadona y `catalog_products` da 200 |
| Sin sesión no se lee el catálogo                                 | con solo la `apikey`, sin `Authorization`, no sale ninguna fila      |
| Nadie con sesión de usuario escribe en el catálogo               | un `insert` con token de usuario se rechaza con 403                  |

La segunda parece redundante con la primera y no lo es. La política dice `to authenticated`; si
alguien la copia mañana sin ese `to`, la primera seguiría pasando en verde y la única que cae es
esta.

Resultado el 2026-08-14: **27/27**. El `insert` rechazado da 403, que es lo esperado cuando no hay
política de escritura ninguna.

### A.2 · La ingesta — hecho el 2026-08-15

`scripts/catalog-ingest.mjs`. Clona el dataset, aplana `products/` y hace `upsert` contra
`catalog_products` por `(supermarket_id, external_id)`. Resultado de la primera pasada real:
**4.957 productos de Mercadona**, y correrlo dos veces seguidas deja 4.957, no 9.914.

#### La normalización se comparte de verdad, no se copia

ADR-0012 pide que la regla de normalización viva «en un solo sitio, compartida con el ranking del
cliente». El problema práctico es que `domain/` es TypeScript y un script de `scripts/` es un
`.mjs` de Node.

Ahora vive en `src/features/catalog/domain/normalized-name.ts` y el script la importa tal cual, con
el borrado de tipos de Node (`--experimental-strip-types`, disponible en el Node 22 de esta
máquina). La alternativa era que el script tuviera su propia copia, y ese fallo no da ningún error:
da un usuario escribiendo «azúcar» que no encuentra el «azucar» guardado. El benchmark, que tenía la
copia provisional, ahora también importa esta.

Se paga un flag experimental y dos `--disable-warning` de ruido. Si algún día Node lo rompe, la
salida es un `.js` con JSDoc en la misma ruta, sin tocar a quien la llama. La receta completa está
en la skill `expo-stack`, porque vale para cualquier script futuro que quiera reusar `domain/`.

#### El mapeo, con los números del dataset delante

De los 4.965 ficheros del clon salen 4.957 filas. Los 8 restantes **no son productos rotos, son
errores guardados**: el generador del dataset escribe la respuesta fallida tal cual, y dentro hay un
403 en HTML o un `{"errors":[{"code":"not_found"}]}`. Descartarlos por no tener `display_name` es el
filtro correcto, no un apaño.

De las 4.957 filas, **todas traen precio, imagen y código de barras**. 4.915 traen formato.

| Columna            | De dónde sale                                             |
| ------------------ | --------------------------------------------------------- |
| `external_id`      | `id`, que es el id de producto en la tienda de origen     |
| `name`             | `display_name`                                            |
| `brand`            | `brand`, y `details.brand` si el primero viene nulo       |
| `barcode`          | `ean`                                                     |
| `image_url`        | `thumbnail`, con `photos[0].regular` de respaldo          |
| `price_cents`      | `price_instructions.unit_price`, a céntimos enteros       |
| `package_size`     | `total_units` × `pack_size` si es pack, si no `unit_size` |
| `price_checked_at` | la fecha del último commit del clon                       |

Cuatro de esas líneas fueron decisiones, no transcripción:

**`price_checked_at` sale del commit del dataset, no de `now()`.** El dataset no trae marca de
tiempo por producto. Poner `now()` sería afirmar que hemos mirado el precio hoy cuando lo que
sabemos es que el snapshot es del 10 de agosto. A.5 le enseña ese dato al usuario; mentir ahí vacía
de sentido el apartado 3 de ADR-0012 entero.

**El precio es `unit_price`, no `reference_price`.** En el medio pollo son 5,22 € y 5,50 €: el
segundo es el precio por kilo. Lo que interesa en una lista de la compra es lo que pagas por lo que
echas al carro.

**`package_size` no es `packaging`.** Aquí hubo un fallo real, encontrado leyendo las filas ya
escritas: el campo `packaging` vale `"Bandeja"`, que es el envase, y `unit_name` vale `"briks"`.
Ninguno de los dos es un tamaño. El tamaño se construye de `price_instructions`, y cuando el
producto es un pack sale el formato que ADR-0012 pedía de ejemplo:

```
Leche entera Hacendado   6 x 1 L    576 cts
Leche entera Hacendado   1 L         96 cts
```

**La imagen es `thumbnail`, de 300×300.** Es una lista de sugerencias en un móvil; `regular` son
600×600 y cuatro veces los bytes para el mismo resultado a simple vista. Las dos son URL del CDN de
origen, que ADR-0013 ya verificó que sirve peticiones externas.

#### Lo que la ingesta no hace: borrar

Un producto que desaparezca del dataset se queda en la tabla. Borrarlo dispararía el
`on delete set null` sobre el artículo de la lista de alguien, y es mucho más probable que sea un
hipo del origen (de hecho hay 8 respuestas fallidas por pasada) que un producto descatalogado. La
fila vieja se detecta por su `updated_at`, que es exactamente para lo que se puso en A.1.

#### Cómo probarlo

```bash
npm run catalog:ingest -- --dry-run          # aplana e informa, no escribe nada
npm run catalog:ingest -- --dry-run --limit 3
npm run catalog:ingest                       # unos 10 lotes de 500
npm run catalog:ingest -- --fresh            # vuelve a bajar el clon
```

Los flags **solo llegan desde Git Bash**; PowerShell 5.1 se come el `--` sin avisar. Sin
`SUPABASE_SECRET_KEY` el script aborta diciendo qué falta, salvo en `--dry-run`, que no la
necesita porque no escribe.

El clon son 41 MB y 4.965 ficheros sueltos. Es el número que hay que vigilar en la Action de A.3.

Después: `npm test` 200/200 en 28 suites, `typecheck` y `lint` limpios, y `npm run test:rls`
sigue en **27/27**, ahora con la tabla del catálogo llena de verdad en vez de vacía.

### A.3 · La GitHub Action — escrita el 2026-08-15

`.github/workflows/catalog-ingest.yml`. Martes a las 05:40 UTC, porque el dataset de origen se
regenera los lunes, más `workflow_dispatch` para lanzarla a mano. Es la segunda Action del repo; la
otra es la que evita la pausa del proyecto Free.

**Le falta un paso que no puedo dar yo:** el secret `SUPABASE_SECRET_KEY` en
_Settings → Secrets and variables → Actions_. `SUPABASE_URL` ya existe de la Action de keep-alive y
se reusa. Hasta que ese secret esté puesto, la ejecución falla en el primer paso con el mensaje del
propio script diciendo qué falta.

#### No instala dependencias, y es a propósito

No hay `npm ci`. El script de ingesta importa solo builtins de `node:` y un fichero de `domain/` que
a su vez no importa nada, así que `node_modules` no pinta nada aquí. Instalar Expo entero para
clonar un dataset y hacer diez `POST` sería minuto y medio de CI por semana a cambio de nada.

El precio de esa decisión: el día que la ingesta necesite una dependencia de verdad, la Action
petará. Petará ruidosamente y en el primer paso, que es la forma buena de enterarse.

Lo que sí obliga es a fijar **Node 22**: el borrado de tipos que hace posible compartir la
normalización con `domain/` necesita 22.6 o superior.

#### `--env-file` no vale en CI

El script leía el entorno con `--env-file=.env` y en un runner no hay `.env`, así que Node abortaba
antes de empezar. Los dos scripts del catálogo pasan a **`--env-file-if-exists=.env`**: en local
sigue cogiendo el fichero y en CI lo ignora y usa las variables que le pone el workflow. Los otros
scripts (`test:rls`, `test:realtime`, `users`) se quedan con `--env-file` porque son de máquina de
desarrollo y quedarse sin `.env` ahí sí es un error que conviene que grite.

#### Que un fallo se vea, que es lo que pedía ADR-0013

Tres capas, porque el correo de GitHub por un workflow programado que falla se ignora solito:

1. **Un paso de comprobación después de la ingesta.** Vuelve a leer la tabla y escribe en el resumen
   del job cuántos productos hay y cuál es el `price_checked_at` más reciente. Si el catálogo se ha
   quedado por debajo de **1.000 filas**, falla. El umbral es deliberadamente flojo: hoy son 4.957 y
   lo que busca cazar es «la ingesta dijo que sí y la tabla está vacía», no una variación normal.
2. **Una issue abierta automáticamente** cuando el job falla, con enlace a la ejecución. Si ya hay
   una abierta con ese título, comenta en ella en vez de abrir la decimoquinta.
3. El `price_checked_at` que la pantalla de A.5 enseñará al usuario. Esa es la red de cara a fuera,
   y **no sustituye a las dos de arriba**: que el usuario vea un precio de hace un mes no es un
   sistema de aviso, es el daño ya hecho.

#### Cómo probarlo

No se puede probar del todo hasta que esté en `main` con el secret puesto. Lo que sí se ha
verificado en local:

- El YAML parsea y `prettier --check` lo da por bueno.
- El paso de comprobación, ejecutado a mano contra el proyecto real, devuelve
  `rows=4957  checked=2026-08-10T01:16:21+00:00` y pasa el umbral.
- El bloque que abre la issue pasa `bash -n` y el cuerpo del mensaje se renderiza bien.

Cuando esté subida: _Actions → Catalog ingest → Run workflow_. Debe terminar en verde y dejar la
tabla del resumen con las 4.957 filas.

### A.4 · La búsqueda

La RPC `search_catalog` con `pg_trgm` para el filtro grueso, y el ranking como función pura de
`domain/` con sus tests. El reparto está razonado en ADR-0012 y no se discute aquí.

**Este es el incremento que más mueve la aguja**, y hay un número que lo respalda: en la medición,
tres de los ocho fallos no los encontraría ningún catálogo del mundo (`aguacate si son buenos` es
una nota, `azucr` una errata, `copas de vino ikea` no es del supermercado) y dos existen en
Mercadona con otro nombre. El techo no lo pone la fuente.

### A.5 · La pantalla

Sugerencias al escribir el nombre del artículo, y la ficha con foto, precio y **su antigüedad**
(«Mercadona · visto hace 3 días»). Un precio sin fecha es una afirmación que se vuelve falsa sola.

Las reglas de siempre: `accessibilityLabel` y `accessibilityRole` en todo control nuevo, área táctil
de 44 pt, contraste AA, y que la foto propia siga siendo el camino principal. El catálogo es el
atajo, no al revés: **con el catálogo vacío la app tiene que hacer exactamente lo que hace hoy.**

---

## Decisiones sobre la marcha

Aquí van las que se tomen durante la fase y no den para ADR. De momento, ninguna.
