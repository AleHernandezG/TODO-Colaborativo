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
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  join_code   text not null unique,
  created_at  timestamptz not null default now()
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
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references communities(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 120),
  quantity      int not null default 1 check (quantity >= 1),
  image_url     text,
  is_purchased  boolean not null default false,
  created_by    uuid references members(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
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

## Crear y unirse: por qué son RPC

Unirse tiene un problema de huevo y gallina. Para validar un `join_code` hay que leer
`communities`, pero la política de `communities` exige ser ya miembro. Se resuelve con una
función `security definer` que hace la comprobación por dentro y devuelve lo justo:

```sql
create or replace function join_community(p_join_code text, p_username text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_community_id uuid;
begin
  select id into v_community_id
    from communities
   where join_code = upper(trim(p_join_code));

  if v_community_id is null then
    raise exception 'invalid_join_code' using errcode = 'P0001';
  end if;

  insert into members (community_id, username, auth_user_id)
  values (v_community_id, trim(p_username), auth.uid())
  on conflict (community_id, auth_user_id) do update set username = excluded.username;

  return v_community_id;
end $$;
```

El `on conflict` hace que reentrar desde el mismo dispositivo sea idempotente en vez de
reventar por la clave única.

El error de código inválido y el de nombre ya cogido deben distinguirse en el cliente: son
dos mensajes distintos para el usuario y confundirlos es una mala experiencia en la primera
pantalla que ve.

## join_code

Alfabeto sin caracteres ambiguos, que estos códigos se dictan por WhatsApp y en voz alta:

```
ABCDEFGHJKLMNPQRSTUVWXYZ23456789
```

Fuera `O`, `0`, `I`, `1`. Genera en el servidor, formato tipo `PAN-42XK`, y normaliza a
mayúsculas al comparar (la RPC ya lo hace). Rate limit en `join_community`: sin él, el
espacio de códigos se puede barrer a fuerza bruta y ese código es el único secreto que
protege la lista.

## Realtime

```sql
alter publication supabase_realtime add table items;
```

Realtime respeta RLS en `postgres_changes`: cada cliente solo recibe eventos de filas que
podría leer. Eso significa que **si una política está mal, el síntoma puede ser "no llegan
los eventos" en vez de un error**. Cuando Realtime no dispare, sospecha de RLS antes que del
canal.

## Verificar RLS de verdad

Que las políticas existan no prueba que funcionen. Antes de cerrar cualquier trabajo de
esquema, ejecuta la prueba de aislamiento: dos comunidades, un usuario en cada una, y
comprueba que el de A obtiene **cero filas** de los artículos de B, no un error de permisos.

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"<uid-del-usuario-A>","role":"authenticated"}';
select count(*) from items where community_id = '<id-comunidad-B>';
```

Cero. Si sale otra cosa, hay un agujero. Deja esta comprobación escrita en
`docs/phases/fase-N.md` con su resultado, que es parte de la auditoría de seguridad.

## Claves

- El cliente usa la **publishable key** (`sb_publishable_...`) vía `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
  Es pública por diseño y va incrustada en la app; quien protege los datos es RLS.
- La **secret key** (`sb_secret_...`) y la service key se saltan RLS. Nunca en el cliente,
  nunca en el repo, nunca en un `EXPO_PUBLIC_*` (ese prefijo las mete en el bundle).
- `.env` está en `.gitignore`. `.env.example` lleva los nombres sin valores.
- Si falta una clave, pídela. No inventes URLs ni tokens de ejemplo que parezcan reales.

## Tipos

```bash
supabase gen types typescript --local > src/shared/lib/db.types.ts
```

Regenera **en el mismo cambio** en que alteres el esquema. Un `db.types.ts` desfasado es peor
que no tenerlo: TypeScript pasa en verde y el fallo aparece en tiempo de ejecución.

Estos tipos son los de las filas de Postgres y se quedan en `data/`. El dominio tiene sus
propias entidades; el adaptador traduce entre ambos. Si `Database['public']['Tables']`
aparece en `presentation/` o en `domain/`, se ha filtrado el backend a una capa que no debía
conocerlo.
