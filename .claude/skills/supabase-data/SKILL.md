---
name: supabase-data
description: Esquema Postgres, políticas RLS, Realtime, RPCs y generación de tipos para el Supabase de este proyecto. Úsala SIEMPRE que toques la base de datos o el backend — crear o alterar tablas, escribir o depurar políticas RLS, añadir una función/RPC, activar Realtime, regenerar db.types.ts, configurar el cliente de Supabase o implementar el flujo de unirse a una comunidad por código. Aplica también si el usuario solo dice "guarda esto en Supabase", "no me deja leer la tabla", "falla la query" o "añade un campo".
---

# Datos: Supabase, RLS y Realtime

El modelo de sesión de esta app es raro y condiciona todo lo demás: **no hay cuentas**.
Se entra con un `join_code` y un nombre de usuario. Eso significa que las políticas RLS no
pueden apoyarse en un `auth.uid()` que se corresponda con una persona registrada, y hay que
construir el puente a mano. Esta skill existe sobre todo para eso.

## Esquema

```sql
create table communities (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  join_code             text not null unique,
  join_code_expires_at  timestamptz not null default now() + join_code_lifetime(),
  created_at            timestamptz not null default now()
);

create table members (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references communities(id) on delete cascade,
  username      text not null,
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (community_id, username),
  unique (community_id, auth_user_id)
);

create table items (
  id                 uuid primary key default gen_random_uuid(),
  community_id       uuid not null references communities(id) on delete cascade,
  name               text not null check (char_length(name) between 1 and 120),
  quantity           int not null default 1 check (quantity >= 1),
  image_path         text,
  is_purchased       boolean not null default false,
  created_by         uuid references members(id) on delete set null,
  catalog_product_id uuid references catalog_products(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index on items (community_id, is_purchased);
create index on members (community_id);
create index on members (auth_user_id);
```

Postgres no indexa las claves foráneas por su cuenta. Los índices de arriba son los caminos
que la app consulta de verdad: la lista de una comunidad y la resolución de identidad.

`updated_at` es la base del last-write-wins, así que no puede depender de que el cliente se
acuerde de mandarlo:

```sql
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger items_touch_updated_at
  before update on items
  for each row execute function touch_updated_at();
```

Por eso el adaptador **nunca** mete `updated_at` en un `update` (ni en `setPurchased` ni en
nada): mandarlo desde el cliente lo único que hace es competir con el trigger. La columna es
del servidor.

## Identidad: sesión anónima + fila de miembro

Al abrir la app por primera vez se llama a `supabase.auth.signInAnonymously()`. Eso da un
`auth.uid()` real y persistente en el dispositivo, sin pedirle nada al usuario. La tabla
`members` liga ese uid con una comunidad y un nombre.

A partir de ahí, "¿de qué comunidades soy miembro?" tiene respuesta en SQL, y eso es lo que
usan todas las políticas:

```sql
create or replace function member_community_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select community_id from members where auth_user_id = auth.uid()
$$;
```

`security definer` aquí no es opcional. Sin él, consultar `members` desde una política de
`members` provoca recursión infinita y Postgres aborta la query. Con `definer` la función
se salta RLS, por eso está acotada a `auth.uid()` y no acepta parámetros: no hay forma de
pedirle las comunidades de otro.

`set search_path = public` evita que alguien con permiso de crear objetos secuestre la
resolución de nombres dentro de una función privilegiada.

## Políticas

```sql
alter table communities enable row level security;
alter table members     enable row level security;
alter table items       enable row level security;

create policy items_select on items for select
  using (community_id in (select member_community_ids()));

create policy items_insert on items for insert
  with check (community_id in (select member_community_ids()));

create policy items_update on items for update
  using (community_id in (select member_community_ids()))
  with check (community_id in (select member_community_ids()));

create policy items_delete on items for delete
  using (community_id in (select member_community_ids()));

create policy members_select on members for select
  using (community_id in (select member_community_ids()));

create policy communities_select on communities for select
  using (id in (select member_community_ids()));
```

Fíjate en que `items_update` lleva `using` **y** `with check`. Solo con `using` se controla
qué filas puedes tocar, pero no en qué se convierten: alguien podría mover un artículo suyo
a otra comunidad con un `update community_id`. El `with check` cierra esa puerta.

No hay política de insert en `communities` ni en `members`. Es deliberado: esas dos escrituras
solo ocurren dentro de las RPC de abajo.

### Las tablas del catálogo son la excepción: no llevan `community_id`

`supermarkets` y `catalog_products` (migración `20260807120000_catalog_schema.sql`) son las únicas
tablas del proyecto que **no pertenecen a nadie**. Son el mismo contenido para todo el mundo, así
que filtrarlas por comunidad sería copiar 4.000 filas por lista. Su política no se parece a ninguna
de las de arriba:

```sql
create policy catalog_products_select on catalog_products for select to authenticated using (true);
```

Tres cosas que hay que leer juntas o se entiende mal:

- **`to authenticated` es lo único que separa esto de una tabla pública.** Con `using (true)` y sin
  `to`, la lee `anon`, o sea cualquiera con la publishable key y sin sesión. El test de aislamiento
  tiene una comprobación dedicada solo a eso.
- **Ninguna política de insert, update ni delete.** Escribe únicamente el script de ingesta con la
  secret key, que se salta RLS por definición. Es el mismo criterio que `communities` y `members`:
  si algún día hace falta escribir desde la app, la respuesta es una RPC.
- **No entran en `supabase_realtime`.** Se reingieren una vez por semana; no hay nada que empujar a
  los móviles.

Y la consecuencia para quien escriba la siguiente política: **«toda tabla se filtra por
`community_id`» ya no es universal en este proyecto.** Copiar la política de `items` a una tabla de
catálogo la deja ilegible para todos; copiar la del catálogo a una tabla de comunidad la deja
legible para todos. Mira primero de quién son los datos.

El detalle del esquema y por qué cada columna, en
[ADR-0012](../../../docs/adr/ADR-0012-catalogo-de-productos-de-supermercado.md); de dónde salen los
datos, en [ADR-0013](../../../docs/adr/ADR-0013-fuente-del-catalogo-mercadona.md).

## Crear y unirse: por qué son RPC

Unirse tiene un problema de huevo y gallina. Para validar un `join_code` hay que leer
`communities`, pero la política de `communities` exige ser ya miembro. Se resuelve con una
función `security definer` que hace la comprobación por dentro y devuelve lo justo:

```sql
create or replace function join_community(p_join_code text, p_username text)
returns table (status text, community_id uuid)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_community_id uuid;
begin
  select id into v_community_id
    from communities
   where join_code = upper(trim(p_join_code));

  if v_community_id is null then
    insert into join_attempts (auth_user_id, succeeded) values (auth.uid(), false);
    return query select 'invalid_join_code'::text, null::uuid;
    return;
  end if;
  ...
end $$;
```

Ver `supabase/migrations/` para la versión completa con el rate limit.

**Devuelve un `status`, no lanza excepciones.** No es una preferencia de estilo: una excepción
deshace la transacción entera, incluido el `insert` en `join_attempts` que lleva la cuenta de
intentos. Un rate limit que lanza excepciones no cuenta nada, porque cada intento fallido se
borra a sí mismo al fallar. Estados: `ok`, `invalid_join_code`, `expired_join_code`,
`username_taken`, `too_many_attempts`.

**`#variable_conflict use_column` no es decorativo.** El parámetro de salida se llama
`community_id` y `members` tiene una columna con ese nombre, así que sin esa línea el `insert`
y el `on conflict` fallan con `column reference "community_id" is ambiguous` (SQLSTATE 42702).
Si añades parámetros de salida que coincidan con nombres de columna, acuérdate.

En una función `language sql` no existe ese pragma, así que el choque se evita a mano: **alias en
la tabla y todas las columnas cualificadas**, nunca `select *`. `search_catalog` devuelve `id`,
`name` y `similarity`, tres nombres que también son columnas, y por eso su `select` final va
columna a columna con el prefijo del alias.

El `on conflict` hace que reentrar desde el mismo dispositivo sea idempotente en vez de
reventar por la clave única. El bloque `exception` traduce el choque contra
`unique (community_id, username)` a `username_taken`: son dos errores distintos para el
usuario y confundirlos es una mala experiencia en la primera pantalla que ve.

Crear comunidad es RPC por lo mismo, más un motivo propio: el `join_code` se genera dentro de
la base de datos (`generate_join_code()`), que es el único sitio donde se puede comprobar la
unicidad en la misma transacción que inserta. Generarlo en el cliente admite colisiones.

Consecuencia de todo esto: **`communities` y `members` no tienen política de insert, update ni
delete.** Si necesitas escribir en ellas, la respuesta casi siempre es una RPC nueva, no una
política nueva. Ver `supabase/migrations/` para el SQL vigente.

## Permisos de las funciones

Postgres da `execute` a `public` por defecto en cualquier función nueva. En una función
`security definer` eso es un agujero: la ejecutaría cualquiera, incluido el rol `anon`, con
privilegios de su dueño. Por eso las migraciones cierran y reabren a mano:

```sql
revoke execute on function join_community(text, text) from public, anon;
grant  execute on function join_community(text, text) to authenticated;
```

Con sesión anónima de Supabase el rol efectivo es `authenticated`, no `anon` — `anon` es quien
llega sin ningún token. Así que la app no pierde nada y el acceso sin sesión queda cerrado.

`generate_join_code()` no recibe grant a nadie: es una función interna que solo llama
`create_community` por dentro. Si algún día la necesitas desde fuera, es señal de que falta
una RPC, no un grant.

Cualquier función nueva repite las dos líneas. Sin ellas, el `revoke` que protege a las demás
da una falsa sensación de que el patrón está aplicado.

**Excepción a propósito: `public.ping()`** (migración `20260802120000_keep_alive_ping.sql`) SÍ
se concede a `anon`. Es un `select 'pong'` sin acceso a ninguna tabla, y existe para que el
GitHub Action que evita la pausa del proyecto Free pueda generar actividad en Postgres sin
sesión. No leemos una tabla desde el ping porque toda lectura pasa por `member_community_ids()`,
que `anon` no ejecuta, así que da `permission denied`. Si ves ese `grant ... to anon`, no es un
descuido; no lo revoques.

### `search_catalog` es la única `security invoker`

Las demás son `definer` porque tienen que esquivar la recursión de las políticas de comunidad.
`catalog_products` tiene `select to authenticated using (true)` y no hay nada que esquivar, así
que `invoker` basta y concede menos. El `revoke`/`grant` se repite igual: sin él, `anon` podría
buscar en el catálogo con solo la clave pública.

## Una función NO puede fijar un parámetro de extensión en su cláusula `set`

Esto cuesta media hora si no lo sabes. Una cláusula `set` con un parámetro normal va bien:

```sql
create function f() ... set search_path = public, extensions as $$ ... $$;
```

Con un parámetro que define una extensión, no:

```sql
set pg_trgm.word_similarity_threshold = 0.5
-- ERROR: permission denied to set parameter "pg_trgm.word_similarity_threshold" (SQLSTATE 42501)
```

El parámetro lo registra la librería de la extensión al cargarse, y en la sesión que aplica la
migración todavía no está cargada. Postgres ve un nombre con prefijo que no conoce y solo deja
fijarlo a un superusuario, que el rol `postgres` de Supabase no es.

Se puede forzar la carga llamando antes a una función de la extensión, pero **no lo hagas**:
PostgREST abre conexiones nuevas y la comprobación se repite al ejecutar. Y el fallo es
silencioso — el parámetro vuelve a su valor de fábrica y la consulta empieza a devolver otra
cosa sin dar ningún error.

La salida es escribir el valor en el SQL. En `search_catalog` eso significó cambiar el operador
`<%`, que consulta el umbral y usa el índice gin, por `word_similarity(…) >= 0.5`, que recorre la
tabla. Con 4.957 filas de nombres cortos sale gratis frente a la latencia de red. Si algún día no
saliera, la salida buena es un índice GiST con el operador de distancia `<->>`, que ordena sin
depender de ningún parámetro de sesión. Razonado en `docs/phases/fase-6.md`, incremento A.4.

## `word_similarity` satura: sirve para filtrar, no para ordenar

`word_similarity(q, texto)` busca la ventana de `texto` que más se parece a `q` y devuelve ese
máximo. Si la palabra aparece entera, la ventana coincide y da **exactamente 1.00**. Para «leche»
puntúan igual `Leche entera Hacendado` y `Aftersun leche corporal Ecran hidratante y reparadora`.

Consecuencia práctica: `order by word_similarity(...) desc` **no ordena nada** cuando hay muchas
coincidencias, cae al criterio siguiente, y si detrás hay un `limit` te llevas un corte arbitrario.
En `search_catalog` eso hizo que la leche no llegara nunca al cliente, con el test de RLS en verde.

El reparto que funciona son dos funciones distintas para dos preguntas distintas:

| Pregunta                    | Función                             | Dónde va      |
| --------------------------- | ----------------------------------- | ------------- |
| ¿Aparece esta palabra?      | `word_similarity(q, nombre) >= 0.5` | El `where`    |
| ¿Cuánto se parece del todo? | `similarity(q, nombre)`             | El `order by` |

Y por delante de las dos, un desempate exacto que no opina:
`order by starts_with(nombre_normalizado, q) desc, …`. Los trigramas son aproximados por diseño;
cuando existe una respuesta exacta, se pregunta primero por ella.

**Al medir una función de Postgres, mídela contra Postgres.** El fallo de arriba no se vio en una
sonda local porque la aproximación en JS de `word_similarity` sí daba valores graduados. Una
reimplementación de la dependencia no valida el contrato con ella.

## join_code

Alfabeto sin caracteres ambiguos, que estos códigos se dictan por WhatsApp y en voz alta:

```
ABCDEFGHJKLMNPQRSTUVWXYZ23456789
```

Fuera `O`, `0`, `I`, `1`. Genera en el servidor, formato tipo `PAN-42XK`, y normaliza a
mayúsculas al comparar (la RPC ya lo hace). Rate limit en `join_community`: sin él, el
espacio de códigos se puede barrer a fuerza bruta y ese código es el único secreto que
protege la lista.

### Caduca solo y se puede cambiar a mano

El plazo vive en una función, no repetido en los dos sitios que lo usan:

```sql
create or replace function join_code_lifetime()
returns interval
language sql immutable as $$ select interval '7 days' $$;
```

Lo usan el `default` de `join_code_expires_at` y `rotate_join_code(p_community_id uuid)`, que
genera uno nuevo y **sobrescribe** al anterior sin periodo de gracia. Rotar no expulsa a nadie: la
pertenencia está en `members` y el código solo sirve para la primera vez.

Dos cosas que se hacen mal con facilidad:

- **`rotate_join_code` comprueba la pertenencia a mano** (`p_community_id in (select
member_community_ids())` → `not_a_member`). Es `security definer`, así que se salta RLS: si no
  comprueba, cualquiera con sesión rota el código de cualquier lista sabiendo su uuid.
- **Un código caducado cuenta como intento fallido en `join_attempts`**, igual que uno inexistente.
  Si no contara, acertar con una lista vencida sería una forma gratis de saber que existe y de
  seguir barriendo sin gastar rate limit.

`join_code_lifetime()` no recibe grant a nadie. Solo se evalúa desde el `default` de la columna y
desde `rotate_join_code`, y ambos corren con privilegios del dueño; `communities` no tiene política
de insert ni de update, así que nadie con rol `authenticated` llega a esa expresión.

El plazo se puede cambiar con un `create or replace` de la función, pero **eso no toca las filas
que ya existen**: su `join_code_expires_at` ya está escrito. Cambiar el plazo hacia atrás para
listas vivas es un `update`, y hay que decidirlo a propósito.

## Storage

Los buckets se crean **en una migración**, igual que las tablas, y con sus políticas en la misma
migración. Un bucket creado desde el panel no está en el repo y nadie sabe si es público.

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-images', 'item-images', false, 2097152, array['image/jpeg'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
```

`public = false` **siempre**. Un bucket público sirve por una URL que se deriva del nombre del
objeto, y nuestros nombres llevan ids que circulan por Realtime y por la API: haría públicas
las fotos de cualquier comunidad. El `on conflict` hace la migración reejecutable sin romper.

Los límites van aquí y no en el cliente. El cliente ya comprime, pero una app modificada no.

### La primera carpeta del nombre es el `community_id`

Esa es la convención que hace posible escribir políticas sobre `storage.objects` sin consultar
las tablas de la app. Ruta: `<community_id>/<item_id>-<epoch_ms>.jpg`.

Lo único que la política mira es la **primera** carpeta, así que el resto del nombre es libre y
puede cambiar sin tocar SQL. El timestamp está ahí para que sustituir una foto cambie el valor
de la columna: sin él, ninguna caché se entera de que los bytes son otros. La historia completa,
en [ADR-0007](../../../docs/adr/ADR-0007-ruta-versionada-de-las-fotos.md).

```sql
create policy item_images_select on storage.objects for select to authenticated
  using (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] in (
      select c.community_id::text from public.member_community_ids() as c(community_id)
    )
  );
```

Cuatro políticas, una por operación. La de `update` lleva `using` **y** `with check`, por lo
mismo que `items_update`: sin `with check` se puede mover un objeto propio a la carpeta de otra
comunidad.

Tres detalles que cuesta descubrir solo:

- **`to authenticated`, no a `public`.** Con sesión anónima de Supabase el rol efectivo es
  `authenticated`; `anon` es quien llega sin token.
- **Se compara texto contra texto** (`community_id::text`), no se castea la carpeta a `uuid`. Un
  objeto con una ruta que no sea un uuid haría fallar el cast con un error de tipo dentro de la
  política; como texto, simplemente no coincide y se deniega, que es lo correcto.
- **`member_community_ids()` devuelve `setof uuid`**, así que en un `select ... from` hay que
  darle alias de columna (`as c(community_id)`) para poder castear.

### Firmar, no publicar

Con bucket privado, la app guarda la **ruta** en la columna (`image_path`, no `image_url`) y
firma al pintar:

```ts
const { data } = await supabase.storage.from('item-images').createSignedUrl(path, ttl)
```

La caducidad es una regla de producto, así que la constante vive en `domain/`
(`imageUrlTtlSeconds`), no en `data/`. La query que envuelve la firma refresca al 90 % del TTL
para no pintar nunca un enlace muerto.

Razonado entero en [ADR-0006](../../../docs/adr/ADR-0006-fotos-de-articulos-en-storage.md).

## Realtime

```sql
alter publication supabase_realtime add table items;
```

Realtime respeta RLS en `postgres_changes`: cada cliente solo recibe eventos de filas que
podría leer. Eso significa que **si una política está mal, el síntoma puede ser "no llegan
los eventos" en vez de un error**. Cuando Realtime no dispare, sospecha de RLS antes que del
canal.

### `replica identity full` es obligatorio para los borrados

```sql
alter table items replica identity full;
```

Por defecto Postgres solo mete la **clave primaria** de la fila borrada en el WAL. Sin el
resto de columnas, Realtime no puede evaluar `filter: community_id=eq.<id>` sobre un `DELETE`,
y ahí se rompe el aislamiento: o el borrado no llega a quien le toca, o llega a todo el
mundo. Con `replica identity full` la fila vieja entera viaja en el WAL y el filtro se
resuelve en el servidor.

Verificado con `npm run test:realtime` (migración `20260802140000`).

Tres cosas que sorprenden y conviene saber antes de perder la tarde:

**El payload del `DELETE` sigue trayendo solo el `id`, y es correcto.** Realtime recorta a
propósito la fila borrada a su clave primaria antes de mandarla, tenga la tabla la replica
identity que tenga. Lo que arregla `replica identity full` no es lo que recibes, es que el
**enrutado** sea correcto. Se comprueba mirando el `old` de un `UPDATE`: si trae la fila
anterior completa, `full` está activo. Si te fías del `old` de un `DELETE` para saberlo,
concluyes que la migración no sirvió, que es justo lo que pasó al escribirla.

**Un canal sin `filter` recibe los borrados de todas las comunidades**, reducidos a un uuid
suelto. RLS no se puede evaluar sobre una fila que ya no existe, así que Realtime no lo
intenta. Por eso **la app se suscribe siempre con `filter: community_id=eq.<id>`**: con filtro
esos borrados ajenos no llegan. Suscribirse a `items` sin filtro es un error de revisión.

**Tras `SUBSCRIBED` hay una ventana de en torno a un segundo en la que los eventos se pierden.**
El canal dice que está suscrito antes de que el servidor tenga registrada la suscripción a los
cambios de Postgres. Se nota justo en el peor sitio: lo que otro añada en ese momento no llega
nunca. La app **refresca la query después de suscribirse**, no solo al reconectar, y así lo que
se haya perdido entra por la puerta de la lectura normal.

### Presencia

Quién tiene la lista abierta ahora. No es una tabla ni pasa por RLS: vive solo en el canal.

```ts
const channel = supabase.channel(`presence:${communityId}`, {
  config: { presence: { key: username, enabled: true } },
})

channel.on('presence', { event: 'sync' }, publish).subscribe((status) => {
  if (status === 'SUBSCRIBED') {
    void channel.track({ username })
    setTimeout(() => void channel.track({ username }), 2000)
  }
})

return () => {
  void channel.untrack()
  void supabase.removeChannel(channel)
}
```

Cada línea rara de ahí arriba tapa un fallo silencioso, todos encontrados con
`npm run test:realtime`, ninguno con un mensaje de error:

**`enabled: true` hace falta.** El canal solo pide presencia al servidor si tiene un binding de
`presence` **o** si lleva `config.presence.enabled === true`. Con solo `key`, `track()` resuelve
sin error y `presenceState()` devuelve `{}` para siempre. Se ponen las dos cosas para que quitar
el listener no rompa nada.

**El `track()` repetido a los 2 s no sobra.** Es la misma ventana de ~1 s de arriba vista desde
la presencia: si dos personas entran a la vez, el diff de una sale antes de que la otra esté
registrada y esta se queda sin verla. Repetir el `track` con la misma clave es idempotente y
genera un diff nuevo que sí llega.

**`untrack()` antes de `removeChannel()`, y sin `await`.** Sin `untrack`, quien sale sigue
apareciendo como presente en la pantalla de los demás. Y `send()` (que es lo que hay debajo)
espera el ack del servidor con timeout de 10 s para todo lo que no sea broadcast, así que
esperarlo en el cleanup síncrono de un `useEffect` colgaría la baja diez segundos sin red. Los
dos mensajes salen por el mismo socket en orden; el `untrack` gana igual.

**La clave es el `username`**, que es único por comunidad (`unique (community_id, username)`).
Así la misma persona con dos dispositivos se agrupa sola y no hay que resolver uid → nombre.

**Lo que se anuncia no lo valida nadie.** El canal se autoriza por token, pero el contenido del
`track()` es lo que el cliente diga. Lo único que impide anunciarse en una comunidad ajena es
no conocer su uuid. Vale para pintar un nombre; no vale para nada de lo que dependa un dato.

## Migraciones

El esquema vive en `supabase/migrations/`, nunca en SQL pegado a mano en el panel. Un cambio
aplicado solo por el editor web no está en el repo, no se puede revisar y no se puede
reproducir en otro proyecto.

```bash
npx supabase migration new <nombre>
npx supabase db push
```

Las migraciones no se editan una vez aplicadas: se añade una nueva encima. Editar una ya
aplicada hace que el historial local y el remoto discrepen, y `db push` empieza a mentir.

## Verificar RLS de verdad

Que las políticas existan no prueba que funcionen.

```bash
node --env-file=.env scripts/rls-isolation-test.mjs
```

El script abre **dos sesiones anónimas reales** y ataca la API REST igual que la app: lectura
cruzada de artículos, de comunidad y de miembros, insert en comunidad ajena, update de un
artículo ajeno, e intento de robarlo moviéndole el `community_id`. Todo debe dar cero filas o
error.

Tres de las 27 comprobaciones van al revés y son las del catálogo: ahí lo que se afirma es que un
miembro **sí** lee una tabla que no es de su comunidad, que sin sesión no la lee nadie, y que con
sesión de usuario no se puede escribir en ella.

Se hace así, y no simulando un usuario con `set local request.jwt.claims` en el editor SQL,
porque esa vía prueba las políticas pero se salta PostgREST. Puede dar verde mientras la app
falla, que es exactamente el fallo que no quieres tener.

Ejecútalo después de **cualquier** cambio en políticas o RPCs, no solo al final de la fase.
El resultado se registra en `docs/phases/fase-N.md`.

Si falla la creación de sesión anónima, revisa que **"Allow anonymous sign-ins"** esté activo
en Authentication → Sign In / Providers. Viene desactivado de fábrica y sin eso no funciona
ningún flujo de la app.

## Claves

- El cliente usa la **publishable key** (`sb_publishable_...`) vía `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
  Es pública por diseño y va incrustada en la app; quien protege los datos es RLS.
- La **secret key** (`sb_secret_...`) y la service key se saltan RLS. Nunca en el cliente,
  nunca en el repo, nunca en un `EXPO_PUBLIC_*` (ese prefijo las mete en el bundle).
- `.env` está en `.gitignore`. `.env.example` lleva los nombres sin valores.
- Si falta una clave, pídela. No inventes URLs ni tokens de ejemplo que parezcan reales.

## Tipos

```bash
npx supabase gen types typescript --linked > src/shared/lib/db.types.ts
```

`--linked` genera contra el proyecto remoto ya enlazado. `--local` apunta a la instancia de
Docker, que en esta máquina no existe: la documentación de Supabase lo usa por defecto y falla
con un error de `docker_engine` que no dice nada útil.

Regenera **en el mismo cambio** en que alteres el esquema. Un `db.types.ts` desfasado es peor
que no tenerlo: TypeScript pasa en verde y el fallo aparece en tiempo de ejecución.

**No uses `>` desde PowerShell 5.1 para escribir este fichero.** Redirige en UTF-16LE con BOM,
y el resultado es un `db.types.ts` que `tsc` lee sin quejarse (entiende el BOM) pero que ESLint
descarta con `Parsing error: File appears to be binary`. O sea: typecheck en verde, lint roto y
ninguna pista de por qué. Pasó y estuvo commiteado así. Genera desde Git Bash, o fuerza la
codificación:

```powershell
npx supabase gen types typescript --linked | Out-File -Encoding utf8 src/shared/lib/db.types.ts
```

Si sospechas, los dos primeros bytes lo cantan: `ff fe` es UTF-16LE.

Estos tipos son los de las filas de Postgres y se quedan en `data/`. El dominio tiene sus
propias entidades; el adaptador traduce entre ambos. Si `Database['public']['Tables']`
aparece en `presentation/` o en `domain/`, se ha filtrado el backend a una capa que no debía
conocerlo.
