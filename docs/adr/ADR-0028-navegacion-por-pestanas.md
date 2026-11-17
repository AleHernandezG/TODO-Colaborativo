# ADR-0028: Navegación por pestañas con Lista y Gastos, sin Recetas ni Menú

- Estado: Aceptado (2026-11-17)
- Fecha: 2026-11-03
- Relacionado: ADR-0004, ADR-0021, ADR-0022, ADR-0025, P-04

## Contexto

El T-16 rediseña todas las pantallas (P-04). La foto de partida
([`diseno/estado-de-partida.md`](../diseno/estado-de-partida.md)) dice que la raíz es un `Stack` sin
cabecera nativa, que cada pantalla pinta la suya y que todo cuelga de la Lista. Su cabecera lleva el
título, el selector de listas (ADR-0025) y los accesos al resto, y con la letra al 115 % aplasta el
título a 19 px. Las cabeceras se rompen al 200 % en casi todas las pantallas.

Al ver los bocetos del T-16.2, Alejandro decidió el 2026-11-03 que **Recetas y Menú semanal salen de
la app** para mantenerla simple. Se esconden, no se borran: fuera las pantallas; código de dominio y
datos, tablas, RPC y recetas guardadas se quedan. El Menú sale con Recetas porque cada hueco del
menú es una receta (ADR-0022) y sin ellas no tiene contenido.

Quedan dos destinos de primer nivel, Lista y Gastos. Lo demás cuelga de ellos: Miembros con el
código de invitación, el modo supermercado, el PDF, el PIN y el historial de gastos.

Lo comprobado en el árbol el 2026-11-03:

| Pieza                              | Versión     | Qué tiene en Android                                                                                                                                                              |
| ---------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expo-router/unstable-native-tabs` | 57.0.25     | JS sobre `Tabs.Host` de react-native-screens                                                                                                                                      |
| `react-native-screens`             | 4.26.2      | `gamma/tabs/host/` en Kotlin, ya compilado en el APK 1.3.1 (`08f58498`)                                                                                                           |
| `expo-symbols`                     | 57.0.3, MIT | Ningún módulo nativo: `expo-module.config.json` declara solo `apple`. Los iconos `md` se dibujan con la fuente de `@expo-google-fonts/material-symbols` 0.4.49 (MIT y Apache-2.0) |
| `expo-font`                        | 57.0.4      | Ya instalado; pinta el glifo a imagen para la barra                                                                                                                               |
| `Tabs` JS de expo-router           | 57.0.25     | Copia propia de bottom-tabs en `build/react-navigation/`, sin paquete aparte                                                                                                      |

`expo-modules-autolinking resolve --platform ios` ya enlaza `expo-symbols` como dependencia de
expo-router. En Android no aparece.

## Alternativas

**Barra inferior nativa (`NativeTabs`).** La elegida. Es la barra de Material 3 que dibuja Android,
con TalkBack y el atrás del sistema resueltos por la plataforma.

**Barra inferior en JS (`Tabs` de expo-router).** Queda como plan B. Se descarta como primera
opción porque la dibujamos nosotros, con su accesibilidad a mano. Su ventaja es que la etiqueta
crece con la letra sin un alto fijo.

**Pestañas arriba, «Lista | Gastos», bajo la cabecera.** Material recomienda la barra inferior para
3 a 5 destinos y las pestañas superiores para dos. Ocupaba 48 dp en vez de 80 y quitaba la API
inestable. Alejandro prefirió la barra inferior: está donde la busca quien no sabe usar apps y es
la misma que tendrá la app si vuelve un tercer destino.

**Sin pestañas: la Lista como portada y Gastos desde un icono de la cabecera.** Es lo que más sitio
deja al 200 %. Se descarta porque Gastos queda detrás de un icono sin texto y el PDF tiene que bajar
al final de la lista.

**Cuatro pestañas con Recetas y Menú.** Era el plan del T-16.2 hasta los bocetos. Fuera por la
decisión de producto de arriba.

**Menú lateral (drawer).** Android lo desaconseja con pocos destinos: esconde lo que hay y pide un
gesto más.

## Decisión

- **Dos pestañas en la barra nativa: Lista y Gastos**, con `NativeTabs` de
  `expo-router/unstable-native-tabs`. Lista es la ruta inicial. Las URL no cambian (`/list`,
  `/expenses`), para que una notificación push abra donde abría.
- **Lo demás se abre encima, sin barra**: modo supermercado, Miembros, el PIN, Nuevo gasto, Todos
  los gastos y Gasto. Se llega a cualquiera en dos toques como mucho desde una pestaña.
- **Atrás** desde Gastos vuelve a Lista y desde Lista sale de la app (`backBehavior` por defecto,
  `initialRoute`). El retroceso predictivo sigue apagado en `app.json`.
- **Cambiar de lista no navega.** Cada pestaña monta su contenido con la `key` de la lista activa:
  quien está en Gastos sigue en Gastos de la otra lista.
- **La barra sale de los tokens**: fondo `surface`, indicador `primary` y el icono activo en
  `onPrimary`, por las props de `NativeTabs` con `usePalette()`. No entra ningún componente de Paper.
- **Iconos con `expo-symbols`**, nombres de Material Symbols, en la barra y en el `Icon` de
  `src/shared/ui`. El T-16.3 lo declara en `package.json` con `npx expo install expo-symbols`, que
  debe fijar la 57.0.3 que ya está en el árbol, junto con el `package-lock.json`.
- **Recetas y Menú se esconden**: el T-16.3 quita `src/app/recipes/` y `src/app/meal-planner/` y lo
  que enlace a ellas. Las features `recipes` y `meal-planner` siguen en `src/features/`, en el array
  de `eslint.config.js` y en `test:rls`. RF-14 y RF-15 quedan fuera de la app hasta nueva orden.
- **El primer paso del T-16.3 es medir en el POCO**: que el update por aire llega a la 1.3.1 sin
  build y que «Gastos» no se corta con la letra al 200 %. Si falla cualquiera de las dos, se cambia a
  `Tabs` de expo-router, con la misma estructura de rutas.

Esto no contradice ADR-0025, que descartó las pestañas como selector de listas, no como navegación:
el selector sigue en el título. Tampoco ADR-0004, porque la barra no es de Paper.

## Consecuencias

Lo bueno:

- No hace falta build. Todo lo nativo ya está en el APK 1.3.1, y el cambio va por update a la
  1.3.1.
- Con dos pestañas cada una mide unos 196 dp en el POCO y la etiqueta cabe al 200 %. Con cuatro eran
  98 dp y «Recetas» se cortaba en el boceto.
- Menos superficie que rediseñar y probar: el T-16 pasa de ocho incrementos a siete.
- Lo pendiente de Realtime en `useRecipes` y `useMealPlanWeek` (incremento 7 del T-15) deja de verse,
  porque nadie monta esas pantallas.

Lo malo:

- `unstable-native-tabs` es inestable y en el SDK 58 pasa a `expo-router/native-tabs`. Subir el
  SDK obliga a cambiar el import y a repasar las props.
- La barra nativa tiene alto fijo. Si HyperOS recorta la etiqueta con la letra grande, se cae al
  plan B y se pierde lo que da la plataforma.
- El teclado tapa la barra (`tabBarRespectsIMEInsets` está apagado), así que la acción de cada
  formulario va en la `ActionBar`, que sube con él.
- Material pide de 3 a 5 destinos y aquí hay dos. Es una salida consciente de la guía.
- Recetas y Menú siguen compilándose, testeándose y pasando por el lint sin que nadie los use. Se
  paga en tiempo de CI a cambio de poder volver sin rehacer nada.
- La 1.3.1 instalada enseña Recetas y Menú hasta que le llegue el update. Lo que alguien guarde
  ahí mientras tanto se queda en la base de datos, sin pantalla para verlo.
- La foto de portada de las recetas de ADR-0023 se queda sin pantalla.

## Fuentes

Consultadas el 2026-11-03.

- [Native tabs, Expo Router](https://docs.expo.dev/router/advanced/native-tabs/)
- [Layout and navigation patterns, Android](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns)
- [NavigationBarItem, Compose Material 3](https://kotlinlang.org/api/compose-multiplatform/material3/androidx.compose.material3/-navigation-bar-item.html)
- [Bottom navigation, Material Design](https://m1.material.io/components/bottom-navigation.html)
- [App bars, Compose](https://developer.android.com/develop/ui/compose/components/app-bars)
- [Make apps more accessible, Android](https://developer.android.com/guide/topics/ui/accessibility/apps)
- [Traversal order, Compose accessibility](https://developer.android.com/develop/ui/compose/accessibility/traversal)
