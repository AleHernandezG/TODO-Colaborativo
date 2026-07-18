# ADR-0002: Modelo de sesión sin cuentas y políticas RLS

- Estado: Aceptado
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

El detalle completo de esquema y políticas vive en la skill `.claude/skills/supabase-data/`,
que es lo que se consulta al programar. Este ADR explica el porqué; la skill, el cómo.

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

Esta decisión no está terminada hasta que exista la prueba de aislamiento: dos comunidades,
un usuario en cada una, y el de A obtiene **cero filas** al consultar los artículos de B.
El procedimiento está en la skill `supabase-data` y su resultado se registra en
`docs/phases/fase-0.md`.
