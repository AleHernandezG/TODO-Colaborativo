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
voluntaria: alguien fotografía un ticket y lo sube. En España la cobertura es escasa y ningún
precio está ligado de forma fiable a una cadena concreta. Para lo que pide RF-10, OFF resuelve la
imagen y no resuelve el precio.

## Lo que hay publicado

Todo lo encontrado es Python. Para este proyecto son **referencia, no dependencia**: la ingesta va
a ser un script de Node en `scripts/`, como el resto de herramientas del repo. Lo que se aprovecha
de estos repos son los endpoints y la forma de las respuestas, que es justo la parte que cuesta
averiguar.

| Proyecto                                                                                                   | Cadenas                    | Qué aporta                                                                                    |
| ---------------------------------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------- |
| [datania/mercadona-catalog](https://github.com/datania/mercadona-catalog)                                  | Mercadona                  | MIT. Baja el catálogo JSON y **lo publica como dataset en Hugging Face**. Documenta la API en `api.md` |
| [DavidRCh56/Scraper_Mercadona_Dia_Carrefour](https://github.com/DavidRCh56/Scraper_Mercadona_Dia_Carrefour) | Mercadona, Carrefour, Dia  | Las tres cadenas por sus APIs públicas, salida a CSV                                          |
| [joseluam97/Supermarket-Price-Scraper](https://github.com/joseluam97/Supermarket-Price-Scraper)            | Mercadona, Carrefour, Dia  | Mismo alcance, salida a Excel                                                                 |
| [vgvr0/supermarket-mercadona-scraper](https://github.com/vgvr0/supermarket-mercadona-scraper)              | Mercadona                  | Recorre todas las categorías y subcategorías                                                  |
| [nicolaspascual/mercadona-scrapper](https://github.com/nicolaspascual/mercadona-scrapper)                   | Mercadona                  | Selenium sobre la web, no la API                                                              |
| [alfonmga/mercadona-cli](https://github.com/alfonmga/mercadona-cli)                                        | Mercadona                  | CLI no oficial                                                                                |

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

## Lo que no se va a hacer

Escribir un scraper apuntado a `tienda.mercadona.es/api` a sabiendas de que su `robots.txt` lo
desautoriza. No es un problema técnico y no lo arregla ir despacio o cambiar el User-Agent; es que
la web dice que no. Hay tres caminos arriba que dan el mismo resultado sin esa pega, así que no
hace falta discutirlo.

Si aun así se decide ir por ahí, es una decisión del proyecto y va escrita en su ADR con el riesgo
asumido, no metida de tapadillo en un script.

## Pendiente de comprobar antes de escribir código

- Cuántos productos trae el dataset de Hugging Face, con qué campos y cada cuánto se actualiza.
  La documentación no fija periodicidad, solo dice que hay GitHub Actions.
- Si las URL de imagen del dataset apuntan al CDN de Mercadona y si ese CDN sirve a peticiones que
  no vengan de su web. Si bloquea, la opción 4 deja de ser respaldo y pasa a ser la principal.
- Qué licencia lleva el dataset publicado, que no tiene por qué ser la MIT del código que lo genera.
- Cobertura real de Open Prices en España, con una consulta a su API en vez de por lo que se lee.
