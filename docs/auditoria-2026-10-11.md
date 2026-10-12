# Auditoría del 2026-10-11: cambio de listas, PIN antiguo y versiones que no llegan

Auditoría de solo lectura. No se editó código ni se publicó nada en EAS ni en Supabase.
Hecha sobre `main` (`cd4d1e7`) y contrastada con `origin/feat/expo-sdk-57` (`a364876`) y con EAS.

> **Actualización del 2026-10-11:** la decisión 0 está tomada. `feat/expo-sdk-57` se fusionó en `main`
> y el proyecto es SDK 57. El incremento 1 está hecho; detalle en `docs/phases/fase-15.md`, apartado 7.
> El resto del informe describe el estado anterior a la fusión, salvo el apartado 7, que se
> reescribió el 2026-10-12 con los prompts al día.

Leyenda: **✔** lo leí yo en el código o en la salida de un comando; **○** viene solo del informe
de un agente y no lo he contrastado.

## Índice

1. [Lo primero: hay dos líneas de código](#1-lo-primero-hay-dos-líneas-de-código)
2. [Pregunta 1: cambiar entre listas](#2-pregunta-1-cambiar-entre-listas)
3. [Pregunta 2: listas anteriores al PIN](#3-pregunta-2-listas-anteriores-al-pin)
4. [Pregunta 3: móviles a los que no llegan las versiones](#4-pregunta-3-móviles-a-los-que-no-llegan-las-versiones)
5. [Comprobaciones](#5-comprobaciones)
6. [Fallos encontrados, por gravedad](#6-fallos-encontrados-por-gravedad)
7. [Plan de arreglos](#7-plan-de-arreglos)

---

## 1. Lo primero: hay dos líneas de código

El móvil lleva una versión que no está en `main`.

|                         | `main` (`cd4d1e7`)         | `origin/feat/expo-sdk-57` (`a364876`) |
| ----------------------- | -------------------------- | ------------------------------------- |
| SDK                     | 54                         | **57**                                |
| `version` en `app.json` | 1.2.0                      | 1.3.1                                 |
| Selector de listas      | no                         | sí (Fase 15, ADR-0025)                |
| Builds en EAS           | APK 1.2.0 del 2026-08-03   | APK 1.3.0 y 1.3.1 del 2026-10-09      |
| Updates por aire        | 8 grupos                   | **ninguno**                           |

- La rama sale de `34011ca` y lleva 5 commits que `main` no tiene; `main` lleva `cd4d1e7`, que la
  rama no tiene.
- Las dos tocan `CLAUDE.md`, `docs/phases/fase-14.md` y `eslint.config.js`: fusionarlas dará
  conflictos.
- **Contradicción a resolver:** el `CLAUDE.md` de la rama dice «SDK 57 desde octubre de 2026»,
  subido por decisión del usuario; el de `main` dice «SDK fijado en 54. No lo subas». El build
  1.3.1 ya es SDK 57.

### De dónde sale cada número de versión

| Sitio                                   | Valor                         | Para qué se usa                                                                                   |
| --------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `app.json` → `expo.version`             | 1.2.0 en `main`, 1.3.1 en la rama | Versión del APK y, por `runtimeVersion.policy: appVersion`, la runtime de los updates          |
| `eas.json` → `appVersionSource: remote` | —                             | Solo gobierna el `versionCode`. `autoIncrement` está solo en `production`: todos los APK llevan 1 |
| `package.json` → `version`              | 1.0.0                         | Nadie lo usa                                                                                      |
| Pie de la pantalla de lista             | `v<version> · <id o base>`    | `Constants.expoConfig.version` + id del update (`src/shared/lib/build-info.ts:11-12`)             |
| Tienda                                  | no hay                        | —                                                                                                 |

La revisión anterior leyó 1.2.0 porque leyó `main`; EAS construyó la rama.

---

## 2. Pregunta 1: cambiar entre listas

**Conclusión: existe y está en el build 1.3.1, pero solo ahí y en el 1.3.0. No está en `main`, no
está en ningún update por aire y no está en la 1.2.0. Nadie lo ha visto aún en un Android real.**

### Qué hace el usuario (1.3.1)

1. En la pantalla de lista, toca el **título de la lista**, que lleva un `▾`
   (TalkBack: «Lista {nombre}», pista «Abre tus listas para cambiar de una a otra»).
2. Se abre el diálogo **«Tus listas»**: una fila por lista con el nombre y «Como {usuario}»; la
   activa lleva «✓ Abierta».
3. Toca otra fila y la pantalla cambia sin navegar.
4. Debajo hay **«Crear otra lista»**, **«Unirme con un código»** y **«Cerrar»**.
5. En la portada, si la sesión ya pertenece a alguna lista, aparece **«Vuelve a una de tus
   listas»** encima de los botones.

En la 1.2.0 el único camino es «Salir de esta lista» y volver a entrar con código, nombre y PIN.
La rama elimina ese botón.

### Qué lo sostiene (leído en la rama)

| Pieza       | Dónde                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------- |
| Ruta        | Ninguna nueva. `/list` → `ItemsScreen` → `ActiveList` → `ItemsView key={community.id}`                            |
| Componentes | `CommunitySwitcher.tsx`, `MembershipList.tsx`, `MyListsShortcut.tsx`, `shared/ui/PickerDialog.tsx`                |
| Store       | `useActiveCommunityStore` (clave `active-community` en AsyncStorage), sin cambio de forma                         |
| Query       | `['my-communities']` → `CommunityRepository.listMine()`: `members` con la comunidad embebida, por `auth_user_id` y `removed_at is null` |
| Hooks       | `use-my-communities`, `use-enter-community`, `use-open-community`, `use-active-membership-sync`                   |
| Dominio     | `community/domain/my-memberships.ts`                                                                              |
| Origen      | Commit `77255bd` (2026-10-05), ADR-0025, `docs/phases/fase-15.md`. Sin migración                                  |

### Comprobado y deducido

- **Comprobado:** el código de la rama, y que los builds `a8a36a6b` (1.3.0) y `5f8bd1c3` (1.3.1) se
  hicieron desde `77255bd` y `a364876`.
- **Deducido:** que funcione en el móvil. `fase-15.md` dice «Android real: Pendiente».
- **Límite de diseño:** «mis listas» son las de la sesión anónima de ese móvil. Tras reinstalar o
  borrar datos sale vacío.

### Guion de prueba

Android con el APK 1.3.1; segundo móvil para los pasos 7 y 8.

1. Mira el pie de la lista: debe decir `v1.3.1 · base`.
2. Con una lista abierta, toca el título con `▾`. Sale «Tus listas», la lista marcada «✓ Abierta»
   y «Por ahora solo estás en esta lista».
3. Pulsa «Crear otra lista», rellena nombre, usuario y PIN. Entras en la nueva; el atrás del
   sistema no debe volver al formulario.
4. Abre el selector y toca la primera. Cambian título, artículos y código del pie.
5. En el selector pulsa «Unirme con un código» y cancela con el atrás de Android. Vuelves a la
   lista en la que estabas.
6. Cierra la app del todo y ábrela: arranca en la última lista abierta.
7. Desde el segundo móvil, como admin, quita al primero de su lista abierta. Al volver a primer
   plano, el primero pasa a su otra lista con «Ya no estás en «…». Te hemos llevado a «…»».
8. Con el primero en la lista A, añade un artículo en la B desde el segundo. Ojo: el repo no tiene
   `google-services.json`, así que es probable que no llegue ninguna notificación (deducido).
9. Modo avión: el selector enseña las listas guardadas y deja cambiar.

---

## 3. Pregunta 2: listas anteriores al PIN

**Conclusión: un miembro sin PIN entra desde cualquier móvil con el código de la lista, su nombre
y cuatro cifras cualesquiera; esas cifras quedan como su PIN sin que nadie se lo diga. Lo mismo
puede hacerlo cualquier otra persona que tenga el código y sepa el nombre.**

La función vigente es `supabase/migrations/20260904120000_member_roles_and_guests.sql:112-211`.
No hubo backfill: `20260824130000_member_pin.sql:5-6` solo añade la columna.

### Qué pasa en cada caso

| Caso                                                | Qué pasa                                                                                                                         | Prueba                                                          |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Mismo móvil, sesión conservada, no sale de la lista | Sigue dentro. Nunca se le pide PIN y `pin_hash` sigue nulo                                                                       | La app no llama a `join_community` si hay `membership` guardada |
| Mismo móvil, sale y vuelve a entrar                 | El cliente exige 4 cifras (`join-community.ts:25`). El servidor devuelve `ok` y las fija como PIN                                | `:166-174`                                                      |
| Móvil nuevo o app reinstalada                       | Igual: `ok`, PIN fijado, la fila pasa al móvil nuevo                                                                             | `:168`                                                          |
| Otra persona con el código y el nombre              | Igual: se queda la identidad, fija su PIN y hereda `is_admin`                                                                    | `:166-174`; no se mira de quién es la fila                      |
| El móvil original tras ser reclamado                | Pierde el acceso sin aviso. En la 1.2.0 ve la lista vacía; en la 1.3.1 vuelve a la portada con «Ya no estás en…»                 | Deducido de la RLS y de `use-active-membership-sync`            |

### Casos sin salida

- **Otro reclamó tu nombre con un PIN, u olvidaste el tuyo y perdiste la sesión.** Ves «El PIN no
  es correcto para este usuario» para siempre. No existe ninguna RPC para restablecer el PIN. La
  única salida es que un admin te quite y entres como miembro nuevo, con el historial de gastos
  partido.
- **Lo anterior, siendo el único admin.** No hay salida desde la app; solo con la secret key.
- **Único miembro en la 1.2.0 que pulsó «Salir» con el código caducado (7 días).** Nadie dentro
  puede rotarlo (deducido). En la 1.3.1 lo resuelve «Vuelve a una de tus listas», si la sesión
  sigue viva.

### El mensaje equivocado

Desde la migración del PIN el servidor ya no devuelve `username_taken`. Quien elige un nombre
ocupado por alguien con PIN ve «PIN incorrecto» (`supabase-community-repository.ts:85-87`), y cada
intento cuenta para el bloqueo de 15 minutos.

### Más grave que todo lo anterior: el PIN no protege nada hoy

La política `members_select` es por fila y no hay permisos por columna, así que cualquier miembro
puede leer el `pin_hash` de los demás. El propio test lo hace
(`scripts/rls-isolation-test.mjs:753`). Un bcrypt de 4 cifras son 10.000 candidatos y se rompe en
segundos. Comprobado en el SQL y en el test; no he comprobado si además viaja por Realtime.

### Qué debe hacer hoy esa persona

1. Mientras siga dentro en su móvil, que apunte el código de invitación y, si está caducado, pulse
   «Generar código nuevo».
2. Que entre con «Unirme con un código» usando exactamente el mismo nombre y un PIN que elija. En
   la 1.2.0 tiene que pulsar antes «Salir de esta lista»; en la 1.3.1 se hace desde el selector.
3. Que lo haga antes de cambiar de móvil o reinstalar, y antes que nadie más.

Cuántos miembros están así no lo sé; lo dice esta consulta en el editor SQL de Supabase:

```sql
select count(*) filter (where pin_hash is null and auth_user_id is not null) as sin_pin,
       count(*) filter (where pin_hash is null and is_admin) as admins_sin_pin
  from members where removed_at is null;
```

### Guion de prueba

Dos Android; uno puede ser Expo Go si se usa `main`.

1. Móvil A, como admin: en Miembros añade un invitado «Prueba». Un invitado nace sin PIN, igual
   que un miembro antiguo.
2. Móvil B: «Entrar con un código», código de la lista, nombre «Prueba», PIN 1111. Debe entrar sin
   ningún aviso de que acaba de fijar un PIN.
3. Móvil B: sal (o borra los datos de la app) y vuelve a entrar con «Prueba» y PIN 2222. Debe
   decir «El PIN no es correcto para este usuario».
4. Móvil B: repite con 1111. Entra.
5. Móvil B: entra con el nombre exacto del admin del móvil A y un PIN cualquiera. Debe decir «PIN
   incorrecto», no «nombre cogido»: ese es el fallo de mensaje.
6. Con una lista real anterior al 2026-08-24: desde B entra con el nombre de un miembro antiguo y
   PIN 3333. Entra, y el móvil de esa persona se queda sin lista. Confirma la suplantación; hazlo
   con una lista de prueba.

---

## 4. Pregunta 3: móviles a los que no llegan las versiones

**Conclusión: las tres hipótesis se confirman y la tercera es peor de lo planteado. No es que
falte un APK nuevo: ya se publicaron dos updates contra un APK que no puede ejecutarlos.**

### Builds en EAS

Todos con perfil y canal `preview`, distribución interna.

| Versión / runtime | Fecha      | Commit               | SDK | Estado                 | Updates que puede recibir |
| ----------------- | ---------- | -------------------- | --- | ---------------------- | ------------------------- |
| 1.0.0             | 2026-07-22 | `aeae5e9`            | 54  | terminado              | 1 («Fase 2»)              |
| 1.1.0             | 2026-08-03 | `a7b552f`            | 54  | terminado              | 0                         |
| 1.2.0             | 2026-08-03 | `8dbcee7` («Fase 3») | 54  | terminado              | 8                         |
| 1.2.0             | 2026-09-08 | `34011ca` (Fase 14)  | 54  | **falló en Gradle**    | —                         |
| 1.3.0             | 2026-10-09 | `77255bd`            | 57  | 1 fallido, 1 terminado | 0                         |
| 1.3.1             | 2026-10-09 | `a364876`            | 57  | terminado              | 0                         |

Id del build 1.3.1: `5f8bd1c3-988a-433a-97d7-d26f2f74d503`.

### Updates publicados (rama `preview`)

| Mensaje                                                  | Runtime | Grupo      |
| -------------------------------------------------------- | ------- | ---------- |
| Fase 14: Modo supermercado y categorias (2026-09-08)     | 1.2.0   | `b318117c` |
| Fases 11-13: recetas, planificador de menus y fotos      | 1.2.0   | `5b55fc8d` |
| Rebuild expense split UI into separate routes            | 1.2.0   | `96f20bba` |
| Ship catalog, member PIN, expense split and error codes  | 1.2.0   | `1c2955a1` |
| Fase 5: id cliente, rotación de código, inglés           | 1.2.0   | `0cd1a39c` |
| Generate item ids on the client                          | 1.2.0   | `af1952ea` |
| Fix replaced item photo and tighten footer and dialog    | 1.2.0   | `1e9c9b7f` |
| Fix replaced item photo and tighten footer and dialog    | 1.2.0   | `9a1b94ac` |
| Fase 2: tiempo real y presencia                          | 1.0.0   | `d77b683a` |

**Canales:** `preview` (rama `preview`) y `development` (vacío). El canal `production` no existe
en EAS.

### Las tres hipótesis

**(a) Runtime y canal: confirmada.** El canal no es el problema, todos van por `preview`. Lo es la
runtime: quien tenga la 1.1.0 no ha recibido nunca nada, y quien tenga la 1.3.x tampoco.

**(b) No se actualiza solo: confirmada.**

- No hay tienda, y la app no tiene código que compruebe versiones: el único uso de `expo-updates`
  es leer el id para el pie.
- Con los valores por defecto, un update se descarga en un arranque en frío y se aplica en el
  siguiente. No se comprueba al volver a primer plano y nadie pide reiniciar.
- Los enlaces de descarga caducan: el del APK 1.2.0 venció el 2026-08-17 y el del 1.3.1 vence el
  **2026-10-23**.

**(c) Módulos nativos: confirmada, y ya ha hecho daño.**

- El único APK 1.2.0 es del 3 de agosto. Después entraron `expo-print` y `expo-sharing` (Fase 8),
  `@sentry/react-native` (Fase 9) y `expo-notifications` y `expo-device` (Fase 10), sin subir la
  `version`.
- Aun así se publicaron contra la runtime 1.2.0 los updates «Fases 11-13» y «Fase 14».
- `ItemsScreen` importa `use-push-notifications.ts`, que carga `expo-notifications` y
  `expo-device` al importar el módulo.
- **Deducido, no visto en un móvil:** el APK de agosto revienta al cargar esos updates y
  `expo-updates` lo devuelve al último que funcionó, o se queda roto. El pie lo dirá: si un móvil
  con 1.2.0 enseña el id de «Rebuild expense split UI» (el `01a0682a` de `CLAUDE.md`) en vez de
  uno más nuevo, es esto.
  - **Corrección del 2026-10-11:** `01a0682a` no es el id de «Rebuild expense split UI» (grupo
    `96f20bba`). Es el id de Android del grupo anterior, `1c2955a1` («Ship catalog, member PIN,
    expense split and error codes», commit `9b5a03c`), según `docs/phases/fase-6.md` (Tarea 3). El
    id de Android de `96f20bba` no está apuntado en el repo: lo da `eas update:view` de ese grupo.
    Un móvil con 1.2.0 que enseñe `01a0682a` está un update por detrás del último válido, no en él.
    Detalle en `docs/phases/fase-15.md`, apartado 8.
- Es exactamente el caso que `docs/guias/despliegue.md:134-139` prohíbe.

### Por qué no se vio antes

- En el entorno `preview` de EAS solo hay dos variables; falta `EXPO_PUBLIC_SENTRY_DSN`. Sentry no
  está activo en ningún APK.
- Un `eas update` lanzado hoy desde `main` iría a la runtime 1.2.0, no a los móviles con 1.3.1.

### Cómo conseguir que una versión estable se actualice sola

| Opción                                                                 | Qué consigue                                                                           | Coste                                                                                                                                                              |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1. `runtimeVersion` por `fingerprint`**                              | Un cambio nativo cambia la runtime solo; no vuelve a pasar lo de la Fase 8             | ADR, y cada cambio nativo obliga a APK nuevo (ya era así)                                                                                                          |
| **2. Comprobar updates al volver a primer plano y ofrecer «Reiniciar»** | Los cambios de JS llegan en minutos, no en dos arranques                               | Un hook y un envoltorio en `shared/`; cuidado con la cola offline, que se vacía al aplicar un update                                                               |
| **3. Aviso dentro de la app que obligue a instalar**                   | Quien tenga un APK viejo ve «instala la versión nueva» con el enlace                   | Una tabla compartida de solo lectura con la versión mínima y la URL; un sitio estable para el APK (GitHub Releases vale); el usuario sigue instalando a mano       |
| **4. Update «puente» a la runtime 1.2.0**                              | Lleva el aviso de la opción 3 a los móviles atascados y deja de servirles un bundle roto | Hay que construirlo desde un árbol compatible con el APK de agosto (SDK 54, sin los módulos de las fases 8 a 10)                                                   |
| **5. Play Store, prueba interna o cerrada**                            | Actualización automática de verdad                                                     | 25 USD una vez; AAB con el perfil `production`; los testers necesitan cuenta de Google. Si la firma de Play no coincide con la del APK actual, hay que desinstalar una vez |

**Recomendación: 1 + 2 + 3 ahora, 4 como parche inmediato y 5 cuando la versión sea estable.**
El motivo para no empezar por Play Store: desinstalar borra la sesión anónima, y con el PIN como
está hoy cada reinstalación es una reentrada reclamable por cualquiera. Primero el PIN.

Los móviles con 1.0.0 y 1.1.0 no son alcanzables por ninguna vía automática: hay que pasarles el
enlace.

---

## 5. Comprobaciones

Todo sobre `main`.

| Comprobación                  | Resultado                                                               |
| ----------------------------- | ----------------------------------------------------------------------- |
| `npm run lint`                | Limpio                                                                  |
| `npm run typecheck`           | Limpio                                                                  |
| `npm test`                    | 60 suites, 431 tests en verde                                           |
| `npm run test:coverage`       | Global 90,65 %; por carpeta hay cuatro por debajo del 70 %              |
| `npm run test:rls`            | **No ejecutado**: no hay `.env`                                         |
| `npm run test:realtime`       | **No ejecutado**: no hay `.env`                                         |
| `npx supabase migration list` | **No ejecutado**: esta copia no está enlazada (`ProjectRefNotLinkedError`) |

En lugar del `migration list` se hizo un sondeo de solo lectura contra el proyecto remoto, con la
publishable key que está en EAS: `items.category`, `recipes.image_path`, `meal_plan_slots` y
`member_push_tokens` existen. `20260907180000_item_categories.sql` está aplicada; el resto de
migraciones no se han podido confirmar una a una.

### Lo que decía la revisión anterior

- **Cobertura: confirmado.** `expenses/data` 61,7 %, `recipes/data` 62,5 %, `meal-planner/data`
  66,7 %, y `meal-planner/domain` 67,5 % en ramas. El umbral de `jest.config.js` es global y por
  eso no salta.
- **Áreas táctiles en el planificador: confirmado**, cuatro controles:
  - «Ir a la semana actual» (`MealPlannerScreen.tsx:209`, unos 16 pt)
  - las dos pestañas de `AssignMealModal.tsx:117` y `:132` (unos 32 pt)
  - «Seleccionar todo» (`ConsolidatedReviewModal.tsx:85`, unos 24 pt)
- **Atrás de Android en `ShoppingModeScreen`: confirmado** que no se trata. El atrás normal es
  inofensivo; el daño está en «Finalizar compra» (`:74`), que hace `router.replace('/list')` y deja
  dos pantallas de lista apiladas.

---

## 6. Fallos encontrados, por gravedad

### Críticos

| #   |     | Fallo                                                                                                                                                         |
| --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ✔   | `pin_hash` legible por cualquier miembro de la lista. Anula ADR-0015                                                                                          |
| 2   | ✔   | Un miembro sin PIN lo reclama cualquiera con el código y el nombre, heredando el rol de admin                                                                 |
| 3   | ✔   | `save_recipe` sobrescribe la receta de otra comunidad: el `on conflict (id) do update` no comprueba la comunidad (`20260907170000_recipe_cover_photo.sql:124-130`) |
| 4   | ✔   | Dos updates publicados contra la runtime 1.2.0 con módulos nativos que su APK no tiene                                                                        |
| 5   | ✔   | El código del build 1.3.1 no está en `main`, y las dos líneas se contradicen en el SDK                                                                        |

### Altos

| #   |     | Fallo                                                                                                                                                                                         |
| --- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | ✔   | Ningún aviso de versión nueva ni comprobación de updates en la app                                                                                                                            |
| 7   | ✔   | Sentry sin DSN en EAS: no hay telemetría de fallos                                                                                                                                            |
| 8   | ✔   | «Nombre ocupado» se muestra como «PIN incorrecto» y consume intentos                                                                                                                          |
| 9   | ✔   | No hay forma de restablecer un PIN; un admin único bloqueado no tiene salida                                                                                                                  |
| 10  | ✔   | El canal de Realtime `members:<id>` se abre dos veces en `/expenses` (`ExpensesScreen.tsx:45` y `use-expense-summary.ts:24`). El agente comprobó en Node que la segunda apertura lanza una excepción; no visto en dispositivo |
| 11  | ○   | Ninguna mutación de las fases 7 a 12 es optimista ni encolable; en el planificador un fallo del servidor no deja rastro en pantalla                                                           |
| 12  | ○   | Un miembro archivado sigue pudiendo crear gastos y recetas: tres RPC no filtran `removed_at`                                                                                                  |
| 13  | ○   | Expulsar no rota el código: el expulsado vuelve a entrar al momento                                                                                                                           |
| 14  | ○   | El servidor no valida el formato del PIN y el límite de intentos es por sesión anónima, no por miembro atacado                                                                                |
| 15  | ✔   | `assertOnline()` sin `await` en `supabase-notifications-repository.ts:19`, `:45` y `:55`: no bloquea nada                                                                                     |
| 16  | ✔   | Claves de i18n que no existen (`common.close`, `items.row.checkHint`, `items.row.uncheckHint`, entre otras): se pinta la clave cruda                                                          |
| 17  | ✔   | Fases 7 a 14 marcadas «completada» sin prueba en Android real registrada                                                                                                                      |
| 18  | ○   | Sin `google-services.json`: el push no puede funcionar en un APK de EAS (deducido)                                                                                                            |

### Medios

| #   |     | Fallo                                                                                                                                                                                       |
| --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 19  | ✔   | Cobertura por debajo del 70 % en cuatro carpetas, tapada por el umbral global                                                                                                               |
| 20  | ○   | Controles sin etiqueta ni rol de accesibilidad y siete áreas táctiles pequeñas en `meal-planner`, `items` y `recipes`                                                                       |
| 21  | ○   | `meal-planner/domain/meal-plan.ts:1` importa de `@/features/recipes`, cuyo índice arrastra React y Supabase; el lint no lo ve                                                               |
| 22  | ○   | `EditRecipeScreen` sube y borra fotos fuera de la mutación: si falla el guardado, la receta apunta a un fichero borrado                                                                     |
| 23  | ○   | Colores que no existen en Tailwind (`text-content-muted`) y blanco fijo sobre el primario en modo oscuro                                                                                    |
| 24  | ○   | Siete funciones `security definer` sin `revoke`/`grant`, y `recipe_ingredients` publicada en Realtime sin `community_id`                                                                    |
| 25  | ○   | El spinner de arranque puede quedarse para siempre si falla la lectura de AsyncStorage                                                                                                      |
| 26  | ○   | `CLAUDE.md`, `despliegue.md` y los diarios 7 a 14: 42 discrepancias. Las que inducen a error: fase actual, 39/39 y 15/15 (el agente cuenta 65 y 18), y la guía sin Sentry, sin FCM y sin la regla de los config plugins |

---

## 7. Plan de arreglos

> **Reescrito el 2026-10-12.** Los prompts de abajo sustituyen a los originales: están puestos al día
> con lo que ya se hizo (fusión a SDK 57, migraciones del PIN y de recetas escritas) y cada uno se
> puede pegar tal cual en una sesión nueva de Claude Code, sin más contexto.

### Estado y orden

| Orden | Incremento                                    | Estado                                                    |
| ----- | --------------------------------------------- | --------------------------------------------------------- |
| —     | 1. Unificar las ramas                         | Hecho (`febae87`)                                         |
| —     | 2. Dejar de servir el bundle roto a la 1.2.0  | Hecho en EAS (grupo `c3353939`); falta verlo en un móvil  |
| 1.º   | 3 y 4. Aplicar las dos migraciones            | Escritas y revisadas, **sin aplicar**                     |
| 2.º   | 6. Pantalla del PIN y migración B             | Sin empezar. Va antes que el 5                            |
| 3.º   | 5. Updates por aire y aviso de versión        | Sin empezar                                               |
| 4.º   | 7. Realtime duplicado y navegación            | Sin empezar                                               |
| 5.º   | 8. Mutaciones, i18n y accesibilidad           | Sin empezar                                               |
| 6.º   | 9. Cobertura                                  | Sin empezar                                               |
| 7.º   | 10. Cierre: documentación y dispositivo       | Sin empezar                                               |
| 8.º   | 11. Play Store en prueba interna              | Sin empezar                                               |

El 6 va antes que el 5 porque, hasta que exista la migración B, una fila sin PIN la puede reclamar
cualquiera con el código de la lista (ADR-0026). El 7 y el 8 se pueden intercambiar; el 9 va después
de los dos porque ambos cambian código que hay que cubrir.

### Cómo usar los prompts

- **Una sesión nueva por incremento.** Copia el bloque entero y pégalo.
- Cada prompt nombra las skills, los agentes y los plugins que le tocan. Los agentes solo leen e
  informan; quien corrige es la sesión principal.
- **Ninguno hace commit, push, `eas update`, `eas build` ni `supabase db push`.** Te dejan el
  comando preparado.
- Todos piden plan antes de tocar nada, y terminan con la skill `qa-runner` y con la documentación
  escrita en el repo.
- Si al abrir la sesión `git status` no está limpio o `main` no está al día, páralo antes de seguir.

---

### Incrementos 3 y 4. Aplicar las dos migraciones

Requisito: el ordenador que tiene `.env`. Agentes: `migration-reviewer` si hay que corregir el SQL.

```
Vas a aplicar a Supabase dos migraciones que están escritas y revisadas pero no se han ejecutado
nunca. Trabajas en el repo de la lista de la compra colaborativa (Expo SDK 57 + Supabase).

ANTES DE NADA lee entero docs/traspaso-2026-10-12.md y sigue su apartado 4 paso a paso (pasos 0 a
4). Lee también docs/guias/ensayar-una-migracion.md, que es el procedimiento del paso 1.

Las migraciones, en este orden:
- supabase/migrations/20261012120000_member_secrets_and_identity_hardening.sql (ADR-0026, A)
- supabase/migrations/20261012130000_recipes_isolation_and_archived_members.sql

Carga la skill `supabase-data` antes de tocar nada de base de datos.

Reglas de esta sesión:
- Primero al proyecto de ENSAYO, nunca directo al real. Yo creo el proyecto de prueba en
  supabase.com y relleno .env.ensayo; dime cuándo lo necesitas y qué claves pedir.
- Antes de cada comando que escriba en Supabase (`supabase link`, `supabase db push`, los tests,
  que crean listas de prueba) enséñame el comando exacto y contra qué proyecto va, y espera mi OK.
- Si `db push` falla en el ensayo: copia el error literal, NO toques el proyecto real, corrige el
  .sql (todavía se puede editar: no está aplicado en ningún sitio), pásalo por el agente
  `migration-reviewer` y repite el ensayo.
- Ensaya también la copia de hashes con datos (apartado «Si la migración mueve datos» de la guía):
  es el único paso irreversible.
- Esperado en el ensayo y después en el real: `npm run test:rls` 102/102 (101/102 sin
  SUPABASE_SECRET_KEY) y `npm run test:realtime` 18/18. Si una comprobación falla solo por el
  código HTTP y el comportamiento es el correcto, ajusta el test, no el SQL, y dímelo.
- Antes de aplicar al real lanza conmigo las consultas del paso 2 del traspaso y enséñame los
  resultados. Si alguna no da lo esperado, para.
- Tras aplicar al real: regenera src/shared/lib/db.types.ts con `gen types --linked` DESDE GIT
  BASH, y corre typecheck, lint y `npm test`.

Al terminar:
- Anota los resultados, con fecha, en docs/phases/fase-15.md (apartados 9 y 10, tablas
  «Verificación»), cambia el estado del ADR-0026 a «migración A aplicada el <fecha>», actualiza su
  fila en docs/README.md y quita de CLAUDE.md (sección «Comandos») el aviso de que 32
  comprobaciones necesitan las migraciones.
- Dime cómo probar a mano con el APK 1.3.1: crear una lista, unirse con código y PIN, añadir un
  gasto, registrar una liquidación y guardar una receta.
- No hagas commit ni push: dime qué ficheros y con qué mensaje.
```

---

### Incremento 6. Pantalla del PIN, mensajes de unirse y migración B

Requisito: las migraciones `20261012120000` y `20261012130000` aplicadas al proyecto real.
Agentes: `architecture-guard`, `pr-review-toolkit:silent-failure-hunter`, `migration-reviewer`.

```
Vas a darle pantalla a las tres RPC del PIN que ya existen en el servidor, arreglar los mensajes de
la pantalla de unirse, y después escribir la segunda migración de ADR-0026. Repo: lista de la
compra colaborativa (Expo SDK 57, TypeScript strict, TanStack Query, Zustand, Supabase).

LEE PRIMERO, enteros:
- docs/adr/ADR-0026-pin-fuera-de-members-y-recuperacion-de-identidad.md (el diseño; la «Migración
  B» es lo que cierras al final)
- docs/phases/fase-15.md, apartados 9 y 10
- docs/auditoria-2026-10-11.md, apartado 3 y los fallos 2, 8 y 9 del apartado 6
- docs/adr/ADR-0016-clasificacion-de-errores-y-mensaje-al-usuario.md y DESIGN.md

Comprueba antes de empezar que las migraciones 20261012120000 y 20261012130000 están aplicadas
(`npx supabase migration list --linked`). Si no lo están, para y dímelo: este incremento depende
de ellas.

Carga la skill `expo-stack` antes de tocar src/ y la skill `supabase-data` antes de tocar SQL. Usa
el plugin `context7` si necesitas la API exacta de una librería en la versión instalada.

ENSÉÑAME UN PLAN Y ESPERA MI OK antes de escribir código. Hazlo en estos incrementos, cada uno con
lint, typecheck y tests en verde antes de pasar al siguiente:

A. Datos y dominio (src/features/community)
- Puerto y adaptador para `set_member_pin`, `my_member_pin_state` y `reset_member_pin`. Cada
  método empieza por `await assertOnline()` y envuelve con `serverError('<operacion>', error)`.
- OJO: `invalid_pin` en `set_member_pin` significa «no son cuatro cifras» y «no coincide» es
  `wrong_pin`; en `join_community` `invalid_pin` significa «no coincide». Que el dominio no los
  confunda.
- Casos de uso puros en domain/ con sus tests. Reutiliza domain/pin.ts.

B. Pantallas (presentation/)
- Aviso en la lista según `my_member_pin_state`: `none` → «ponte un PIN»; `exposed` → «cambia tu
  PIN» (explica en una frase por qué); `set` → nada. Es una query, no estado en Zustand.
- Pantalla o diálogo para fijar y cambiar el PIN. Fijarlo NO es optimista: la respuesta la decide
  el servidor. Documéntalo como excepción a la regla de mutaciones, igual que `create_community`.
- En la pantalla de miembros, solo para admins: «Restablecer PIN», con confirmación que avise de
  que esa persona sale de la lista hasta que vuelva a entrar, y que enseñe el PIN temporal de
  forma que se pueda copiar y dictar.
- En esa misma pantalla, no ofrezcas «hacer admin» a un invitado sin sesión: el servidor lo
  rechaza con P0005.
- `use-remove-member` invalida `['join-code', communityId]`: expulsar a alguien con sesión rota el
  código de invitación.

C. Pantalla de unirse (JoinCommunityScreen)
- El mensaje de PIN incorrecto cubre los dos casos reales, porque el servidor no los distingue:
  «soy yo con el PIN mal» y «ese nombre es de otra persona». Di qué hacer en cada uno y qué hacer
  si se ha olvidado (pedir a un admin que lo restablezca).
- `username_taken` SIGUE VIVO: la migración A lo devuelve otra vez y la B lo usará más. No lo
  borres, aunque la auditoría original lo diera por código muerto.
- «Demasiados intentos» dice el plazo y se pinta en línea, no en un snackbar que desaparece.
- `submit` no hace nada si `isPending` (hoy el teclado puede lanzar una segunda petición).
- Separa en dos el `throw` de supabase-community-repository.ts que dice «estado desconocido: ok».

Reglas que aplican a A, B y C: textos en es.json y en.json (hay un test que falla si se
desincronizan); `accessibilityLabel` y `accessibilityRole` en cada control, área táctil de 44 pt,
contraste AA, estado no solo por color; errores con `showError(cause)` o `useFailureMessage()`,
nunca inspeccionando el error en presentation/; nada de imports de react-native-paper fuera de
src/shared/ui.

Al terminar A, B y C lanza en paralelo los agentes `architecture-guard` (sobre
src/features/community) y `pr-review-toolkit:silent-failure-hunter` (sobre el flujo de unirse y
el del PIN), y corrige lo que encuentren.

D. Migración B de ADR-0026 (solo cuando A, B y C estén probados en un móvil)
- Diseño primero, en una nota del ADR o en un ADR nuevo si cambia algo respecto a lo escrito;
  pásalo por `migration-reviewer` y espera mi OK antes del .sql.
- Contenido: borrar los secretos con `exposed = true`; la fila sin PIN que es de otra sesión deja
  de ser reclamable y devuelve `username_taken`; adoptar un invitado exige un PIN válido.
- `join_community` solo puede devolver estos seis estados, que son los que conocen los APK
  instalados: ok, invalid_join_code, expired_join_code, username_taken, invalid_pin,
  too_many_attempts. Ni uno más.
- Antes de aplicarla, lanza conmigo la consulta del final del ADR que cuenta las listas con un
  único admin sin PIN: a esas personas hay que avisarlas antes.
- Añade a scripts/rls-isolation-test.mjs las comprobaciones de la B.
- Ensayo en el proyecto de prueba (docs/guias/ensayar-una-migracion.md) y, con mi OK, al real. El
  `db push` lo lanzo yo.

Para probar en el móvil: esto es solo JS, así que llega por aire a los APK 1.3.1. Dame el comando
de `eas update --branch preview --environment preview` con su mensaje; lo lanzo yo. Antes
comprueba con `git diff` que no ha cambiado `plugins` de app.json ni ninguna dependencia nativa.

Cierre: skill `qa-runner`. Escribe en docs/phases/fase-15.md qué se hizo, las decisiones sobre la
marcha y un guion de prueba con dos móviles (fijar PIN, cambiarlo, restablecerlo desde el admin y
recuperar la fila en el otro móvil, intentar reclamar una fila ajena). Actualiza la skill
`expo-stack` o `supabase-data` si aparece una regla nueva. No hagas commit ni push.
```

---

### Incremento 5. Updates por aire y aviso de versión

Agentes: `pr-review-toolkit:silent-failure-hunter`, `architecture-guard`, `migration-reviewer`.

```
Vas a hacer que la app se entere de que hay una versión nueva y que los updates por aire lleguen
sin depender de dos arranques en frío. Repo: lista de la compra colaborativa (Expo SDK 57).

LEE PRIMERO:
- docs/auditoria-2026-10-11.md, apartado 4 entero y los fallos 4, 6 y 7 del apartado 6
- docs/guias/despliegue.md entero
- docs/phases/fase-15.md, apartados 7 y 8
- src/shared/lib/build-info.ts, src/shared/lib/query-persister.ts, src/shared/lib/observability.ts
  y src/shared/ui/BuildTag.tsx

Contexto que tienes que respetar:
- El proyecto es SDK 57 y `app.json` está en la versión 1.3.1. NO subas el SDK. La skill
  `upgrading-expo` del plugin `expo` no se usa en este repo: si se carga sola, ignórala y dímelo.
- Hay móviles con un APK 1.2.0 (SDK 54) que no pueden ejecutar nada de lo que hay en main. No
  publiques nada contra la runtime 1.2.0.
- Hoy el único uso de expo-updates es leer el id para el pie de la pantalla. No hay código que
  compruebe ni aplique updates: todo va por los valores por defecto.

Carga la skill `expo-stack` antes de tocar src/ y `supabase-data` antes del SQL. Usa el plugin
`context7` para la API de expo-updates en la versión instalada (mira package.json), no la de la
última. Las skills de despliegue y EAS del plugin `expo` sirven para los comandos de build y
update.

ENSÉÑAME UN PLAN Y ESPERA MI OK. Incrementos:

A. ADR nuevo (el siguiente número libre en docs/adr/): pasar `runtimeVersion` de la política
`appVersion` a `fingerprint`, para que un cambio nativo cambie la runtime solo. Tiene que decir
qué alternativa se descarta, qué cuesta (cada cambio nativo es build nuevo; el APK 1.3.1 deja de
recibir updates en cuanto cambie el fingerprint) y cómo se comprueba antes de publicar. NO cambies
app.json hasta que yo apruebe el ADR: cambiar la política es un cambio nativo y pide build nuevo.

B. Comprobar y aplicar updates
- src/shared/lib/updates.ts: el único fichero que importa expo-updates para comprobar, descargar
  y recargar. Sale pronto y lo deja dicho si `__DEV__` o `!Updates.isEnabled`.
- src/shared/hooks/use-ota-updates.ts: comprueba en frío y al volver a primer plano
  (`useAppForeground` ya existe), con un mínimo entre comprobaciones. Los fallos van a
  observability, sin snackbar para el caso sin red.
- Cuando haya un update descargado: aviso persistente «Actualización lista» con la acción
  «Reiniciar». NO recargues solo si hay mutaciones en cola: query-persister.ts tira la caché al
  cambiar de update y se perderían escrituras hechas sin conexión. Dime cómo lo resuelves.

C. El pie dice la verdad
- build-info.ts distingue cuatro orígenes: desarrollo, bundle del APK, update por aire y arranque
  de emergencia (`Updates.isEmergencyLaunch`). Hoy «base» sale igual en Expo Go, en un APK recién
  instalado y tras un update revertido.
- BuildTag lo pinta, y una pulsación larga enseña canal y runtime, para que una captura de
  pantalla valga como diagnóstico.
- Un arranque de emergencia se manda a observability.

D. Aviso de versión mínima
- Diseño de una tabla compartida de solo lectura (como `supermarkets`: `select` para
  `authenticated`, ninguna política de escritura, fuera de Realtime) con versión mínima admitida,
  última versión y URL de descarga del APK. Pásalo por `migration-reviewer` y espera mi OK antes
  del .sql. Se ensaya en el proyecto de prueba (docs/guias/ensayar-una-migracion.md).
- Puerto y adaptador en una feature o en shared, con `assertOnline()`; la comparación de versiones
  es una función pura en domain/ con tests.
- Por debajo de la mínima: pantalla que bloquea, con el botón de descarga. Entre la mínima y la
  última: aviso que se puede cerrar.
- Dime dónde propones colgar el APK para que el enlace no caduque: los de EAS duran dos semanas.

E. Guía de despliegue: `EXPO_PUBLIC_SENTRY_DSN` como variable obligatoria del entorno `preview`
(hoy falta y ningún APK manda fallos), con el comando para añadirla, que lanzo yo.

Textos en es.json y en.json. Accesibilidad completa en lo que se pinte.

Al terminar lanza `pr-review-toolkit:silent-failure-hunter` sobre el código de updates y
`architecture-guard` sobre src/shared y lo que hayas tocado.

Para probar: B, C y D son JS y llegan por aire a los APK 1.3.1; dame el comando de `eas update`.
Si apruebo el cambio a `fingerprint`, eso es build nuevo: dame el comando de `eas build` y dime
qué les pasa a los APK ya instalados.

Cierre: skill `qa-runner`, guion de prueba en un Android real escrito en docs/phases/fase-15.md
(publicar un update y verlo llegar al volver a primer plano; bajar la versión mínima y ver el
bloqueo) y docs/guias/despliegue.md al día. No hagas commit, push, build ni update.
```

---

### Incremento 7. Realtime duplicado y navegación

Agente: `architecture-guard`.

```
Vas a arreglar un fallo de Realtime que puede lanzar una excepción al abrir la pantalla de gastos,
y tres problemas de navegación relacionados. Repo: lista de la compra colaborativa (Expo SDK 57,
Expo Router, TanStack Query, Supabase Realtime).

LEE PRIMERO:
- docs/auditoria-2026-10-11.md, fallo 10 del apartado 6 y el punto «Atrás de Android» del
  apartado 5
- La skill `expo-stack`, que tienes que cargar: secciones de Realtime y «La pila y el botón atrás»
- src/features/community/presentation/hooks/use-community-members.ts
- src/features/expenses/presentation/screens/ExpensesScreen.tsx y hooks/use-expense-summary.ts

El problema: `useCommunityMembers` abre el canal `members:<id>` dentro del propio hook de lectura,
y ese hook se usa en seis sitios. ExpensesScreen lo llama directamente y otra vez a través de
`useExpenseSummary`, así que el mismo canal se abre dos veces en el mismo componente. Un agente
comprobó en Node que la segunda apertura lanza «cannot add callbacks after subscribe()»; nadie lo
ha visto en un móvil.

ENSÉÑAME UN PLAN Y ESPERA MI OK. Después:

1. Reproduce primero el fallo en un test, antes de arreglar nada. Si no se reproduce, dímelo y
   paramos a pensar: no arregles a ciegas.
2. Saca la suscripción a un hook `useMembersRealtime` que se monte una sola vez por pantalla, y
   deja `useCommunityMembers` como lectura pura. La suscripción sigue siendo un método del
   repositorio, con `filter: community_id=eq.<id>`.
3. Revisa si `items:<id>`, `presence:<id>` y los canales de recetas y menús tienen el mismo
   problema cuando hay dos pantallas de lista apiladas.
4. `ShoppingModeScreen` («Finalizar compra») y `RecipeDetailScreen` navegan con `useGoToList()`
   (dismissAll + replace) en vez de `router.replace('/list')` o `router.push('/list')`, que dejan
   dos pantallas de lista montadas.
5. En `use-push-notifications`, tocar una notificación no hace `push` de la ruta en la que ya se
   está.
6. Maneja de forma explícita el botón atrás de Android en `ShoppingModeScreen` y escribe en el
   diario qué hace. Android es la plataforma prioritaria y su comportamiento propio no se deja al
   valor por defecto.
7. Las suscripciones nuevas de recetas, menús y miembros no tienen los respaldos que pide la
   skill: refetch tras SUBSCRIBED, `onStatus` y `useAppForeground`. Añádelos.

Usa el plugin `context7` si necesitas el comportamiento exacto de @supabase/supabase-js o de
expo-router en la versión instalada.

Al terminar lanza el agente `architecture-guard` sobre lo que hayas tocado y corrige lo que
encuentre.

Para probar: es JS; dame el comando de `eas update --branch preview --environment preview`, que
lanzo yo, tras comprobar que no ha cambiado nada nativo.

Cierre: skill `qa-runner`. Guion en docs/phases/fase-15.md con DOS móviles: abrir gastos, abrir
miembros con gastos debajo, finalizar una compra y pulsar atrás, tocar una notificación estando
ya en la lista, y que un cambio hecho en un móvil llegue al otro. No hagas commit ni push.
```

---

### Incremento 8. Mutaciones, i18n y accesibilidad de las fases 7 a 12

Agentes: `architecture-guard`, `pr-review-toolkit:silent-failure-hunter`.

```
Vas a poner al día el código de las fases 7 a 12 con tres reglas del proyecto que no cumple:
mutaciones, textos y accesibilidad. Repo: lista de la compra colaborativa (Expo SDK 57,
NativeWind, TanStack Query).

LEE PRIMERO:
- docs/auditoria-2026-10-11.md, fallos 11, 15, 16, 20, 21, 22 y 23 del apartado 6
- CLAUDE.md, secciones «Reglas de estado», «Reglas de errores», «Reglas de UX y accesibilidad» y
  «Reglas de datos y sincronización»
- DESIGN.md
- docs/adr/ADR-0009-cola-de-mutaciones-offline.md y ADR-0010

Carga la skill `expo-stack`. ENSÉÑAME UN PLAN Y ESPERA MI OK. Son tres bloques; cada uno acaba con
lint, typecheck y tests en verde antes de empezar el siguiente.

BLOQUE 1. Mutaciones
Ninguna de estas es optimista ni encolable, y varias no avisan si fallan: use-meal-planner (alta y
borrado), use-add-meal-plan-to-list, use-save-recipe, use-delete-recipe, use-add-recipe-to-list,
use-set-member-admin, use-remove-member, use-add-guest.
- Para CADA una decide conmigo, antes de escribir: optimista y encolable (`mutationKey` +
  `setMutationDefaults`, variables con todo lo que necesita la función, id generado en el cliente
  en la llamada a `mutate`), o `networkMode: 'always'` documentado como excepción. Tráeme una
  tabla con tu propuesta y el motivo.
- Todas con `onError` y `showError(cause)`. En el planificador un fallo del servidor hoy no deja
  ningún rastro en pantalla y el diálogo se cierra antes de saber el resultado.
- Borrar una receta lleva «deshacer», no un `Alert.alert`.
- `await` en los tres `assertOnline()` de supabase-notifications-repository.ts, que hoy no
  bloquean nada, y `assertOnline()` + timeout en el envío a exp.host.
- EditRecipeScreen: subir la foto, guardar y descartar la anterior van en un caso de uso dentro
  de la mutación. Hoy la foto vieja se borra antes de que el guardado confirme.
- use-add-recipe-to-list y use-add-meal-plan-to-list llaman al adaptador de `items` saltándose
  su caso de uso: expón desde `items` lo que haga falta y úsalo.
- meal-planner/domain/meal-plan.ts importa de `@/features/recipes`, cuyo índice arrastra React y
  Supabase. Arréglalo, y amplía la regla de pureza de eslint.config.js para que lo cace:
  repite los patrones que ya lleva ese fichero y comprueba con una sonda que los viejos siguen
  disparando (CLAUDE.md explica la trampa del flat config).

BLOQUE 2. Textos
- Claves que se usan y no existen en los JSON: common.close, common.loading, common.save,
  common.back, items.row.checkHint, items.row.uncheckHint. Hoy se pinta la clave cruda o un
  `defaultValue` en castellano.
- Fuera los `defaultValue` y el ternario de AddGuestDialog que compara con 'Reintentar'.
- Mensajes interpolados, no concatenados (MembersScreen, AddGuestDialog,
  ConfirmRemoveMemberDialog).
- Amplía el test de i18n para que falle si un `t('…')` de src/ usa una clave que no existe.

BLOQUE 3. Accesibilidad y diseño
- 44 pt de área táctil, `accessibilityLabel` y `accessibilityRole` en: MealPlannerScreen,
  AssignMealModal, ConsolidatedReviewModal, ShoppingModeScreen, ItemsScreen (selector de
  agrupación), AddItemBar (chip de categoría) y las pantallas de recetas. Los campos de texto
  llevan etiqueta, no solo placeholder.
- El stepper de raciones de AssignMealModal lee lo mismo en el menos y en el más.
- Colores solo de tokens: `text-content-muted` no existe (el token es `muted`), `bg-accent` y
  `amber-*` tampoco, y el blanco fijo sobre el primario no llega a contraste AA en oscuro.
- La opción activa de las pestañas no se distingue solo por el fondo.
- Pantallas que confunden error o sin conexión con «vacío»: RecipeDetailScreen, RecipesScreen,
  MealPlannerScreen, ShoppingModeScreen, MembersScreen. MealPlannerScreen además no tiene
  refresco al tirar.

Al terminar los tres bloques lanza en paralelo `architecture-guard` (sobre meal-planner, recipes,
notifications, community e items) y `pr-review-toolkit:silent-failure-hunter` (sobre las
mutaciones), y corrige lo que encuentren.

Para probar: es JS; dame el comando de `eas update`, que lanzo yo.

Cierre: skill `qa-runner`. Guion en docs/phases/fase-15.md: cada mutación con y sin red, modo
claro y oscuro, fuente del sistema al máximo y una pasada con TalkBack por el planificador y las
recetas. Las excepciones a la regla de mutaciones que se decidan van a CLAUDE.md. No hagas commit
ni push.
```

---

### Incremento 9. Cobertura

Agente: `pr-review-toolkit:pr-test-analyzer`.

```
Vas a subir la cobertura de tests de cuatro carpetas que están por debajo del umbral del proyecto
y a hacer que el umbral lo detecte. Repo: lista de la compra colaborativa (Jest, jest-expo).

LEE PRIMERO:
- docs/auditoria-2026-10-11.md, apartado 5 («Lo que decía la revisión anterior») y fallo 19
- jest.config.js
- La skill `qa-runner`, sección de cobertura: qué se cubre y qué no

El dato: la cobertura global es del 91 %, pero por carpeta están por debajo del 70 %
expenses/data (61,7 %), recipes/data (62,5 %), meal-planner/data (66,7 %) y las ramas de
meal-planner/domain (67,5 %). El umbral de jest.config.js es global y por eso no salta. Vuelve a
medir con `npm run test:coverage` antes de empezar: los incrementos 7 y 8 habrán movido los
números.

ENSÉÑAME UN PLAN Y ESPERA MI OK. Después:
1. Tests que prueben comportamiento, no líneas: para un adaptador, que empieza por
   `assertOnline()`, que envuelve el error con `serverError`, que traduce bien la fila de Postgres
   a la entidad del dominio, y qué hace cuando el servidor devuelve vacío o nulo. Mira cómo lo
   hacen los tests de community/data e items/data y sigue ese estilo.
2. No mockees lo que estás probando. Si para subir un porcentaje hay que escribir un test que no
   puede fallar, no lo escribas y dímelo.
3. Cambia `coverageThreshold` para exigir el 70 % por carpeta de domain/ y data/, no solo en
   global, y enséñame que el comando falla si bajo una a propósito.
4. La UI no se persigue: no añadas tests de pantallas para subir el número.

Al terminar lanza el agente `pr-review-toolkit:pr-test-analyzer` sobre los tests nuevos y corrige
lo que señale.

Cierre: skill `qa-runner`. Anota en docs/phases/fase-15.md la tabla de cobertura antes y después,
y actualiza el número del README. No hagas commit ni push.
```

---

### Incremento 10. Cierre: documentación y prueba en dispositivo

Agente: `docs-drift-auditor`.

```
Vas a cerrar la Fase 15: poner la documentación de acuerdo con el código y dejar preparado el
guion de prueba en dispositivo de todo lo que nunca se ha visto en un móvil. Repo: lista de la
compra colaborativa (Expo SDK 57 + Supabase).

LEE PRIMERO:
- docs/auditoria-2026-10-11.md, fallos 17 y 26 del apartado 6
- docs/phases/fase-15.md entero
- docs/traspaso-2026-10-12.md
- CLAUDE.md entero

Empieza lanzando el agente `docs-drift-auditor` sobre CLAUDE.md, README.md, docs/README.md,
docs/guias/despliegue.md, las tres skills de .claude/skills y los diarios de las fases 7 a 15.
Tráeme su lista ordenada por gravedad ANTES de corregir nada, y espera mi OK sobre qué se arregla.

Lo que ya se sabe que está mal:
- El bloque de estado de CLAUDE.md cuenta las fases 5 y 6 en presente («Lo que falta ahora es
  probar la pantalla rehecha»), cuando están cerradas desde septiembre. Reescríbelo corto: fase en
  curso, qué se arrastra y dónde está el detalle.
- CLAUDE.md dice «los diez ficheros de lib/» y son más; su bloque de variables de entorno no
  nombra `EXPO_PUBLIC_SENTRY_DSN` ni `SUPABASE_SECRET_KEY`; el stack no menciona Sentry, push, PDF
  ni sus ADR (0018 a 0024); la fecha de los plugins no cuenta `pr-review-toolkit`.
- Las fases 7 a 14 figuran como «completada» o «completada y verificada» sin ninguna prueba en un
  Android real registrada. NO las marques como cerradas ni como abiertas por tu cuenta: enséñame
  el estado de cada una y lo decido yo.
- La skill `supabase-data` describe estados y tablas de antes de las migraciones de octubre;
  compruébala contra supabase/migrations/.
- docs/guias/despliegue.md: dos avisos que eran deducciones y hay que confirmar o quitar (que un
  build `production` falla sin token de Sentry, y que el push no funciona sin configuración de
  FCM). Si a estas alturas hay un build que lo demuestre, escríbelo como hecho; si no, como
  pendiente de comprobar.
- docs/guias/auditoria-dependencias.md razona con Expo Go 54.
- Tres dependencias de desarrollo que llegaron con el SDK 57 (@react-native/jest-preset,
  react-test-renderer, test-renderer) sin que ningún documento diga por qué hace falta cada una.
  Averígualo y escríbelo, o dime cuál sobra.

Reglas: un ADR no se edita para cambiar de opinión; si una decisión cambió, se escribe uno nuevo
que lo supersede y solo se toca el estado del viejo. Si cambias una regla de CLAUDE.md, cámbiala
también en el agente de .claude/agents que la comprueba.

Después escribe UN documento en docs/guias/ con el guion de prueba en Android real de las fases 7
a 15, por pantallas, con un hueco para el resultado y la fecha de cada paso: miembros y roles,
PDF, notificaciones push, recetas, planificador, foto en el alta, modo supermercado, selector de
listas, PIN, y updates. Marca qué pasos necesitan dos móviles. Ninguna fase pasa a «cerrada»
hasta que yo lo recorra.

Vuelve a lanzar `docs-drift-auditor` al final. No cierres mientras devuelva discrepancias de
gravedad alta.

Cierre: skill `qa-runner`, sección «Antes de cerrar fase». No hagas commit ni push.
```

---

### Incremento 11. Play Store en prueba interna

Sin agente. Requisito: los incrementos 5 y 6 cerrados.

```
Vas a escribir la guía para publicar la app en Google Play en prueba interna, de forma que se
actualice sola. No vas a publicar nada: solo el documento. Repo: lista de la compra colaborativa
(Expo SDK 57, EAS).

LEE PRIMERO:
- docs/auditoria-2026-10-11.md, apartado 4, tabla «Cómo conseguir que una versión estable se
  actualice sola»
- docs/guias/despliegue.md entero, app.json y eas.json
- docs/adr/ADR-0026-pin-fuera-de-members-y-recuperacion-de-identidad.md, «Consecuencias»

Usa las skills de despliegue y EAS del plugin `expo` y el plugin `context7` para la documentación
vigente de EAS Build, EAS Submit y Play Console. La skill `upgrading-expo` no se usa en este repo.
Todo lo que afirmes sobre Google Play o EAS y no puedas confirmar en su documentación oficial,
márcalo como «sin confirmar»: precios, plazos de revisión y requisitos de testers cambian.

Escribe docs/guias/publicar-en-play-prueba-interna.md con:
1. Alta de la cuenta de desarrollador: coste, qué pide y cuánto tarda.
2. La firma. Los APK ya instalados están firmados con el keystore que custodia EAS. Explica qué
   firma usa Play (Play App Signing), si un móvil con el APK actual podrá actualizarse encima
   desde Play o habrá que desinstalar, y cómo evitar desinstalar si se puede.
3. Qué le pasa a quien desinstale: pierde la sesión anónima y tiene que volver a entrar con su
   nombre y su PIN. Di qué hay que tener hecho antes para que eso no deje a nadie fuera (ADR-0026:
   todo el mundo con PIN, admins que puedan restablecer).
4. El build: perfil `production` de eas.json (App Bundle), `versionCode` con `appVersionSource:
   remote` y `autoIncrement`, y las variables de entorno del entorno `production` de EAS. Hoy solo
   están subidas al entorno `preview`.
5. Sentry en el build de producción: ese perfil no lleva `SENTRY_DISABLE_AUTO_UPLOAD`, así que
   intentará subir sourcemaps. Qué variables necesita.
6. Los canales: el canal `production` no existe todavía en EAS. Cómo conviven sus updates con los
   de `preview` y qué canal recibe cada build.
7. Prueba interna frente a prueba cerrada: límites de testers, si hace falta revisión y cuánto
   tarda un cambio en llegar a un móvil.
8. Las notificaciones push: qué configuración de FCM hace falta y dónde se sube en EAS.
9. Una lista de comprobación final, paso a paso, con los comandos que tendré que lanzar yo.

Añade al final una sección «Lo que no he podido confirmar».

Documenta en docs/phases/fase-15.md que la guía existe y qué decisiones quedan para mí. No lances
ningún build ni ningún submit, y no hagas commit ni push.
```
