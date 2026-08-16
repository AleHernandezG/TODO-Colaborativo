# Fase 6 · Catálogo de productos y reparto de gastos

- Estado: **abierta**, solo el bloque A. A.1 a A.4 hechos; de A.5 va el primero de tres
- Inicio: 2026-08-07
- Bloque A (catálogo, RF-10): 4.957 productos de Mercadona en la tabla desde el 2026-08-15, la Action
  que los refresca escrita, la búsqueda lista y su puerto y adaptador también. Falta enseñarla
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

El orden importa: cada uno es verificable solo y ninguno depende del siguiente. Del A.5 va el primero
de sus tres.

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

### A.4 · La búsqueda — hecha el 2026-08-15, con una corrección encima el 2026-08-16

La RPC `search_catalog` con `pg_trgm` para el filtro grueso, y el ranking como función pura de
`domain/` con sus tests. El reparto está razonado en ADR-0012 y no se discute aquí.

**Este es el incremento que más mueve la aguja**, y hay un número que lo respalda: en la medición,
tres de los ocho fallos no los encontraría ningún catálogo del mundo (`aguacate si son buenos` es
una nota, `azucr` una errata, `copas de vino ikea` no es del supermercado) y dos existen en
Mercadona con otro nombre. El techo no lo pone la fuente.

El orden es el de siempre en este repo: primero la mitad que no es SQL, porque se deshace con un
`git checkout`. La migración va detrás y con el visto bueno delante.

#### El ranking: seis escalones, y los dos primeros desempates salen de mirar los datos

`rankCatalogResults(query, candidates, limit)` en `src/features/catalog/domain/`. Normaliza la
consulta ella misma con `normalizeCatalogName`, así que quien la llama no puede olvidarse. Con
consulta vacía —o que la normalización deje vacía, como `¿?`— devuelve cero resultados: no se busca
sobre nada.

Cada candidato cae en un escalón:

| Escalón | Cuándo                                                      | Ejemplo con `leche entera`                   |
| ------: | ----------------------------------------------------------- | -------------------------------------------- |
|       5 | el nombre normalizado **es** la consulta                    | `leche entera`                               |
|       4 | el nombre **empieza** por la consulta                       | `Leche entera Hacendado`                     |
|       3 | todas las palabras casan **y el nombre arranca por la 1ª**  | `aceite oliva` → `Aceite de oliva Hacendado` |
|       2 | cada palabra de la consulta es prefijo de alguna del nombre | `leche hacendado` → `Leche entera Hacendado` |
|       1 | el nombre la contiene suelta, o la marca empieza por ella   | `Batido de chocolate 90% leche`              |
|       0 | nada de lo anterior, solo pega por trigrama                 | erratas                                      |

El escalón 2 es el que hace que el orden de las palabras dé igual, que importa aquí porque **la
marca va siempre al final del nombre** en este dataset (`Leche entera Hacendado`), así que buscar
«leche hacendado» es lo natural y no encaja en ningún prefijo.

Dentro del mismo escalón: **primero la unidad suelta, después el pack**. Esto salió de los datos, no
de la teoría: `Leche entera Hacendado` está dos veces, `1 L` a 0,96 € y `6 x 1 L` a 5,76 €. Sin esta
regla el primer resultado de «leche» es el pack y el usuario ve 5,76 € donde espera 0,96 €. Se
detecta por el `x` que mete la ingesta en `package_size`; los dos lados del acuerdo son nuestros.
Luego similitud, luego nombre más corto, y por último nombre e `id` alfabéticos para que el orden
sea siempre el mismo y los tests no dependan de cómo venga la lista.

Lo que **no** hace: tirar los del escalón 0. Un candidato que solo pega por trigrama es mejor que
una pantalla vacía, y el `limit` ya lo deja abajo.

#### `word_similarity`, no `similarity`, y el umbral es 0.5 (medido)

El primer intento usaba `similarity()`, que compara la consulta contra el nombre **entero**. Contra
nombres largos eso hunde cualquier consulta corta. Con los 4.957 productos reales delante:

| Consulta          | `similarity` ≥ 0.12 | `word_similarity` ≥ 0.5 | `word_similarity` ≥ 0.6 |
| ----------------- | ------------------: | ----------------------: | ----------------------: |
| `leche`           |                  89 |                     150 |                     150 |
| `leche entera`    |                  92 |                      21 |                      14 |
| `lech`            |                  44 |                     155 |                       0 |
| `papel higienico` |                  23 |                       7 |                       7 |

Dos cosas se leen ahí. Una: con `similarity`, escribir `lech` devolvía `Lechuga Iceberg` por delante
de la leche, porque contra un nombre largo la lechuga puntúa más. Con `word_similarity` la leche
sube sola. Y dos: **0.6 —el valor por defecto de `pg_trgm`— deja `lech` en cero resultados**. Es
justo el caso de escribir a medias, que es el 90% de lo que va a pasar. Por eso el umbral se baja a
0.5 y se fija dentro de la propia función, no en la sesión.

#### Lo que los trigramas no arreglan, y no se va a fingir que sí

`lehce` no devuelve nada, con ningún umbral. `leche` da los trigramas `lec ech che` y `lehce` da
`leh ehc hce`: no comparten ninguno. Una transposición en una palabra de cinco letras es el caso
donde los trigramas no llegan, y bajar el umbral no lo salva, solo mete ruido en todo lo demás.
Queda así y se dice: el usuario borra y reescribe. Arreglarlo pediría distancia de edición, que no
tiene índice.

Buscar solo por marca (`hacendado`) devuelve 1.995 candidatos y el orden es arbitrario. Tampoco se
arregla: nadie apunta «hacendado» en la lista de la compra.

#### La RPC `search_catalog`

`supabase/migrations/20260815120000_search_catalog.sql`. **No toca tablas, ni columnas, ni índices,
ni políticas**: solo añade la función.

**`security invoker`, y es la primera función de este repo que no es `definer`.** Las otras lo son
para esquivar la recursión de las políticas de comunidad; aquí no hay nada que esquivar, porque
`catalog_products` tiene `select to authenticated using (true)`. Un `definer` solo daría permisos
que nadie necesita. A cambio, el día que el catálogo se restrinja por comunidad esta función lo
respeta gratis.

**El umbral va escrito en el `where`, y el índice gin no se usa. Esto no era el plan.** El diseño
aprobado usaba el operador `<%`, que sí tira del índice, con
`set pg_trgm.word_similarity_threshold = 0.5` en la propia función. Al aplicarlo, Postgres lo
rechazó:

```
ERROR: permission denied to set parameter "pg_trgm.word_similarity_threshold" (SQLSTATE 42501)
```

El motivo es que ese parámetro lo define la librería de `pg_trgm` al cargarse, y en la sesión que
aplica la migración todavía no está cargada. Postgres lo ve como un parámetro desconocido con
prefijo, y esos solo los puede fijar un superusuario. El rol `postgres` de Supabase no lo es.

Se puede rodear —cargar `pg_trgm` llamando a una de sus funciones y luego un `alter function`— y se
descartó por cómo falla, no por cómo se ve. PostgREST abre conexiones nuevas, así que el mismo
permiso se vuelve a comprobar al ejecutar; y si un día no se aplica, el umbral no da error: vuelve al
0.6 de fábrica y **`lech` pasa a devolver cero resultados**. Una búsqueda que a veces no encuentra
nada y nadie sabe por qué es peor que una búsqueda que recorre 4.957 filas.

Así que `word_similarity(…) >= 0.5` escrito a mano y `Seq Scan`. **4.957 filas de nombres cortos**,
contra una latencia de red que ya es de 100 ms largos desde el móvil. El día que el catálogo tenga
varios supermercados y esto se note, la salida es un índice GiST, que sí ordena por distancia
(`<->>`) sin depender de ningún parámetro de sesión.

De ahí sale el `as materialized` del CTE: sin él, `word_similarity` se calcula dos veces por fila,
una en el `where` y otra en el `order by`. Con él, una.

**Las columnas del `select` final van con alias y una a una**, no un `select *`. Los nombres de
`returns table` (`id`, `name`, `similarity`) quedan en ámbito dentro del cuerpo y chocan con los de
la tabla. Esta trampa ya costó una migración de corrección en la Fase 0
(`20260719151500_fix_join_community_ambiguity.sql`); no hace falta pagarla dos veces.

**La consulta llega ya normalizada desde el cliente, y Postgres no la vuelve a normalizar.**
Descartado `unaccent`: sería una segunda implementación de la misma regla, con casos límite
distintos a los de `normalizeCatalogName`, y esa divergencia no da error — da búsquedas que fallan
sin que nadie sepa por qué. `trim()` se queda como defensa barata. Contrapartida asumida: quien
llame a la RPC sin normalizar obtiene resultados peores, y por eso el único que la llama es el
adaptador de `data/`.

**El escalonado no baja a SQL.** Cabía meter el `case when normalized_name = p_query then 4 …` en el
`order by`. No: ADR-0012 pone el ranking en `domain/` con Jest, y así cada ajuste del orden cuesta un
test y no una migración nueva.

**`returns table` con `similarity`**, no `setof catalog_products`, porque el dominio necesita ese
número para desempatar. `currency` sale como `text` aunque la columna sea `char(3)`, para que
PostgREST y los tipos generados no arrastren `bpchar`.

`p_limit` acotado a 1..100, por defecto 50, los ~50 candidatos que pide ADR-0012.
`p_supermarket_id` nulo significa todos: hoy solo hay Mercadona, pero la firma ya no cambia cuando
haya dos.

#### Defecto encontrado al medir de punta a punta: el filtro grueso mataba de hambre al ranking

Aplicada la RPC, la primera búsqueda real de «leche» devolvió `6 Panes de leche 3%`,
`Chocolate con leche Milka` y `Café con leche en cápsula Tassimo`. La leche, no.

El motivo es que **`word_similarity` de Postgres satura**. Cualquier nombre que contenga la palabra
entera puntúa exactamente `1.00`, no un valor graduado. Pedidas 100 filas para «leche», las 100
traían `similarity = 1` — un solo valor distinto. Con todo empatado, `order by similarity desc, name`
degenera en alfabético, y las filas que empiezan por «leche» no aparecen hasta la posición 80. Con
`p_limit = 50` no llegaba ninguna al cliente.

El ranking del dominio no fallaba: nunca vio los candidatos buenos. Es el fallo clásico de partir una
búsqueda en dos mitades, **la mitad que recorta tiene que conservar lo que la mitad que ordena
sabría promocionar**, y eso ADR-0012 lo daba por supuesto sin decirlo.

Se vio porque la comprobación se hizo contra la RPC de verdad. La sonda previa usaba una
aproximación de `word_similarity` escrita en JS que sí daba valores graduados, así que en local todo
parecía correcto. **Una aproximación de la dependencia no vale para validar el contrato con ella.**

#### La corrección: `20260815130000_search_catalog_candidate_order.sql`

La anterior ya estaba aplicada, así que no se edita: se corrige con otra encima. Firma, permisos,
tablas y umbral no se tocan. Cambian tres cosas.

**Un flag exacto de prefijo manda en el orden de selección.**
`starts_with(normalized_name, query)` es booleano y no empata: las 21 filas que empiezan por «leche»
entran antes que las ~130 que solo la contienen, pase lo que pase con los trigramas.

**La columna devuelta pasa de `word_similarity` a `similarity`.** `word_similarity` sigue decidiendo
quién entra, que es la pregunta que sabe contestar («¿aparece esta palabra?»). Como valor devuelto no
sirve porque satura. `similarity` compara contra el nombre entero y por tanto penaliza el ruido:
«leche» contra `Leche entera Hacendado` puntúa alto, contra
`Aftersun leche corporal Ecran hidratante y reparadora` puntúa bajo. **Pertenencia y grado son dos
preguntas distintas y se estaban contestando con la misma función.** El dominio no cambia: usa
`similarity` solo para desempatar, y ahora ese desempate significa algo.

**La CTE materializa solo `(id, sim)` de los supervivientes** y el resto de columnas salen de un
join. Antes materializaba las 4.957 filas enteras con sus `image_url` para tirar el 97%.

Lo que se descartó:

| Alternativa                                   | Por qué no                                                                                                                                   |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Subir el límite a 500 y que el dominio filtre | Arregla «leche» y ninguna causa. Sigue habiendo un corte ordenado por nada, solo más lejos, y son 500 filas con URLs por red móvil por tecla |
| Ordenar solo por `similarity`, sin el flag    | Es una heurística de longitud disfrazada: `Pan de leche Hacendado` puntúa casi igual que `Leche entera Hacendado` porque miden lo mismo      |
| Mover el ranking entero a SQL                 | Lo prohíbe ADR-0012 y con razón: los cinco niveles y la regla del pack tienen 15 tests en Jest                                               |

Lo que se mueve a SQL **no es ranking, es qué candidatos sobreviven al recorte**, que es
responsabilidad de quien recorta. Esa es la línea, y conviene tenerla escrita: el dominio ordena lo
que recibe; la RPC decide qué merece viajar.

El coste es una segunda llamada a pg_trgm por fila. Sigue siendo `Seq Scan` sobre 4.957 filas y sigue
sin importar frente a los ~90 ms de latencia de red.

#### El test de RLS pasa de 27 a 29

Dos comprobaciones, las dos de permisos, que es de lo que va ese script:

| Comprobación                                     | Qué afirma                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| Un miembro busca en el catálogo                  | 200, resultados, todos de `mercadona` y **el primero empieza por la consulta** |
| Sin sesión no se puede ejecutar `search_catalog` | con solo la `apikey`, sin `Authorization`, se rechaza                          |

La segunda es la que vigila el `revoke … from public, anon`. Sin ella, alguien que reescriba la
función mañana y se deje los `grant` por defecto abre el catálogo a cualquiera con la clave pública,
y el resto del script seguiría en verde.

La primera afirmaba `similarity ≥ 0.5` y pasaba en verde con la búsqueda rota, porque ese umbral era
el de `word_similarity` y saturaba a 1 en todas las filas. **Una aserción sobre el rango de un número
no dice nada del orden.** Ahora comprueba que el primer resultado empieza por lo que se ha escrito, y
el mensaje imprime su nombre, así que una regresión se lee en la salida sin abrir nada.

#### Cómo probarlo

El ranking va solo: `npx jest src/features/catalog` da 25/25 sin tocar la red.

La RPC necesita la migración aplicada, y eso lo tiene que lanzar Alejandro:

```bash
npx supabase db push --linked --yes
npx supabase gen types typescript --linked > src/shared/lib/db.types.ts   # desde Git Bash
npm run test:rls    # 29/29
```

Y una medición que conviene hacer una vez, porque es la que decide si el `Seq Scan` es aceptable o
hay que volver al índice por otra vía:

```sql
explain analyze
select * from search_catalog('leche', 'mercadona', 10);
```

Va a salir un `Seq Scan` sobre `catalog_products`, y eso es lo esperado. Lo que importa es el
`Execution Time`. Por debajo de ~50 ms no hay nada que hacer: la red desde el móvil cuesta más que
eso. Si se fuera a cientos de milisegundos, el siguiente paso es el índice GiST con `<->>`.

### A.5 · La pantalla — partida en tres

Sugerencias al escribir el nombre del artículo, y la ficha con foto, precio y **su antigüedad**
(«Mercadona · visto hace 3 días»). Un precio sin fecha es una afirmación que se vuelve falsa sola.

Las reglas de siempre: `accessibilityLabel` y `accessibilityRole` en todo control nuevo, área táctil
de 44 pt, contraste AA, y que la foto propia siga siendo el camino principal. El catálogo es el
atajo, no al revés: **con el catálogo vacío la app tiene que hacer exactamente lo que hace hoy.**

Es demasiado para un incremento, así que van tres: **A.5.1** dominio y datos sin UI, **A.5.2** la
lista de sugerencias bajo el campo de añadir, **A.5.3** la foto y el precio en el artículo.

#### A.5.1 · El puerto, el adaptador y el caso de uso — hecho el 2026-08-16

| Fichero                                       | Qué hace                                                       |
| --------------------------------------------- | -------------------------------------------------------------- |
| `catalog/domain/catalog-repository.ts`        | El puerto. Un método, `search`                                 |
| `catalog/domain/search-catalog.ts`            | Pide candidatos y los pasa por `rankCatalogResults`            |
| `catalog/domain/price-age.ts`                 | `price_checked_at` → `{ unit, count }`, para que lo pinte i18n |
| `catalog/data/supabase-catalog-repository.ts` | `assertOnline()`, la RPC y el mapeo a la entidad               |

Sin UI todavía, y aun así verificable: 46 tests en la feature, 98% de cobertura.

**Tres caracteres mínimo, medidos sobre el nombre normalizado.** Por debajo, los trigramas devuelven
ruido y cada tecla es una llamada de red. `isSearchableQuery` corta antes de tocar el repositorio, no
después, así que escribir «le» no genera tráfico. El corte se comprueba tras normalizar: `«  l.  »`
son cinco caracteres que valen uno.

**El caso de uso pide 50 candidatos y devuelve 6.** Son dos límites distintos y conviene no
confundirlos: 50 es lo que viaja por la red para que el ranking tenga con qué trabajar, 6 es lo que
cabe en pantalla sin tapar el teclado. Ese 50 es justo el número que el defecto de A.4 volvía
peligroso, y por eso el orden de selección de la RPC importa tanto.

##### El mapeo del adaptador existe para tapar una mentira de `gen types`

Con `returns table`, Supabase **no puede inferir la nulabilidad** y declara `brand`, `image_url`,
`package_size`, `price_cents` y `price_checked_at` como no nulos. Los cinco lo son.

Si eso se deja pasar, TypeScript deja de avisar justo donde hay que tener cuidado: `price_cents!`
compila, `priceCents.toFixed(2)` compila, y revienta en el móvil con el primer producto sin precio.
Y son muchos: el dataset trae fotos y precios a huecos.

El adaptador declara su propio `SearchRow` con los nulos puestos y asigna el resultado de la RPC a
él. **No hace falta ningún `as`**: `{ brand: string }[]` es asignable a `{ brand: string | null }[]`,
así que la conversión es una anotación de tipo y el compilador la acepta sola. De ahí para dentro de
la feature, los nulos son visibles y `strict` vuelve a hacer su trabajo.

Hay un test dedicado solo a esto, con las cinco columnas a `null`, para que se caiga si alguien
«arregla» el mapeo copiando los tipos generados.

##### `price-age.ts` en dominio, y no `Intl.RelativeTimeFormat`

Devuelve `{ unit: 'today' | 'day' | 'week' | 'month', count }` y el plural lo resuelve i18n, que ya
tiene un test que falla si ES e EN se desincronizan. Con `Intl` la cadena la construiría Hermes, que
es lo único de esta app que no se puede probar en Jest ni traducir con las reglas del proyecto.

Dos casos raros resueltos en el código, que es donde manda `CLAUDE.md` para el código async y los
bordes: una fecha ilegible devuelve `null` y la pantalla no enseña antigüedad; una fecha futura
(reloj del móvil mal, o una ingesta con fecha adelantada) cuenta como hoy en vez de dar días
negativos.

##### La misma sonda que destapó lo de A.4 destapó un escalón que faltaba

Con la corrección aplicada, `similarity` pasó de un valor único a 11-29 valores distintos por
consulta y «leche», «leche entera» y «papel higiénico» salieron bien a la primera. `aceite oliva`, no:
devolvía **`Barra pan de aceite de oliva`** por delante del aceite.

No era el filtro esta vez, era el ranking. Los dos caían en el escalón 2 (todas las palabras de la
consulta son prefijo de alguna del nombre) y ahí decidía la similitud, que premia al nombre con menos
ruido alrededor. `Barra pan de` mete menos ruido que `1º Hacendado`, así que el pan ganaba.

Escalón 3 nuevo: **de los que casan todas las palabras, van primero los que arrancan por la primera
palabra escrita.** Un nombre que empieza por lo que has empezado a escribir es más probable que sea
lo que buscas, y eso es una comprobación exacta, no una heurística de longitud.

Solo afecta a consultas de varias palabras. Con una sola, «el nombre empieza por la primera palabra»
es exactamente el escalón 4, así que el 3 no se alcanza nunca y las búsquedas de una palabra ordenan
igual que antes. Hay un test dedicado a fijar eso, porque es justo el tipo de cosa que se rompe sin
que nadie se entere.

##### Tres caracteres, ahora con la medición delante

| Escrito | Candidatos que devuelve la RPC | Tres primeras sugerencias                   |
| ------- | ------------------------------ | ------------------------------------------- |
| `le`    | 100 (el tope)                  | Lechuga hoja roble, Lenguado rubio, Lechuga |
| `lec`   | 100 (el tope)                  | Lechuga Iceberg, Lechuga hoja roble, Leche  |
| `pa`    | 100 (el tope)                  | Patata, Papaya, Patatas                     |
| `pan`   | 100 (el tope)                  | Pan Viena, Pan Bretzel, Pan 5 semillas      |
| `hue`   | 66                             | Huevos, Hueso garrón, Hueso vacuno          |

Con dos caracteres los resultados no son basura, y aun así el mínimo se queda en tres por dos
motivos. Uno, que cada tecla es una llamada de red y con dos letras el usuario no ha dicho todavía
qué quiere. Dos, y este es el que importa: **con dos caracteres la RPC devuelve siempre el tope de
candidatos**, o sea que el filtro grueso vuelve a estar recortando a ciegas. Que los resultados
salgan bien de todas formas es mérito del `starts_with` de la corrección de A.4, que ordena antes de
recortar. Se sostiene, pero no es un sitio donde apoyarse a propósito.

`hue` con 66 candidatos es el caso sano: por debajo del tope, el ranking ve el conjunto entero.

##### Y la comprobación de que el mapeo hacía falta

De los 100 productos que devuelve «leche», **7 vienen con `brand` a `null`**. Los tipos generados
juran que esa columna es `string`. Sin el mapeo del adaptador, el primer `brand.toLowerCase()` de la
pantalla revienta en el móvil con TypeScript diciendo que todo está bien.

---

## Decisiones sobre la marcha

Aquí van las que se tomen durante la fase y no den para ADR.

**`rank-catalog-results.ts` es solo de la app, y da igual.** La regla de la skill `expo-stack` —el
fichero que comparte script y app no importa nada— tiene esta consecuencia: como el ranking importa
`./normalized-name` sin extensión, que es lo correcto para el bundler, Node no lo puede cargar con
`--experimental-strip-types`. Se descubrió al querer probar el ranking contra los datos reales desde
un script. No se toca: ningún script ordena resultados, solo la app. Si algún día hiciera falta,
la salida es la de siempre, bajarlo a `.js` con JSDoc.
