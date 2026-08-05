# Ejecutar los E2E con Maestro

Los tests de Jest cubren dominio y repositorios, que es donde está la lógica. Lo que no cubren
es que la app **funcione de verdad**: que el botón esté donde se puede pulsar, que la lista se
repinte, que un cambio hecho sin cobertura llegue al servidor al volver la red. Para eso están
los dos flujos de `.maestro/`.

No sustituyen a la prueba a mano de cada fase. La sustituyen para lo aburrido: el camino que se
recorre igual cada vez y que nadie vuelve a probar entero después de la tercera semana.

## Qué prueban

| Flujo | Recorre |
|---|---|
| `camino-feliz.yaml` | Crear lista → añadir artículo con cantidad 2 → marcar comprado y volver a pendiente → borrar y deshacer → borrar de verdad → refrescar para confirmar que el servidor está de acuerdo → salir de la lista |
| `cola-offline.yaml` | Crear lista → modo avión → añadir artículo → cerrar y reabrir la app sin red → recuperar red → confirmar contra el servidor que el artículo encolado llegó |

`cola-offline.yaml` es la comprobación automatizada de lo que hace la Fase 4. Va etiquetado como
`offline` y `config.yaml` lo excluye de la tanda por defecto, porque toca el modo avión del
dispositivo y eso no siempre se puede en cualquier Android (ver más abajo).

Fuera quedan a propósito: unirse con código (hace falta un segundo dispositivo), las fotos (el
selector del sistema no es la app y automatizarlo es pelearse con permisos y con la galería), y
Realtime entre dos móviles. Esos siguen en el guion manual de cada fase.

## Lo que hace falta

**El CLI de Maestro.** No es una dependencia de npm, se instala aparte y no está en
`package.json`:

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

En Windows va por WSL o por Git Bash con Java instalado; Maestro corre sobre la JVM. Comprueba
que responde con `maestro -v`.

**Un Android con depuración USB activada y `adb` viéndolo.** `adb devices` tiene que listarlo.
Vale un emulador.

**La app instalada como APK o development build.** Los flujos declaran
`appId: com.alejandrohernandez.listacompra`, que es el paquete de nuestra app. **Con Expo Go no
funcionan**: ahí el paquete es `host.exp.exponent` y el flujo tendría que navegar primero por la
interfaz de Expo Go para abrir el proyecto, que cambia entre versiones y no es lo que queremos
probar. Usa el APK de `eas build --profile preview`.

## Ejecutar

```bash
npm run test:e2e                        # camino feliz
maestro test .maestro/cola-offline.yaml # el de modo avión, aparte
maestro studio                          # inspector: qué ve Maestro en la pantalla actual
```

`maestro studio` es lo que se usa cuando un selector no encuentra nada: enseña el árbol de vistas
tal y como lo lee Maestro, con el texto y el id de cada elemento.

## Deja basura en la base de datos

Cada ejecución crea una comunidad y un miembro reales en Supabase, porque los flujos hablan con
el backend de verdad. `launchApp: clearState: true` borra el estado del móvil, no el del
servidor, así que las listas se acumulan: `E2E Maestro` y `E2E Offline`, una por ejecución.

Se limpian a mano desde el panel de Supabase borrando esas filas de `communities` (los miembros y
los artículos se van con ellas por el `on delete cascade`). Después:

```bash
npm run users -- --delete-orphans
```

que se lleva los usuarios anónimos que se quedaron sin fila en `members`.

No se montó un proyecto de Supabase separado para tests porque duplicaría migraciones, claves y
mantenimiento para un flujo que se ejecuta a mano cada pocos días. Si algún día esto entra en CI,
esa decisión cambia y toca ADR.

## Por qué unos selectores son `id` y otros texto

Los flujos apuntan a los controles por su texto visible o por su `accessibilityLabel`, que en
Android es lo mismo para Maestro. Eso es deliberado: si un selector se rompe porque cambió una
etiqueta, casi siempre significa que también se rompió para quien use TalkBack.

La excepción son los campos de texto. `Input` pinta la etiqueta como un `<Text>` encima del
`TextInput` y le pone esa misma cadena como `accessibilityLabel`, así que hay dos elementos con
el texto «Tu nombre» y el primero es la etiqueta, que no enfoca nada. Un `tapOn` por texto tocaría
la etiqueta y el `inputText` siguiente se perdería. Por eso `Input` acepta un `testID` opcional y
los tres campos que los flujos escriben lo llevan:

| `testID` | Campo |
|---|---|
| `create-community-name` | Nombre de la lista, en crear |
| `create-community-username` | Tu nombre, en crear |
| `add-item-name` | Añadir a la lista, en la pantalla de lista |

No hay `testID` en los botones y no hacen falta: `Button` pone la etiqueta como
`accessibilityLabel` del propio `Pressable`, así que el texto ya identifica al control que se
puede pulsar.

## Cuando falla

**Se queda esperando en «Estás dentro como Robot».** La creación de la lista es la única mutación
que no es optimista: espera al servidor porque el `join_code` lo genera él. Si el proyecto de
Supabase está pausado (plan Free), aquí es donde se nota.

**`cola-offline.yaml` no consigue poner el modo avión.** `setAirplaneMode` es solo de Android y
en algunas versiones el sistema no deja cambiarlo sin permisos de root. Si pasa, ese flujo no es
ejecutable en ese dispositivo: el guion manual de `docs/phases/fase-4.md` cubre lo mismo a mano.

**`cola-offline.yaml` no ve «Leche» tras reabrir la app.** El persistidor de la caché escribe con
un throttle de un segundo. Si el `stopApp` llega antes de esa escritura, no hay nada que
rehidratar. Es el primer sospechoso antes de tocar nada del código.

**Un `tapOn` no encuentra un texto que está claramente en pantalla.** Maestro compara con una
expresión regular contra la cadena completa, no por trozos. «Añadir» no encuentra «Añadir uno», y
es lo que queremos; pero si cambias un texto de `es.json` y el flujo lo tenía escrito entero, hay
que actualizar el flujo. Los textos de los flujos son copias literales de `es.json`.
