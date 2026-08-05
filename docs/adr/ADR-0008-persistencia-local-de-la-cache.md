# ADR-0008: La caché local se guarda en AsyncStorage, no en MMKV

- Estado: Aceptado
- Fecha: 2026-08-04
- Corrige una elección declarada en `CLAUDE.md` desde la Fase 0 que nunca llegó a implementarse.

## Contexto

`CLAUDE.md` lleva desde el principio esta línea en el stack:

> **Persistencia local:** react-native-mmkv.

Al empezar la Fase 4, que es la primera que necesita persistencia de verdad, resultó que
**`react-native-mmkv` nunca se instaló**. No es una regresión ni una dependencia rota: la
decisión se escribió antes de existir el proyecto y las fases 0 a 3 no la necesitaron, porque la
sesión de Supabase y los stores de Zustand ya usaban `@react-native-async-storage/async-storage`
(decidido en la Fase 0 al descartar `expo-secure-store` por su límite de ~2 KB por valor).

Así que la Fase 4 no elegía entre «lo que hay» y «algo nuevo». Elegía entre añadir MMKV ahora o
consolidar el almacén que la app ya usa en producción.

Lo que decide el asunto no es el rendimiento de cada librería, sino esto:

**MMKV es un módulo nativo de terceros, y este proyecto se prueba en Expo Go.** Expo Go solo trae
compilados los módulos del SDK de Expo. Un `import` de `react-native-mmkv` no falla al empaquetar:
falla al arrancar en el dispositivo, con un error de módulo nativo ausente. El flujo de trabajo
diario de este proyecto (`npx expo start` → QR → móvil real) dejaría de existir, y el único
dispositivo de pruebas tiene un Expo Go clavado en el cliente 54.0.8 que no se puede actualizar
desde el Play Store (ver `CLAUDE.md`). Todo cambio pasaría a exigir un development build.

El coste no acaba ahí: `runtimeVersion` está en `policy: 'appVersion'`, así que meter un módulo
nativo obliga a subir de versión y a generar un APK nuevo. Los cambios solo-JS, que hoy llegan al
móvil con `eas update` en un minuto, pasarían a costar una build.

## Decisión

**La caché de TanStack Query y los stores persistidos de Zustand se guardan en AsyncStorage.**
`react-native-mmkv` no se instala y se borra del stack en `CLAUDE.md`.

En concreto:

- `createAsyncStoragePersister` de `@tanstack/query-async-storage-persister`, con la clave
  `query-cache`, montado con `PersistQueryClientProvider` en el layout raíz.
- `zustand/middleware` `persist` con `createJSONStorage(() => AsyncStorage)` para la sesión y la
  comunidad activa.

**AsyncStorage es asíncrono, y eso tiene una consecuencia obligatoria: nada que dependa de un
valor persistido puede decidir en el primer render.** Un store recién montado devuelve su valor
inicial, no el guardado. El patrón de las dos comprobaciones (`hasHydrated()` en el estado inicial
del `useState` **y** dentro del efecto, más `onFinishHydration`) no es opcional aquí; está en la
skill `expo-stack` y se aplica en `useSessionHydrated` y en el store de la comunidad activa.
Con MMKV, que es síncrono, ese código sobraría. Es el precio real de esta decisión.

## Alternativas consideradas

**Instalar `react-native-mmkv` y montar un development build.** Es lo que dice el `CLAUDE.md`
original y es más rápido en frío (lectura síncrona, sin puente). Se descarta porque cambia el
flujo de trabajo del proyecto entero para ganar milisegundos en el arranque de una lista de la
compra de decenas de filas. El tamaño de la caché aquí se mide en kilobytes; el cuello de botella
del arranque es la red, no leer un JSON del disco.

**MMKV solo para la caché de Query, dejando la sesión en AsyncStorage.** Dos almacenes distintos
para el mismo problema, con dos modelos de hidratación (uno síncrono y otro no) conviviendo en el
mismo arranque. Se descarta por el coste de razonar sobre eso cada vez que se toque el bootstrap,
que es exactamente el sitio donde ya se perdió tiempo en la Fase 0.

**`expo-sqlite` como almacén.** Es un módulo del SDK, así que funcionaría en Expo Go, y aguanta
mucho más volumen. Se descarta porque resolver «guardar un blob JSON y recuperarlo» con una base
de datos relacional es traer un problema nuevo (esquema, migraciones del almacén local) para un
caso que no lo pide.

## Consecuencias

**A favor**

- El flujo `expo start` → QR → Expo Go sigue funcionando, que es como se prueba todo aquí.
- Los cambios solo-JS siguen llegando por `eas update` sin APK nuevo.
- Un almacén, un modelo mental. La sesión de Supabase ya vivía ahí.
- Cero dependencias nuevas para cerrar la Fase 4.

**En contra**

- **Hidratación asíncrona.** Cada consumidor de un store persistido tiene que esperarla
  explícitamente o enseñará el estado inicial durante un frame. Ya mordió una vez: la Fase 1 mandó
  a la landing a usuarios que sí tenían lista.
- **Menos rendimiento en escritura** que MMKV. Irrelevante al volumen de esta app; dejaría de
  serlo si algún día se persistieran listas de miles de filas.
- **AsyncStorage tiene un límite total por app en Android** (6 MB por defecto en el
  `AsyncStorage` de la comunidad, configurable). Una lista de la compra no se acerca, pero la
  caché lleva `maxAge` de 7 días y `buster` por versión precisamente para no crecer sin control.

## Notas

Si algún día el proyecto pasa a development builds por otro motivo (Sentry, notificaciones push,
cualquier módulo nativo de la Fase 5), esta decisión se puede revisar: el argumento principal
desaparece. Entonces sería un ADR nuevo, no una edición de este.

Detalle de qué se persiste y cómo se invalida: `docs/phases/fase-4.md`, incremento 1.
