# ADR-0012: Catálogo de productos de supermercado para imagen y precio de referencia

- Estado: **Propuesto**. Falta una decisión que es del usuario (ver «Qué falta por decidir»).
- Fecha: 2026-08-05
- Da soporte a RF-4 (imagen del artículo) y prepara RF-9 / Fase 6, sin sustituir a
  [ADR-0005](ADR-0005-reparto-de-gastos.md).

## Contexto

Hoy, poner imagen a un artículo significa hacerle una foto o buscarla en la galería. Sobre el
papel cumple RF-4; en la práctica nadie fotografía un brick de leche. La función existe y casi no
se usa, porque el coste de usarla es más alto que lo que aporta.

Lo que hace falta es lo contrario: escribir «leche», elegir el supermercado y que salga la foto ya
hecha. Y aprovechando que hay que ir a buscar la foto, traerse el precio, porque el otro punto
donde esta app va a pedirle al usuario que teclee mucho es la Fase 6. Registrar un gasto artículo
por artículo con el importe a mano es tedioso, y es justo lo que hace que la gente deje de usar un
Tricount a los tres días.

El precio tiene una trampa evidente: cambia, y encima cambia por oferta, por tienda y por semana.
Un precio traído de fuera no puede convertirse solo en una deuda entre dos personas.

## Decisión

Un catálogo propio de productos, alimentado por un script fuera de la app, del que la app lee
imagen y precio de referencia. Cuatro piezas.

### 1. El catálogo es una tabla nuestra; la app nunca habla con el supermercado

Un script de `scripts/` rellena `catalog_products` en Supabase. La app solo lee esa tabla.

Eso es lo que significa «en local» aquí: local **a nosotros**, no dentro del APK. Tres motivos:
el ritmo de peticiones contra una web ajena lo marca un proceso que controlamos, no cuarenta
móviles con IP doméstica; un cambio en el HTML de origen rompe una tarea nocturna, no la pantalla
de añadir artículo; y si hay que apagar una fuente, se apaga en un sitio y sin publicar una
versión nueva de la app.

### 2. Las imágenes se referencian, no se copian

`catalog_products.image_url` apunta al CDN de origen. **No guardamos copias en nuestro Storage.**
Guardar la URL es enlazar; guardar el fichero es redistribuir la obra de otro, que es una línea
que este proyecto no tiene ninguna necesidad de cruzar.

El coste es real y hay que asumirlo: un enlace se puede romper, y algunos CDN bloquean peticiones
que no vienen de su web. Cuando la imagen no cargue, la tarjeta cae al hueco de siempre y el
usuario tiene el camino que ya existe, hacer la foto. Que el atajo falle no puede dejar sin imagen
a nadie.

En `items`, el origen de la imagen se sabe por una columna nueva:

```
items.catalog_product_id uuid references catalog_products(id) on delete set null
```

Si está a `null`, `image_url` es una ruta de nuestro bucket privado y hay que firmarla, que es lo
que pasa hoy. Si tiene valor, `image_url` es una URL pública y se usa tal cual. Una sola columna
resuelve dos cosas: de dónde sale la foto y de qué producto es el precio. Deducirlo mirando si la
cadena empieza por `https://` funcionaría hasta el día que cambie el formato de las rutas de
Storage.

### 3. El precio es de referencia, lleva fecha y lo confirma una persona

```
price_cents        int      -- enteros de céntimos, regla de ADR-0005
currency           char(3)  -- explícita, no supuesta
price_checked_at   timestamptz
```

La app **nunca** convierte un precio de referencia en un gasto por su cuenta. Lo prerrellena y el
usuario confirma o corrige, que es exactamente lo que pidió quien encargó esto. Y la pantalla
enseña la antigüedad («Mercadona · visto hace 3 días»), porque un precio sin fecha es una
afirmación que se vuelve falsa sola y el usuario no tiene forma de saber cuándo.

El precio **no se copia a `items`**. El precio de referencia pertenece al catálogo y cambia con él;
lo que se congela es lo que alguien pagó de verdad, que es un hecho histórico y vive en el gasto de
la Fase 6. Una copia en `items` sería el dato denormalizado que hay que mantener a mano que
`CLAUDE.md` prohíbe, y encima uno que envejece mal.

### 4. La búsqueda: filtro grueso en Postgres, orden en `domain/`

Una RPC `search_catalog(p_query, p_supermarket_id, p_limit)` con `pg_trgm` devuelve unos 50
candidatos. El orden que acaba viendo el usuario (coincidencia exacta primero, luego la que empieza
por lo escrito, luego marca, luego similitud) es una función pura de `domain/` con sus tests.

Ni todo en el cliente ni todo en SQL, y por motivos distintos. Bajarse el catálogo entero para
buscar en local suena bien hasta que se cuentan las filas: un solo supermercado pasa de 4.000 y
PostgREST corta en 1.000, así que serían varias páginas en cada arranque para ahorrar una petición
de 20 filas. Y dejar el ranking en SQL choca con la regla de que la lógica de negocio vive en
`domain/`: el orden de resultados es lo que se va a tocar el día que alguien busque «leche» y le
salga primero un cacao, y eso se itera con Jest en segundos, no escribiendo una migración.

El texto por el que se busca se normaliza **al ingerir**, no al consultar: `normalized_name` en
minúsculas y sin acentos, calculado en JavaScript por el script. `unaccent()` no es inmutable en
Postgres, así que no se puede indexar directamente y hay que envolverla en una función propia
marcada `immutable` a sabiendas de que es mentira. Normalizar antes evita ese apaño entero y deja
la misma regla de normalización en un solo sitio, compartida con el ranking del cliente.

## Esquema propuesto

**Todavía no escrito.** Va aquí para revisarlo antes de que exista el `.sql`, como manda
`CLAUDE.md`.

```sql
create table supermarkets (
  id       text primary key,          -- 'mercadona'
  name     text not null,             -- 'Mercadona'
  country  char(2) not null           -- 'ES'
);

create table catalog_products (
  id               uuid primary key default gen_random_uuid(),
  supermarket_id   text not null references supermarkets(id) on delete cascade,
  external_id      text not null,
  name             text not null,
  normalized_name  text not null,
  brand            text,
  package_size     text,              -- '1 L', '6 x 125 g'
  barcode          text,
  image_url        text,
  price_cents      int check (price_cents >= 0),
  currency         char(3) not null default 'EUR',
  price_checked_at timestamptz,
  updated_at       timestamptz not null default now(),
  unique (supermarket_id, external_id)
);

create index on catalog_products (supermarket_id);
create index on catalog_products using gin (normalized_name gin_trgm_ops);
create index on catalog_products (barcode) where barcode is not null;

alter table items add column catalog_product_id uuid references catalog_products(id) on delete set null;
```

Decisiones del esquema que no son obvias:

- **`unique (supermarket_id, external_id)`** es lo que hace que el script sea idempotente: reingerir
  es un `upsert`, no un duplicado. El id del producto en origen es la única clave estable que hay;
  el nombre cambia («Leche entera» → «Leche entera Hacendado») y no sirve.
- **`on delete cascade` desde `catalog_products` a `supermarkets`**, porque un producto sin
  supermercado no significa nada. **`on delete set null` desde `items`**, porque un artículo que se
  quedó sin producto de catálogo sigue siendo un artículo de la lista y no puede desaparecer de la
  compra de nadie porque hayamos borrado una fuente.
- **`barcode` desde el principio**, aunque no haya pantalla que lo use. Es una columna anulable que
  hoy cuesta cero y que abre escanear con la cámara, que es la forma natural de identificar un
  producto. Añadirla luego es una migración más y reingerir todo el catálogo.
- **`price_checked_at` separado de `updated_at`**: interesa saber cuándo se miró el precio, no
  cuándo se tocó la fila por cualquier motivo. Es el dato que se enseña en pantalla.
- **Sin `community_id` en ninguna de las dos tablas.** Es la primera vez en este proyecto que hay
  datos compartidos por todos y es deliberado: un catálogo por comunidad sería el mismo contenido
  copiado N veces.

RLS, en la misma migración que las tablas:

```sql
alter table supermarkets      enable row level security;
alter table catalog_products  enable row level security;

create policy supermarkets_select     on supermarkets     for select to authenticated using (true);
create policy catalog_products_select on catalog_products for select to authenticated using (true);
```

Lectura para cualquiera con sesión, y **ninguna política de insert, update o delete**. Escribe solo
el script de ingesta con la clave secreta, que se salta RLS por definición. Es el mismo patrón que
`communities` y `members`: si algún día hace falta escribir desde la app, la respuesta será una RPC,
no una política.

`search_catalog` repite el cierre de permisos de todas las funciones del proyecto:

```sql
revoke execute on function search_catalog(text, text, int) from public, anon;
grant  execute on function search_catalog(text, text, int) to authenticated;
```

La extensión `pg_trgm` va en el esquema `extensions`, no en `public`, que es donde la pone Supabase
por defecto y donde el resto de este proyecto espera encontrarla.

## De dónde salen los datos

Es la parte delicada del ADR y conviene decirla sin rodeos.

Los precios son hechos y un hecho no tiene autor. Las fotos de producto no: son obra de alguien, y
las condiciones de uso de casi cualquier web de supermercado prohíben la extracción automática de
su contenido. Que el dato esté a la vista no lo convierte en libre.

El orden recomendado para empezar:

1. **Fuentes abiertas primero.** Open Food Facts es una base de datos comunitaria con licencia ODbL
   y fotos bajo licencia libre, con API pública y buena cobertura de marca blanca española. Da
   nombre, marca, formato, foto y código de barras sin ninguna ambigüedad legal. Para el precio
   existe Open Prices, del mismo proyecto, pero es de aportación voluntaria y en España va justo de
   cobertura.
2. **La API pública que el supermercado sirve a su propia web**, si la hay. Es JSON sin
   autenticación y sin sorpresas de parseo, bastante más limpio que raspar HTML, pero sigue siendo
   su catálogo bajo sus condiciones.

Y en cualquiera de los dos casos, cómo se hace: respetando `robots.txt`, con un User-Agent que
diga quién es y cómo contactar, un producto por segundo como mucho y una pasada al día. Nada de
concurrencia, nada de guardar copias de las imágenes, nada de datos personales. Un catálogo de la
compra no justifica molestar a nadie.

**Esta elección es del usuario, no mía, y por eso el ADR está en Propuesto.** Es la diferencia
entre un proyecto que solo consume datos abiertos y uno que asume un riesgo pequeño pero real a
cambio de precios de verdad.

## Alternativas consideradas

**Meter el catálogo dentro del APK.** Búsqueda instantánea y sin red, que es tentador. El texto de
un supermercado son unos 600 KB y cabría; las imágenes, a 30 KB cada una, pasan de 100 MB y no
caben en un flujo de trabajo basado en Expo Go y `eas update`. Además ataría cada actualización del
catálogo a publicar una versión de la app. Se descarta para las imágenes; el volcado de texto queda
como salida de emergencia si la búsqueda con red resulta lenta de usar.

**Buscar en vivo contra el supermercado desde el móvil.** Cero mantenimiento y siempre fresco. A
cambio pone a todos los móviles a pegarle a una web ajena, deja la pantalla de añadir artículo a
merced de un cambio de HTML y no funciona sin conexión. Es la opción que parece más simple y es la
que más se rompe.

**Un buscador de imágenes genérico** (la API de imágenes de un buscador). Cubre cualquier producto
sin mantener catálogo. Devuelve fotos de calidad irregular, sin precio, con licencias desconocidas
y con coste por consulta. Peor en todo salvo en cobertura.

**Escanear el código de barras en vez de buscar por texto.** Es más preciso y más rápido cuando
tienes el producto en la mano, pero no sirve para planificar la compra desde el sofá, que es cuando
se usa esta app. No se descarta: encaja encima de este mismo catálogo, y por eso `barcode` entra en
el esquema desde el principio.

**Guardar el precio en `items` al elegir el producto.** Evita un join y deja el precio a mano en la
Fase 6. Guarda una copia de un dato que cambia, sin fecha y sin forma de saber si sigue siendo
cierto. Lo que se congela es lo pagado, no lo listado.

## Consecuencias

**A favor**

- Poner imagen pasa de «hazle una foto al brick» a escribir tres letras. Es lo que convierte RF-4
  de función testimonial en función usada.
- La Fase 6 arranca con los importes prerrellenados en vez de con un teclado numérico por artículo.
- El precio con fecha y confirmación manual es honesto: la app no afirma lo que no sabe.
- La app no adquiere ninguna dependencia de red nueva hacia terceros. Sigue hablando solo con
  Supabase.

**En contra**

- **Un catálogo es una cosa viva.** Si nadie ejecuta la ingesta, envejece en silencio. Por eso el
  precio enseña su antigüedad y por eso todo esto es opcional: con el catálogo vacío la app hace
  exactamente lo que hace hoy.
- **Cobertura parcial siempre.** La marca blanca de una cadena grande sí; el pan de la panadería de
  abajo no. La foto propia sigue siendo el camino principal y el catálogo es el atajo, no al revés.
- **Mantenimiento por supermercado.** Cada fuente es un adaptador que alguien tiene que arreglar
  cuando cambie. Se empieza por uno.
- Dos tablas, una RPC y una columna nueva en `items`; `db.types.ts` hay que regenerarlo.
- Es la primera vez que este proyecto tiene datos que no pertenecen a ninguna comunidad. La
  suposición «toda tabla se filtra por `community_id`» deja de ser universal, y quien escriba la
  próxima política tiene que saberlo.

## Qué falta por decidir

Para pasar a Aceptado:

1. **Qué fuente**, con lo dicho arriba: solo abierta, o también la API pública de una cadena.
2. **Qué supermercados y en qué orden.** La recomendación es uno solo para la primera versión.
3. Si la ingesta se lanza a mano o con un GitHub Action programado, como el que ya evita la pausa
   del proyecto Free.
