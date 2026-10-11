# Auditoría del 2026-10-11: cambio de listas, PIN antiguo y versiones que no llegan

Auditoría de solo lectura. No se editó código ni se publicó nada en EAS ni en Supabase.
Hecha sobre `main` (`cd4d1e7`) y contrastada con `origin/feat/expo-sdk-57` (`a364876`) y con EAS.

> **Actualización del 2026-10-11:** la decisión 0 está tomada. `feat/expo-sdk-57` se fusionó en `main`
> y el proyecto es SDK 57. El incremento 1 está hecho; detalle en `docs/phases/fase-15.md`, apartado 7.
> El resto del informe describe el estado anterior a la fusión.

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

Ninguno se empieza sin OK. Orden propuesto: el 2 cuanto antes, luego 1, 3 y 4 juntos (son la
seguridad), 5, y el resto detrás.

### Decisión 0: cuál es la línea buena

O se fusiona `feat/expo-sdk-57` en `main` (y el SDK pasa a ser 57, con el `CLAUDE.md` de la rama),
o se descarta y los móviles con 1.3.1 se quedan con un APK huérfano. Los prompts de abajo suponen
la fusión, porque es lo que ya está instalado; si se elige lo contrario, cambian el 1 y el 5.

### Incremento 1. Unificar las ramas

Agente: `docs-drift-auditor`

```
Fusiona origin/feat/expo-sdk-57 en main sin commitear (el commit lo hago yo). Antes de tocar
nada enséñame el plan: qué ficheros entran en conflicto (CLAUDE.md, docs/phases/fase-14.md,
eslint.config.js como mínimo) y cómo resuelves cada uno. Reglas: gana el texto de la rama en
todo lo que hable de SDK y versión; gana main en agentes, plugin pr-review-toolkit y el array
`features` de eslint.config.js, que debe acabar con las 8 features. Después corre npm ci,
lint, typecheck, npm test y `npx expo export --platform android`. Al terminar lanza
docs-drift-auditor sobre CLAUDE.md y docs/guias/despliegue.md y dame la lista de lo que sigue
sin coincidir con el código. No publiques ningún update ni lances ningún build.
```

### Incremento 2. Dejar de servir un bundle roto a la 1.2.0

Lo lanza el usuario.

```
Dame el comando exacto de `eas update:republish` para volver a poner como último update de la
rama `preview`, runtime 1.2.0, el grupo 96f20bba-9b89-42f7-af7f-a56f09441436 ("Rebuild expense
split UI"), que es el último anterior a expo-print y expo-notifications. Antes confirma con
`git log` y `git show <commit>:package.json` que el commit de ese grupo no importa ningún
módulo que falte en el package.json del APK del 2026-08-03. No lo ejecutes: lo lanzo yo.
Documenta en docs/phases/fase-15.md qué pasó con los grupos 5b55fc8d y b318117c y por qué.
```

### Incremento 3. PIN: diseño de esquema

Agente: `migration-reviewer`

```
Diseña, sin escribir todavía el .sql, la corrección del PIN por miembro y espera mi OK.
Problemas a resolver, todos en supabase/migrations/20260904120000_member_roles_and_guests.sql
y 20260824130000_member_pin.sql: (1) pin_hash se lee por la API porque members_select es por
fila; (2) un miembro con pin_hash nulo y auth_user_id de otra sesión lo reclama cualquiera
(líneas 166-174); (3) el servidor acepta PIN nulo o de cualquier formato; (4) no hay RPC para
fijar o restablecer el PIN; (5) el rate limit es por sesión y no por miembro atacado; (6)
remove_member no rota el join_code. Quiero el diseño con tablas, on delete, políticas, firma de
cada RPC con su drop de la anterior, y para cada punto la alternativa que descartas y su coste.
Dime qué le pasa a un miembro antiguo que perdió la sesión y nunca fijó PIN, y qué le pasa a un
APK ya instalado que no conozca los estados nuevos. Pasa el diseño por migration-reviewer antes
de enseñármelo. Va en un ADR nuevo que supersede a ADR-0015; no edites ADR-0015. Añade a
scripts/rls-isolation-test.mjs las comprobaciones que hoy faltan, empezando por cambiar la de
la línea 753, que exige que pin_hash sea legible.
```

### Incremento 4. Recetas, archivados y permisos

Agente: `migration-reviewer`

```
Migración correctora, con diseño previo y mi OK. (1) save_recipe: el `on conflict (id) do
update` de 20260907170000_recipe_cover_photo.sql:124-130 no comprueba que la receta sea de
p_community_id; añade la condición y lanza 42501 si no. (2) create_expense_with_shares,
save_recipe y delete_recipe comprueban la pertenencia sin `removed_at is null`: usa
member_community_ids(). (3) revoke/grant con firma exacta en register_push_token,
unregister_push_token, get_community_push_tokens, save_recipe, delete_recipe, upsert_meal_slot
y delete_meal_slot. (4) saca recipe_ingredients de la publicación de Realtime. Ninguna firma
cambia. Añade a test:rls un caso por cada punto. Pasa el .sql por migration-reviewer antes del
db push, que lanzo yo. Documenta en la skill supabase-data.
```

### Incremento 5. Updates y aviso de versión

Agentes: `silent-failure-hunter`, `architecture-guard`

```
Plan primero, luego código. (1) ADR nuevo: runtimeVersion con policy `fingerprint` en vez de
`appVersion`, con lo que cuesta. (2) src/shared/lib/updates.ts como único fichero que importe
expo-updates para comprobar y aplicar, y src/shared/hooks/use-ota-updates.ts que compruebe en
frío y al volver a primer plano (useAppForeground), mande los fallos a observability y enseñe
un snackbar persistente "Actualización lista" con "Reiniciar". No recargues solo si hay
mutaciones en cola: query-persister.ts tira la caché al cambiar de update. (3) build-info.ts:
distingue desarrollo, embebido, update y arranque de emergencia (Updates.isEmergencyLaunch), y
que BuildTag lo pinte. (4) Aviso de versión mínima: diseña la tabla compartida de solo lectura
(como supermarkets: select para authenticated, sin políticas de escritura) con versión mínima,
última versión y URL del APK, y una pantalla que bloquee por debajo de la mínima; el diseño de
la tabla pasa por migration-reviewer. Textos en es.json y en.json. Añade EXPO_PUBLIC_SENTRY_DSN
a la guía de despliegue como variable obligatoria del entorno preview. Al terminar lanza
silent-failure-hunter sobre el código de updates y architecture-guard sobre src/shared.
```

### Incremento 6. Mensajes de la pantalla de unirse

Agente: `silent-failure-hunter`. Depende del incremento 3.

```
Depende del incremento 3. En src/features/community: quita `username_taken` de
failedJoinStatuses, de JoinOutcome, de JoinCommunityScreen.tsx:58 y de los dos JSON, porque el
servidor ya no lo devuelve. Sustituye el mensaje de PIN incorrecto por uno que cubra los dos
casos reales (soy yo con el PIN mal, o el nombre es de otro) y diga qué hacer si se ha olvidado.
Cuando el servidor fije un PIN sobre un miembro que ya existía, la pantalla lo confirma. El
aviso de demasiados intentos dice el plazo (15 minutos) y se pinta en línea. `submit` no hace
nada si isPending. Separa en dos el throw de supabase-community-repository.ts:91-93. Tests de
dominio y del adaptador. Al terminar lanza silent-failure-hunter sobre el flujo.
```

### Incremento 7. Realtime duplicado y navegación

Agente: `architecture-guard`

```
Reproduce primero, en un test, que abrir dos veces el canal `members:<id>` falla. Saca la
suscripción de use-community-members.ts a un hook `useMembersRealtime` que se monte una sola
vez por pantalla, y deja useCommunityMembers como lectura pura. En ShoppingModeScreen.tsx:74 y
RecipeDetailScreen.tsx:115 navega con useGoToList() en vez de replace/push de '/list'. En
use-push-notifications.ts no hagas push de la ruta en la que ya se está. Maneja de forma
explícita el botón atrás de Android en ShoppingModeScreen y di en el diario qué hace. Regla:
skill expo-stack, "La pila y el botón atrás". Lanza architecture-guard al terminar y dime cómo
probarlo en el Android real.
```

### Incremento 8. Mutaciones, i18n y accesibilidad de las fases 7 a 12

Agente: `architecture-guard`

```
Tres bloques, cada uno con lint, typecheck y tests antes de pasar al siguiente. (1) Mutaciones
de meal-planner, recipes y community (use-meal-planner, use-add-meal-plan-to-list,
use-save-recipe, use-delete-recipe, use-add-recipe-to-list, use-set-member-admin,
use-remove-member, use-add-guest): para cada una decide conmigo si es optimista y encolable
(mutationKey + setMutationDefaults, ADR-0009) o si lleva networkMode 'always' documentado como
excepción; todas con onError y showError. Añade await a los tres assertOnline() de
supabase-notifications-repository.ts. (2) i18n: añade las claves que se usan y no existen
(common.close, common.loading, common.save, common.back, items.row.checkHint,
items.row.uncheckHint), quita los defaultValue y el ternario de AddGuestDialog.tsx:53, y amplía
el test de i18n para que falle si un t('…') usa una clave ausente. (3) Accesibilidad: 44 pt,
accessibilityLabel y accessibilityRole en los controles de MealPlannerScreen, AssignMealModal,
ConsolidatedReviewModal, ShoppingModeScreen, ItemsScreen y recipes; tokens de color en vez de
text-content-muted y #FFFFFF. Lanza architecture-guard al terminar.
```

### Incremento 9. Cobertura

Agente: `pr-review-toolkit:pr-test-analyzer`

```
Sube al 70 % la cobertura de expenses/data, recipes/data, meal-planner/data y las ramas de
meal-planner/domain, con tests que prueben comportamiento y no líneas. Cambia
coverageThreshold en jest.config.js para que el umbral se exija por carpeta de domain/ y data/
y no solo en global, y enséñame que falla si bajo una. Lanza pr-test-analyzer sobre los tests
nuevos.
```

### Incremento 10. Cierre: documentación y prueba en dispositivo

Agente: `docs-drift-auditor`

```
Cierre. Reescribe en CLAUDE.md el bloque de estado (fase actual, recuentos de test:rls y
test:realtime contados sobre los scripts, features y rutas reales, stack con Sentry, push, PDF
y sus ADR, y la regla nueva: dependencia nativa o config plugin nuevo = runtime nueva y build).
Actualiza docs/guias/despliegue.md: Sentry, FCM, el aviso de versión, los tres canales y dónde
se cuelga el APK. Escribe en un solo documento de docs/guias el guion de prueba en Android real
de las fases 7 a 15 y deja hueco para el resultado de cada paso; ninguna fase pasa a "cerrada"
hasta que yo lo recorra. Lanza docs-drift-auditor al final y no cierres hasta que no devuelva
discrepancias altas.
```

### Incremento 11. Play Store en prueba interna

Cuando lo anterior esté estable.

```
Escribe docs/guias/publicar-en-play-prueba-interna.md, sin ejecutar nada: alta de la cuenta,
qué firma usa Play frente al keystore de EAS y si los APK ya instalados podrán actualizarse
encima o habrá que desinstalar, build con el perfil production, canal `production` en EAS y
cómo conviven sus updates con los de `preview`, y qué le pasa a la sesión anónima y al PIN de
quien desinstale. Dime los costes y lo que no puedas confirmar en la documentación oficial.
```
