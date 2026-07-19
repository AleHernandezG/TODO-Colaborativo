# ADR-0002: Modelo de sesión sin cuentas y políticas RLS

- Estado: **Aceptado y verificado** (prueba de aislamiento en verde el 2026-07-19)
- Fecha: 2026-07-18

## Contexto

En beta se entra a la app con un `join_code` y un nombre de usuario. Sin email, sin
contraseña, sin verificación (§9.1 del documento maestro). Esa decisión de producto está
tomada: la fricción de registrarse mataría la prueba con usuarios reales, que son familias
compartiendo la lista de la compra.

El problema es que choca de frente con el requisito de seguridad: RLS debe impedir que un
usuario lea o escriba datos de otra comunidad (§9.3). Y las políticas RLS de Postgres se
escriben, en la práctica, en función de `auth.uid()` — el identificador de un usuario
autenticado. Si no hay cuentas, no hay `auth.uid()`, y sin él las políticas no tienen a qué
agarrarse.

El documento maestro dejó esto explícitamente abierto (§7.3): *"las políticas RLS concretas
dependen del modelo de sesión elegido"*. Este ADR lo cierra.

## Decisión

Usar **sesión anónima de Supabase** como identidad técnica, desacoplada de la identidad
social del usuario.

1. Al primer arranque, la app llama a `supabase.auth.signInAnonymously()`. Eso produce un
   `auth.uid()` real y persistente en el dispositivo, sin pedirle nada a la persona.
2. La tabla `members` gana una columna `auth_user_id uuid not null references auth.users(id)`,
   que liga ese uid con una comunidad y un `username`.
3. Todas las políticas RLS preguntan "¿de qué comunidades es miembro este uid?" a través de
   una función auxiliar.

Hay dos detalles que no son evidentes y que condicionan la implementación:

**La función auxiliar tiene que ser `security definer`.** Una política sobre `members` que
consulte `members` provoca recursión infinita y Postgres aborta la consulta. La función se
salta RLS para romper el ciclo, y por eso está acotada a `auth.uid()` sin aceptar parámetros:
no existe forma de pedirle las comunidades de otra persona.

```sql
create or replace function member_community_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select community_id from members where auth_user_id = auth.uid()
$$;
```

**Unirse es un problema de huevo y gallina.** Validar un `join_code` exige leer `communities`,
pero la política de `communities` exige ser ya miembro. Se resuelve con una RPC
`join_community(p_join_code, p_username)` también `security definer`, que valida por dentro,
inserta la fila de miembro y devuelve solo el `community_id`. El cliente nunca hace un
`select` contra `communities` para unirse.

Crear una comunidad tiene el mismo problema por el otro lado: hay que insertar en
`communities` y en `members` de forma atómica, y no existe política de insert en ninguna de
las dos. Por eso `create_community(p_name, p_username)` es también una RPC `security definer`,
que además genera el `join_code` dentro de la base de datos. Generarlo en el cliente sería un
error: dos dispositivos podrían proponer el mismo código y solo la base de datos puede
comprobar la unicidad en la misma transacción en la que inserta.

En consecuencia, **`communities` y `members` no tienen política de insert, update ni delete**.
Toda escritura sobre ellas pasa por las dos RPC. Es deliberado: reduce la superficie a dos
funciones auditables en vez de a un conjunto de políticas repartidas.

El detalle completo de esquema y políticas vive en la skill `.claude/skills/supabase-data/`,
y el SQL aplicable en `supabase/migrations/`. Este ADR explica el porqué; la skill, el cómo.

## Alternativas consideradas

- **Sin RLS, filtrando por `community_id` desde el cliente.** Es lo más rápido de escribir y
  no protege nada: con la publishable key, que va incrustada en la app y cualquiera puede
  extraer, se consulta la tabla entera. Convierte el `join_code` en el único control de
  acceso y hace que un código filtrado exponga todas las comunidades, no solo una.
- **JWT personalizado con `community_id` como claim.** Conceptualmente limpio y permite
  políticas triviales. Requiere firmar tokens, o sea un servidor o una Edge Function con la
  clave secreta, más gestión de expiración y rotación. Demasiada máquina para beta, y añade
  la pieza de infraestructura que se quería evitar en [ADR-0001](./ADR-0001-eleccion-de-backend.md).
- **Auth real desde el principio (email/OTP o magic link).** Resuelve todo esto de forma
  ortodoxa, pero contradice el requisito de producto. Es la ruta post-beta (§9.4) y el diseño
  elegido no la bloquea.

## Consecuencias

**A favor**

- RLS funciona de verdad: el aislamiento entre comunidades se aplica en la base de datos, no
  a base de confiar en el cliente.
- El usuario no percibe nada. Cero fricción, cero pantallas de registro.
- Realtime hereda el aislamiento gratis: `postgres_changes` respeta RLS, así que cada
  dispositivo solo recibe eventos de filas que podría leer.
- La migración a auth real es aditiva: `auth.users` ya existe y ya está referenciada. Pasar
  de anónimo a permanente es vincular credenciales a un usuario que ya está creado, sin
  rehacer el esquema ni las políticas.

**En contra**

- **La identidad muere con el dispositivo.** Si se desinstala la app o se cambia de móvil, ese
  `auth.uid()` se pierde y la persona vuelve a entrar con `join_code` + username, generando
  una fila de miembro nueva. Aceptable en beta; en producción es lo que arregla el auth real.
- Se acumulan usuarios anónimos huérfanos en `auth.users`. Conviene una limpieza periódica de
  los que no tengan ninguna fila en `members`.
- Las funciones `security definer` son código privilegiado. Cualquier cambio en
  `member_community_ids()` o en `join_community()` merece revisión explícita: un fallo ahí es
  un fallo de aislamiento entre comunidades, no un bug normal. Ambas llevan
  `set search_path = public` para evitar secuestro de resolución de nombres.
- El `join_code` sigue siendo un secreto compartido débil (§9.2). RLS es defensa en
  profundidad, no sustituye al rate limiting en `join_community`.

## Verificación

Esta decisión no está terminada hasta que pase la prueba de aislamiento: dos comunidades, un
usuario anónimo en cada una, y el de A obteniendo **cero filas** de todo lo de B.

Está automatizada en `scripts/rls-isolation-test.mjs`, que abre dos sesiones anónimas reales
y ataca la API REST igual que hace la app. Se eligió eso frente a simular un usuario en el
editor SQL con `set local request.jwt.claims`: esa vía prueba las políticas pero se salta
PostgREST, así que puede dar verde mientras la app real falla.

Requisito previo: **"Allow anonymous sign-ins" activado** en el panel (Authentication →
Sign In / Providers). Sin eso no hay identidad y no funciona nada de lo descrito aquí.

Pasada el 2026-07-19 contra el proyecto real: 11/11. Salida completa en
`docs/phases/fase-0.md`. Lo que confirma en concreto es que A no lee artículos, comunidad ni
miembros de B; que no puede insertar ahí; que no puede modificar un artículo ajeno; y que no
puede robarlo cambiándole el `community_id`, que era el agujero que dejaba una política de
update escrita solo con `using`.
