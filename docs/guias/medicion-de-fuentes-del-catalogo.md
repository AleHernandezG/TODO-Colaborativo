# Medir las fuentes del catálogo antes de elegir una

Plan escrito el 2026-08-06 para poder ejecutarlo tal cual más adelante. Contiene todo lo necesario
para construir el script sin volver a razonar nada: qué mide, contra qué, con qué criterio, qué saca
por pantalla y qué decisiones ya están tomadas.

Alimenta la decisión pendiente de
[ADR-0012](../adr/ADR-0012-catalogo-de-productos-de-supermercado.md), que sigue en **Propuesto**.
Los datos de partida están en
[`fuentes-de-datos-del-catalogo.md`](./fuentes-de-datos-del-catalogo.md).

## Por qué existe

El usuario eligió el 2026-08-06 no elegir todavía. Ante cuatro fuentes posibles, la respuesta fue
medir las dos que salían mejor paradas y decidir con el número delante en vez de con la intuición.

Retrasa el catálogo unos días. A cambio evita lo que de verdad cuesta caro, que es montar la
ingesta, el esquema y la pantalla de búsqueda encima de una fuente que resulte no encontrar la mitad
de lo que la gente escribe.

## Qué NO es esto

- **No abre la Fase 6.** Medir es investigación, no construcción. La Fase 6 empieza cuando haya
  fuente elegida y primera migración escrita. Hasta entonces no se crea `docs/phases/fase-6.md`.
- **No cierra la Fase 5.** Sigue pendiente el incremento 4, la pasada con TalkBack, que es prueba
  manual en el dispositivo. Esto avanza en paralelo y no la sustituye.

Se respeta así la regla de `CLAUDE.md` de no saltar de fase sin cerrar la anterior, sin dejar de
avanzar en lo que no depende de un móvil.

## La pregunta que responde

**De los artículos que la gente escribe de verdad en sus listas, ¿cuántos encuentran su producto en
cada fuente?**

Y de los que lo encuentran, cuántos traen foto y cuántos traen precio, que son las dos cosas por las
que existe RF-10.

Si la respuesta es «la mitad» en las dos, la conclusión no es elegir fuente: es que el trabajo
siguiente es la búsqueda, no la ingesta.

## El script

`scripts/catalog-source-benchmark.mjs`. Node sin dependencias nuevas, igual que el resto de
`scripts/`. Se declara en `package.json` siguiendo el patrón que ya usan `test:rls`, `test:realtime`
y `users`:

```json
"catalog:benchmark": "node --env-file=.env scripts/catalog-source-benchmark.mjs"
```

Formas de ejecutarlo:

```bash
npm run catalog:benchmark                  # nombres reales de Supabase
npm run catalog:benchmark -- --sample      # lista de respaldo, sin tocar la base
npm run catalog:benchmark -- --limit 20    # acota la muestra (por defecto 40)
npm run catalog:benchmark -- --source hf   # una sola fuente: hf | off
```

Variables de entorno, las que ya existen en `.env`:

| Variable                   | Para qué                                              |
| -------------------------- | ----------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL` | Leer los nombres de artículos reales                  |
| `SUPABASE_SECRET_KEY`      | Lo mismo. Se salta RLS, que es lo que hace falta aquí |

Sin `SUPABASE_SECRET_KEY` el script no falla: avisa y cae a `--sample`.

### De dónde salen los nombres

De la tabla `items` del proyecto real, columna `name`, que es la que usa
`supabase-item-repository.ts`. Se leen todos, se normalizan, se quitan duplicados y se cogen los
`--limit` más frecuentes.

Medir contra nombres inventados por mí no valdría nada: el punto entero es saber qué pasa con lo que
la gente escribe, con sus abreviaturas, sus faltas y sus marcas.

La lista de respaldo de `--sample` es para poder ejecutarlo sin la clave secreta o con la base
vacía. Va escrita en el propio script, unos 30 nombres del estilo de los que ya hay en la lista de
pruebas. Sirve para comprobar que el script funciona, **no para decidir**.

### Fuente A · Dataset de Mercadona en Hugging Face

```bash
git clone https://huggingface.co/datasets/datania/mercadona-catalog
```

Al scratchpad, nunca dentro del repo. Son 27,1 MB y no se commitea. Si el directorio ya existe, se
reutiliza y se avisa de la fecha del clon, porque el dataset se regenera los lunes y medir contra
una copia de hace un mes es medir otra cosa.

Estructura, comprobada el 2026-08-06:

```text
categories.json     32,7 kB
product_ids.json    56,3 kB   los ids, del orden de 4.500 a 5.000
categories/                   un fichero por categoría
products/                     un fichero por producto
```

No hay parquet ni CSV. El visor de Hugging Face ni siquiera consigue previsualizarlo porque falla al
inferir tipos. La ingesta es recorrer `products/` y aplanar, no leer una tabla.

**Los nombres exactos de los campos del JSON de producto están sin verificar.** Vienen de la API de
Mercadona y el `api.md` del repo los documenta, pero no los he mirado uno a uno. Lo primero al
implementar es volcar las claves del primer producto:

```bash
node -e "const p = require('./products/<un-id>.json'); console.log(Object.keys(p))"
```

Lo que hay que localizar ahí: nombre visible, marca si existe, formato o envase, URL de imagen y
precio. Si el precio viene como cadena con coma decimal, se pasa a **céntimos enteros**, que es la
regla de `CLAUDE.md` y de ADR-0012.

El índice se construye en memoria: un array de
`{ name, normalizedName, brand, imageUrl, priceCents }`. Con 5.000 filas no hace falta nada más
elaborado.

### Fuente B · Open Food Facts y Open Prices

Búsqueda de producto contra OFF, filtrando por España:

```text
GET https://world.openfoodfacts.org/cgi/search.pl
    ?search_terms=<consulta>
    &countries_tags=spain
    &json=1
    &page_size=20
    &fields=code,product_name,brands,quantity,image_url
```

**Su límite es de 10 consultas por minuto para búsquedas.** Es lo que manda en el tiempo total: 40
artículos son unos 4 minutos. El script espera 6 segundos entre consultas y va imprimiendo por dónde
va, para que se note que está trabajando y no colgado.

El `User-Agent` tiene que identificar quién es y cómo contactar, que es lo que pide OFF y lo que
exige ADR-0012. Decidido el 2026-08-07, va literal en el script:

```text
ListaCompraColaborativa/1.2.0 (+https://github.com/AleHernandezG/TODO-Colaborativo; aletrabajosspam@gmail.com)
```

Repo público y un correo de contacto que no es el personal del autor. Va escrito en el código, no en
`.env`: no es un secreto, es lo contrario, es una identificación que tiene que viajar con la
herramienta para que quien mire los logs de OFF sepa a quién llamar.

**No hace falta cuenta en Open Food Facts.** Comprobado el 2026-08-07: la búsqueda responde 200 sin
credencial ninguna, y la lectura de Open Prices ya se había comprobado el 2026-08-06. Solo se
necesita cuenta para **escribir** en ellos, que es aportar productos o subir precios, y esta
herramienta no escribe nada. Si algún día se aportase de vuelta, sería una decisión aparte y con su
ADR.

Para el precio, una consulta a Open Prices por cada producto encontrado, usando su código de barras:

```text
GET https://prices.openfoodfacts.org/api/v1/prices?product_code=<barcode>&size=1
```

Interesa `total` (si hay algún precio) y la fecha del más reciente. Su límite no está documentado
con claridad, así que se va conservador: una consulta por segundo.

Comprobado el 2026-08-06, para no repetirlo: `?location_osm_country=Spain&size=1` devuelve
`"total": 286432`. Hay precios de España de sobra; lo que esta medición averigua es cuántos caen
sobre los productos que nos interesan.

### Normalización

Minúsculas, sin acentos, sin signos de puntuación, espacios colapsados. Se aplica igual a lo que se
busca y a lo que devuelve cada fuente.

Se escribe **dentro del script, a propósito y de forma provisional**. ADR-0012 dice que esa función
acaba en `domain/`, compartida con el ranking del cliente. Duplicarla ahora en TypeScript para una
herramienta de medir sería trabajo tirado si gana la otra fuente. Cuando se escriba la ingesta de
verdad, se mueve.

### El criterio de coincidencia, contado dos veces

Cada artículo se cuenta con dos varas:

| Criterio     | Cuenta como encontrado si                                     |
| ------------ | ------------------------------------------------------------- |
| **Estricto** | El nombre normalizado del producto **empieza** por lo buscado |
| **Flexible** | El nombre normalizado del producto **contiene** lo buscado    |

Un solo número escondería que el resultado depende entero de lo generoso que sea el criterio, y ese
es el punto débil de toda esta medición. Con los dos, la distancia entre ellos es información: si
salen muy separados, la conclusión no es «esta fuente es mejor», es «hay que mirar los fallos a mano
antes de decidir nada».

### Qué saca por pantalla

Una tabla por fuente y la lista de los que no encontró, que es donde está lo interesante:

```text
Fuente: Mercadona (Hugging Face, clon del 2026-08-06)
  Artículos medidos          40
  Encontrados (estricto)     28   70%
  Encontrados (flexible)     34   85%
  De los encontrados:
    con imagen               34  100%
    con precio               34  100%

  Sin coincidencia: pan de pueblo, aguacate maduro, ...
```

Y al final, las dos fuentes una al lado de la otra, que es lo que se lleva a la decisión.

Los números crudos se guardan también en JSON en el scratchpad, para poder volver a mirarlos sin
repetir los cuatro minutos de espera de OFF.

## Decisiones de diseño, y por qué

**Los nombres salen de la base real, no de una lista de ejemplo.** Es lo único que hace que el
número signifique algo. Una lista escrita por mí mediría lo bien que escribo yo los nombres de
productos, no lo bien que funciona la fuente.

**Se cuenta dos veces, estricto y flexible.** Explicado arriba. Es la diferencia entre una medición
y una cifra que respalda lo que ya querías creer.

**La normalización es provisional y vive en el script.** Explicado arriba.

**Un clon del dataset, no 4.700 peticiones.** Hugging Face sirve los ficheros uno a uno, y recorrer
`products/` por HTTP serían miles de peticiones para una simple medición. Un `git clone` es una
operación y deja además constancia de la fecha de la copia.

**El script no escribe en Supabase.** Solo lee `items`. Nada de crear tablas ni de ingerir: eso es
la Fase 6 y va después de la decisión.

## Riesgos

- **El límite de OFF manda en el tiempo.** 10 consultas por minuto, 4 minutos para 40 artículos. Se
  mitiga con `--limit` y con progreso en pantalla. No se sortea acelerando: ir más rápido es
  exactamente lo que ADR-0012 dice que no se hace.
- **27 MB de clon.** Al scratchpad, fuera del repo. Si acaba dentro por error, `git status` lo canta
  antes del commit.
- **La cifra vale lo que valga el criterio de coincidencia.** Por eso los dos conteos y por eso se
  imprimen los fallos: un «no encontrado» que resulta ser un error de la vara se ve leyendo diez
  líneas.
- **El dataset se regenera los lunes.** Dos mediciones de semanas distintas no son comparables sin
  decir contra qué clon se hicieron. El script imprime la fecha del clon en la cabecera.
- **Los campos del JSON de producto están sin verificar.** Es lo primero que hay que mirar al
  implementar, y está resuelto con el volcado de claves de arriba.

## Qué se hace con el resultado

1. Los números y la lista de fallos van a
   [`fuentes-de-datos-del-catalogo.md`](./fuentes-de-datos-del-catalogo.md), bajo un apartado con su
   fecha.
2. Con eso delante, el usuario elige fuente.
3. Esa elección se escribe en un **ADR nuevo** que deja ADR-0012 en Aceptado. No se edita ADR-0012
   para cambiarle la decisión: solo su estado.
4. Entonces, y no antes, se abre `docs/phases/fase-6.md` y empieza el bloque A.

## Ya decidido, para cuando llegue la ingesta

**La ingesta se lanza con una GitHub Action programada**, decisión del usuario el 2026-08-06, no a
mano. El repo ya tiene una Action que evita la pausa del proyecto Free de Supabase, así que el
camino está andado.

Lo que eso implica y hay que tener listo el día que se escriba:

- La **secret key en los secrets del repo**, nunca en el YAML. Es la clave que se salta RLS y es la
  que la ingesta necesita, porque `catalog_products` no tiene política de escritura por diseño.
- Una **cadencia semanal** encaja con la fuente A, que se regenera los lunes. Ingerir a diario
  contra un dataset que cambia una vez por semana es gastar por gusto.
- Un **fallo de la Action tiene que verse**. Una ingesta que lleva tres semanas rota y de la que
  nadie se ha enterado es justo el escenario que ADR-0012 apunta en sus consecuencias, y es peor que
  no tener catálogo: la app estaría enseñando precios viejos con cara de nuevos.

## Lo que sigue abierto

Si el CDN de imágenes de Mercadona sirve peticiones que no vengan de su web. No se ha comprobado
porque para tener una URL hay que sacarla del dataset, y no compensa tocar nada de Mercadona antes
de que la fuente esté decidida. Con el clon delante se resuelve en un comando:

```bash
curl -sI "<url-de-imagen-del-dataset>" | head -1
```

Un 403 significa que la fuente A deja de resolver la foto y que Open Food Facts pasa de respaldo a
camino principal para las imágenes, casando por código de barras. Eso cambiaría la decisión, así que
**esta comprobación se hace en la misma sesión que la medición**, no después.
