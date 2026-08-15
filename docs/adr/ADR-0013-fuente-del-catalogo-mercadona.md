# ADR-0013: El catálogo se alimenta del dataset público de Mercadona

- Estado: Aceptado
- Fecha: 2026-08-07
- Cierra las tres preguntas que [ADR-0012](ADR-0012-catalogo-de-productos-de-supermercado.md) dejó
  abiertas y lo pasa a Aceptado. No sustituye nada de él: su diseño, su esquema y sus reglas siguen
  vigentes tal cual.

## Contexto

ADR-0012 dejó el catálogo enteramente diseñado pero en Propuesto, con tres cosas sin decidir: de
qué fuente salen los datos, qué supermercados y en qué orden, y si la ingesta se lanza a mano o
programada.

La primera era la única difícil, y en agosto de 2026 había cuatro candidatas plausibles. En vez de
elegir por intuición se midió: `scripts/catalog-source-benchmark.mjs` coge los nombres reales de la
tabla `items`, busca cada uno en las dos fuentes que mejor pintaban y cuenta cuántos encuentran
producto, con foto y con precio. El procedimiento está en
[`medicion-de-fuentes-del-catalogo.md`](../guias/medicion-de-fuentes-del-catalogo.md) y los
resultados en [`fuentes-de-datos-del-catalogo.md`](../guias/fuentes-de-datos-del-catalogo.md).

Ejecutado el 2026-08-07 sobre los 20 nombres distintos que había en la base:

| Fuente                           | Estricto | Flexible | Con imagen | Con precio |
| -------------------------------- | -------- | -------- | ---------- | ---------- |
| Mercadona (dataset Hugging Face) | 55%      | 60%      | **100%**   | **100%**   |
| Open Food Facts + Open Prices    | 30%      | 35%      | 71%        | **0%**     |

## Decisión

### 1. La fuente es `datania/mercadona-catalog`, el dataset publicado en Hugging Face

Es la opción 1 de ADR-0012. La ingesta clona el dataset, lo aplana y hace `upsert` en
`catalog_products`. **Ni la app ni nuestro script tocan Mercadona en ningún momento.**

Lo que decidió la medición no fue el 55% frente al 30%, que con 20 nombres podría ser ruido. Fue
que **Open Prices tiene 286.432 precios de España y ninguno cayó sobre estos productos**. Un precio
existe ahí porque alguien fotografió un ticket, y eso se concentra en lo que compra la comunidad de
Open Food Facts, no en lo que compra una casa cualquiera. Una fuente que da el 0% de la mitad de
RF-10 no es una fuente para RF-10.

Open Food Facts no se descarta como idea: sigue siendo el respaldo natural para la foto cuando
falte, casando por `barcode`, que es para lo que esa columna está en el esquema. Pero no es la
fuente principal y no aporta precio.

### 2. Un solo supermercado, y es Mercadona

Es la recomendación que ya traía ADR-0012 y no ha aparecido ningún motivo para desviarse. Cada
cadena es un adaptador que alguien tiene que arreglar cuando cambie, y el valor de la segunda es
mucho menor que el de la primera: quien usa esta app compra casi siempre en el mismo sitio.

La tabla `supermarkets` existe igualmente desde el principio, con una fila. No es sobrediseño: es
lo que hace que añadir la segunda cadena sea un `insert` en vez de una migración que reparta una
columna.

### 3. La ingesta la lanza una GitHub Action semanal

Programada, no a mano, decidido por el usuario el 2026-08-06. El repo ya tiene una Action que evita
la pausa del proyecto Free de Supabase, así que el patrón está andado.

**Semanal, los martes.** El dataset de origen se regenera los lunes; ingerir a diario contra algo
que cambia una vez por semana es gastar minutos para reescribir las mismas filas.

La clave secreta va en los secrets del repo, nunca en el YAML. Es la que necesita la ingesta, porque
`catalog_products` no tiene política de escritura por diseño.

**Un fallo de la Action tiene que verse.** Una ingesta rota tres semanas sin que nadie se entere es
peor que no tener catálogo: la app estaría enseñando precios viejos con cara de nuevos. El
`price_checked_at` que ADR-0012 ya obliga a enseñar es la red de seguridad de cara al usuario, pero
no sustituye a enterarse.

## Lo que se acepta al elegir esto

Dos cosas, dichas claramente porque son el precio de la decisión.

**Dependemos de que un tercero siga publicando.** Si `datania` abandona el proyecto, el catálogo se
congela. Se nota, porque `price_checked_at` deja de avanzar y la pantalla lo enseña. El plan B es la
opción 3 de ADR-0012, ingesta propia por las rutas que el `robots.txt` de Mercadona sí permite, que
es más trabajo pero no es un callejón sin salida.

**El dato llegó ahí por una ruta que Mercadona desautoriza.** El dataset se genera consumiendo
`tienda.mercadona.es/api`, y su `robots.txt` dice `Disallow: /api`. Nosotros no lo tocamos y eso es
real, no un tecnicismo: nuestra ingesta habla con Hugging Face. Pero la procedencia es la que es.
Elegir esto es decidir que consumir un dataset MIT publicado por un tercero es asunto del tercero.
Es lo que hace todo el mundo con los datasets públicos y es defendible, pero es una decisión tomada
a sabiendas, no un descuido.

Lo que **no** se hace, y sigue sin hacerse: escribir un scraper apuntado a esa API. Está descartado
en ADR-0012 y esta decisión no lo reabre.

## Datos verificados que sostienen esto

Todo comprobado el 2026-08-07, no supuesto:

- **El CDN de imágenes sirve peticiones externas.** `prod-mercadona.imgix.net` contesta 200 y
  `image/jpeg` sin `Referer` y con cualquier User-Agent. Era la duda que quedaba sobre la regla de
  ADR-0012 de enlazar en vez de copiar; si hubiera contestado 403, la foto habría tenido que salir
  de Open Food Facts.
- **Los campos del dataset son los que hacen falta**: `display_name`, `brand`, `packaging`, `ean`,
  `thumbnail`, `photos[0].regular` y `price_instructions.unit_price`. Mapean uno a uno contra el
  esquema de ADR-0012, así que el esquema no cambia.
- **El precio viene como cadena con punto decimal** (`"5.50"`). Se convierte a céntimos enteros en
  el script, que es la regla de `CLAUDE.md`.
- **La licencia del dataset es MIT**, declarada en el propio dataset y no solo en el código que lo
  genera. Sin obligación de atribución ni de compartir igual. Si algún día entrara Open Food Facts
  como respaldo de imagen, sus datos son ODbL y sus fotos CC-BY-SA, y entonces la pantalla lleva
  atribución. Está anotado en `CLAUDE.md` para que no se pierda.

## Alternativas consideradas

**Open Food Facts + Open Prices como fuente principal.** Es la que tiene la licencia más limpia y
ninguna pega de procedencia, y hasta la medición era la favorita del autor de la investigación. Cae
por el 0% de precio: los 286.432 precios españoles existen, pero no sobre los productos que esta
lista pide. Queda como respaldo de imagen.

**Una API comercial** tipo Pepesto. Resuelve varias cadenas con un esquema unificado y pone el
problema de cumplimiento en su tejado. Se descarta por coste recurrente en un proyecto que corre en
el plan gratuito de Supabase, y porque su cobertura (1.000 a 2.000 referencias por cadena, sesgadas
a cocina) no es mejor que la del dataset gratuito.

**Ingesta propia por las rutas permitidas.** Es la opción sin ninguna pega de procedencia y la que
da más control. Se descarta **por ahora**, no en general: es bastante más trabajo, es frágil ante un
cambio de maquetación y no hay motivo para pagarlo antes de saber si el catálogo se usa. Es el plan
B explícito si el dataset deja de publicarse.

**`Data-Market/productos-de-supermercados`.** Varias cadenas y actualización cada 12 horas, pero sin
imágenes ni códigos de barras, que es justo la mitad de RF-10. El CSV público es una muestra con los
supermercados anonimizados; el dataset entero se vende.

**Esperar a tener más nombres antes de decidir.** La muestra son 20 nombres y varios son de pruebas.
Se descarta porque la diferencia son 25 puntos y un 0% frente a un 100% en precio: no es un empate
que unas semanas más de datos vayan a resolver. La medición se repetirá cuando la beta lleve
tiempo, pero para afinar la búsqueda, no para reabrir esto.

## Consecuencias

**A favor**

- La Fase 6 puede empezar. El esquema de ADR-0012 vale sin tocar una línea.
- Foto y precio en el 100% de lo que se encuentra, que es lo que hace que RF-10 valga la pena.
- La ingesta es leer ficheros de un clon, no rascar HTML. Es la variante menos frágil de todas.

**En contra**

- Un tercero en la cadena de suministro del dato, con lo dicho arriba.
- Solo Mercadona. Quien compre en otro sitio no tiene catálogo, y para esa persona la app sigue
  funcionando exactamente como hoy.
- **El techo de acierto no lo pone la fuente, lo pone la búsqueda.** De los ocho fallos de la
  medición, tres no los encontraría ningún catálogo (`aguacate si son buenos` es una nota, `azucr`
  es una errata, `copas de vino ikea` no es del supermercado) y dos existen en Mercadona con otro
  nombre. El siguiente trabajo que mueve la aguja es el ranking de `domain/`, no añadir cadenas. Eso
  ya estaba previsto en ADR-0012 y ahora hay un número que lo respalda.
