# ADR-0004: NativeWind para estilos y React Native Paper solo para overlays

- Estado: Aceptado
- Fecha: 2026-07-19

## Contexto

La §6.2 del documento maestro dice "elige UNA vía" y deja la decisión abierta: NativeWind a
secas, o NativeWind más una librería de componentes accesibles (gluestack-ui o React Native
Paper). `CLAUDE.md` ya daba NativeWind por hecho, pero eso solo resuelve el estilado.

El problema no es estilar, es que hay tres cosas que **no** se pueden escribir a mano sin
meterse en un pantano:

- **Snackbar.** No es un adorno. Las mutaciones optimistas hacen rollback ante error de red y
  el usuario tiene que enterarse; sin snackbar, la operación se deshace sola en pantalla sin
  explicación. Es requisito de las reglas de estado de `CLAUDE.md`.
- **Modales y diálogos.** Confirmación de borrado con "deshacer", que es requisito de UX.
- **Portal.** Los dos anteriores necesitan renderizarse fuera del árbol de su pantalla.

Escribir eso a mano significa gestionar foco, anuncios de lector de pantalla, el botón atrás de
Android y el teclado. Es exactamente donde se rompe la accesibilidad, y la accesibilidad aquí
no es negociable.

## Decisión

**NativeWind para todo lo visual. React Native Paper solo para `Snackbar`, `Dialog` y
`Portal`.**

El design system sigue siendo propio, en `src/shared/ui`, construido con NativeWind sobre los
tokens de `src/theme`. Paper no aporta el aspecto de la app: aporta tres primitivas de
superposición que son difíciles de hacer bien.

Reglas concretas:

- Paper **no** se usa para `Button`, `Card`, `TextInput` ni nada que defina el aspecto. Esos
  son nuestros. Si un componente de Paper se cuela en una pantalla, es un error de revisión.
- El tema de Paper se deriva de los tokens de `src/theme`, no se define aparte. Un solo sitio
  donde vive el color.
- `PaperProvider` y `Portal.Host` se montan una vez en el layout raíz de Expo Router.

## Alternativas consideradas

**gluestack-ui v3.** Es la opción tentadora: sus componentes son primitivas sin estilo que se
estilan con NativeWind, así que no habría dos sistemas de tema conviviendo, y su accesibilidad
está bien valorada. Se descarta por dos motivos de riesgo, no de calidad. Uno, el ritmo de
cambios: v2 en 2024 y v3 en 2025, con reestructuración de por medio; para un proyecto de una
sola persona en beta, comerse una migración mayor es tiempo que no está presupuestado. Dos, su
modelo es que copias los componentes a tu repo y los mantienes tú, lo cual es una ventaja
cuando quieres control y un coste cuando lo que quieres es que el snackbar funcione y no
pensar más en él. Merece revisarse si el proyecto crece.

**NativeWind a secas, todo a mano.** Lo más limpio en teoría y lo peor en la práctica. El
trabajo real de un diálogo accesible no es pintarlo, es el manejo de foco y los anuncios de
lector de pantalla. Se descarta porque la accesibilidad es requisito duro y esta vía la deja
en manos de que nos acordemos de todo.

**Paper para todo el design system.** Resolvería más de golpe, pero impone Material Design en
iOS, donde se nota que no es una app nativa, y contradice la decisión ya tomada de tener
componentes propios en `src/shared/ui`.

## Consecuencias

**A favor**

- Snackbar y diálogos accesibles desde el primer día, sin escribir gestión de foco.
- El aspecto de la app sigue siendo nuestro y sigue saliendo de los tokens.
- La superficie de Paper es tan pequeña que cambiarlo más adelante (por gluestack u otra cosa)
  toca tres componentes, no la app entera. La decisión no se cementa.

**En contra**

- Dos sistemas de tema en el proyecto: las clases de NativeWind y el `theme` de Paper. Se
  mitiga derivando el segundo de los tokens, pero es un sitio más que puede desincronizarse.
- Paper arrastra `react-native-vector-icons` y su peso, para usar una fracción de lo que trae.
- Riesgo real de que Paper se vaya filtrando a más pantallas por comodidad. Se controla en
  revisión: si aparece un import de `react-native-paper` fuera de `src/shared/ui`, se rechaza.

## Notas

Comprobado antes de decidir: Paper funciona con Expo sin configuración extra y sus componentes
siguen las guías de accesibilidad de Material Design 3, incluidos los tamaños mínimos de área
táctil. gluestack-ui v3 está optimizado para las versiones recientes de Expo y la nueva
arquitectura de React Native, o sea que descartarlo no es por incompatibilidad.

- [Comparativa gluestack-ui / React Native Paper (PkgPulse, 2026)](https://www.pkgpulse.com/guides/gluestack-ui-vs-react-native-paper-vs-unistyles-react-2026)
- [React Native Paper](https://reactnativepaper.com/)
- [gluestack-ui](https://gluestack.io/)
