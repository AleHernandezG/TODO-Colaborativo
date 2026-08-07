# Fuentes de datos del catálogo de productos

Investigación previa al bloque A de la Fase 6 (RF-10, [ADR-0012](../adr/ADR-0012-catalogo-de-productos-de-supermercado.md)).
Hecha el 2026-08-05 a petición del usuario, que pidió expresamente **productos de marca con precio
actual de las principales cadenas españolas**, no solo marca blanca.

Este documento es el insumo de la decisión, no la decisión. Cuando se elija fuente, va en un ADR
nuevo que deje ADR-0012 en Aceptado.

## Primero, una corrección

En la conversación describí Open Food Facts como buena en «marca blanca española» y se entendió
que solo tiene marca blanca. Es al revés: OFF es una base de datos de **productos de marca
identificados por código de barras** (Danone, Central Lechera, Pascual…), y lo que tiene de mérito
es que además haya llegado a cubrir marca blanca. Da nombre, marca, formato, foto con licencia
libre y código de barras.

Lo que OFF no da bien es el **precio**. Open Prices, del mismo proyecto, es de aportación
voluntaria: alguien fotografía un ticket y lo sube.

> Aquí este documento decía que en España la cobertura es escasa y que ningún precio está ligado de
> forma fiable a una cadena. Al consultar su API el 2026-08-06 resultó que no, en los dos puntos.
> Ver «Comprobado el 2026-08-06», más abajo.

## Lo que hay publicado

Todo lo encontrado es Python. Para este proyecto son **referencia, no dependencia**: la ingesta va
a ser un script de Node en `scripts/`, como el resto de herramientas del repo. Lo que se aprovecha
de estos repos son los endpoints y la forma de las respuestas, que es justo la parte que cuesta
averiguar.

| Proyecto                                                                                                    | Cadenas                   | Qué aporta                                                                                             |
| ----------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------ |
| [datania/mercadona-catalog](https://github.com/datania/mercadona-catalog)                                   | Mercadona                 | MIT. Baja el catálogo JSON y **lo publica como dataset en Hugging Face**. Documenta la API en `api.md` |
| [DavidRCh56/Scraper_Mercadona_Dia_Carrefour](https://github.com/DavidRCh56/Scraper_Mercadona_Dia_Carrefour) | Mercadona, Carrefour, Dia | Las tres cadenas por sus APIs públicas, salida a CSV                                                   |
| [joseluam97/Supermarket-Price-Scraper](https://github.com/joseluam97/Supermarket-Price-Scraper)             | Mercadona, Carrefour, Dia | Mismo alcance, salida a Excel                                                                          |
| [vgvr0/supermarket-mercadona-scraper](https://github.com/vgvr0/supermarket-mercadona-scraper)               | Mercadona                 | Recorre todas las categorías y subcategorías                                                           |
| [nicolaspascual/mercadona-scrapper](https://github.com/nicolaspascual/mercadona-scrapper)                   | Mercadona                 | Selenium sobre la web, no la API                                                                       |
| [alfonmga/mercadona-cli](https://github.com/alfonmga/mercadona-cli)                                         | Mercadona                 | CLI no oficial                                                                                         |

Fuera de GitHub: hay un [dataset de Mercadona en Kaggle](https://www.kaggle.com/datasets/computingvictor/mercadoan-inventory),
actores de pago en [Apify](https://apify.com/aitorsm/mercadona-product-scraper/api), y
[Pepesto](https://www.pepesto.com/supermarkets/), una API comercial que cubre 26 supermercados de
11 países con esquema unificado, con Mercadona y Carrefour España activos. Pepesto indexa del orden
de 1.000 a 2.000 referencias por cadena, centradas en ingredientes de cocina, no el catálogo
entero.

## La API de Mercadona, y el problema que tiene

Es la más agradecida de las tres: Django REST Framework, sin autenticación, JSON limpio.

```
GET https://tienda.mercadona.es/api/categories/          lista de categorías (2 niveles)
GET https://tienda.mercadona.es/api/categories/<id>/     una categoría (hasta 3 niveles)
GET https://tienda.mercadona.es/api/products/<id>/       un producto
```

Parámetros habituales: `lang` y `wh` (almacén, del tipo `vlc1` o `mad1`). El `wh` importa más de lo
que parece: **el precio depende del almacén**, así que un catálogo sin fijar almacén mezcla precios
de sitios distintos. Si esto sigue adelante, el almacén es una columna, no una suposición.

El problema es que su `robots.txt` dice esto, comprobado directamente:

```
User-agent: *
Allow: /$
Allow: /favicon.ico
Allow: /sitemap.xml
Allow: /product
Disallow: /
Disallow: /api
Disallow: /legal
```

`Disallow: /api` es explícito. Que el endpoint conteste sin pedir credenciales no lo convierte en
una invitación; el `robots.txt` es exactamente el sitio donde una web dice qué acceso automático
acepta, y ahí dice que ese no. Lo que sí permite es `/product`, las fichas de producto de la web.

Esa distinción es lo importante de toda esta investigación: **para Mercadona, el camino cómodo
(la API) es el que está desautorizado, y el camino autorizado (las fichas de producto) es el
incómodo.** Casi todos los repos de la tabla usan la API.

De las otras dos cadenas que salen en esos repos:

- **Carrefour** bloquea carrito, cuenta, pagos y las búsquedas con parámetros (`/c?q=*`,
  `/c?filter=*`), y deja abiertas las páginas de catálogo de producto.
- **Dia** es la más cerrada de las tres: bloquea `/products/` y `/search?*` directamente.

## Opciones, ordenadas por lo que costaría y lo que expone

**1. Consumir un dataset ya publicado.** `datania/mercadona-catalog` sube el catálogo a Hugging
Face y el proyecto es MIT. Nuestra ingesta se bajaría ese dataset y lo volcaría a
`catalog_products`. Ni la app ni nuestro script tocan Mercadona en ningún momento. Es lo más rápido
de montar y lo que menos expone. A cambio depende de que un tercero siga publicando, y la
antigüedad del precio pasa a ser la de su última pasada, que hay que reflejar en
`price_checked_at` en vez de poner la nuestra.

**2. Una API comercial** tipo Pepesto. Se paga y a cambio dan varias cadenas con el mismo esquema,
mantenimiento incluido y el problema de cumplimiento en su tejado. La pega es la cobertura: entre
1.000 y 2.000 referencias por cadena orientadas a cocina cubren bien una lista de la compra normal,
pero no es el catálogo entero, y es un coste recurrente en un proyecto que hoy corre en el plan
gratuito de Supabase.

**3. Ingesta propia por las rutas que el `robots.txt` permite.** Para Mercadona serían las fichas
de `/product`, no `/api`; para Carrefour, sus páginas de catálogo. Es más lento, más frágil ante
un cambio de maquetación y hay que escribir un adaptador por cadena. Es la opción con más trabajo
y la que mantiene el control.

**4. Imagen de OFF y precio de otro sitio.** Sigue siendo válida para la parte de la foto, que es
la mitad de RF-10 y la que tiene licencia limpia. Se puede combinar con cualquiera de las tres
anteriores casando productos por código de barras, que es para lo que `barcode` ya está en el
esquema propuesto.

## Recomendación

Empezar por la 1 y dejar la 4 como respaldo de imágenes. Es la que permite tener algo funcionando
esta semana sin montar un scraper ni pagar nada, y sirve para responder la pregunta que de verdad
importa antes de invertir más: **cuántos artículos de una lista real encuentran su producto**. Si
la respuesta es «la mitad», el trabajo siguiente es mejorar la búsqueda, no añadir cadenas.

Con esa medición encima de la mesa se decide si compensa la 2 o la 3.

La recomendación aguanta después de lo comprobado el 2026-08-06, con un matiz: la opción 4 sube de
categoría. Con 286.432 precios en España, Open Food Facts más Open Prices deja de ser solo el
respaldo de la foto y se convierte en una fuente completa y sin la pega de procedencia que tiene la

1. Sigue sin ser la primera recomendación porque no está medida: hay que saber cuántos productos
   distintos hay detrás de esos precios antes de apostar por ella.

Y la pega de procedencia de la 1, dicha claramente porque no estaba: **el dataset de Hugging Face
se genera consumiendo `tienda.mercadona.es/api`**, que es la ruta que su `robots.txt` desautoriza.
Nosotros no tocaríamos Mercadona en ningún momento, y eso es real, pero el dato llegó ahí por ese
camino. Elegir la 1 es decidir que consumir un dataset MIT publicado por un tercero es asunto del
tercero. Es defendible y es lo que hace todo el mundo con los datasets públicos, pero es una
decisión, no un detalle.

## Los números, medidos el 2026-08-07

Ejecutado `npm run catalog:benchmark` contra los **20 nombres distintos** que hay en la tabla
`items` del proyecto real. Procedimiento completo en
[`medicion-de-fuentes-del-catalogo.md`](./medicion-de-fuentes-del-catalogo.md).

| Fuente                           | Estricto | Flexible | Con imagen | Con precio |
| -------------------------------- | -------- | -------- | ---------- | ---------- |
| Mercadona (dataset Hugging Face) | 55%      | 60%      | **100%**   | **100%**   |
| Open Food Facts + Open Prices    | 30%      | 35%      | 71%        | **0%**     |

Gana la 1 y no está cerca. Tres cosas que los porcentajes no dicen:

**El 0% de precio de Open Prices es el resultado importante.** Sus 286.432 precios de España son
reales, pero ninguno cayó sobre los productos que esta lista pide. Un precio existe cuando alguien
ha fotografiado un ticket con ese producto, y eso se concentra en lo que la gente de OFF compra, no
en lo que compra esta casa. La opción 4 vuelve a ser lo que era: respaldo de imagen, no fuente de
precio.

**Casi la mitad de los fallos no son culpa de la fuente.** De los 8 que Mercadona no encontró, tres
no los encontraría ningún catálogo del mundo: `aguacate si son buenos` es una nota, no un producto;
`azucr` es una errata de azúcar; `copas de vino ikea` no es del supermercado. Otros dos
(`ambientador mercadona`, `detergente lavadora mercadona`) sí existen en Mercadona, pero con otro
nombre. **El techo real está bastante por encima del 60%, y lo que lo sube es la búsqueda, no
cambiar de fuente.** Era la hipótesis de la recomendación y se confirma.

**La muestra son 20 nombres.** Es lo que hay en la base, y varios son de pruebas. Sirve para decidir
entre dos fuentes que se llevan 25 puntos, no para afinar nada. Cuando la beta lleve unas semanas
con listas de verdad, esto se vuelve a correr y el número valdrá más.

### Dos cosas que aparecieron por el camino

**El endpoint clásico de búsqueda de Open Food Facts está caído a efectos prácticos.**
`cgi/search.pl` contestó **503 en 11 de 20 consultas**, y eso espaciándolas 6 segundos, muy por
debajo de su límite. Repetido a mano después: 3 de 4 fallaron. El que sí responde es el nuevo,
`https://search.openfoodfacts.org/search`, que devolvió 200 en todas. El script usa ese, con 2
segundos entre consultas y tres reintentos con espera creciente ante un 5xx. Si un día se escribe
la ingesta contra OFF, va por ahí.

**Su filtro de país no es el parámetro que parece.** `countries_tags=spain` como parámetro de query
se ignora en silencio: devuelve exactamente lo mismo que sin filtro (1.527 resultados para «leche»).
Lo que funciona es meterlo en la consulta, `q=leche AND countries_tags:"en:spain"`, que baja a 238.
Un filtro que no filtra y no avisa es peor que uno que da error, así que queda escrito.

## Lo que no se va a hacer

Escribir un scraper apuntado a `tienda.mercadona.es/api` a sabiendas de que su `robots.txt` lo
desautoriza. No es un problema técnico y no lo arregla ir despacio o cambiar el User-Agent; es que
la web dice que no. Hay tres caminos arriba que dan el mismo resultado sin esa pega, así que no
hace falta discutirlo.

Si aun así se decide ir por ahí, es una decisión del proyecto y va escrita en su ADR con el riesgo
asumido, no metida de tapadillo en un script.

## Comprobado el 2026-08-06

Las cuatro dudas de la investigación inicial, resueltas consultando las fuentes en vez de leyendo
sobre ellas. Dos respuestas contradicen lo que este mismo documento decía el día anterior.

### El dataset de Hugging Face

Vive en [`datania/mercadona-catalog`](https://huggingface.co/datasets/datania/mercadona-catalog).
Declara **licencia MIT en el propio dataset**, no solo en el código que lo genera, que era la duda.
Pesa 27,1 MB, ronda las 1.400 descargas al mes y **se regenera los lunes** con una GitHub Action.
Incluye precio, descripción e imágenes.

Lo que no esperábamos: **son JSON en crudo, no hay parquet ni CSV**. En la raíz hay
`categories.json` (32,7 kB) y `product_ids.json` (56,3 kB), y el grueso está en dos carpetas,
`categories/` y `products/`, con un fichero por elemento. Por el tamaño de `product_ids.json` salen
del orden de 4.500 a 5.000 productos, que cuadra con el «un supermercado pasa de 4.000» de
[ADR-0012](../adr/ADR-0012-catalogo-de-productos-de-supermercado.md).

Para la ingesta esto importa: no es leer una tabla, es recorrer un árbol de ficheros y aplanarlo.
El visor de datasets de Hugging Face ni siquiera consigue previsualizarlo, falla al inferir tipos.
Sigue siendo trabajo de una tarde, pero no es «bajar un CSV».

### Open Prices en España: la cobertura no es escasa

Aquí me equivoqué. El documento decía «en España la cobertura es escasa», escrito por lo leído.
Consultando su API el 2026-08-06:

```
GET https://prices.openfoodfacts.org/api/v1/prices?location_osm_country=Spain&size=1
→ "total": 286432
```

**286.432 precios en España.** Y cada precio trae `location_osm_id` con su objeto `location`, así
que sí está ligado a una tienda concreta de OpenStreetMap, que normalmente lleva marca. La otra
afirmación del documento, que ningún precio está ligado de forma fiable a una cadena, también hay
que ponerla en cuarentena.

Lo que sigue sin saberse, y es lo que decide si sirve: **cuántos productos distintos** hay detrás de
esos precios y qué antigüedad tienen. 286.432 precios pueden ser 40.000 productos o 3.000 productos
comprados muchas veces. Es una consulta más a su API y se hace cuando se elija esta vía.

### El CDN de imágenes: cerrado el 2026-08-07

Era lo único que quedaba abierto. **Sirve peticiones externas sin poner pegas.** Con una URL del
dataset delante:

```
status:200  tipo:image/jpeg  bytes:7471
```

Contesta igual con nuestro User-Agent que sin ninguno, y no pide `Referer`. Las URLs son de
`prod-mercadona.imgix.net`, un imgix con los parámetros de recorte en la query
(`?fit=crop&h=300&w=300`), así que el tamaño se pide, no se descarga entero.

Que conteste 200 no cambia la discusión de `robots.txt` de más arriba: eso iba de `tienda.mercadona.es/api`,
que es otro dominio y otra cosa. Aquí solo estamos enlazando una imagen desde su CDN, que es lo que
[ADR-0012](../adr/ADR-0012-catalogo-de-productos-de-supermercado.md) ya dice que se hace y sin
guardar copia.

## Qué cuesta esto, comprobado el 2026-08-07

Nada, en dinero. Ninguna de las piezas tiene plan de pago ni pide tarjeta ni clave de API:

| Pieza                   | Coste                                                       |
| ----------------------- | ----------------------------------------------------------- |
| Open Food Facts         | Gratis, sin cuenta. La búsqueda contesta 200 sin credencial |
| Open Prices             | Gratis, sin cuenta, para leer                               |
| Dataset de Hugging Face | Gratis, descarga pública                                    |
| GitHub Actions          | Gratis: minutos ilimitados en repos públicos, y este lo es  |
| Supabase                | El plan Free que ya usa el proyecto                         |

Cuenta solo hace falta para **escribir** en Open Food Facts o en Open Prices, que es aportar
productos o subir precios. Nada de eso está en el alcance.

### Lo que sí tiene condiciones, y no es el precio

La base de datos de Open Food Facts es **ODbL 1.0**, y el contenido individual de cada registro va
bajo Database Contents License; las fotos son CC-BY-SA. Confirmado el 2026-08-07 en sus términos de
uso. Gratis no es lo mismo que sin ataduras, y ODbL trae dos:

- **Atribución.** Si la app enseña datos de OFF, tiene que decir de dónde salen. Es una línea en la
  ficha de producto, no un problema, pero hay que acordarse de ponerla.
- **Compartir igual.** Una base de datos derivada de la suya se publica bajo ODbL si se distribuye.
  Lo que distribuimos es una app que consulta nuestra copia, no la copia; ahí ODbL no obliga a
  publicar nada. Si algún día se ofreciera la tabla del catálogo como export o API, sí.

El dataset de Mercadona es MIT, que no pide nada de esto. Su problema no es la licencia sino la
procedencia, contada arriba: se genera consumiendo la ruta que su `robots.txt` no permite.

**Esto no cambia la recomendación, pero sí entra en el ADR.** Elegir Open Food Facts es aceptar
poner atribución; elegir Mercadona es aceptar la procedencia. Las dos decisiones tienen un coste y
ninguno es económico.

## Una fuente más, evaluada y descartada

[`Data-Market/productos-de-supermercados`](https://github.com/Data-Market/productos-de-supermercados)
apareció buscando lo anterior y encaja de entrada: varios supermercados españoles, actualizado cada
12 horas, del orden de 50.000 registros diarios. Se descarta por dos motivos, y el primero basta:
**no trae imágenes ni códigos de barras**, que es justo la mitad de RF-10. Y el CSV de GitHub es
solo una muestra con los supermercados anonimizados como hashes; el dataset entero se vende.
