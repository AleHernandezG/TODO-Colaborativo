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
| `pin-unirse.yaml` | Crear lista como Ana con PIN → copiar el código → borrar datos y unirse como Bea → borrar datos y volver a entrar como Ana con su PIN → borrar datos y probar un PIN equivocado → botón atrás. Etiqueta `pin` |

**`camino-feliz.yaml` y `cola-offline.yaml` están desfasados desde la fase 15**: no rellenan el PIN,
que es obligatorio al crear, y el primero pulsa «Salir de esta lista», que ya no existe (ADR-0025).
Están apuntados como deuda en el ROADMAP. `pin-unirse.yaml` se escribió el 2026-11-02 y todavía no
se ha ejecutado entero; «Cómo prueba la sesión sola» dice qué falta.

`cola-offline.yaml` es la comprobación automatizada de lo que hace la Fase 4. Va etiquetado como
`offline` y `config.yaml` lo excluye de la tanda por defecto, porque toca el modo avión del
dispositivo y eso no siempre se puede en cualquier Android (ver más abajo).

Unirse con código ya no necesita un segundo móvil: `pin-unirse.yaml` borra los datos de la app
entre pasos (`clearState`) y cada vez entra una sesión anónima nueva, que para el servidor es otra
persona. Fuera quedan a propósito las fotos (el
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

## En Windows, sin tocar el `PATH`

Así está montado desde el 2026-11-02 en el ordenador de Alejandro. En otro ordenador se repite tal
cual. Todo es gratis y de fuentes oficiales; para quitarlo basta con borrar la carpeta.

| Pieza | De dónde | Versión probada | Licencia |
| --- | --- | --- | --- |
| `adb` (Android SDK Platform-Tools) | `https://dl.google.com/android/repository/platform-tools-latest-windows.zip` | 37.0.1 | Gratis; el paquete binario lleva los términos del SDK de Android y el código es Apache-2.0 |
| Maestro CLI | `https://github.com/mobile-dev-inc/maestro/releases/latest/download/maestro.zip` | 2.12.1 | Apache-2.0 |
| Java | El que haya instalado, 17 o superior. Si no llega, Temurin 21 en zip: `https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk` | 23.0.1; 21.0.13 (Temurin) | GPLv2 con Classpath Exception, como todo OpenJDK. Fuera de la lista de la regla 3; aceptado por Alejandro el 2026-11-02 porque solo se ejecuta en local y no se distribuye ni se enlaza con la app |

Desde Git Bash:

```bash
T="$HOME/tools"; mkdir -p "$T/dl-pt" "$T/dl-maestro"
curl -sSL -o "$T/dl-pt/pt.zip" https://dl.google.com/android/repository/platform-tools-latest-windows.zip
unzip -q -o "$T/dl-pt/pt.zip" -d "$T"
curl -sSL -o "$T/dl-maestro/maestro.zip" https://github.com/mobile-dev-inc/maestro/releases/latest/download/maestro.zip
unzip -q -o "$T/dl-maestro/maestro.zip" -d "$T"
"$T/platform-tools/adb.exe" version
"$T/maestro/bin/maestro.bat" --version
```

Maestro tiene que encontrar `adb` en el `PATH` de la orden que lo lanza, no en el del sistema:

```bash
export PATH="$HOME/tools/platform-tools:$PATH"
cmd //c "%USERPROFILE%\tools\maestro\bin\maestro.bat" test .maestro/pin-unirse.yaml
```

Si el Java del sistema es anterior al 17, el JDK va también en `~/tools` y se apunta en la misma
orden. El 2026-11-02, en el segundo ordenador del POCO, `java -version` decía `1.8.0_511`:

```bash
T="$HOME/tools"; mkdir -p "$T/dl-jdk"
curl -sSfL -o "$T/dl-jdk/jdk.zip" "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk"
unzip -Z1 "$T/dl-jdk/jdk.zip" | cut -d/ -f1 | sort -u    # una sola carpeta, jdk-21.0.x+y
unzip -q -o "$T/dl-jdk/jdk.zip" -d "$T" && mv "$T"/jdk-21.* "$T/jdk-21"

export JAVA_HOME="$(cygpath -w "$T/jdk-21")"
export PATH="$T/jdk-21/bin:$T/platform-tools:$PATH"
cmd //c "%USERPROFILE%\tools\maestro\bin\maestro.bat" --version
```

`maestro --version` pinta una línea de interrogaciones antes del número: es el banner en una consola
sin UTF-8 y no afecta a nada.

`npm run test:e2e` llama a `maestro` a secas y solo funciona si está en el `PATH`. **Nunca `maestro
cloud`**: es el servicio de pago de Maestro y el hook `bloquear-escrituras-git.mjs` lo deniega.

## El móvil de pruebas: POCO F5 con HyperOS

El de Alejandro es un POCO F5 (`23049PCD8G`, `marble_eea`), Android 14, HyperOS `OS1.0.19.0`. Xiaomi
pide tres interruptores en Ajustes → Ajustes adicionales → Opciones de desarrollador. Las opciones
aparecen tras pulsar siete veces «Versión de HyperOS» en Ajustes → Sobre el teléfono.

| Interruptor | Para qué | Sin él |
| --- | --- | --- |
| Depuración USB | Que `adb` vea el móvil | `adb devices` no lo lista |
| Instalar vía USB | `adb install`, que usa Maestro para poner sus dos apps de control y nosotros para cambiar de APK | Maestro falla con `DeviceServerDiedException ... during 'deviceInfo'` y no aparece ningún paquete `dev.mobile.maestro` |
| Depuración USB (ajustes de seguridad) | Que un programa pueda tocar la pantalla | Los `tapOn` no hacen nada o dan `INJECT_EVENTS` |

Los dos últimos piden la cuenta Xiaomi iniciada. Tras activar el de seguridad hay que reiniciar. La
primera vez que se conecta un ordenador sale «¿Permitir depuración USB?» con su huella RSA: hasta
aceptarlo, `adb devices` dice `unauthorized`.

Lo que se vio el 2026-11-02: con solo «Depuración USB», `adb` funcionó (versión instalada, capturas,
abrir la app) y Maestro no arrancó, sin llegar a instalar sus apps. Es el síntoma de que falta
«Instalar vía USB».

## Es seguro para el móvil

- Ningún ordenador manda órdenes por `adb` sin que alguien desbloquee el móvil y acepte su clave
  RSA. Lo dice la documentación de Android: https://developer.android.com/tools/adb
- No se desbloquea el bootloader, no hay root y no se pierde la garantía. Son ajustes de las opciones
  de desarrollador y se apagan igual que se encienden.
- El riesgo real es el interruptor de seguridad: mientras está encendido, un ordenador autorizado
  puede tocar la pantalla. **Al acabar cada tanda de pruebas se apagan los tres**, y en un ordenador
  que no es de confianza, «Revocar autorizaciones de depuración USB».
- **`clearState` borra los datos de la app en ese móvil**: la sesión, la caché y las listas en las
  que estaba. En el POCO se aceptó porque la lista que tenía era de prueba. En un móvil con listas de
  verdad, primero hay que saber el PIN de cada una.
- `adb uninstall` también borra los datos y el hook lo deniega. Para cambiar de versión se usa
  `adb install -r`, que conserva los datos si el APK lleva la misma firma. EAS firma los builds del
  proyecto con la misma clave; si no cuadrase, Android rechaza la instalación sin tocar nada.

Fuentes, consultadas el 2026-11-02: la de Android de arriba; el FAQ de scrcpy sobre «USB debugging
(Security settings)» y el reinicio (https://github.com/Genymobile/scrcpy/blob/master/FAQ.md); AirDroid
y GameBench sobre la cuenta Xiaomi (https://help.airdroid.com/hc/articles/360045329413,
https://docs.gamebench.net/docs/studio-pro-desktop/troubleshooting/xiaomi/). Xiaomi no tiene una
página oficial que lo cuente.

## Qué versión tiene el móvil, y por qué un update «no llega»

Antes de creer cualquier resultado:

```bash
adb shell dumpsys package com.alejandrohernandez.listacompra | grep -E "versionName|lastUpdateTime"
adb exec-out screencap -p > captura.png      # el pie de la lista: v<version> · base o · <id>
```

Un update por aire solo llega a un APK con la misma `version` (`runtimeVersion` con la política
`appVersion`). El 2026-11-02 el POCO tenía la **1.2.0 `base`**, instalada el 4 de agosto, y por eso
nunca recibió nada de la 1.3.x: no era que tardara, era que no le tocaba. Dentro de la misma versión,
`expo-updates` descarga al abrir y aplica en la apertura siguiente. Para forzarlo, dos veces y con
unos segundos entre medias:

```bash
adb shell am force-stop com.alejandrohernandez.listacompra
adb shell monkey -p com.alejandrohernandez.listacompra -c android.intent.category.LAUNCHER 1
```

y mirar el pie.

**Los APK de EAS caducan.** El 2026-11-02 los enlaces de los builds 1.3.0 y 1.3.1 (`5f8bd1c3`)
respondían `NoSuchKey`: el build sigue en la lista y el fichero ya no. Al terminar un build se
descarga el APK y se guarda fuera del repo, por ejemplo en `~/tools/apk/agora-<version>.apk`. Sin él,
volver a una versión exige un build nuevo.

## Cómo prueba la sesión sola

Con el móvil conectado y los tres interruptores, Claude Code recorre el guion sin que nadie toque el
móvil. Es lo que pide la skill `probar-en-android` antes de pasar un guion a mano:

1. `adb devices` y la versión instalada, como arriba. Si no es la que toca, se para.
2. Para poner otra versión, `adb install -r <apk>`. Nunca desinstalar.
3. El flujo de Maestro del incremento. Si no existe, se escribe en `.maestro/` con la etiqueta del
   incremento.
4. Capturas con `adb exec-out screencap -p`, que la sesión puede mirar, y `maestro hierarchy` cuando
   un selector no encuentra nada.
5. Sin red: `adb shell cmd connectivity airplane-mode enable` y `disable`. Si HyperOS no lo deja,
   `adb shell svc wifi disable` y `svc data disable`.
6. El resultado, con versión y móvil, en el diario de la fase.

Lo que sigue siendo a mano: TalkBack, el tamaño de letra máximo y si algo se ve bien. Maestro dice si
un texto está, no si se lee.

**Pendiente el 2026-11-02, actualizado a las 19:40:** en el segundo ordenador ya están `adb`
37.0.1, Maestro 2.12.1 y Temurin 21.0.13 en `~/tools`, y `adb devices` ve el POCO (`1e5b87b9`) como
`unauthorized` hasta aceptar la clave RSA. Falta todo lo que depende del APK: el build 1.3.1 nuevo
(`08f58498`, commit `64e27b1`) seguía `in queue`. Cuando termine, se descarga a
`~/tools/apk/agora-1.3.1-08f58498.apk`, se apunta aquí su tamaño y su SHA-256, se activan «Instalar
vía USB» y «Depuración USB (ajustes de seguridad)» y se ejecuta `pin-unirse.yaml` por primera vez. La parte que
lee el código de invitación sigue sin comprobar.
