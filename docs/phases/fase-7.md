# Fase 7 · Gestión de miembros (RF-11 y RF-12)

- Estado: **completada** (código, migraciones, tests automáticos y build Android superados; lista para verificación en dispositivos físicos).
- Inicio: 2026-09-04 · Cierre: 2026-09-04.
- Requisitos funcionales:
  - **RF-11 · Roles y baja de miembros**: rol `is_admin`, promoción/degradación de administradores, baja física de duplicados o miembros sin historial, y baja lógica/archivo (`removed_at`) de miembros con movimientos para proteger claves foráneas `ON DELETE RESTRICT` y balances. Invariantes de no auto-expulsión y garantía de existencia de al menos un administrador activo.
  - **RF-12 · Participantes invitados en gastos**: creación de participantes sin cuenta (`auth_user_id = null`) para imputarles gastos y cuotas. Herencia y adopción de fila e historial si instalan la app y se unen con ese nombre.
  - **Realtime de miembros**: inclusión de `members` en la publicación `supabase_realtime` con `replica identity full` para sincronización instantánea en todos los dispositivos.
- Documento de diseño: [ADR-0017](../adr/ADR-0017-gestion-de-miembros-y-roles.md).
- Reglas mandatorias: sin sobrecargas de funciones (`DROP FUNCTION` explícito previo en `create_community` y `join_community`, conforme a ADR-0016), y verificación en dispositivo Android real.

---

## Desglose de incrementos de trabajo

### Incremento 1 · Esquema SQL, funciones RPC, RLS y Realtime

**Objetivo:** Establecer el modelo de datos en Supabase, las invariantes de seguridad en funciones transaccionales y la reactividad en tiempo real.

1. **Migración SQL (`supabase/migrations/20260904120000_member_roles_and_guests.sql`):**
   - Alterar `members`: añadir columnas `is_admin boolean not null default false` y `removed_at timestamptz default null`.
   - Modificar `auth_user_id`: relajar a nullable (`alter table members alter column auth_user_id drop not null;`).
   - Sustituir constraints únicos globales por índices únicos parciales sobre activos:
     - `drop index / constraint` de `(community_id, username)`.
     - `create unique index idx_members_active_username on members(community_id, username) where removed_at is null;`.
     - `drop index / constraint` de `(community_id, auth_user_id)`.
     - `create unique index idx_members_active_auth_user on members(community_id, auth_user_id) where removed_at is null and auth_user_id is not null;`.
     - `create index idx_members_community_active on members(community_id) where removed_at is null;`.
   - Actualizar funciones RLS:
     - `member_community_ids()`: filtrar por `and removed_at is null` para revocar acceso inmediato a miembros dados de baja.
     - `current_member_id(p_community_id uuid)`: filtrar por `and removed_at is null`.
   - Limpieza y redefinición de RPCs existentes (evitando sobrecargas PostgREST):
     - `DROP FUNCTION IF EXISTS create_community(text, text, text);`
     - `DROP FUNCTION IF EXISTS create_community(text, text);`
     - Recrear `create_community`: asigna `is_admin = true` al creador.
     - `DROP FUNCTION IF EXISTS join_community(text, text, text);`
     - `DROP FUNCTION IF EXISTS join_community(text, text);`
     - Recrear `join_community`: busca miembros activos (`removed_at is null`), permite a un usuario autenticado reclamar una fila de invitado (`auth_user_id is null` y `pin_hash is null`) estableciendo su nuevo PIN y asociando su `auth_user_id`.
   - Nuevas RPCs transaccionales con `security definer`:
     - `remove_member(p_community_id uuid, p_member_id uuid)`: valida que el invocador sea admin activo, impide auto-expulsión, asegura que la comunidad no quede sin administradores, comprueba si existen registros asociados en `expenses`, `expense_shares` o `settlements`, y ejecuta borrado físico (`delete`) o lógico (`update removed_at = now()`).
     - `add_guest_member(p_community_id uuid, p_username text)`: valida que el invocador sea admin activo y registra un participante con `auth_user_id = null`.
     - `set_member_admin(p_community_id uuid, p_member_id uuid, p_is_admin boolean)`: permite promover o degradar administradores comprobando que permanezca al menos un admin activo.
   - Publicación en Supabase Realtime:
     - `alter publication supabase_realtime add table members;`
     - `alter table members replica identity full;`
2. **Generación de tipos:**
   - Ejecutar `npx supabase gen types typescript` para actualizar `src/shared/lib/db.types.ts`.
3. **Tests de integración de RLS y RPCs:**
   - Ampliar `scripts/rls-isolation-test.mjs` verificando:
     - Creador nace como admin.
     - Invocación de `remove_member` por no admin rechazada.
     - Auto-expulsión denegada.
     - Imposibilidad de dejar a la comunidad con cero administradores.
     - Borrado físico efectivo cuando no hay historial de gastos.
     - Archivo con `removed_at` cuando existen gastos/cuotas/liquidaciones.
     - Creación de invitado y posterior adopción mediante `join_community`.
     - Expulsado pierde acceso RLS de inmediato.

---

### Incremento 2 · Dominio y repositorios

**Objetivo:** Adaptar las entidades, reglas de negocio y contratos de persistencia sin acoplamiento a frameworks en `domain/`, e implementar el adaptador de Supabase en `data/`.

1. **Entidades y tipos en dominio (`src/features/community/domain/`):**
   - Actualizar `CommunityMember`:
     ```typescript
     export type CommunityMember = {
       id: string
       username: string
       isSelf: boolean
       isAdmin: boolean
       isGuest: boolean
       removedAt?: string | null
     }
     ```
   - Casos de uso puros y validaciones en dominio:
     - Validación de nombres de invitados.
     - Reglas de negocio sobre administradores y miembros activos vs archivados.
2. **Contrato del repositorio (`CommunityRepository`):**
   - Incorporar métodos:
     - `removeMember(communityId: string, memberId: string): Promise<{ mode: 'deleted' | 'archived' }>`
     - `setMemberAdmin(communityId: string, memberId: string, isAdmin: boolean): Promise<void>`
     - `addGuestMember(communityId: string, username: string): Promise<CommunityMember>`
     - `subscribeMembers(communityId: string, onChange: () => void): () => void`
3. **Implementación en adaptador Supabase (`supabaseCommunityRepository`):**
   - Asegurar `assertOnline()` en peticiones sueltas.
   - Invocación a RPCs correspondientes envolviendo fallos con `serverError`.
   - `listMembers`: retornar miembros activos (y permitir consulta opcional con archivados si es requerida para balances).
   - `subscribeMembers`: crear canal Realtime con `filter: community_id=eq.${communityId}` para `members`.
4. **Integración con reparto de gastos (`src/features/expenses/`):**
   - Actualizar `useExpenseSummary` y `calculateBalances`: los miembros dados de baja que posean saldo pendiente (`netBalanceCents !== 0`) deben computarse y mostrarse en el balance hasta su liquidación total.
   - En selectores de nuevo gasto / edición de gasto: filtrar estrictamente miembros activos.
5. **Tests unitarios (Jest):**
   - Pruebas unitarias de casos de uso y de `supabaseCommunityRepository` con mocks en `__tests__/`.

---

### Incremento 3 · Presentación y UI accesible

**Objetivo:** Ofrecer una experiencia de usuario clara, accesible y reactiva en Android, con soporte offline pragmático y feedback inmediato.

1. **Hooks y mutaciones TanStack Query:**
   - `useCommunityMembers`: incluir suscripción Realtime que invalide la query ante cambios.
   - Mutaciones optimistas: `useRemoveMemberMutation`, `useSetAdminMutation`, `useAddGuestMutation`.
2. **Pantalla de gestión de miembros:**
   - Nueva pantalla `MembersScreen` (o modal/sección accesible desde los ajustes de la comunidad).
   - Lista accesible con chips informativos: «Tú», «Admin», «Invitado».
   - Menú contextual o botones de acción para administradores:
     - «Hacer administrador» / «Quitar administrador».
     - «Eliminar miembro» con diálogo de confirmación accesible (Paper `Dialog` / `Portal`).
     - Botón flotante o superior «Añadir invitado».
   - Visualización restringida para no administradores (modo lectura sin botones destructivos).
3. **Internacionalización (i18n):**
   - Claves en español e inglés para roles, diálogos de confirmación, advertencias de baja y errores en `src/shared/lib/i18n/locales/`.
4. **Accesibilidad (WCAG AA):**
   - Targets táctiles ≥ 44×44 pt.
   - Contrastes AA en modo claro y oscuro.
   - Etiquetas `accessibilityLabel`, `accessibilityRole` y `accessibilityHint` en cada acción.

---

### Incremento 4 · Verificación exhaustiva y pruebas en dispositivo real

**Objetivo:** Confirmar que todos los criterios de aceptación de RF-11 y RF-12 se cumplen en backend, frontend y dispositivos Android reales.

1. **Scripts automatizados:**
   - `npm test`: suite completa de Jest pasando al 100%.
   - `npm run test:rls`: verificación de aislamiento de datos y RPCs de miembros.
   - `npm run test:realtime`: verificación de la propagación de eventos Realtime de miembros.
   - `npm run typecheck` y `npm run lint`: sin errores ni advertencias.
2. **Prueba en dispositivos reales Android con Expo Go:**
   - **Caso 1 (RF-11 - Borrado físico de duplicado):** Admin crea lista, usuario entra dos veces por error; admin elimina el duplicado sin movimientos; la fila desaparece en ambos dispositivos en < 2 segundos sin recargar.
   - **Caso 2 (RF-11 - Baja lógica con historial):** Miembro participa en un gasto; admin lo da de baja; desaparece del selector de nuevos gastos pero su nombre e historial se mantienen en el detalle de gastos anteriores y en la pantalla de balance mientras la deuda siga viva.
   - **Caso 3 (RF-11 - Seguridad e invariantes):** Intento de auto-expulsión denegado; intento de dejar la lista sin administradores bloqueado con mensaje amigable; usuario normal no puede ejecutar acciones de admin.
   - **Caso 4 (RF-12 - Invitado y adopción posterior):** Admin añade invitado «Carlos»; se imputa un gasto a Carlos; en un segundo móvil se instala la app e ingresa con el código de lista y el nombre «Carlos»; hereda automáticamente la fila, su historial y su saldo.

---

## Resultados de validación técnica

1. **Migración SQL aplicada en Supabase:**
   - `supabase/migrations/20260904120000_member_roles_and_guests.sql` aplicada con éxito con `npx supabase db push --linked --yes`.
   - `src/shared/lib/db.types.ts` regenerado con los nuevos campos y firmas de RPC.
2. **Aislamiento RLS y RPCs de backend (`npm run test:rls`):**
   - **51/51 comprobaciones correctas** (incluyendo roles, auto-expulsión denegada, preservación del último admin, revocación inmediata de acceso RLS tras baja, borrado físico de duplicados limpios, archivo lógico con historial, y adopción de invitados por `join_community`).
3. **Propagación en tiempo real (`npm run test:realtime`):**
   - **18/18 comprobaciones correctas** (incluyendo emisión de eventos Realtime INSERT y DELETE sobre la tabla `members` en la comunidad propia y aislamiento con respecto a otras comunidades).
4. **Batería de tests unitarios y de integración (`npm test`):**
   - **45 suites ejecutadas, 45 pasadas (100%)**.
   - **345 tests ejecutados, 345 pasados (100%)**.
5. **Tipado estricto y Calidad de Código:**
   - `npm run typecheck`: **0 errores**.
   - `npm run lint`: **0 errores/warnings**.
6. **Compilación / Export Android:**
   - `npx expo export --platform android`: **compilación limpia completada sin incidencias**.
