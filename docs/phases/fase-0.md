# Fase 0 · Cimientos

- Estado: **en curso**
- Inicio: 2026-07-18

Entregable de la fase (§12 del documento maestro): la app arranca, conecta con Supabase y
muestra la landing vacía.

---

## Hecho

### Configuración de Claude Code

Tres skills de proyecto en `.claude/skills/`. Se cargan solas cuando el trabajo entra en su
territorio, así que las convenciones no dependen de que alguien se acuerde de repetirlas en
cada prompt.

| Skill | Cubre |
|---|---|
| `expo-stack` | Fronteras de import entre capas, Zustand vs TanStack Query, mutación optimista con rollback, Realtime, offline, accesibilidad |
| `supabase-data` | Esquema, RLS, RPCs, Realtime, generación de tipos, manejo de claves |
| `qa-runner` | Orden de lint/typecheck/test, prueba manual, cierre de fase |

Se buscaron skills de comunidad para Expo y Supabase en los seis marketplaces configurados:
no existe ninguna. Se descartó `database-design@claude-code-workflows` (Postgres genérico)
porque se solapa con `supabase-data` y su recomendación de IDs `BIGINT IDENTITY` contradice
el `uuid` + `gen_random_uuid()` del esquema.

Instalado el plugin `skill-creator@claude-plugins-official` para poder iterar sobre estas
skills más adelante.

### Decisiones de arquitectura

- [ADR-0001](../adr/ADR-0001-eleccion-de-backend.md) — Supabase como backend. Ratifica lo que
  ya decidía el documento maestro (§6.3), para que el repo se explique solo.
- [ADR-0002](../adr/ADR-0002-modelo-de-sesion-y-rls.md) — **decisión nueva.** El documento
  maestro dejaba las políticas RLS abiertas (§7.3) a la espera del modelo de sesión. Se cierra
  con sesión anónima de Supabase + `members.auth_user_id` + función `security definer`.
  Léelo antes de tocar nada de autenticación o RLS.

### Higiene del repositorio

- `.gitignore` reescrito. Estaba en UTF-16 con BOM (de un `echo >>` desde PowerShell) y git
  no lo interpretaba: la regla `.env` que parecía estar puesta no filtraba nada. Ahora es
  UTF-8 y cubre Expo, `ios/`, `android/`, secretos de firma, y `.claude/settings.local.json`.
  Si añades reglas desde PowerShell usa `Add-Content -Encoding utf8`, o vuelve a romperse.
- `.env` y `.env.example` creados, vacíos. Pendiente rellenar `.env.example` con los nombres
  de variable cuando exista el proyecto Expo.

---

## Pendiente

- [ ] Proyecto Expo + TypeScript strict (versión de SDK compatible con Expo Go de la App Store)
- [ ] ESLint + Prettier y los scripts `lint`, `typecheck`, `test` en `package.json`
- [ ] Estructura de carpetas de §5.2
- [ ] Design tokens en `src/theme` y `shared/ui` mínimo (Button, Input, Card)
- [ ] Proyecto Supabase creado y esquema aplicado
- [ ] Políticas RLS de ADR-0002 aplicadas
- [ ] **Prueba de aislamiento entre comunidades ejecutada, con su resultado pegado aquí**
- [ ] `src/shared/lib/db.types.ts` generado
- [ ] i18n con ES por defecto
- [ ] Landing vacía renderizando en un iPhone real vía Expo Go

---

## Cómo probar

Se rellena cuando haya app. El formato es pasos concretos y reproducibles, no "comprobar que
funciona". Para cualquier cosa que toque sincronización hacen falta dos dispositivos.

---

## Deuda técnica asumida

- La identidad vive en el dispositivo: desinstalar la app pierde la sesión y crea un miembro
  nuevo. Consecuencia conocida de ADR-0002, se arregla con auth real post-beta (§9.4).
- Usuarios anónimos huérfanos acumulándose en `auth.users`. Hará falta una limpieza periódica.
- Sin rate limiting todavía en `join_community`. Es una mitigación recomendada ya (§9.3), no
  post-beta: sin ella el espacio de códigos se puede barrer a fuerza bruta.
