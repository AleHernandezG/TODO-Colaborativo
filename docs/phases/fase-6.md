# Fase 6 · Catálogo de productos y reparto de gastos

- Estado: **abierta**. Bloque A cerrado y verificado en dispositivo; bloque B completo en código desde el 2026-08-28 (B.9) y **pendiente de la prueba con dos móviles** (guion en B.10).
- Inicio: 2026-08-07
- Bloque A (catálogo, RF-10): 4.979 productos de Mercadona en la tabla, Action semanal verificada, sugerencias bajo el campo de texto y fotos vinculadas. Verificado en Android real el 2026-08-24.
- Bloque B (reparto de gastos, RF-9): escrito el 2026-08-24. Esquema de `expenses`, `expense_shares` y `settlements` aplicado en Supabase, RPC atómica `create_expense_with_shares`, algoritmo de liquidación mínima en `domain/`, pantalla `ExpensesScreen` con balances e historial. Las cuatro reglas de `CLAUDE.md` que le faltaban (B.5) se cerraron el 2026-08-28: optimistic UI con rollback, deshacer al borrar, Realtime y cola offline con el id del gasto puesto por el cliente. **Sigue sin verificarse en dispositivo.**
- El 2026-08-28 se arregló el fallo que impedía unirse a cualquier lista desde el 24 (B.6) y se rediseñó cómo se clasifican y se enseñan los errores ([ADR-0016](../adr/ADR-0016-clasificacion-de-errores-y-mensaje-al-usuario.md)). `npm run test:rls` pasa a 37/37 y `npm run test:realtime` vuelve a 12/12.
- El mismo 2026-08-28, ya de tarde, se cerró B.5 (ver B.9): `npm test` da 327 en 43 suites, `npm run test:rls` 39/39 y `npm run test:realtime` 15/15.

> **La Fase 5 se cerró el 2026-08-16**, con la pasada de TalkBack recorrida entera y limpia. Esta
> fase se abrió antes de aquello y avanzó en paralelo, porque su primer trabajo era SQL y no competía
> por el móvil; la condición era **no publicar nada de aquí antes de cerrar la anterior**, y ya está
> cerrada. La regla de `CLAUDE.md` de no saltar de fase sin cerrar la anterior se dobló lo justo para
> no tener a nadie parado, no se rompió.

## Los dos bloques

**Bloque A · Catálogo de productos (RF-10).** Escribir «leche» y que salga la foto ya hecha y el
precio de referencia. Diseñado entero en
[ADR-0012](../adr/ADR-0012-catalogo-de-productos-de-supermercado.md) y con la fuente elegida en
[ADR-0013](../adr/ADR-0013-fuente-del-catalogo-mercadona.md). **Completado y verificado el 2026-08-24**.

**Bloque B · Reparto de gastos (RF-9).** Quién debe qué a quién. Su requisito de entrada
([ADR-0005](../adr/ADR-0005-reparto-de-gastos.md), identidad no suplantable) quedó resuelto el
2026-08-24 con el PIN de 4 dígitos por miembro ([ADR-0015](../adr/ADR-0015-pin-por-miembro-para-identidad-no-suplantable.md)).
Ahora sí es seguro construir balances y deudas sobre miembros con identidad protegida.

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

El orden importa: cada uno es verificable solo y ninguno depende del siguiente. Los cinco están
escritos, incluidas las tres partes del A.5.

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

**Le faltaba un paso que no podía dar yo,** el secret `SUPABASE_SECRET_KEY` en
_Settings → Secrets and variables → Actions_, **y Alejandro lo puso el 2026-08-16**. `SUPABASE_URL`
ya existía de la Action de keep-alive y se reusa. Sin ese secret la ejecución fallaba en el primer
paso con el mensaje del propio script diciendo qué faltaba; ahora queda verla correr una vez de
verdad, y para eso está el `workflow_dispatch`: _Actions → Catalog ingest → Run workflow_, sin
esperar al martes.

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

**Ejecutada con éxito el 2026-08-24** vía _Actions → Catalog ingest → Run workflow_. Terminó en verde (23s), actualizando a **4.979 productos** con `price_checked_at` del snapshot del 2026-08-24T00:55:48+00:00.

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
| `catalog/domain/price.ts`                     | `price_checked_at` → `{ unit, count }`, para que lo pinte i18n |
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

##### `price.ts` en dominio, y no `Intl.RelativeTimeFormat`

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

#### A.5.2 · Las sugerencias bajo el campo de añadir — escrito el 2026-08-16

| Fichero                                                    | Qué hace                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| `shared/hooks/use-debounced-value.ts`                      | Genérico, sin nada del catálogo dentro                          |
| `catalog/presentation/use-catalog-search.ts`               | `useQuery` + debounce, y traduce el estado a lo que pinta la UI |
| `catalog/presentation/components/CatalogSuggestionRow.tsx` | Una fila: foto, nombre, formato, precio y su antigüedad         |
| `catalog/presentation/components/CatalogSuggestions.tsx`   | La caja, los separadores y el pie con la fuente                 |
| `items/presentation/components/AddItemBar.tsx`             | Las monta bajo el `Input` y rellena el nombre al tocar          |

`price.ts` gana dos funciones que la fila necesita: `priceAmount(cents, separador)`, porque el dinero
son céntimos enteros y se parte a mano, y `currencySymbol(code)`, que traduce `EUR` a `€` y deja
pasar por su código cualquier moneda que no conozca. Nada de `Intl`, por lo mismo que `priceAge`.

##### La lista tiene cuatro estados y ninguno es un hueco vacío

Sin nada que enseñar **no se pinta nada**: ni marco, ni estado vacío, ni un espacio reservado. La
pantalla de la lista tiene el campo de añadir en la cabecera de un `SectionList`, y un hueco fijo ahí
empujaría los artículos hacia abajo todo el rato sin dar nada a cambio.

| Situación                               | Qué se ve                                               |
| --------------------------------------- | ------------------------------------------------------- |
| Menos de 3 caracteres                   | Nada                                                    |
| Buscando y todavía sin resultados       | Una línea, «Buscando en el catálogo…»                   |
| Con resultados                          | La caja, hasta 6 filas, y el pie con la fuente          |
| Sin conexión, o el catálogo no responde | Una línea que lo dice, **solo si no hay nada cacheado** |

El último caso es el que importa: si ya había sugerencias en pantalla y se cae la red, se quedan. Un
producto de hace diez segundos sigue valiendo, y borrarlo para poner un aviso sería peor. El aviso
aparece solo cuando además no hay nada que enseñar.

##### El detalle que se escapa: `keepPreviousData` deja basura al borrar

`placeholderData: keepPreviousData` está puesto para que la lista no parpadee entre teclas, y tiene
un efecto que no se ve venir: cuando el usuario **borra** el campo, la consulta se deshabilita, pero
`data` sigue trayendo lo último bueno. Sin cuidado, borrar el texto deja seis sugerencias colgadas
debajo de un campo vacío.

Por eso el hook devuelve `[]` en cuanto la búsqueda deja de ser buscable, y lo comprueba **dos
veces**: sobre lo que hay escrito ahora mismo y sobre lo que ya cuajó tras el debounce. La primera es
la que hace que borrar limpie al instante en vez de 250 ms después.

Ese mismo par explica el resto de la lógica del hook. `problem` se calcula con el valor **sin**
debounce, porque «no hay conexión» no tiene por qué esperar a que pares de escribir; las sugerencias
salen del valor **con** debounce, que es el único que llega a la red.

##### La consulta no se persiste, y es a propósito

`meta.persist` no está. La persistencia de TanStack Query en este repo es opt-in
([ADR-0008](../adr/ADR-0008-persistencia-local-de-la-cache.md) y `shared/lib/query-persister.ts`), y
el catálogo no cumple ninguna de las dos razones para entrar: no es lo que el usuario quiere ver al
abrir la app sin red, y una caché de búsquedas se llena de consultas de un solo uso. La lista de la
compra sí se persiste. Lo que escribiste una vez en el campo de añadir, no.

`staleTime` de 5 minutos, en cambio, sí: dentro de una misma sesión de escritura es normal borrar y
volver a escribir lo mismo, y eso no debería salir a la red otra vez.

##### La fila: qué se enseña y qué se deja fuera

Fuera la marca. En el dataset de Mercadona **la marca ya viene al final del nombre** («Leche entera
Hacendado»), así que enseñarla aparte repite la palabra en la misma fila. Se descubrió mirando los
datos, no diseñando la fila. La marca sigue contando para el ranking, que es donde sirve.

Fuera también el supermercado en cada fila: va una sola vez, en el pie, junto con lo que de verdad
hay que decir: **«Precios de Mercadona, orientativos»**. [ADR-0012](../adr/ADR-0012-catalogo-de-productos-de-supermercado.md)
pide que un precio de referencia nunca se disfrace de gasto, y esa línea es la mitad barata de
cumplirlo; la otra mitad es la fecha, que va en cada fila porque cada producto se vio un día
distinto.

El nombre del supermercado sale de `defaultSupermarketName`, al lado de `defaultSupermarketId` en
dominio, y no de la traducción. Un nombre propio no se traduce, y meterlo en `es.json` obligaría a
mantenerlo en dos ficheros. **Los dos constantes tienen que casar con la fila de `supermarkets`**; el
día que haya un segundo supermercado, esto pasa a salir de la consulta y este párrafo caduca.

La antigüedad solo se enseña si hay precio. «Visto hace 3 días» sin precio al lado no dice nada:
`price_checked_at` es la fecha **del precio**, no del producto.

##### Accesibilidad

Cada fila es un `Pressable` con `accessibilityRole="button"`, `minHeight` de `minTouchTarget` y una
etiqueta que junta con comas lo que un vidente lee de un vistazo: nombre, formato, precio y
antigüedad. Todo lo de dentro va marcado como no accesible, para que TalkBack lea la fila una vez y
no cuatro trozos sueltos. La caja lleva `accessibilityRole="list"` y dice cuántas sugerencias hay,
que es lo que no se puede deducir al tacto.

El `SectionList` de la pantalla ya traía `keyboardShouldPersistTaps="handled"`, así que tocar una
sugerencia con el teclado abierto funciona sin tocar nada más. Sin eso, el primer toque solo cierra
el teclado y el segundo cae en otra fila porque la lista se ha movido.

##### Tocar una sugerencia rellena el nombre y cierra la lista

Y cerrarla necesita estado propio: si solo se copiara el nombre al campo, el hook volvería a buscar
ese nombre exacto y la lista se quedaría abierta enseñando el producto que acabas de elegir.
`AddItemBar` se guarda el último nombre elegido y esconde las sugerencias mientras el campo siga
igual. En cuanto se toca una tecla vuelven a salir.

En este incremento tocar una sugerencia **solo rellena el texto**. La foto y el precio son A.5.3.

##### Cómo probarlo

`npm run lint`, `npm run typecheck`, `npx jest` (249 en 33 suites) y
`npx expo export --platform android` pasan. Lo demás pide el móvil:

1. **Que salgan.** Escribe «lec» en el campo de añadir. A los tres caracteres aparece la caja con
   fotos, precios y «visto hace N días». Con dos caracteres, nada.
2. **Que no parpadeen.** Sigue escribiendo hasta «leche entera». La lista se refina sin quedarse en
   blanco entre teclas.
3. **Que borrar limpie.** Vacía el campo de un tirón. Las sugerencias desaparecen **al momento**, no
   un cuarto de segundo después.
4. **Que tocar rellene.** Toca una fila con el teclado abierto. El nombre entra en el campo al primer
   toque y la lista se cierra. Añade el artículo: entra con ese nombre, como cualquier otro.
5. **Que la foto se vea.** Son URLs del CDN de Mercadona (`prod-mercadona.imgix.net`, 300×300, sin
   autenticación). Comprobado por HTTP desde el PC; en el móvil hay que verlo.
6. **Sin red.** Modo avión con sugerencias en pantalla: se quedan. Borra y escribe otra cosa: sale la
   línea «Sin conexión: el catálogo no se puede consultar», sin spinner eterno.
7. **Con TalkBack.** Una fila se lee entera de una vez: nombre, formato, precio, antigüedad. No se
   entra dentro a leer trozos.
8. **En oscuro.** Cambia el tema del sistema con la lista abierta.

#### A.5.3 · La foto del catálogo en el artículo — escrito el 2026-08-16

Elegir una sugerencia deja de ser solo texto: el artículo se queda enlazado al producto
(`items.catalog_product_id`) y la lista enseña su foto sin que nadie saque el móvil.

| Fichero                                        | Qué hace                                                    |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `items/domain/item-image-source.ts`            | La regla de ADR-0014 como función pura, más los ids a pedir |
| `catalog/domain/catalog-products-by-id.ts`     | Caso de uso: una lista de ids → un índice por id            |
| `catalog/data/supabase-catalog-repository.ts`  | `byIds`, un `select … in (…)` sobre la tabla                |
| `catalog/presentation/use-catalog-products.ts` | La consulta, y esta **sí** se persiste                      |
| `items/presentation/components/ItemImage.tsx`  | Acepta la URL del catálogo; la propia sigue mandando        |
| `items/presentation/ItemsScreen.tsx`           | Pide los productos **una vez para toda la lista**           |

##### El conflicto que había que resolver antes de escribir nada

[ADR-0012](../adr/ADR-0012-catalogo-de-productos-de-supermercado.md) decía que `image_path` guardaría
la ruta del bucket o la URL del CDN según `catalog_product_id`. Esa regla no sobrevive al primer
usuario que le hace una foto propia a un artículo que vino del catálogo, que es algo que
`EditItemDialog` ya permite hoy: quedan las dos columnas con valor y la app no sabe si firmar la
cadena o usarla tal cual.

Lo arregla [ADR-0014](../adr/ADR-0014-origen-de-la-foto-del-articulo.md): **`image_path` guarda solo
rutas de nuestro bucket, nunca una URL**, y la foto del catálogo se saca del producto enlazado al
pintar. Sin migración, porque la columna ya estaba y lo que cambia es la convención de contenido.

| `image_path` | `catalog_product_id` | Qué se pinta                              |
| ------------ | -------------------- | ----------------------------------------- |
| `null`       | `null`               | El hueco de la cámara                     |
| `null`       | uuid                 | La foto del CDN, sin firmar               |
| ruta         | lo que sea           | La foto propia, firmada. **Siempre gana** |

`itemImageSource()` devuelve eso como unión discriminada, y borrar la foto propia hace reaparecer la
del catálogo sola: el enlace nunca se rompió.

##### Una consulta para toda la lista, con la clave ordenada

`catalogImageProductIds(items)` recoge los ids de los artículos que **de verdad** van a enseñar foto
del catálogo (los que tienen foto propia no cuentan: esa foto gana y su producto no hace falta),
quita repetidos y **los ordena**. Ese `.sort()` es lo que hace que la clave de consulta no dependa del
orden de la lista: sin él, marcar un artículo como comprado lo mueve de sección, cambia el orden del
array y TanStack Query se cree que es otra consulta y vuelve a la red.

Va en `ItemsScreen`, no en `ItemRow`. Una consulta por fila serían veinte peticiones para una lista
de veinte artículos, cada una con su `assertOnline()` y su entrada de caché.

##### Y esta consulta sí lleva `meta.persist`

Justo al revés que la de A.5.2, y por el motivo que da ADR-0008: se persiste lo que el usuario quiere
ver al abrir la app sin red. La lista de la compra ya se persistía; si los productos del catálogo no,
la lista cacheada saldría con huecos de cámara donde ayer había fotos. Son pocas filas, cambian poco
y se piden por id: es el caso opuesto a una caché de búsquedas de un solo uso.

`staleTime` y `gcTime` de 24 horas. El precio y la foto los refresca la ingesta semanal; pedirlos más
a menudo no descubre nada.

##### El enlace viaja en las `variables`, no en el closure

`AddItemVariables` gana `catalogProductId`, con lo que un alta hecha sin cobertura conserva el
producto al rehidratarse ([ADR-0009](../adr/ADR-0009-cola-de-mutaciones-offline.md): lo que no está
en `variables` se pierde al reiniciar la app). Hay un test que lo comprueba deshidratando y
rehidratando la mutación en otro cliente.

`AddItemBar` guarda el producto elegido entero, no solo su nombre, y **solo manda el enlace si el
texto sigue siendo exactamente el que puso la sugerencia**. Editar el nombre después de elegir ya
volvía a abrir la lista de sugerencias en A.5.2; que además suelte el enlace es coherente con eso:
estás buscando otra cosa.

##### El precio no se pinta todavía

Está guardado —el enlace lo trae— pero no sale en la fila del artículo. Decisión del usuario: en la
lista de la compra la foto ayuda a reconocer el producto y el precio solo mete ruido. Su consumidor
real es el bloque B (RF-9), ya escrito. La regla de ADR-0012 sigue intacta: un precio de
referencia no se convierte en gasto sin que una persona lo confirme.

##### Cómo probarlo

`npm run lint`, `npm run typecheck`, `npx jest` (267 en 35 suites), `npm run test:coverage` (97.8%
de sentencias en dominio y datos) y `npx expo export --platform android` pasan. En el móvil, después
del guion de A.5.2:

1. **Que la foto llegue.** Escribe «lec», toca una sugerencia con foto y añade el artículo. Aparece
   en la lista con la foto del producto, no con el hueco de la cámara.
2. **Que la propia gane.** Abre ese mismo artículo, hazle una foto con la cámara y guarda. La lista
   pasa a enseñar la tuya.
3. **Que borrarla devuelva la del catálogo.** Vuelve a abrirlo, «Quitar foto», guarda. Reaparece la
   del catálogo, sin tener que volver a elegir la sugerencia.
4. **Que un artículo escrito a mano siga igual.** Escribe «pan de la panadería de abajo» sin tocar
   ninguna sugerencia. Hueco de la cámara, como siempre.
5. **Que se vea sin red.** Con la lista cargada y fotos de catálogo en pantalla, modo avión y cierra
   la app del todo. Al volver a abrirla las fotos siguen ahí.
6. **Que no vuelva a la red al marcar.** Marca y desmarca artículos con fotos de catálogo. Las fotos
   no parpadean ni desaparecen un instante.
7. **Con TalkBack.** La foto de la fila sigue siendo decorativa: la fila se lee entera de una vez y
   no anuncia una imagen suelta.

---

## Incrementos del bloque B

El bloque B se escribió del tirón el 2026-08-24, en dos commits (`ffd3764` el PIN, `3d8ff11` los
gastos). Lo que sigue es el diario a posteriori: lo que hay, lo que no hay y qué falló.

### B.1 · El PIN por miembro — hecho el 2026-08-24

El requisito de entrada de [ADR-0005](../adr/ADR-0005-reparto-de-gastos.md): sin identidad que no se
pueda suplantar, un balance de deudas no significa nada. Diseñado y razonado entero en
[ADR-0015](../adr/ADR-0015-pin-por-miembro-para-identidad-no-suplantable.md).

Lo que se movió: `members.pin_hash` (bcrypt vía `pgcrypto`), `p_pin` en `create_community` y en
`join_community`, `pin.ts` en el dominio de `community` con la validación de los cuatro dígitos, y el
campo de PIN en las dos pantallas de entrada. El rate limit de `join_attempts` que ya existía para el
`join_code` pasa a cubrir también los intentos de PIN: 10 fallos por `auth_user_id` en 15 minutos
contra 10.000 combinaciones posibles.

Lo bueno del diseño es el efecto secundario: un miembro se recupera desde otro móvil. Antes, cambiar
de teléfono significaba `username_taken` y perder el historial; ahora el mismo nombre con el PIN
correcto reasigna el `auth_user_id` a la fila que ya existía.

**Los miembros anteriores al PIN se quedan sin `pin_hash`.** `join_community` los trata como
"establece el PIN al reclamarlos": el primero que entre con ese nombre lo fija. Es una ventana de
suplantación con nombre y precio, y se aceptó a cambio de no dejar tirados a los cuatro miembros que
ya existían en «Casa Alejes».

### B.2 · El esquema de gastos — aplicado en remoto el 2026-08-24

`20260824140000_expenses_and_settlements.sql`, siguiendo el diseño de ADR-0005:

- **`expenses`**: importe en `amount_cents` entero con `check (> 0)`, moneda explícita, `description`
  obligatoria y no vacía, `item_id` opcional con `on delete set null` (borrar un artículo no borra el
  gasto que documenta), `paid_by_member_id` con `on delete restrict` (no se borra un miembro que debe
  o al que se le debe).
- **`expense_shares`**: la tabla puente, con `unique (expense_id, member_id)` para que nadie tenga
  dos cuotas del mismo gasto.
- **`settlements`**: los pagos directos entre dos miembros, con
  `check (from_member_id <> to_member_id)`.
- Índices en las ocho columnas por las que se filtra o se hace join.
- RLS en las tres tablas: leer, cualquier miembro de la comunidad; escribir y borrar, solo quien creó
  la fila (`created_by_auth_user_id = auth.uid()`). Las cuotas heredan el permiso de su gasto por
  `exists`.
- **`create_expense_with_shares`**: la RPC transaccional. Comprueba pertenencia, valida que la suma
  de las cuotas cuadra exactamente con el total (`23514` si no) y hace los dos `insert` en la misma
  transacción. Es lo que evita el gasto huérfano sin cuotas que dejarían tres llamadas desde el móvil.

Nada de totales guardados: los balances se calculan.

### B.3 · El dominio: balances y liquidación mínima

`calculate-balances.ts`, dos funciones puras con sus tests:

- `calculateBalances` acumula, por miembro, lo pagado y lo debido, y saca el neto. Las liquidaciones
  entran como un pago más de quien paga y una deuda más de quien recibe, así que la propiedad que
  comprueban los tests sigue valiendo: **la suma de todos los netos es 0**, siempre.
- `calculateMinTransfers` empareja deudores y acreedores de mayor a menor para saldar todo con el
  menor número de transferencias. No es el óptimo teórico (eso es NP-difícil) sino el voraz de
  siempre, que con cuatro personas da el mismo resultado y se lee.

`money.ts` lleva el dinero: `parseCurrencyToCents` acepta «12,34», «12.34» y «12» y rechaza el resto;
`splitEvenly` reparte el céntimo residual **ordenando los ids** antes, para que dos móviles que
dividan 10 € entre 3 obtengan exactamente el mismo reparto. Nada de flotantes en ningún punto.

### B.4 · La pantalla de gastos

`src/app/expenses.tsx` cuelga de la lista, con el botón en la cabecera de `ItemsScreen`.
`ExpensesScreen` enseña mi balance, el total gastado, las transferencias que saldarían las cuentas y
el historial de gastos y de liquidaciones. `AddExpenseModal` da de alta un gasto eligiendo quién pagó
y entre quiénes se reparte; `SettleDebtModal` registra un pago sobre una transferencia sugerida.

Los balances no se piden al servidor: `use-expense-summary.ts` los calcula con las tres queries
(miembros, gastos, liquidaciones) que ya están en caché.

### B.5 · Lo que el bloque B no tenía — cerrado el 2026-08-28

Esto no era una lista de mejoras: eran cuatro reglas duras de `CLAUDE.md` que el bloque B **no
cumplía**. Las cuatro están puestas. El detalle de cómo, en B.9.

| Regla                                                   | Cómo quedó                                                              |
| ------------------------------------------------------- | ----------------------------------------------------------------------- |
| Toda mutación con actualización optimista + rollback    | Un hook por mutación, con `cancelQueries` y rollback en `onError`.      |
| «Deshacer» tras borrar                                  | `deleting-rows-store.ts` + `visibleRows`, con el `delete` diferido 5 s. |
| Cada cliente se suscribe a Realtime de su comunidad     | `subscribe()` en el repositorio y `use-expenses-realtime.ts`.           |
| Una mutación encolable declara `mutationKey` y defaults | `expense-mutations.ts`, con el id del gasto puesto por el cliente.      |

La consecuencia práctica con dos móviles era esta: quien añadía un gasto lo veía; el otro no, hasta
que cerraba y volvía a abrir la pantalla. Y el botón se quedaba en carga esperando al servidor en vez
de responder al instante como el resto de la app.

### B.6 · El fallo de las sobrecargas — del 2026-08-24 al 2026-08-28

**Síntoma:** la app no dejaba unirse a ninguna lista. En pantalla, «No se pudo conectar con el
servidor». El código `KY8-KXJU` era válido y no había caducado, la comunidad existía con sus 28
artículos y sus cuatro miembros, y el servidor respondía.

**Causa:** `20260824130000_member_pin.sql` escribió
`create or replace function join_community(p_join_code text, p_username text, p_pin text default null)`.
Un `create or replace` que **añade un parámetro no reemplaza nada**: crea otra función con otra firma
y deja viva la de dos argumentos. Con las dos presentes, PostgREST no puede elegir y devuelve
`PGRST203` a cualquier cliente que no mande `p_pin`, que es exactamente lo que hace el APK instalado
en el móvil, anterior al PIN y sin ese campo en la pantalla. Lo mismo en `create_community`.

**Arreglo:** `20260828120000_drop_stale_rpc_overloads.sql` borra las dos sobrecargas de dos
argumentos. La de tres, con su `default null`, ya resuelve las llamadas de dos. Comprobado contra el
servidor con la publishable key: `invalid_join_code`, `invalid_pin` y `ok` vuelven a responder sin
mandar `p_pin`. **El APK antiguo vuelve a funcionar sin reinstalar nada.**

**Lo que no falló y aun así costó cuatro días.** Tres cosas taparon el diagnóstico y las tres están
arregladas:

1. **El mensaje mentía.** Trece sitios de la app aplanaban cualquier fallo que no fuera
   `OfflineError` en «no se pudo conectar con el servidor». Un error de esquema salía como un problema
   de cobertura. Rediseñado en
   [ADR-0016](../adr/ADR-0016-clasificacion-de-errores-y-mensaje-al-usuario.md): ahora `data/` lanza
   `ServerError` con operación, detalle y código, y `presentation/` clasifica en cinco tipos y enseña
   el código entre paréntesis.
2. **`npm run test:realtime` llevaba roto desde el mismo día** y nadie lo miró: su `create_community`
   de dos argumentos se comía el mismo `PGRST203`. Ahora manda `p_pin` y vuelve a dar 12/12. Un
   script de comprobación que falla y no bloquea nada no comprueba nada.
3. **Ningún test cubría la llamada de dos argumentos.** `npm run test:rls` pasaba en verde porque
   todas sus llamadas mandaban PIN, igual que la app nueva. Añadidas dos comprobaciones que llaman a
   `create_community` y a `join_community` **sin `p_pin`** y exigen que resuelvan: son las dos que
   habrían cantado el 24. El script pasa de 35 a 37.

**La regla que sale de aquí:** una migración que añade un parámetro a una función expuesta por
PostgREST lleva el `drop function` de la firma anterior en la misma migración. Anotado en la skill
`supabase-data`.

**Y un rastro que hay que limpiar a mano.** Diagnosticar esto dejó un miembro `DiagTest` con PIN 1234
en «Casa Alejes». `members` no tiene política de `delete` a propósito, así que se borra desde el panel
de Supabase. También quedaron tres o cuatro usuarios anónimos huérfanos:
`npm run users -- --delete-orphans`.

### B.7 · Limpieza que vino con el arreglo

Con `db.types.ts` regenerado, el repositorio de gastos pierde los siete `(supabase.from as any)` y
`(supabase.rpc as any)` que llevaba dentro. Estaban ahí porque los tipos generados eran anteriores al
esquema de gastos; ya no hacen falta y ahora el compilador vuelve a mirar esas consultas.

Queda **un** cast, y es la tercera aparición de la trampa de siempre: `gen types` declara
`p_item_id: string` en `create_expense_with_shares` cuando la columna es nullable, así que pasar
`null` (que es lo correcto para un gasto sin artículo) no compila. Se resuelve en el sitio,
`(input.itemId ?? null) as unknown as string`, y no tocando el fichero generado, que se sobreescribe
en cada `gen types`. El `?? null` **no es decorativo**: sin él el argumento viaja como `undefined`,
`JSON.stringify` lo borra del cuerpo y PostgREST ya no encuentra la función. Lo cazó un test que
comprobaba el cuerpo de la llamada.

También desaparece el `as any` de `router.push('/expenses')`: estaba porque `.expo/types/router.d.ts`
era del día 24 a las 13:18 y la ruta se creó a las 13:32. Lo regenera el dev server, no
`expo export`, así que basta arrancar `npx expo start` una vez.

### B.8 · Cómo probar el arreglo

En el PC, todo en verde: `npm run lint`, `npm run typecheck`, `npm test` (304 en 40 suites),
`npm run test:rls` (37/37) y `npm run test:realtime` (12/12).

En el móvil, **con el APK que ya está instalado, sin reinstalar nada**:

1. **Unirse con el código de siempre.** Landing → «Unirme a una lista», código `KY8-KXJU`, nombre y
   PIN. Entra en «Casa Alejes» con sus artículos. Esto es lo que llevaba cuatro días fallando.
2. **Que el mensaje de error diga algo.** Modo avión y vuelve a intentar unirte: «No tienes conexión.
   Conéctate y vuelve a intentarlo.», sin paréntesis. Quita el modo avión, teclea un código
   inexistente: sale el error del campo, no el de conexión.
3. **Que el código de error llegue a la pantalla.** Un fallo que el servidor rechace sale como «El
   servidor ha rechazado la operación. Vuelve a intentarlo. (42501)». El número entre paréntesis es
   lo que hay que leerme si algo vuelve a fallar.
4. **Que un artículo siga añadiéndose sin red.** Modo avión, añade dos artículos, cierra la app del
   todo, quita el modo avión y ábrela: siguen ahí y se suben. La cola offline no se ha tocado, pero es
   el camino que más errores toca.
5. **Los gastos.** Botón de gastos en la cabecera de la lista, añade un gasto y una liquidación.
   Cuando se escribió esto el otro móvil no lo veía hasta reabrir la pantalla; desde B.9 sí. El guion
   completo de gastos con dos móviles está en B.10.

### B.9 · Gastos al nivel de la lista — 2026-08-28

Cierra B.5. Las cuatro reglas que el bloque B incumplía están puestas, y la pantalla de gastos se
comporta como la de artículos: responde al instante, se puede deshacer, se entera de lo que hacen
los demás y no pierde nada sin cobertura.

#### Mutaciones optimistas

Las cuatro mutaciones viven ahora en hooks propios (`use-create-expense.ts`,
`use-create-settlement.ts`, `use-delete-expense.ts`, `use-delete-settlement.ts`) con el patrón de
siempre: `cancelQueries` → `getQueryData` → `setQueryData` → rollback en `onError` →
`invalidateQueries` en `onSuccess`, nunca en `onSettled`.

El gasto optimista se construye entero en `onMutate`, con sus cuotas y con `createdByAuthUserId`
sacado del store de sesión, porque `use-expense-summary.ts` calcula los balances con lo que hay en
caché: un gasto a medio construir daría un balance falso durante el segundo que tarda el servidor.

Los dos modales dejan de esperar. `AddExpenseModal` y `SettleDebtModal` llaman a `mutate`, cierran y
avisan; ya no tienen `isPending` ni `confirmDisabled`, y su `useErrorSnackbar` se fue al hook, que es
quien sabe si hubo que revertir.

#### Deshacer al borrar

Mismo mecanismo que en artículos, con la misma pieza en dos sitios: `deleting-rows-store.ts` marca
el id, `visible-rows.ts` lo esconde en el `select` de la consulta y `clearDeleting` va en
`onSettled`. La fila **no se quita de la caché**: la caché refleja al servidor y el servidor todavía
la tiene, así que quitarla haría que reapareciese sola en el siguiente evento de Realtime.

El `delete` real se difiere 5 s (`deleteUndoWindowMs`). Si el usuario deshace, el servidor no se
entera de nada. Vale igual para gastos y para liquidaciones.

`visibleRows` es genérico (`<T extends { id: string }>`) y vive en `domain/` porque lo usan las dos
consultas y es una función pura con sus tests.

#### Realtime

`ExpenseRepository` gana `subscribe(communityId, { onChange, onStatus })`, que devuelve la función de
baja. Es el único método del repositorio sin `assertOnline()`, por lo de siempre: un canal reconecta
solo y ya avisa por `onStatus`.

`use-expenses-realtime.ts` es copia fiel del de artículos, con sus dos temporizadores
(`eventCoalesceMs = 300`, `subscribeSettleMs = 1500`), sin invalidar mientras
`queryClient.isMutating() > 0`, y con `useAppForeground` para refrescar al volver de segundo plano.
Invalida las dos claves, `expenses` y `settlements`.

**`expense_shares` se queda fuera del canal, a propósito.** No tiene `community_id`, así que su
suscripción no se podría filtrar con `community_id=eq.<id>` y recibiría los borrados de todas las
comunidades. Las cuotas se escriben en la misma transacción que su gasto y se borran en cascada con
él, así que el evento de `expenses` ya las cubre. La alternativa era denormalizar `community_id` en
`expense_shares`: una columna más que mantener y un índice más, a cambio de cero eventos nuevos.

`20260828140000_expenses_realtime.sql` mete `expenses` y `settlements` en la publicación
`supabase_realtime` y les pone `replica identity full`. Lo segundo no es opcional: sin la fila
completa, un `DELETE` no lleva `community_id` y el filtro del canal lo descarta, así que el otro
móvil vería aparecer gastos pero no desaparecerlos.

#### Cola offline y el id que pone el cliente

`expense-mutations.ts` registra las cuatro claves con `setMutationDefaults` (ADR-0009) y
`_layout.tsx` lo llama junto al de artículos, antes de rehidratar. Las `variables` llevan el
`communityId` porque la función que se rehidrata no tiene closure donde mirarlo.

Y con eso llega ADR-0010: **el id del gasto y el de la liquidación los genera el cliente** con
`randomUuid()`, en la llamada a `mutate`, no en `onMutate`. `onMutate` corre otra vez al reanudar una
mutación pausada; un id generado ahí sería distinto al que se pintó, y el gasto que el usuario ve no
sería el que se guarda.

Eso obliga a que el alta sea idempotente, y ahí entra la migración
`20260828150000_create_expense_with_shares_client_id.sql`:

- `p_expense_id uuid default null` **al final** de la firma, y el `drop function` de la firma de seis
  argumentos en la misma migración (la regla de B.6).
- `values (coalesce(p_expense_id, gen_random_uuid()), ...) on conflict (id) do nothing returning id`,
  y si no devuelve nada es que ya estaba: se devuelve `p_expense_id` y no se insertan las cuotas otra
  vez.
- El `default null` es lo que mantiene vivo al APK ya instalado, que llama sin ese argumento. Hay un
  check de `test:rls` que lo comprueba en cada ejecución, con ese nombre, para que no se rompa por
  descuido.

La liquidación no necesitó migración: es un `insert` normal y su idempotencia se resuelve tragándose
el `23505` en el adaptador.

`createExpense` y `createSettlement` pasan a devolver `void` y **no releen después de escribir**. La
versión anterior hacía un `select` detrás del `insert` para devolver la fila; si ese segundo viaje
fallaba, el `onError` revertía la UI de un gasto que se había guardado perfectamente.

#### Lo que hay que saber antes de tocar esto

- **`scope: { id: 'expenses' }` en las cuatro mutaciones.** Serializa la cola de gastos, que es lo
  que hace falta para que un borrado no adelante a su alta. Es correcto **mientras `itemId` sea
  siempre `null`**, que es lo que hace hoy la pantalla. El día que se abra `AddExpenseModal` desde un
  artículo creado sin conexión, ese gasto puede salir de la cola antes que el artículo del que
  depende y romper la FK: ahí hay que unificar el scope con el de artículos.
- **La X de borrar sale en todas las filas y solo el que creó el gasto puede borrarlo.** La RLS es la
  correcta; la pantalla es la que miente. Con el borrado optimista puesto se nota más que antes: el
  gasto ajeno desaparece, y a los cinco segundos vuelve con un snackbar «(42501)». Deuda anotada, no
  arreglada en esta tanda: pide decidir si el borrado ajeno se esconde o se permite, y eso es una
  regla de producto, no un bug.
- **`RealtimeStatus` se mudó a `src/shared/ui/`.** Estaba dentro de `items/presentation/components/`
  y ahora lo usan dos pantallas. Su tipo `ItemsChannelStatus` se sustituyó por un `ChannelStatus`
  local, porque un componente de `shared/ui` no importa de una feature.

#### Deuda de estilo saldada

Fuera los comentarios en castellano y el JSDoc de `calculate-balances.ts`, `money.ts`, el repositorio
y los `{/* Header */}` del JSX, que era lo que quedaba pendiente de la última entrada de «Decisiones
sobre la marcha».

#### Cómo se probó en el PC

`npm run lint` y `npm run typecheck` limpios. `npm test`: **327 tests en 43 suites** (venía de
304 en 40). `npx expo export --platform android` compila.

Tests nuevos: `create-expense.test.ts` y `visible-rows.test.ts` en `domain/`,
`expense-mutations.test.ts` en `presentation/` (rehidrata una mutación pausada y comprueba que llega
al repositorio con el mismo id), y el del repositorio reescrito para el contrato nuevo, con los
filtros del canal y la traducción de estados dentro.

`npm run test:rls` pasa de 37 a **39/39**: se añaden «El gasto se guarda con el id que genera el
cliente» y «Reenviar el mismo gasto no lo duplica ni duplica sus cuotas» (dos llamadas idénticas a la
RPC dejan una fila y una cuota).

`npm run test:realtime` pasa de 12 a **15/15**: un gasto y una liquidación llegan al canal de su
comunidad, y el canal de la comunidad B no recibe nada de la A.

Un aviso sobre ese último: la primera ejecución dio 14/15, y el que falló fue el check **viejo** de
artículos («Llega el alta con su `community_id`»), no ninguno de los tres nuevos. Es una carrera del
propio script, que espera un rato fijo por el evento. La ejecución siguiente dio 15/15. Si vuelve a
salir, se repite antes de buscar la causa en el código.

### B.10 · Guion de prueba con dos móviles

La pantalla de gastos **no se había visto nunca en un Android real**. Este es el guion para darla por
buena. Hacen falta dos móviles en la misma comunidad, y da igual si están en la misma Wi-Fi.

**Preparación.** `npx expo start` (o `--tunnel` si no comparten red), los dos móviles dentro de la
misma lista con miembros distintos, y el botón de gastos en la cabecera de la lista.

1. **Un gasto aparece en los dos.** En A, añade un gasto de 12,00 € pagado por A y repartido entre
   los dos. Tiene que salir en la lista de A **antes** de que el servidor conteste (el modal se
   cierra al instante, sin botón en carga). En B tiene que aparecer solo, en un par de segundos, sin
   tocar nada y sin salir de la pantalla. Esto es lo que no funcionaba.
2. **Los balances cuadran.** Tras ese gasto, A ve «te deben 6,00 €» y B ve «debes 6,00 €», y en las
   transferencias sugeridas sale una de B a A por 6,00 €.
3. **Deshacer de verdad deshace.** En A, borra ese gasto y pulsa «Deshacer» antes de que pase el
   snackbar. El gasto vuelve en A, y en B **no se ha movido nada en ningún momento**: si en B
   parpadeó, el borrado no se estaba difiriendo.
4. **Borrar confirmado se propaga.** En A, borra el gasto y no toques el snackbar. A los cinco
   segundos desaparece en A y, poco después, en B.
5. **Una liquidación.** En B, sobre la transferencia sugerida, registra el pago. Sale al instante en
   B, aparece en A, y los balances de los dos se van a cero.
6. **Borrar ajeno falla, y se ve.** En B, toca la X de un gasto creado por A. Desaparece, y a los
   cinco segundos vuelve con «El servidor ha rechazado la operación… (42501)». Es la deuda de B.9: lo
   que hay que comprobar aquí es que **vuelve**, no que se queda borrado en la pantalla.
7. **Sin cobertura no se pierde nada.** Modo avión en A, añade dos gastos y borra uno de los que ya
   había. Todo responde al instante. **Cierra la app del todo** (deslizar en recientes, no solo
   segundo plano). Quita el modo avión y ábrela: los dos gastos suben, el borrado se ejecuta, y en B
   aparece todo. Ningún gasto duplicado: si sale uno repetido, el id lo está poniendo el servidor y
   no el cliente.
8. **La lista cacheada sigue ahí.** Modo avión y arranque en frío en A: la pantalla de gastos enseña
   lo último que se descargó, no un error. Si la comunidad es nueva y nunca se abrió con red, sale el
   aviso de que no hay nada cacheado.
9. **El aviso de canal solo sale cuando toca.** Con red, la cabecera no enseña nada: `RealtimeStatus`
   se calla cuando el canal está conectado y solo aparece a los dos segundos si sigue conectando o
   se ha caído. Si ves «Conectando…» fijo, el canal no está subiendo. En modo avión no sale ninguno
   de los dos, que es lo correcto: sin red el que informa es el banner de la cola.
10. **Accesibilidad.** Con TalkBack, recorre la pantalla entera: los importes se leen con su moneda,
    el botón de añadir gasto es alcanzable sin ver la pantalla y las X se anuncian. Ojo con esas X:
    su etiqueta es genérica («Borrar gasto»), no dice cuál, así que en una lista larga no se sabe
    sobre cuál estás. Si con TalkBack delante resulta confuso, es lo primero que hay que arreglar.

Si algo falla, lo primero que hay que leer es el código entre paréntesis del snackbar (ADR-0016) y la
versión al pie de la pantalla de lista, para asegurarse de que el móvil está corriendo este código.

---

## Tarea 2 · Estructura de ficheros — 2026-08-29

Nada de esto cambia lo que hace la app. Cambia por dónde se entra a cada cosa, que es lo que estaba
podrido: 639 imports y ni uno usaba el alias `@/` que `tsconfig.json` llevaba declarado desde la
Fase 0, 129 subían dos o más niveles con `../../`, y 17 se metían en el interior de otra feature sin
que nada lo impidiera. La carpeta decía "feature autocontenida" y el grafo de imports decía otra cosa.

E1 y E2 se hicieron el 2026-08-29 y se commitearon por separado (`ad35955`, `a50044a`). E3
(normalizar `presentation/`) salió el mismo día, en su propio incremento. E4 queda por debajo.

### E1 · Encender el alias `@/`

**Primero se comprobó que Metro lo resuelve, antes de tocar un solo import.** No es paranoia: si el
alias no llegara al bundler, el typecheck pasaría igual (TypeScript lee `paths` por su cuenta) y el
fallo no aparecería hasta que alguien abriese la app en el móvil. `@expo/cli` arranca Metro con
`isTsconfigPathsEnabled: exp.experiments?.tsconfigPaths ?? true`, y `app.json` solo declara
`typedRoutes` y `reactCompiler`, así que está encendido por defecto. Comprobado además a mano: un
import cambiado a `@/shared/ui/Button` y `npx expo export --platform android` en verde.

**La regla del codemod: se reescribe el import que sale de su módulo de primer nivel**
(`features/<x>`, `shared`, `theme`, `app`); dentro del mismo módulo se queda relativo. Son 135
imports en 58 ficheros.

Quedan 15 relativos con `../..`, y quedan a propósito. Son todos del tipo
`presentation/components/AddItemBar.tsx` → `../../domain/quantity`: cruzan de capa, pero no de
feature. Ahí el `../../` dice "subo a mi feature y bajo a su dominio", que es justo lo que pasa, y se
lee mejor que `@/features/items/domain/quantity` repetido en un fichero que ya vive dentro de
`items`. La alternativa era la regla simple por profundidad (todo `../..` al alias, 137 imports); se
descartó porque convierte un movimiento interno en una ruta absoluta y hace más ruidoso mover una
feature de sitio.

Después del codemod, `eslint --fix`: `simple-import-sort` mete `@/` en el grupo de absolutos,
separado de los relativos, y ordena solo.

**Jest no necesitó nada.** El preset de `jest-expo` ya trae
`moduleNameMapper: { '^@/(.*)$': '<rootDir>/./src/$1' }`, así que los nueve
`jest.mock('../../../../shared/lib/supabase')` siguen resolviendo con el alias. El riesgo aquí era el
contrario y conviene dejarlo escrito: **añadir un `moduleNameMapper` propio en `jest.config.js` pisa
el del preset entero**, incluidos los de `react-native-vector-icons`. No se añadió.

**Dos scripts sí importan de `src/`**, contra lo que se suponía al planificar:
`scripts/catalog-ingest.mjs` y `scripts/catalog-source-benchmark.mjs` cargan
`../src/features/catalog/domain/normalized-name.ts` con `--experimental-strip-types`, y **Node ahí no
resuelve los `paths` de tsconfig**. Salió bien porque `normalized-name.ts` no importa nada y el
codemod no lo tocó, pero es una mina: el día que ese fichero, o cualquier otro que consuma un script,
necesite un import, tiene que ser relativo o el script revienta. `test:rls` y `test:realtime` sí son
independientes de `src/`, como se pensaba.

### E2 · Una puerta por feature

Cada feature tiene ahora un `index.ts` con lo que el resto puede usar, y una regla de ESLint que
prohíbe entrar por otro sitio. Referencia: la Public API de
[Feature-Sliced Design](https://feature-sliced.design/docs/reference/public-api).

La superficie real resultó pequeña, 19 símbolos:

| Feature     | Expone                                                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog`   | `CatalogProduct`, `CatalogProductsById`, `CatalogSuggestions`, `useCatalogProducts`                                                                                                                |
| `community` | `Community`, `CommunityMember`, `CreateCommunityScreen`, `JoinCommunityScreen`, `JoinCodeCard`, `ViewersLine`, `useActiveCommunityStore`, `useActiveCommunityHydrated`, `useCommunityMembers`, `useViewers` |
| `expenses`  | `ExpensesScreen`, `registerExpenseMutationDefaults`                                                                                                                                               |
| `items`     | `ItemsScreen`, `registerItemMutationDefaults`                                                                                                                                                     |
| `session`   | `SessionGate`, `useSessionStore`                                                                                                                                                                  |

Pasaron por la puerta 25 imports: los 17 cruzados y **los 8 de `src/app`**. Meter las rutas en la
regla no era opcional: `src/app` importa pantallas de cuatro features, así que dejarlo fuera abre un
agujero por el que cabe la app entera.

**La trampa de flat config, que es lo que hay que recordar de este incremento.** En la configuración
plana de ESLint, cuando dos bloques casan con el mismo fichero, **el último gana la regla entera; no
se fusionan**. Añadir un bloque suelto de `no-restricted-imports` para `src/features/**` habría
apagado en silencio la regla de pureza de `domain/` (react, react-native, Supabase) y la de
`react-native-paper` en los `.tsx`. Y el lint habría seguido en verde, que es la peor forma de perder
una regla.

Así que en vez de un bloque nuevo, `eslint.config.js` **genera los bloques con un bucle**, uno por
feature y capa, y cada uno repite los patrones que le tocan:

- `features/<f>/domain/**/*.ts` → pureza de dominio **+** internos de las otras cuatro
- `features/<f>/**/*.ts`, con `ignores` de `domain/` → internos de las otras cuatro
- `features/<f>/**/*.tsx` → Paper **+** internos de las otras cuatro
- `app`, `shared` y `theme` → internos de las cinco, con Paper donde ya aplicaba y respetando las
  exenciones de `shared/ui/**` y `app/_layout.tsx`

Los tres conjuntos de cada feature son disjuntos (`**/*.ts` con `ignores` de `domain`,
`domain/**/*.ts`, `**/*.tsx`), así que ninguno pisa a otro.

**Segunda trampa, encontrada probando y no leyendo.** Los patrones de `no-restricted-imports` casan
contra **la cadena literal del import, no contra la ruta resuelta**. El primer intento usaba
`**/features/<f>/presentation/**` y dejaba pasar limpiamente un
`../../community/presentation/use-viewers` escrito a mano, que es justo el caso que la regla existe
para impedir. El patrón bueno es `**/<f>/presentation/**`, sin el `features/`, que caza las dos
formas. Se descubrió porque la sonda de esa forma relativa no dio error; sin probarla, la regla
habría quedado con el agujero puesto.

**Cómo se comprobó que la regla muerde.** Nueve ficheros sonda, seis que deben fallar y tres que no:
import al interior de otra feature por alias y por ruta relativa, `src/app` entrando a una pantalla,
`react` en `domain/`, Paper en un `.tsx` de feature y Paper en `src/app`; y del otro lado, import al
interior de la _propia_ feature, Paper dentro de `shared/ui` y un import por la puerta. Salieron 6
errores y 3 silencios. Las sondas se borraron después.

### Cómo quedaron E1 y E2

|                                        | Antes | Ahora                                        |
| -------------------------------------- | ----- | -------------------------------------------- |
| Imports con `@/`                       | 0     | 131                                          |
| Imports que suben 3 o 4 niveles        | 102   | 0                                            |
| Imports que suben 2 o más              | 129   | 15, todos de capa dentro de su propia feature |
| Imports al interior de otra feature    | 17    | 0                                            |

Verificado con `npm run lint`, `npm run typecheck`, `npm test` (43 suites, 327 tests),
`npx expo export --platform android`, `npm run test:rls` (39/39) y `npm run test:realtime` (15/15).

Para comprobar a mano que la puerta sigue cerrada, sin arrancar nada: escribe en cualquier fichero de
`items` un `import { useViewers } from '@/features/community/presentation/use-viewers'` y corre
`npm run lint`. Tiene que dar `no-restricted-imports`. Si no lo da, alguien ha añadido un bloque
después en `eslint.config.js` y se ha llevado la regla por delante.

Dos cosas que **no** cambiaron y conviene no confundir con esto:

- `npx prettier --check "src/**"` sigue marcando 64 ficheros, los mismos antes y después. Es el
  artefacto de finales de línea de siempre (`core.autocrlf=true`), y Prettier no está en
  `npm run lint`.
- `npm run catalog:ingest -- --dry-run` falla con `not a git repository`. Es un clon corrupto en
  `%TEMP%\catalog-ingest`, comprobado fallando igual en el árbol limpio. Se arregla con `--fresh`,
  confirmado al verificar E3: con el flag vuelve a leer las 4.979 filas.

### E3 · Normalizar `presentation/`

Las cinco features tenían `presentation/` con cinco formas distintas: 47 ficheros sueltos en la raíz,
`components/` solo en dos de ellas, y ninguna manera de saber dónde estaba el store de una feature sin
listar la carpeta. Ahora hay cinco carpetas posibles —`screens`, `components`, `hooks`, `stores`,
`mutations`— y **en la raíz de `presentation/` no queda ningún fichero suelto en ninguna feature**.

| Feature     | Carpetas                                                             |
| ----------- | -------------------------------------------------------------------- |
| `catalog`   | `components` (2) · `hooks` (2)                                       |
| `community` | `screens` (2) · `components` (2) · `hooks` (7) · `stores` (1)        |
| `expenses`  | `screens` (1) · `components` (6) · `hooks` (8) · `stores` (1) · `mutations` (1 + test) |
| `items`     | `screens` (1) · `components` (5) · `hooks` (8) · `stores` (1) · `mutations` (1 + test) |
| `session`   | `components` (1) · `hooks` (1) · `stores` (1)                        |

**Solo se crean las carpetas que tienen contenido.** La coherencia que se buscaba es "si una feature
tiene store, está en `stores/`", no "todas las features tienen las mismas carpetas". La segunda
lectura produce directorios vacíos de adorno que además git no versiona, así que la simetría ni
siquiera sobreviviría a un clon. Por eso `catalog` sale con dos carpetas y `session` con tres de un
fichero cada una, que no es lo mismo que una carpeta vacía.

Cuatro casos no encajaban en el reparto obvio y se decidieron uno a uno:

- **`item-mutations.ts` y `expense-mutations.ts` tienen carpeta propia, `mutations/`.** No son hooks:
  no llaman a React, no empiezan por `use` y no devuelven nada a un componente; meterlos en `hooks/`
  rompe lo único que hace esa carpeta escaneable de un vistazo. Y dejarlos sueltos reproducía el
  problema que E3 venía a matar. Lo que hay dentro tiene nombre propio en el repo desde
  [ADR-0009](../adr/ADR-0009-cola-de-mutaciones-offline.md): la clave de mutación, el tipo de las
  `variables` y el registro de `setMutationDefaults`. Eso es **el contrato de la cola offline**, y de
  hecho la dependencia va al revés de lo que sugeriría meterlo en `hooks/`: cuatro hooks de cada
  feature importan `itemMutationKeys` / `expenseMutationKeys` de ahí.
- **Los dos `__tests__/` bajan con el fichero que prueban**, a `mutations/__tests__/`. Es la
  convención que ya seguían `domain/__tests__/`, `data/__tests__/` y `shared/lib/__tests__/`: el test
  es hermano de su sujeto, no vive dos niveles por encima. Un `presentation/__tests__/` común habría
  obligado a decidir esto otra vez con el primer test de un hook.
- **`SessionGate.tsx` es un componente**, y va a `components/`. Recibe `{ children }`, devuelve JSX y
  no lo renderiza ninguna ruta: lo monta `_layout.tsx` envolviendo el árbol entero. En este repo
  `screens/` quiere decir *cuerpo de una ruta* —lo que un fichero de `src/app/` renderiza—, y si
  entra ahí el gate de arranque, pasa a querer decir "pantalla grande", que no distingue nada.

**Lo que costó, dicho en claro.** Los imports que cruzan de capa dentro de la propia feature bajan un
nivel más: `hooks/use-items.ts` pasa de `../domain/item` a `../../domain/item`. Los que suben dos
niveles van de 13 a 100, y aparecen los dos primeros de tres niveles, que son los `jest.mock` y los
`import` de los tests de mutaciones hacia `data/`. **Ninguno sale de su feature** —los 100 apuntan a
`domain/` (83) o `data/` (17) del propio módulo—, así que la regla de `CLAUDE.md` los deja relativos
a propósito y no hay que convertirlos al alias. E1 dejó anotado que quedaban 15 de esos "a propósito";
ahora son más y más hondos, y sigue siendo la misma decisión, no un descuido.

Los imports con `@/` no se movieron (125 antes y después): E3 no cruza ninguna frontera de módulo.

**Cómo se reescribieron los 169 imports.** No con búsqueda y reemplazo. Un script resuelve cada ruta
relativa contra el directorio **viejo** del fichero, la mapea con la tabla de renombrados que da
`git diff --cached --name-status -M`, y la recalcula desde el directorio **nuevo**. Así da igual que
el fichero se haya movido, que se haya movido su destino, o las dos cosas: los tres casos salen bien
sin enumerarlos. Después, `eslint --fix` para el orden. Los ficheros se movieron con `git mv`, así que
el historial los sigue.

Un detalle que hay que hacer bien y no avisa si se hace mal: en los tests de mutaciones, el `import` y
el `jest.mock` del repositorio son **la misma cadena** y tienen que cambiar juntos. El script los trata
igual porque su expresión regular casa las dos formas.

**La regla de ESLint sigue mordiendo con el nivel extra**, que era el riesgo real de este incremento:
los patrones son `**/<feature>/presentation/**` y `**` cruza directorios, pero eso se comprueba, no se
supone. Nueve sondas como en E2, seis que deben fallar y tres que no: import al interior de otra
feature por alias y por relativo (`../../../community/presentation/hooks/use-viewers`), `src/app`
entrando a una pantalla, `react` en `domain/`, Paper en un `.tsx` de feature y Paper en `src/app`; y
del otro lado, import dentro de la propia feature, Paper en `shared/ui` y un import por la puerta.
Salieron 6 errores y 3 silencios. Borradas después.

Verificado con `npm run lint`, `npm run typecheck`, `npm test` (43 suites, 327 tests),
`npx expo export --platform android`, `npm run test:rls` (39/39), `npm run test:realtime` (15/15) y
`npm run catalog:ingest -- --dry-run --fresh` (4.979 filas). E3 no toca `catalog/domain`, así que los
dos scripts que importan de `src/` con `--experimental-strip-types` no se ven afectados.

### E4 · `shared/` no se parte, y el árbol de `CLAUDE.md` deja de mentir

E4 entraba con una premisa que resultó ser falsa, y por eso no movió ni un fichero. La premisa era que
`shared/lib` mezclaba infraestructura (`supabase.ts`, `query-client.ts`, `db.types.ts`, `i18n/`) con
helpers casi puros (`uuid.ts`, `image.ts`, `share.ts`), y que la carpeta `utils/` que el árbol de
`CLAUDE.md` lleva dibujada desde la Fase 0 —y que nunca ha existido— era el sitio de los segundos.

Se miraron los imports de los diez ficheros antes de proponer la línea de corte:

```
uuid.ts        → expo-modules-core
image.ts       → expo-image-manipulator
share.ts       → expo-clipboard + react-native
network.ts     → @react-native-community/netinfo
build-info.ts  → expo-constants + expo-updates
supabase.ts    → @supabase/supabase-js + async-storage
query-client.ts, query-persister.ts → tanstack + netinfo + async-storage
errors.ts      → ./network
```

**No hay ni un helper puro.** Los tres candidatos son envoltorios de un módulo nativo de Expo, y
existen exactamente por eso: para ser el único sitio del código que lo toca. Es literalmente lo que
[ADR-0010](../adr/ADR-0010-id-del-articulo-generado-en-el-cliente.md) dice de `uuid.ts` — *"el único
sitio que habría que tocar si algún día desaparece"*—, que es la descripción de un adaptador, no la de
una utilidad. `uuid.ts` hace el mismo trabajo que `supabase.ts`, solo que envolviendo algo más
pequeño.

Con eso, ninguna línea de corte sobrevive: por "sin dependencias externas", `utils/` queda vacía
(`errors.ts` solo importa `./network`, que importa NetInfo); por "no importa nada de Expo ni de RN",
vacía otra vez; y por "pocas líneas" no es un criterio, es una coincidencia. Una carpeta cuyo criterio
de admisión no se puede enunciar es una carpeta que se vuelve a llenar de cualquier cosa en seis meses.

El precio de intentarlo tampoco era cero. `CLAUDE.md`, ADR-0010, ADR-0016 y seis diarios de fase citan
`src/shared/lib/*.ts` por su ruta literal. Los diarios son un registro fechado: cambiar el de
`fase-3.md` para que diga que ese día se creó `shared/utils/image.ts` falsea lo que pasó, y dejarlo
sin tocar deja una ruta que ya no existe. Se pagan si el corte compra algo; aquí no compraba nada.

Lo que sí era un problema real es que **el árbol de `CLAUDE.md` describía una carpeta inexistente**, y
eso se arregla ahí mismo: fuera `utils/`, y una línea que diga qué va en cada una de las tres que sí
hay. `lib/` con diez ficheros y una subcarpeta no es un cajón desastre; es la plomería de la app, y
todos sus ficheros tienen nombre.

E4 no toca código, así que no hay nada que verificar más allá de que la documentación sea cierta.

---

## Tarea 3 · La pantalla de gastos, rehecha — 2026-09-03

### Antes de nada: el update que la puso en el móvil

El APK instalado llevaba el JS del 2026-08-06. Todo el bloque A y todo el B estaban en el repo y
aplicados en Supabase, pero en el móvil no existían: ni catálogo, ni PIN, ni gastos, ni los códigos
de error de ADR-0016. Con el PIN ya en la base, un miembro con `pin_hash` puesto recibía
`invalid_pin` desde una app que ni siquiera pintaba el campo.

Se publicó por aire, sin recompilar, porque nada de eso toca nativo: `app.json` no se ha movido
desde que se generó el APK (misma `version` 1.2.0, misma `runtimeVersion` por política `appVersion`)
y en `package.json` solo entraron scripts. `eas update --branch preview` dejó el grupo
`1c2955a1-2d99-45f3-82eb-5956c7631ce0`, id de Android `01a0682a`, commit `9b5a03c`. Los dos móviles
enseñan `v1.2.0 · 01a0682a` al pie de la lista, que es la comprobación de que corren este código y
no el bundle del APK.

Al aplicarse el update **se vacía la caché persistida de TanStack Query**: `cacheBuster()` de
`src/shared/lib/query-persister.ts` es la versión más el `updateId`, así que cambia con cada update.
Es lo que se quiere, porque llegan estructuras de datos nuevas, pero conviene tenerlo presente antes
de dar por roto el paso 8 de B.10: el primer arranque tras un update no tiene lista cacheada porque
no puede tenerla.

### Lo que estaba mal

Con la pantalla ya en un Android real, el veredicto fue que el reparto de gastos «queda muy feo y
poco organizado» y «está inutilizable». Mirando el código, no era una impresión:

- **La cabecera se rompía sola.** `Button` de `shared/ui` era `w-full` siempre, y en una fila
  `flex-row` de React Native `flexShrink` vale 0 por defecto: el botón «+ Gasto» pedía el ancho
  entero y aplastaba el título.
- **Todo en un `ScrollView` de cuatro bloques.** Balance, deudas, historial de gastos y
  liquidaciones, uno detrás de otro, sin jerarquía y sin ningún sitio a donde ir.
- **Los balances por miembro se calculaban y se tiraban.** `useExpenseSummary` ya devolvía
  `balances` con lo que ha puesto cada uno; ninguna pantalla lo pintaba.
- **Los gastos no tenían fecha ni detalle.** Una fila no se podía abrir, y el reparto por miembro,
  que es el dato que justifica el importe, no se veía en ninguna parte.
- **El alta vivía en un diálogo de Paper.** Un formulario de cinco campos dentro de un modal, con el
  teclado encima.
- **La ✕ salía en gastos ajenos** que la RLS no deja borrar (la deuda anotada en B.9), y con un área
  táctil por debajo de los 44 pt.
- **Sin banner de sin conexión.** La lista lo tenía; gastos no.

### Las tres decisiones, y las tomó el usuario

| Pregunta                 | Elegido                                            |
| ------------------------ | -------------------------------------------------- |
| ¿Una pantalla o varias?  | **Rutas separadas** bajo `/expenses`               |
| ¿Cómo se añade un gasto? | **Pantalla completa**, fuera el diálogo            |
| ¿Dónde se borra?         | **Solo en el detalle, y solo si el gasto es tuyo** |

### Las rutas

`src/app/expenses.tsx` se convierte en carpeta. Cuatro ficheros, cada uno una línea que reexporta la
pantalla de la feature:

```
src/app/expenses/index.tsx     → ExpensesScreen       resumen
src/app/expenses/new.tsx       → NewExpenseScreen     alta a pantalla completa
src/app/expenses/history.tsx   → MovementsScreen      movimientos por día
src/app/expenses/[id].tsx      → ExpenseDetailScreen  detalle y borrado
```

No hay `_layout.tsx` dentro: cuelgan del `Stack` de la raíz, que ya va con `headerShown: false`, así
que cada pantalla dibuja su propia cabecera y el botón atrás del sistema funciona sin tocar nada.
`router.push('/expenses')` desde la lista sigue resolviendo, ahora al `index`.

**El resumen** enseña, en este orden: tu balance en grande con icono y texto (nunca solo color), las
liquidaciones recomendadas con avatar de quién paga a quién, quién ha puesto qué con el balance de
cada miembro, y los tres últimos movimientos con un botón para verlos todos. Abajo, fija, la acción
principal: «Añadir gasto». Si no hay ni un movimiento no se pinta nada de eso, solo un vacío con 🧾
que invita a apuntar el primero.

**Los movimientos** son una `SectionList` con gastos y liquidaciones mezclados y agrupados por día,
con «Hoy» y «Ayer» por nombre. Una fila de gasto se abre; una de liquidación no, porque no hay nada
más que contar de ella.

**El detalle** es el único sitio donde se borra. Enseña importe, quién pagó, fecha con hora y el
reparto miembro a miembro. Si el gasto es tuyo, botón de borrar en rojo con el deshacer de siempre;
si no lo es, una línea que dice por qué no se puede.

### El borrado ahora dice lo mismo que la RLS

La política `expenses_delete` exige `created_by_auth_user_id = auth.uid()`, y `settlements_delete`
lo mismo. La pantalla mentía: ofrecía la ✕ en todas las filas y el servidor contestaba `42501` cinco
segundos después, cuando la cola soltaba el borrado. La regla vive ahora en `domain/ownership.ts`
(`isOwnExpense` / `isOwnSettlement`), con tests, y decide dos cosas: si el detalle enseña el botón de
borrar, y si una liquidación lleva ✕ en la lista de movimientos.

Se compara contra `session.userId`, no contra `members.isSelf`. No es lo mismo: `isSelf` dice quién
eres en la comunidad y la RLS mira quién creó la fila, así que un gasto que pagó otro pero apuntaste
tú es tuyo para borrar. Y un `authUserId` vacío no es dueño de nada, que es lo que evita que un gasto
optimista creado sin sesión, con la cadena vacía por id, parezca borrable.

**Esto cierra la primera deuda de B.9.** La segunda, la de que `scope: { id: 'expenses' }` solo vale
mientras el gasto no cuelgue de un artículo creado sin conexión, sigue abierta; el alta nueva manda
`itemId` a nulo, así que no empeora.

### Dominio nuevo, con sus tests

- **`domain/movements.ts`**: `toMovements` mezcla gastos y liquidaciones en una lista ordenada de más
  nuevo a más viejo, y `groupMovementsByDay` la parte en días. Ordena por timestamp, no comparando
  las cadenas ISO: de Postgres llegan con desfase `+00:00` y las optimistas se generan con
  `toISOString()`, que acaba en `Z`, así que el orden lexicográfico se equivoca en cuanto se mezclan.
  Una fecha ilegible cae al final y se agrupa aparte en vez de reventar el orden entero.
- **`domain/ownership.ts`**: lo de arriba.
- El día se calcula en la zona horaria del móvil (`getFullYear` / `getMonth` / `getDate`) y la hora se
  formatea a mano. **Nada de `Intl` ni `toLocaleDateString`**: no había un solo uso en el repo y no
  hace falta estrenar el soporte de Hermes para pintar `03/09/2026`.

Nueve tests nuevos entre los dos ficheros, incluidos los casos de zona horaria y el de la fecha rota.

### Lo que cambió fuera de la feature

- **`Button` acepta `fullWidth`** (por defecto `true`, así que ninguna pantalla existente se mueve) y
  una variante **`danger`**: borde rojo sobre superficie, con el texto en `danger`. En claro es
  `#B91C1C` sobre `#F3F4F6`, 6,4:1, que pasa AA de sobra; en oscuro, `#F87171` sobre `#161B26`.
- **`OfflineBanner` se muda a `src/shared/ui/`**, por lo mismo que se mudó `RealtimeStatus` en B.9:
  ahora lo usan pantallas de dos features y una feature no importa del interior de otra.
- El botón de gastos de la cabecera de la lista va con `fullWidth={false}` y tamaño pequeño. El
  título largo se conserva como `accessibilityHint`.

### i18n

Veintiocho claves nuevas en los dos idiomas y tres borradas: `addExpenseModalTitle`,
`expenseHistoryTitle` y `settlementsHistoryTitle` se quedaron sin pantalla. `addExpenseButton` deja
de ser «+ Gasto» y pasa a «Añadir gasto», que es lo que dice el botón grande de abajo. El test que
compara `es.json` con `en.json` sigue en verde.

### Cómo se probó en el PC

`npm run lint` y `npm run typecheck` limpios. `npm test`: **336 tests en 45 suites**, contra los 327
en 43 de antes. `npx expo export --platform android` compila.

Aviso de siempre, que volvió a morder: tras crear ficheros en `src/app/` hay que arrancar
`npx expo start` una vez antes del typecheck, porque `.expo/types/router.d.ts` lo genera el dev
server y no `expo export`. Sin eso, `tsc` no conoce `/expenses/new` ni `/expenses/[id]` y falla con
`is not assignable to type RelativePathString`.

### Lo que esto le hace a B.10

El guion de B.10 se escribió contra la pantalla vieja, y **su paso 6 queda obsoleto en cuanto se
publique esto**: ya no hay ✕ en un gasto ajeno, así que no hay nada que ver volver. Ese paso pasa a
ser: en B, abre un gasto creado por A y comprueba que el detalle **no ofrece borrar** y enseña «Solo
quien apuntó el gasto puede borrarlo». Los otros nueve siguen valiendo, con dos matices: el gasto se
añade desde `/expenses/new`, a pantalla completa y no en un modal, y el borrado con deshacer de los
pasos 3 y 4 se hace desde el detalle, que vuelve solo al resumen al borrar.

El guion de arriba **no se ha tocado**, porque se está recorriendo ahora mismo contra el update
`01a0682a`, que todavía lleva la pantalla vieja. Cuando esa pasada termine y esto se publique, se
sustituye el paso 6.

Sobre las pantallas nuevas hay que mirar, además:

1. **Que la cabecera quepa.** El título no se parte ni se come el botón atrás, en las cuatro.
2. **El ir y venir.** Resumen → «Ver los N movimientos» → una fila → atrás → atrás, y acabas en la
   lista. El botón atrás del sistema hace lo mismo que la flecha, y entrar directo al detalle sin
   historial detrás también sale al resumen.
3. **El alta con el teclado abierto.** En `/expenses/new`, con el teclado subido, «Guardar gasto»
   tiene que seguir siendo alcanzable y la lista de miembros scrollable.
4. **Que el reparto cuadre.** Con tres miembros y 10,00 €, los importes por persona suman exactamente
   10,00 € (`splitEvenly` reparte el céntimo suelto). Desmarcar a alguien recalcula al momento.
5. **Los avatares.** Iniciales legibles, y el tuyo en color primario.
6. **TalkBack.** Cada fila de movimiento se anuncia con concepto, importe y quién pagó. Los avatares
   no se leen, que son decorativos y van ocultos al lector. En el detalle, el botón de borrar avisa
   de que hay cinco segundos para deshacer.

---

## Decisiones sobre la marcha

Aquí van las que se tomen durante la fase y no den para ADR.

**`rank-catalog-results.ts` es solo de la app, y da igual.** La regla de la skill `expo-stack` —el
fichero que comparte script y app no importa nada— tiene esta consecuencia: como el ranking importa
`./normalized-name` sin extensión, que es lo correcto para el bundler, Node no lo puede cargar con
`--experimental-strip-types`. Se descubrió al querer probar el ranking contra los datos reales desde
un script. No se toca: ningún script ordena resultados, solo la app. Si algún día hiciera falta,
la salida es la de siempre, bajarlo a `.js` con JSDoc.

**`edit-item.ts` se reformateó aunque no es de esta fase.** Era el único fichero de `src/` que
`npx prettier --check` marcaba, y lo marcaba ya en `main`, sin que nadie lo hubiera tocado: la
versión commiteada de `ItemImageChange` y `EditItemResult` no es la que produce el prettier 3.9.5
que tiene el repo instalado. Va en su propio commit, de solo formato y sin nada de A.5.3 dentro,
para que `prettier --check "src/**"` vuelva a salir en verde entero y no quede un fichero marcado a
perpetuidad. El resultado se lee peor que lo que había —prettier junta la unión en una línea
indentada en vez de dejar los `|` delante—, así que si algún día se prefiere la forma antigua, lo
que hay que cambiar es la configuración, no el fichero: volver a escribirlo a mano lo deja marcado
otra vez a la primera pasada del formateador.

**El bloque B llegó con formato y comentarios que este repo no quiere.** Al arreglar el fallo del 28
salieron tres cosas del commit del 24 que no son de esta tanda pero conviene tener anotadas:

- `npx prettier --check "src/**"` marca cuatro ficheros que ya estaban marcados en `main`:
  `community/domain/join-community.ts`, sus dos tests y `db.types.ts`. Los tres primeros son la misma
  historia que `edit-item.ts` (ver más arriba) y van en su propio commit de solo formato. El cuarto
  **no se toca nunca**: es salida cruda de `gen types` y formatearlo genera 130 líneas de ruido en cada
  regeneración.
- Cuatro ficheros de `expenses/presentation/` sí se reformatearon en esta tanda, sin ningún cambio de
  código dentro (`git diff -w` los deja vacíos): los arrastró el `prettier --write` de la pasada de
  errores.
- **El código de gastos lleva comentarios en castellano y JSDoc**, en `calculate-balances.ts`,
  `money.ts`, el repositorio y algún `{/* Header */}` en el JSX. `CLAUDE.md` los prohíbe
  explícitamente y no se pidió ninguna excepción. Se dejaron como estaban en esa tanda para no mezclar
  una limpieza de estilo con un arreglo de producción. **Quitados el 2026-08-28** al cerrar B.5.
