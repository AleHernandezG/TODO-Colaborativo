# ADR-0017: Gestión de miembros, roles y participantes invitados

- Estado: Aceptado
- Fecha: 2026-09-04
- Resuelve: RF-11 (Roles y baja de miembros) y RF-12 (Participantes invitados en gastos) para la Fase 7.
- Relacionado con: [ADR-0002](ADR-0002-modelo-de-sesion-y-rls.md), [ADR-0005](ADR-0005-reparto-de-gastos.md), [ADR-0015](ADR-0015-pin-por-miembro-para-identidad-no-suplantable.md), [ADR-0016](ADR-0016-clasificacion-de-errores-y-mensaje-al-usuario.md).

## Contexto

Con la Fase 6 cerrada y verificada en dispositivos reales, la app cuenta con catálogo de productos y reparto de gastos entre miembros (`expenses`, `expense_shares`, `settlements`). No obstante, el modelo de miembros mantenía limitaciones de la fase beta inicial:

1. **Sin gestión de bajas ni limpieza de duplicados:** Si una persona entraba dos veces por error con nombres distintos (ej. «Ana» y «Ana 2») o si alguien dejaba el grupo de convivencia, no existía mecanismo para quitar a ese miembro.
2. **Restricción estricta de integridad referencial:** Las cuatro claves foráneas de gastos a `members` (`expenses.paid_by_member_id`, `expense_shares.member_id`, `settlements.from_member_id`, `settlements.to_member_id`) están definidas con `ON DELETE RESTRICT`. Un borrado directo de un miembro que haya participado en gastos provocaría un error `23503 (foreign_key_violation)` y corrompería los balances contables del grupo.
3. **Ausencia de roles y permisos:** Todos los miembros tenían idénticos privilegios. No existía la figura de administrador para moderar la lista, evitar expulsiones arbitrarias o delegar la administración.
4. **Participantes no usuarios (invitados):** En escenarios cotidianos (cenas con amigos, visitas temporales), participan personas que no tienen la app instalada ni cuentan con un dispositivo en el grupo. Se necesita poder imputarles gastos o incluirlos en el reparto sin obligarles a instalar la app ni romper el modelo de balances.
5. **Falta de Realtime en `members`:** La tabla `members` no formaba parte de la publicación `supabase_realtime`, obligando a reinicios de sesión o recargas manuales para percibir nuevas incorporaciones o cambios.

## Decisión

Se adopta un modelo integral de miembros que combina **roles administrativos**, **baja híbrida (física o lógica según historial)**, **participantes invitados sin sesión de auth** y **sincronización en tiempo real**:

### 1. Modelo de datos en `members`

- **Columna `is_admin boolean not null default false`:** Indica si el miembro posee facultades administrativas en la comunidad. Quien crea la comunidad (`create_community`) recibe `is_admin = true` de forma automática.
- **Columna `removed_at timestamptz default null`:** Marca temporal de baja/archivo. Un valor no nulo identifica a un miembro histórico retirado.
- **Columna `auth_user_id uuid null`:** Se relaja la restricción `not null` para permitir participantes invitados creados por un administrador sin usuario de autenticación asociado.
- **Índice único parcial para `username`:**
  Se elimina el constraint `unique (community_id, username)` y se sustituye por:
  ```sql
  create unique index idx_members_active_username
    on members (community_id, username)
    where removed_at is null;
  ```
  Esto permite que si un miembro es archivado, su nombre quede liberado para su posterior reutilización en la comunidad.
- **Índice único parcial para `auth_user_id`:**
  Se elimina el constraint `unique (community_id, auth_user_id)` y se sustituye por:
  ```sql
  create unique index idx_members_active_auth_user
    on members (community_id, auth_user_id)
    where removed_at is null and auth_user_id is not null;
  ```
  Garantiza que un usuario autenticado solo tenga un registro activo por comunidad, permitiendo múltiples filas `null` (invitados) y desvinculando registros de usuarios dados de baja si reingresan en el futuro.
- **Índice para filtrado de activos:**
  ```sql
  create index idx_members_community_active
    on members (community_id)
    where removed_at is null;
  ```

### 2. Baja híbrida mediante RPC transaccional (`remove_member`)

La expulsión o baja de un miembro se encapsula en una función `security definer`:
- **Comprobación de autorización:** El invocador debe ser un miembro activo con `is_admin = true` de la misma comunidad.
- **Invariante de no auto-expulsión:** Nadie puede auto-expulsarse (`p_member_id <> caller_member_id`). Quien desee salir debe ser retirado por otro admin o solicitarlo.
- **Invariante de admin mínimo:** Si el miembro a expulsar es administrador, la comunidad debe contar al menos con otro administrador activo adicional.
- **Decisión de borrado según historial:**
  La función inspecciona si el miembro aparece en:
  1. `expenses` (`paid_by_member_id = p_member_id`)
  2. `expense_shares` (`member_id = p_member_id`)
  3. `settlements` (`from_member_id = p_member_id` o `to_member_id = p_member_id`)
  
  - **Sin historial:** Se ejecuta un `DELETE` físico de la fila en `members`. Es el caso típico de duplicados creados por error tipográfico o miembros que se unieron sin realizar movimientos. Desaparece por completo de la base de datos.
  - **Con historial:** Se ejecuta un `UPDATE members SET removed_at = now() WHERE id = p_member_id`. No se rompen las restricciones `ON DELETE RESTRICT`, se preserva la integridad contable y el miembro retirado permanece visible en gastos históricos y balances hasta su liquidación.
- Devuelve `status: 'deleted' | 'archived'`.

### 3. Participantes invitados (`add_guest_member`) y adopción de identidad

- **Creación de invitado:** Un admin puede invocar la RPC `add_guest_member(p_community_id uuid, p_username text)`. Inserta un miembro con `auth_user_id = null`, `pin_hash = null` e `is_admin = false`.
- **Efecto en RLS:** Las funciones `member_community_ids()` y `current_member_id()` comparan `auth_user_id = auth.uid()`. Dado que `null = auth.uid()` evalúa a `null` (falso), los invitados no conceden privilegios de acceso a ningún cliente anónimo.
- **Participación contable:** El dominio de gastos habla de `member_id` (`MemberRef`), por lo que un invitado puede ser pagador o deudor sin requerir cambios en el cálculo de balances.
- **Adopción posterior de cuenta:** Si en el futuro esa persona se instala la app e introduce el `join_code` y su nombre de invitado, `join_community` detecta el miembro con `auth_user_id is null` y `pin_hash is null`. El nuevo usuario adopta la fila: asigna su `auth.uid()`, registra su nuevo `pin_hash` y asume el historial acumulado.

### 4. Gobernanza y asignación de roles (`set_member_admin`)

- Un admin puede conceder o retirar el rol de administrador a otro miembro activo mediante `set_member_admin(p_community_id, p_member_id, p_is_admin)`.
- Si se intenta retirar el rol de admin (`p_is_admin = false`), se valida que quede al menos un administrador activo en la comunidad.

### 5. Seguridad a nivel de fila (RLS) y aislamiento

- **`member_community_ids()` y `current_member_id()`:**
  Se actualizan para incluir la condición `and removed_at is null`:
  ```sql
  create or replace function member_community_ids()
  returns setof uuid
  language sql stable security definer set search_path = public as $$
    select community_id from members where auth_user_id = auth.uid() and removed_at is null
  $$;
  ```
  En el instante en que un miembro es retirado, pierde de forma inmediata el acceso a consultas e inserciones en listas, gastos y miembros de esa comunidad.
- **Lectura de miembros:** Los miembros activos de una comunidad pueden leer todos los miembros de su comunidad (`members_select`), lo cual permite seguir mostrando el nombre del autor en gastos históricos o liquidar saldos pendientes de miembros archivados.

### 6. Publicación en Supabase Realtime

- Se añade la tabla `members` a la publicación:
  ```sql
  alter publication supabase_realtime add table members;
  alter table members replica identity full;
  ```
- El repositorio de comunidad suscribe un canal Realtime filtrado por `community_id=eq.<id>`, invalidando las consultas de miembros en TanStack Query ante eventos `INSERT`, `UPDATE` o `DELETE`.

### 7. Regla de compatibilidad de RPCs (ADR-0016)

Para prevenir errores `PGRST203` por sobrecargas en PostgREST:
- La migración incluye sentencias explícitas `DROP FUNCTION IF EXISTS` de las firmas previas de `create_community` y `join_community` antes de su recreación.

## Alternativas consideradas

1. **Borrado físico siempre (ON DELETE CASCADE en gastos):**
   - *Descartada:* Borrar en cascada un miembro borraría sus gastos o sus cuotas de reparto, desbalanceando las cuentas del resto del grupo y haciendo desaparecer deudas reales.
2. **Borrado lógico siempre (archivar todo):**
   - *Descartada:* Si un usuario escribe «Anaa» por error y entra de nuevo como «Ana», archivar «Anaa» mantendría un registro basura en la base de datos de forma perpetua. El borrado condicional según historial limpia la basura real sin poner en riesgo la contabilidad.
3. **Tabla separada `guest_participants`:**
   - *Descartada:* Forzaría a duplicar o hacer polimórficas todas las claves foráneas de `expenses`, `expense_shares` y `settlements` (`member_id` vs `guest_id`), complicando severamente el cálculo de balances y requiriendo un proceso de migración de datos si el invitado se une a la app. Reusar `members` con `auth_user_id = null` resuelve el problema con coste cero en el modelo relacional.
4. **Permitir a cualquiera quitar a cualquiera (sin roles):**
   - *Descartada:* En un grupo abierto, cualquier miembro o invitado podría expulsar al creador de la lista o a otros participantes de forma hostil o accidental.

## Consecuencias

### Positivas
- **Gestión limpia de miembros:** Se pueden corregir duplicados accidentales al instante sin dejar huella.
- **Seguridad contable garantizada:** Ningún saldo ni gasto se corrompe al dar de baja a un participante con historial.
- **Inclusión de invitados:** Se pueden repartir gastos de viajes o cenas con personas que no usen la app.
- **Sincronización en vivo:** Altas, bajas y cambios de rol se reflejan de inmediato en todos los móviles conectados.

### Negativas / Deuda asumida
- Los miembros retirados con balance pendiente deben ser contemplados en la pantalla de balance hasta que su deuda quede en cero.
- Si una persona con historial fue dada de baja y quiere reingresar con el mismo nombre, el registro previo archivado permanece en la base de datos y se crea uno nuevo, conservándose el historial anterior bajo el id previo.
