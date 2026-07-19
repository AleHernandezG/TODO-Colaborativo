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

### Base de datos

Migraciones aplicadas al proyecto remoto el 2026-07-19 con `npx supabase db push`:

- `20260718120000_initial_schema.sql` — las tres tablas con sus constraints e índices,
  trigger de `updated_at` y publicación de `items` en Realtime.
- `20260718120100_rls_policies_and_rpcs.sql` — RLS activo, políticas de select/insert/update/
  delete, funciones `member_community_ids()` y `current_member_id()`, y las RPC
  `create_community`, `join_community` y `generate_join_code`, con sus grants.

`scripts/rls-isolation-test.mjs` verifica el aislamiento entre comunidades con dos sesiones
anónimas reales contra la API REST. Sin dependencias: `node --env-file=.env scripts/rls-isolation-test.mjs`.

**Test de aislamiento en verde** (2026-07-19), que es lo que convierte ADR-0002 en una
decisión verificada y cubre el punto E de la auditoría de la §11 del documento maestro:

```
OK   El join_code no lleva caracteres ambiguos — PFW-QN7E
OK   Un miembro puede escribir en su propia comunidad — HTTP 201
OK   A no lee los artículos de B — 0 filas
OK   Sin filtro, A solo ve lo suyo — 0 filas ajenas
OK   A no lee la comunidad de B — 0 filas
OK   A no lee los miembros de B — 0 filas
OK   A no puede insertar en la comunidad de B — HTTP 403
OK   A no puede modificar un artículo de B — 0 filas afectadas
OK   A no puede robar un artículo moviéndolo a su comunidad — 0 filas afectadas
OK   Un join_code inexistente da invalid_join_code — HTTP 400
OK   Un username ya usado da username_taken — HTTP 400

11/11 comprobaciones correctas
```

Fíjate en el matiz entre insertar y modificar: insertar en comunidad ajena da 403, pero
modificar un artículo ajeno da 200 con **cero filas afectadas**. No es un fallo. PostgREST
aplica la política de select antes del update, así que la fila sencillamente no existe para
quien la ataca. Al comprobar RLS a mano, un 200 no significa que haya funcionado; hay que
mirar cuántas filas se tocaron.

Un `db push` desde Windows sin Docker suelta un warning de `docker_engine` al final. Es el
cacheo local del catálogo de migraciones y no afecta al push remoto: la línea que vale es
"Finished supabase db push". Docker solo hace falta para levantar Supabase en local.

### Decisiones sobre la marcha

Cosas que se decidieron al escribir las migraciones, demasiado concretas para un ADR pero que
no se explican solas leyendo el SQL.

**`items_update` lleva `using` y `with check`, no solo `using`.**
`using` decide qué filas puedes tocar; `with check` decide en qué pueden convertirse. Con solo
`using`, un miembro de A podía coger un artículo suyo y moverlo a B con un
`update ... set community_id`, o al revés. Es un fallo de aislamiento que las lecturas cruzadas
no detectan, porque la política de select seguiría siendo correcta. El test lo comprueba
("A no puede robar un artículo moviéndolo a su comunidad").

**El `join_code` se genera en la base de datos, no en el cliente.**
`generate_join_code()` sortea y reintenta hasta encontrar uno libre, dentro de la misma
transacción que inserta la comunidad. Es el único sitio donde la comprobación de unicidad y la
inserción no pueden cruzarse con las de otro dispositivo. Generándolo en el cliente, dos
móviles pueden proponer el mismo código y el segundo se lleva un error de clave única en la
cara del usuario. Reintenta 10 veces y si no lo consigue lanza `join_code_generation_failed`:
un bucle infinito ahí dejaría la petición colgada cuando el espacio de códigos se sature.

**Las funciones se revocan de `public` y `anon`, y se conceden solo a `authenticated`.**
Postgres da `execute` a `public` por defecto, lo que en una función `security definer` significa
que la ejecuta cualquiera con los privilegios del dueño. Con sesión anónima de Supabase el rol
efectivo es `authenticated` (`anon` es quien llega sin token), así que la app no pierde nada.
Detalle y plantilla para funciones futuras en la skill `supabase-data`.

### Proyecto Expo

Generado sobre la plantilla oficial y **fijado en SDK 54** (React Native 0.81.5, React 19.1.0,
TypeScript 5.9), recortada: fuera las pantallas de ejemplo, el `reset-project.js` y los
`README`/`CLAUDE.md`/`AGENTS.md` de la plantilla, que habrían pisado los nuestros.

Estructura de §5.2 montada, tokens en `src/theme`, `Button` en `src/shared/ui`, i18n en
español y la landing renderizando.

Verificado: `eslint` sin errores, `tsc --noEmit` limpio, 9 tests en verde y
`npx expo export --platform android` compilando. Lo último importa más de lo que parece: el
typecheck no prueba que Metro y NativeWind estén bien configurados, el bundle sí.

El bundle de Android pesa **4.64 MB de bytecode Hermes**, más **1.31 MB** de
`MaterialCommunityIcons.ttf`, que arrastra Paper. Son los datos para cualquier discusión futura
sobre el tamaño de la app: `node_modules` ronda el giga y no viaja al móvil. Esa fuente de
1.31 MB es la mitad de lo que Paper cuesta de verdad y merece recorte cuando el diseño esté
cerrado y se sepa qué iconos se usan.

### La versión del SDK la manda el dispositivo, no la CLI

El proyecto se creó primero en **SDK 57**, que es lo que da `create-expo-app@latest`, y al
escanear el QR el Expo Go del móvil respondió *"Project is incompatible with this version of
Expo Go"*. El dispositivo de pruebas tiene **Expo Go cliente 54.0.8, que solo admite SDK 54**,
y el Play Store no le ofrece actualización.

Se bajó el proyecto a SDK 54. `npx expo install --fix` alinea las dependencias de Expo pero
**no toca las de desarrollo**: `jest-expo`, `babel-preset-expo`, `eslint-config-expo`,
`typescript` y `@types/react` se quedaron en la versión de SDK 57 y hubo que bajarlas a mano,
más un borrado de `node_modules` y `package-lock.json`, porque npm resolvía contra el árbol
viejo y daba conflictos de peers que señalaban a React cuando la causa era otra.

La lección, ya metida en `CLAUDE.md`: **se pregunta qué SDK admite el Expo Go del dispositivo
antes de crear el proyecto.** La última versión que devuelve la CLI no sirve como referencia, y
un Expo Go que no puede actualizarse es un techo duro: o bajas el SDK o te pasas a development
build y pierdes la comodidad del QR.

Reglas de arquitectura que ahora aplica ESLint en vez de la buena voluntad:

- `src/features/*/domain/**` no puede importar React, React Native, Supabase, Expo ni `data/`.
- `react-native-paper` no se puede importar fuera de `src/shared/ui` (excepción: el layout
  raíz, que es donde se monta el provider). Es ADR-0004 convertido en error de lint.

### Decisiones sobre la marcha, segunda tanda

**La sesión de Supabase va en AsyncStorage, no en expo-secure-store.**
`CLAUDE.md` decía secure-store y estaba equivocado. SecureStore tiene un límite de ~2048 bytes
por valor y la sesión de Supabase (access token + refresh token en JSON) lo supera. El fallo
no sería un error limpio, sería una sesión que a veces no persiste. `expo-secure-store` se
desinstaló al no quedar nada que guardara ahí.

**`react-dom` sigue en las dependencias aunque no compilamos para web.**
Lo quité al recortar la plantilla y `npm install` reventó: `expo-router` arrastra componentes
de Radix para su interfaz de depuración, que declaran `react-dom` como peer. Sin él, npm
intenta traer el `react-dom` más nuevo, que exige un React más nuevo del que pinnea el SDK, y
el árbol de dependencias no resuelve. Sí se quitó `react-native-web`, así que
`expo start --web` no funciona: esto es una app móvil.

**`babel-preset-expo` es dependencia de desarrollo explícita.**
Con un `babel.config.js` propio (necesario para NativeWind), Jest lo resuelve desde la raíz del
proyecto y no lo encuentra si solo está como dependencia transitiva. Sin esto, `npm test` falla
con "Cannot find module 'babel-preset-expo'" y el error no menciona a NativeWind por ningún
lado.

**El test de tokens comprueba contraste, no colores.**
`src/theme/__tests__/tokens.test.ts` calcula la ratio de contraste WCAG de cada pareja de
colores en claro y oscuro y exige AA (4.5:1). Así, cambiar un token a un valor bonito pero
ilegible rompe la suite en vez de llegar a producción. La accesibilidad es requisito duro y
esta es la parte que se puede automatizar.

### Higiene del repositorio

- `.gitignore` reescrito. Estaba en UTF-16 con BOM (de un `echo >>` desde PowerShell) y git
  no lo interpretaba: la regla `.env` que parecía estar puesta no filtraba nada. Ahora es
  UTF-8 y cubre Expo, `ios/`, `android/`, secretos de firma, y `.claude/settings.local.json`.
  Si añades reglas desde PowerShell usa `Add-Content -Encoding utf8`, o vuelve a romperse.
- `.env` y `.env.example` creados, vacíos. Pendiente rellenar `.env.example` con los nombres
  de variable cuando exista el proyecto Expo.

---

## Pendiente

Backend, y en este orden:

- [x] Proyecto Supabase creado (`mnjhkqpeeivitpfejoxq`), claves en `.env`
- [x] **"Allow anonymous sign-ins" activado** (2026-07-19, ver abajo). Venía desactivado de
      fábrica y sin esto no hay `auth.uid()`: ni RLS ni el flujo de entrada funcionan
- [x] `npx supabase login` y `npx supabase link --project-ref mnjhkqpeeivitpfejoxq`
- [x] `npx supabase db push` — migraciones aplicadas
- [x] **Test de aislamiento en verde** (11/11, salida arriba)
- [x] `src/shared/lib/db.types.ts` generado
- [x] Comunidades de prueba borradas (base a cero: 0 comunidades, 0 artículos)

App:

- [x] Proyecto Expo + TypeScript strict (**SDK 54**, el que admite el Expo Go del dispositivo)
- [x] ESLint + Prettier y los scripts `lint`, `typecheck`, `test` en `package.json`
- [x] Script `test:rls` apuntando a `scripts/rls-isolation-test.mjs`
- [x] Estructura de carpetas de §5.2
- [x] Design tokens en `src/theme` y `Button` en `shared/ui`
- [x] i18n con ES por defecto
- [ ] **Landing renderizando en un iPhone real vía Expo Go** — lo único que queda, y hay que
      hacerlo a mano: `npx expo start` y escanear el QR
- [ ] `Input` y `Card` en `shared/ui` (se añaden cuando haya pantallas que los pidan, no antes)

---

## Cómo activar las sesiones anónimas

1. Abre https://supabase.com/dashboard/project/mnjhkqpeeivitpfejoxq/auth/providers
   (menú lateral: **Authentication** → **Sign In / Providers**).
2. Arriba del todo, antes de la lista de proveedores (Email, Google, Apple...), hay un bloque
   **User Signups**.
3. Activa el interruptor **Allow anonymous sign-ins**. Guarda si te lo pide.

Comprobación rápida de que quedó activo, sin salir de la terminal:

```bash
curl -s -X POST "https://mnjhkqpeeivitpfejoxq.supabase.co/auth/v1/signup" \
  -H "apikey: TU_PUBLISHABLE_KEY" -H "Content-Type: application/json" \
  -d "{\"data\":{},\"gotrue_meta_security\":{}}"
```

Con el interruptor activo devuelve un JSON con `access_token`. Si devuelve
`anonymous_provider_disabled`, el cambio no se guardó.

El token de una sesión anónima trae `"role": "authenticated"` junto a `"is_anonymous": true`.
Comprobado el 2026-07-19 contra este proyecto, y es lo que justifica que las migraciones
concedan `execute` a `authenticated` y se lo revoquen a `anon`.

---

## Cómo probar

Backend, ejecutable ya:

```bash
node --env-file=.env scripts/rls-isolation-test.mjs
```

Debe terminar en `11/11 comprobaciones correctas`. Sale con código 1 si falla algo, así que
sirve tal cual en CI. Pásalo después de **cualquier** cambio en políticas o RPCs, no solo al
cerrar la fase.

La parte de app se rellena cuando haya app. El formato es pasos concretos y reproducibles, no
"comprobar que funciona". Para cualquier cosa que toque sincronización hacen falta dos
dispositivos.

---

## Deuda técnica asumida

- La identidad vive en el dispositivo: desinstalar la app pierde la sesión y crea un miembro
  nuevo. Consecuencia conocida de ADR-0002, se arregla con auth real post-beta (§9.4).
- Usuarios anónimos huérfanos acumulándose en `auth.users`. Hará falta una limpieza periódica.
- Sin rate limiting todavía en `join_community`. Es una mitigación recomendada ya (§9.3), no
  post-beta: sin ella el espacio de códigos se puede barrer a fuerza bruta.
- **`react-native-mmkv` no funciona en Expo Go.** Es un módulo nativo y necesita development
  build. La persistencia offline de la Fase 4 depende de él, así que al llegar ahí hay que
  elegir: pasarse a development build (y perder la comodidad de probar escaneando un QR) o
  usar AsyncStorage como almacén de la caché de TanStack Query. Detectado en Fase 0 para que
  no sea una sorpresa en la 4.
