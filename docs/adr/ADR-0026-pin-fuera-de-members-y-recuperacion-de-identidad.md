# ADR-0026: El PIN sale de `members` y la identidad sin PIN deja de ser reclamable

- **Fecha:** 2026-10-12
- **Estado:** Aceptado por el usuario el 2026-10-12. La migración A está escrita
  (`supabase/migrations/20261012120000_member_secrets_and_identity_hardening.sql`), revisada por
  `migration-reviewer` y **sin aplicar**: falta ensayarla en el proyecto de prueba. La migración B
  no está escrita.
- **Decisores:** Alejandro, con Claude
- **Supersede a:** [ADR-0015](ADR-0015-pin-por-miembro-para-identidad-no-suplantable.md) en sus
  apartados 1, 4 y 5. Los apartados 2 y 3 (el PIN viaja en `create_community` y `join_community`)
  siguen valiendo.
- **Matiza a:** [ADR-0017](ADR-0017-gestion-de-miembros-y-roles.md) en quién puede ser admin y en
  qué hace `remove_member` con el código de invitación.

---

## Contexto

La auditoría del 2026-10-11 (`docs/auditoria-2026-10-11.md`, apartados 3 y 6) encontró que el PIN de
ADR-0015 no protege la identidad que ADR-0005 exige para el reparto de gastos. Seis problemas, todos
comprobados en el SQL:

1. **El hash se puede leer.** `members.pin_hash` está en una tabla cuya política `members_select` es
   por fila y sin permisos por columna: cualquier miembro lee el hash de los demás con
   `members?select=pin_hash`. El propio `scripts/rls-isolation-test.mjs` lo hace. Un bcrypt de un PIN
   de 4 cifras son 10.000 candidatos; se rompe sin conexión en segundos. Además `members` está
   publicada en Realtime con `replica identity full` desde ADR-0017.
2. **Una fila sin PIN la reclama cualquiera.** En `join_community`
   (`20260904120000_member_roles_and_guests.sql:166-174`), si el miembro existe y `pin_hash` es nulo,
   quien llame se queda la fila y fija su PIN. No se mira de quién era. No hubo backfill, así que
   todo miembro anterior al 2026-08-24 está en ese caso, y conserva `is_admin`.
3. **No hay forma de fijar ni restablecer un PIN** salvo como efecto lateral de `join_community`.
   Quien lo olvida y pierde la sesión se queda fuera; si era el único admin, sin salida.
4. **El límite de intentos es por sesión anónima.** Cada `signInAnonymously()` da otros diez.
5. **Reentrar con otro nombre sobrescribe el PIN** de la fila propia sin pedir el anterior (`:199-203`).
6. **Expulsar no expulsa.** `remove_member` no cambia el código, y el expulsado, que lo conoce,
   vuelve a entrar como miembro nuevo.

Restricciones:

- Hay APK instalados (1.3.1, y 1.2.0 con el update republicado el 2026-10-12) que no se pueden
  cambiar a la vez que el servidor. Conocen estos estados de `join_community` y lanzan un error
  genérico ante cualquier otro: `ok`, `invalid_join_code`, `expired_join_code`, `username_taken`,
  `invalid_pin`, `too_many_attempts`.
- Ningún cliente lee `pin_hash`: `listMembers` pide `id, username, auth_user_id, is_admin,
  removed_at` y `listMine` pide `username` y la comunidad.
- Cambiar la firma de una RPC expuesta obliga a borrar la anterior en la misma migración
  (`CLAUDE.md`, «Cambios de esquema»).
- El adversario de ADR-0005 es **otro miembro de la misma lista**. Ese siempre tiene el código de
  invitación: lo lee de `communities` y puede rotarlo.

## Decisión

**Dos migraciones.** La A se aplica ya. La B se aplica cuando la app tenga la pantalla que avisa
«ponte un PIN» y el botón de restablecer (incremento 6 del plan de la auditoría). Ninguna firma
existente cambia en ninguna de las dos.

El reparto lo fuerzan dos decisiones del usuario que, aplicadas a la vez, se pisarían: invalidar los
PIN que han sido legibles, y no activar todavía la regla que impide reclamar una fila sin PIN.
Invalidar hoy dejaría a todos los miembros sin PIN con la regla vieja aún activa, es decir,
reclamables por cualquiera con el código: peor que ahora. Así que **el hash deja de ser legible en
la A, y la invalidación y la regla nueva llegan juntas en la B.**

### Migración A

#### A.1 El hash vive en `member_secrets`, sin políticas

```sql
create table member_secrets (
  member_id   uuid primary key references members(id) on delete cascade,
  pin_hash    text not null,
  exposed     boolean not null default false,
  updated_at  timestamptz not null default now()
);
alter table member_secrets enable row level security;
revoke all on member_secrets from anon, authenticated;
```

- Sin ninguna política: solo la leen y escriben las funciones `security definer`.
- `on delete cascade`: el secreto no sobrevive al miembro. Un archivado (`removed_at`) conserva su
  fila y su secreto.
- No entra en la publicación de Realtime.
- `exposed` marca los hashes que vinieron de `members.pin_hash` y por tanto han podido leerse. Pasa
  a `false` cada vez que la persona fija un PIN nuevo. Es lo que permite a la migración B invalidar
  solo los que tocan.
- `updated_at` lo mantiene el trigger `touch_updated_at` que ya existe.

Orden dentro del fichero, que es un solo lote:

1. `lock table members in access exclusive mode`, para que ninguna llamada a la función vieja
   escriba un hash después de la copia. Va dentro de un `do $`: suelto exige un bloque de
   transacción explícito y `supabase db push` manda el fichero como un lote sin `begin`.
2. Crear `member_secrets` con su RLS y su `revoke`.
3. Copiar: `insert into member_secrets (member_id, pin_hash, exposed) select id, pin_hash, true from
   members where pin_hash is not null`, dentro de un `do $$` que compruebe que la columna existe,
   para que el fichero sea reejecutable.
4. Cambios en `join_attempts` (A.3).
5. Reescribir todas las funciones (A.2, A.4, A.5, A.6).
6. Una aserción: el número de filas copiadas coincide con el de miembros que tenían hash.
7. `alter table members drop column pin_hash`, lo último. Con eso el hash desaparece también del
   payload de Realtime de `members`.
8. `revoke` y `grant` de todas las funciones tocadas, con su firma exacta.

**Tres funciones nombran hoy la columna y hay que reescribirlas en este mismo fichero**, con la
misma firma, los mismos nombres de parámetro y las mismas columnas de salida: `create_community`
(`:99-100`), `join_community` (`:158-206`) y `add_guest_member` (`:332-333`, que la inserta a nulo de
forma explícita). plpgsql no valida columnas al crear la función: sin esto el `drop column` pasaría
en verde y la primera llamada daría `42703`.

#### A.2 `join_community`, misma firma

Firma intacta: `join_community(p_join_code text, p_username text, p_pin text default null)`. Sigue
devolviendo estados y no lanza excepciones, para que los intentos fallidos se cuenten.

Orden de las comprobaciones:

1. Límite por sesión, como hoy (10 fallos en 15 minutos). La respuesta bloqueada no inserta fila.
2. Código inexistente o caducado, como hoy.
3. Formato del PIN: una cadena vacía equivale a nulo; si viene, tiene que cumplir `^[0-9]{4}$`
   (no `\d`, que en Postgres admite dígitos que no son ASCII). Si no, `invalid_pin`, sin anotarlo
   contra ningún miembro. `create_community` valida lo mismo.
4. Bloquear la fila de la comunidad (`for no key update`) y buscar al miembro activo por nombre.
   El bloqueo serializa el recuento de intentos, la comprobación del PIN, la adopción y el alta, y
   evita que dos sesiones adopten la misma fila a la vez. Se bloquea la comunidad y no la fila del
   miembro porque es el mismo bloqueo que toman `remove_member`, `set_member_admin` y
   `reset_member_pin`: uno solo y siempre el primero, así no hay orden que pueda cruzarse.
   `no key` para no frenar las altas de artículos y gastos, que toman `for key share` por su FK.
5. Si la fila es de otra sesión o no tiene sesión: límite por miembro (A.3).
6. La tabla:

| Estado de la fila                                   | Qué hace                                                  | Estado devuelto       |
| --------------------------------------------------- | --------------------------------------------------------- | --------------------- |
| Tiene PIN y el recibido coincide                    | Pasa la fila a quien llama                                | `ok`                  |
| Tiene PIN y el recibido falta o no coincide         | Nada. Fallo anotado contra el miembro, salvo si es su dueño | `invalid_pin`       |
| Sin PIN y `auth_user_id` nulo (invitado)            | Guarda el PIN si viene y asigna la fila a quien llama     | `ok`                  |
| Sin PIN y `auth_user_id` = quien llama              | Guarda el PIN si viene                                    | `ok`                  |
| Sin PIN y `auth_user_id` de otra sesión             | **Como hoy:** quien llama se queda la fila. Cambia en la B | `ok`                  |

Cuando una fila **cambia de manos** (su `auth_user_id` pasa a ser otro):

- Se borran sus `member_push_tokens`. Si no, el móvil anterior sigue recibiendo las notificaciones
  de la lista y ya no puede darse de baja.
- **Si quien llama ya tenía otra fila activa en esa comunidad, la suelta en la misma transacción**:
  se borra si no tiene historial contable (el criterio de `remove_member`), y si lo tiene se queda
  con `auth_user_id` nulo, sin secreto, sin push tokens y sin rol de admin. Si esa fila era admin,
  el rol pasa a la fila adoptada, porque es la misma sesión. Sin esto el `update` choca con
  `idx_members_active_auth_user` y el usuario ve un `23505`. Es justo el camino de quien olvida el
  PIN, entra como «Ana2» para avisar, y luego recupera «Ana».

Si no existe un miembro con ese nombre:

- Quien llama ya tiene fila activa (renombrarse): si esa fila tiene PIN, el recibido tiene que
  coincidir (`invalid_pin` si no) y **no se sobrescribe**; si no lo tiene, se guarda el recibido.
- Si no tiene fila, se inserta el miembro nuevo.
- El `insert` y el `update` del nombre van en un subbloque `begin ... exception when
  unique_violation` que devuelve `username_taken`. Cubre el doble toque y dos personas eligiendo el
  mismo nombre a la vez. Lo tenía la versión de `20260805120000` y se perdió con el PIN.

#### A.3 Límite de intentos también por miembro atacado

```sql
alter table join_attempts
  add column member_id uuid references members(id) on delete set null;
create index join_attempts_member_idx
  on join_attempts (member_id, attempted_at desc) where member_id is not null;
create index join_attempts_attempted_at_idx on join_attempts (attempted_at);
```

- `on delete set null` y no `cascade`: borrar un miembro no debe borrar fallos que siguen contando
  para el límite por sesión.
- El índice parcial sirve al recuento y a la FK.
- `join_community` anota `member_id` en los fallos de PIN y en los aciertos contra un miembro
  concreto. `username_taken` no se anota contra nadie: una fila sin PIN no tiene nada que adivinar.

Dos límites sobre los fallos contra un mismo miembro, vengan de la sesión que vengan:

- **5 en la última hora.**
- **20 desde el último acierto**, mirando como mucho 30 días atrás. Al llegar, la recuperación de
  esa persona queda bloqueada hasta que un admin la restablezca (A.4).

Los dos devuelven `too_many_attempts` sin insertar fila. **No se aplican al dueño que reentra** (la
fila ya es de su sesión) ni a `set_member_pin`, que solo cuenta los fallos de la propia sesión: si
no, un compañero podría impedirle cambiar su PIN estando dentro.

Los umbrales van en funciones `immutable`, como `join_code_lifetime()`, y no repetidos por el
código. `join_community` borra de paso los intentos de más de 30 días.

Con el tope de 20, la probabilidad de que un compañero de lista acierte un PIN ajeno es del 0,2 %
por cada bloqueo que un admin levante.

#### A.4 Tres RPC nuevas

- **`set_member_pin(p_community_id uuid, p_new_pin text, p_current_pin text default null) returns
  table (status text)`.** Actúa sobre la fila activa de quien llama. Si ya tiene PIN,
  `p_current_pin` tiene que coincidir. Estados: `ok`, `invalid_pin` (el nuevo está mal formado),
  `wrong_pin` (el actual no coincide), `too_many_attempts`. Deja `exposed = false`. Lanza
  `not_a_member` (P0001) si quien llama no es miembro activo. Ojo al escribir el adaptador:
  `invalid_pin` aquí es «mal formado» y en `join_community` es «no coincide».
- **`my_member_pin_state(p_community_id uuid) returns text`.** `'none'`, `'exposed'` o `'set'`,
  solo sobre la fila activa de quien llama; `'none'` si no es miembro. Es lo que la app necesita
  para ofrecer «ponte un PIN» o «cambia tu PIN».
- **`reset_member_pin(p_community_id uuid, p_member_id uuid) returns table (temp_pin text)`.** Solo
  un admin activo, nunca sobre sí mismo. Genera un PIN temporal de 4 cifras con `gen_random_bytes`,
  guarda su hash, pone `auth_user_id` a nulo e `is_admin` a falso, borra los push tokens,
  desliga de ese miembro sus intentos (no los borra: siguen contando para el límite de la sesión
  que los hizo), y **devuelve el PIN temporal al admin**, que se lo dice a la
  persona. Ella entra con su nombre y ese PIN, conserva su `members.id` y su historial, y lo cambia
  con `set_member_pin`. Errores como los de `remove_member`: `forbidden_not_admin` (42501),
  `member_not_found` (P0002), `cannot_reset_self` (P0003).

Las tres llevan `revoke execute ... from public, anon` y `grant execute ... to authenticated` con su
firma exacta.

#### A.5 Un invitado no puede ser admin

- Saneado: `update members set is_admin = false where auth_user_id is null and is_admin`.
- Invariante en la base de datos: `check (not is_admin or auth_user_id is not null)`.
- `set_member_admin` rechaza promover a un objetivo sin sesión (`cannot_promote_guest`, P0005).
  Degradar sigue permitido.
- Los recuentos de «queda otro admin» de `remove_member` y `set_member_admin` añaden
  `and auth_user_id is not null`.
- `remove_member`, `set_member_admin` y `reset_member_pin` empiezan por
  `perform 1 from communities where id = p_community_id for update`. Sin ese bloqueo, dos admins que
  se degradan o se expulsan a la vez se ven el uno al otro como «el otro admin» y la lista queda con
  cero.

#### A.6 `remove_member` rota el código de invitación

En la misma transacción en que archiva o borra, genera un código nuevo y reinicia su caducidad, **solo
si el expulsado tenía sesión o secreto**: quitar un invitado que nunca entró no mata las
invitaciones pendientes. La rotación va escrita dentro de `remove_member`, reutilizando
`generate_join_code()` y `join_code_lifetime()`; no se saca a una función auxiliar, que con los
privilegios por defecto de Supabase podría quedar ejecutable por cualquiera con sesión.

### Migración B (con el incremento 6)

Cuando la app ya avise a cada persona de su estado y el admin tenga el botón de restablecer:

1. **Invalidar los PIN expuestos:** `delete from member_secrets where exposed`. Quien no lo haya
   cambiado para entonces se queda sin PIN.
2. **La fila sin PIN con dueño deja de ser reclamable.** La última fila de la tabla de A.2 pasa a
   no hacer nada y devolver `username_taken`, un estado que todos los clientes instalados ya
   entienden.
3. **Adoptar un invitado exige un PIN válido.**

Antes de aplicarla se cuenta cuántas listas tienen un único admin con sesión y sin PIN, y se avisa a
esas personas.

### Cómo se ensaya

Ninguna de las dos se aplica al proyecto real sin haber corrido antes en un proyecto de Supabase de
prueba: se le aplican todas las migraciones de `supabase/migrations/` y se pasan `test:rls` y
`test:realtime` contra él. No hay Docker en la máquina de desarrollo y, una vez hecho el `drop
column`, no hay vuelta atrás. El procedimiento se escribe en `docs/guias/` junto con la migración A.

## Alternativas consideradas

**Permisos por columna en vez de tabla aparte.** Es una línea y no mueve datos. Se descarta porque
rompe a cualquier cliente o script que haga `select *` sobre `members`, porque no está comprobado
que Realtime con `replica identity full` respete el permiso por columna, y porque deja el secreto a
una política mal escrita de volver a ser legible.

**Una sola migración con todo.** Era el diseño original. Activaba ya la regla de «fila sin PIN no
reclamable», y con ella el creador de una lista antigua, sin PIN y único admin, dejaba de poder
recuperar su fila desde un móvil nuevo sin que nadie pudiera restablecerle. El usuario decidió
esperar a que la app avise. El coste de esperar: entre la A y la B, las filas sin PIN siguen siendo
reclamables y los PIN expuestos siguen valiendo.

**Conservar los PIN actuales para siempre.** Nadie tendría que hacer nada. Se descarta: quien
hubiera copiado un hash antes de la migración entra como otra persona al primer intento.

**Invalidar los PIN en la migración A.** Ver el principio de «Decisión»: con la regla vieja aún
activa dejaría a todos reclamables.

**Solo 5 intentos por hora, sin tope.** Un miembro paciente acierta seguro en 84 días. Se añade el
tope de 20.

**Exigir PIN en el servidor a todo miembro nuevo.** Los APK 1.0.0, 1.1.0 y el 1.2.0 sin update no
mandan PIN y recibirían un `invalid_pin` que no saben pintar. Tras la B un miembro sin PIN ya no es
reclamable, solo irrecuperable sin un admin. Se puede exigir más adelante.

**Que `reset_member_pin` deje la fila sin PIN y adoptable.** Cualquier compañero ve el cambio por
Realtime y puede adoptarla antes que su dueño. Por eso devuelve un PIN temporal.

**Devolver `username_taken` al adoptar teniendo ya otra fila.** Más simple que soltar la fila
anterior, pero deja sin salida el camino normal de recuperación.

**Rotar el código en toda expulsión.** Mataría las invitaciones pendientes también al quitar un
invitado o un duplicado.

**Un estado nuevo (`name_in_use`).** Más preciso, pero los clientes instalados lo tratarían como
error desconocido. Se reutiliza `username_taken`.

## Consecuencias

- **Entre la A y la B el problema 2 sigue abierto y los PIN expuestos siguen valiendo.** La A cierra
  la lectura del hash hacia delante, el límite de intentos, el renombrado, la expulsión y los admins
  sin sesión. No cierra la suplantación de filas sin PIN. Eso obliga a no retrasar el incremento 6.
- **`reset_member_pin` expulsa en el acto a quien sigue dentro** en su móvil: su lista desaparece
  hasta que vuelva a entrar con el PIN temporal, y lo que tuviera en la cola offline falla. Quien
  solo olvidó el PIN pero sigue dentro no necesita restablecer: usa `set_member_pin`... si recuerda
  el actual. Si no, el restablecimiento le cuesta la sesión.
- **El admin conoce el PIN temporal** hasta que la persona lo cambie. Ya podía suplantar a
  cualquiera restableciendo y adoptando, así que no gana poder.
- **El tope de 20 permite bloquear la recuperación de otro.** Un compañero puede gastar los intentos
  de una persona y dejarla sin poder entrar desde un móvil nuevo hasta que un admin la restablezca.
  No afecta a quien ya está dentro.
- **Tras la B, si un admin único pierde la sesión sin PIN, la lista se queda sin admin** y la única
  salida es la secret key. Es el coste de cerrar el problema 2, y la razón de avisar antes.
- **Los clientes instalados siguen funcionando** sin actualizar: mismas firmas, mismos estados. Lo
  único que pierden, tras la B, es adoptar un invitado desde un cliente que no manda PIN.
- **Un nombre ocupado por alguien con PIN sigue viéndose como «PIN incorrecto»** en el cliente, y
  cada intento gasta uno de los 5 de esa persona. El servidor no puede distinguir «soy yo con el PIN
  mal» de «soy otro». El texto se arregla en el incremento 6.
- **El código nuevo tras una expulsión tarda en verse** en los móviles ya abiertos: `communities` no
  está en Realtime y `use-remove-member` no invalida `['join-code']`. Arreglo de cliente, incremento 6.
- **`db.types.ts` se regenera** en el mismo cambio que cada migración.
- **`scripts/rls-isolation-test.mjs` cambia.** Las comprobaciones de las líneas 827 y 840 exigen hoy
  que `pin_hash` sea legible; pasan a exigir lo contrario. La de la línea 836 usa un código después
  de dos expulsiones y tendrá que releerlo. Casos nuevos: `member_secrets` no se lee con sesión de
  miembro; `create_community` y `add_guest_member` siguen funcionando; adoptar teniendo fila propia;
  renombrarse no cambia el PIN sin el anterior; PIN mal formado; el límite por miembro salta desde
  dos sesiones y el tope de 20 bloquea; `set_member_pin` y `my_member_pin_state` completos;
  `reset_member_pin` solo lo ejecuta un admin, devuelve un PIN que funciona y borra los push tokens;
  `anon` no ejecuta ninguna de las tres; tras expulsar a alguien con sesión el código viejo da
  `invalid_join_code`; un invitado no puede ser admin.
- **Lo que este ADR no arregla:**
  - Un miembro archivado sigue pudiendo crear gastos y recetas: tres RPC no filtran `removed_at`. Es
    el incremento 4. Hasta entonces «expulsar» sigue sin expulsar del todo.
  - «Tu gasto» se decide por `created_by_auth_user_id` y no por miembro: quien recupera su identidad
    en otro móvil ya no puede borrar sus gastos antiguos.
  - `get_community_push_tokens` entrega los tokens de los demás.
  - El servidor no valida la longitud del nombre ni colapsa espacios en `join_community`; lo hace
    solo el cliente.
  - No hay lista de vetados: un expulsado que consiga el código nuevo vuelve a entrar.
- La skill `supabase-data` describe `members` con los `unique` completos y lista `username_taken`
  entre los estados sin `invalid_pin`. Se actualiza en el mismo cambio que la migración A.

## Lo que no se ha podido comprobar

El repo no está enlazado a Supabase en la máquina donde se escribió esto. Antes de aplicar la A, en
el editor SQL del proyecto real:

```sql
-- ¿Algo más nombra la columna? (objetos creados a mano en el panel)
select oid::regprocedure from pg_proc where prosrc ilike '%pin_hash%';

-- ¿Cuántas listas se quedarían sin admin al sanear los invitados admin?
select count(*) from communities c
 where not exists (select 1 from members m where m.community_id = c.id and m.removed_at is null
                     and m.is_admin and m.auth_user_id is not null);

-- ¿Puede `authenticated` ejecutar funciones internas?
select has_function_privilege('authenticated', 'generate_join_code()', 'execute');
```

Y antes de la B:

```sql
-- Listas con un único admin con sesión que además no tiene PIN
select count(*) from communities c
 where (select count(*) from members m where m.community_id = c.id and m.removed_at is null
          and m.is_admin and m.auth_user_id is not null) = 1
   and exists (select 1 from members m
                left join member_secrets s on s.member_id = m.id
               where m.community_id = c.id and m.removed_at is null
                 and m.is_admin and s.member_id is null);
```
