# Prompt de arranque · T-15 · Preparar la prueba en el Android y cerrar el paso del móvil de los incrementos 3 y 4

> Hecho el 2026-11-02. El resultado está en `docs/phases/fase-15.md`, apartado 13. Se conserva como
> referencia: lo que cuenta abajo del POCO y del build ya no es el estado actual.

Este prompt va antes del incremento 6. Deja el ordenador donde se conecte el POCO F5 listo para que
la sesión pruebe sola por `adb` y Maestro, instala el APK 1.3.1 del build del 2026-11-02, guarda una
copia que no caduque y recorre `.maestro/pin-unirse.yaml`, que se escribió sin poder ejecutarlo.

Lo que hay, el 2026-11-02:

- En el ordenador donde se montó, `adb` 37.0.1 y Maestro 2.12.1 en `C:\Users\Usuario\tools`, sin
  tocar el `PATH`. En otro ordenador no hay nada instalado.
- El POCO F5 (`23049PCD8G`, HyperOS `OS1.0.19.0`) tiene la **1.2.0 `base`** y una lista de prueba
  que se puede perder. Tiene «Depuración USB» activada y ese ordenador autorizado. Faltaban
  «Instalar vía USB» y «Depuración USB (ajustes de seguridad)»: sin ellos Maestro falla con
  `DeviceServerDiedException ... during 'deviceInfo'`.
- Alejandro lanzó `eas build --profile preview --platform android` para la 1.3.1. Los APK
  anteriores devuelven `NoSuchKey`.
- `pin-unirse.yaml` nunca se ha ejecutado. La parte que copia el código de invitación es la más
  dudosa.

Recuentos de partida: Jest con 68 suites y 490 tests, `test:hooks` 103/103, `test:rls` 102/102 y
`test:realtime` 18/18 contra el real, lint con 0 errores y 9 avisos, typecheck limpio.

Sin commit, si no se ha hecho antes: `METODO-PARA-PROYECTO-NUEVO.md` y `PIEZAS-PARA-PROYECTO-NUEVO.md`
en la raíz, que son de Alejandro.

Se pega tal cual en la sesión.

---

```
Vas a dejar lista la prueba en el Android del paquete T-15 y a cerrar el paso del móvil de los
incrementos 3 y 4. No tocas src/, ni SQL, ni app.json: instalas herramientas fuera del repo, pones
el APK 1.3.1 en el POCO F5, ejecutas un flujo de Maestro y apuntas el resultado.

No hagas commit, push, eas update, eas build ni supabase db push: los hooks los bloquean y los
lanzo yo. Tampoco adb uninstall ni maestro cloud: el primero borra datos y el segundo es de pago, y
el hook los deniega. Si al empezar git status trae algo más que METODO-PARA-PROYECTO-NUEVO.md y
PIEZAS-PARA-PROYECTO-NUEVO.md, dímelo antes de tocar nada.

El ritmo: me enseñas el plan y las decisiones de golpe, cada una con tu recomendación y la
alternativa que descartas. Si contesto «adelante», van como las propones. A partir de ahí solo te
paras en los casos de «Donde sí te paras».

Antes de nada, lee en este orden:
  1. docs/guias/e2e-con-maestro.md, desde «En Windows, sin tocar el PATH» hasta el final
  2. docs/phases/fase-15.md, apartado 13
  3. .maestro/pin-unirse.yaml
  4. La skill probar-en-android

No explores el repositorio fuera de esta lista. Si un selector del flujo no encuentra nada, el
texto sale de src/shared/lib/i18n/es.json y el testID de la pantalla; míralos solo entonces.

Dónde escribes:
  - Fuera del repo: ~/tools (adb, Maestro y ~/tools/apk/ para el APK)
  - .maestro/pin-unirse.yaml, solo si hay que ajustar selectores
  - docs/phases/fase-15.md, apartado 13: «Qué falta» pasa a resultado
  - docs/guias/e2e-con-maestro.md: lo que se aprenda del POCO o de Maestro en Windows
  - docs/plan/ROADMAP.md: el bloque «Estado»

Qué no tocas:
  - src/: si el flujo necesita un testID que no existe, no lo añades aquí. No llegaría al APK
    instalado, solo por aire en el incremento 6. Lo apuntas y usas otro selector
  - El PATH del sistema: todo se lanza con el PATH de la propia orden
  - Las listas de verdad de nadie: clearState en el POCO está permitido porque su lista es de
    prueba. En cualquier otro móvil, se pregunta antes

Pasos:
  1. Herramientas. Comprueba si existen ~/tools/platform-tools/adb.exe y
     ~/tools/maestro/bin/maestro.bat. Si no, instálalas con las órdenes de la guía, desde sus URL
     oficiales, cada descarga en su carpeta vacía. Java 17 o más (java -version).
  2. El build. npx eas-cli build:list --platform android --limit 3 --non-interactive. Busca el
     de Version 1.3.1 terminado el 2026-11-02 o después. Si está en cola o falló, párate y
     dímelo.
  3. El APK. Descárgalo de su Application Archive URL a ~/tools/apk/agora-1.3.1-<id corto>.apk. Si
     pesa menos de 1 MB o empieza por <?xml, es un NoSuchKey: párate. Apunta su tamaño y su
     SHA-256 en la guía, para saber luego cuál es.
  4. El móvil. adb devices. Si sale unauthorized, pídeme aceptar el diálogo. Comprueba la
     versionName instalada.
  5. Antes de instalar, pídeme que active en el POCO «Instalar vía USB» y «Depuración USB
     (ajustes de seguridad)», con la cuenta Xiaomi, y que lo reinicie. Espera mi confirmación.
  6. adb install -r con el APK. Si falla por firma (INSTALL_FAILED_UPDATE_INCOMPATIBLE), párate:
     no desinstales. Después, versionName=1.3.1 y una captura del pie de la lista. Ábrela dos
     veces con force-stop entre medias por si hay update por aire, y apunta lo que diga el pie.
  7. pin-unirse.yaml con el PATH de la orden apuntando a ~/tools/platform-tools. Si falla,
     maestro hierarchy y capturas para ver qué lee Maestro. Ajusta el selector, no la app.
     Repite hasta que pase o hasta tres intentos sin avance.
  8. Sin red: con la app abierta, adb shell cmd connectivity airplane-mode enable, intenta
     unirte, captura el aviso, y disable. Si HyperOS no deja, svc wifi disable y svc data disable.
  9. Al terminar, pídeme que apague en el POCO los tres interruptores de depuración. No lo des por
     hecho sin mi confirmación.

Decisiones que tienes que tomar:
  1. Si pin-unirse.yaml no consigue leer el código de invitación: recomiendo leerlo de la captura
     o de maestro hierarchy y pasarlo con -e JOIN_CODE=... al flujo, dejando el flujo preparado
     para las dos formas. Descartado: añadir un testID en src/, que no llegaría al APK instalado
  2. Si el pie dice un update por aire distinto del que esperas: apúntalo tal cual y sigue. Qué
     update toca lo decide el incremento 5

Casos límite:
  - El build no ha terminado: no hay nada que instalar. Me dices el estado y lo dejas así
  - adb no ve el móvil: cable, modo «Transferencia de archivos» y el diálogo RSA, en ese orden
  - Supabase pausado (plan Free): el flujo se queda en «Estás dentro como Ana». No es un fallo
    del flujo; me lo dices
  - Un paso sin captura ni aserción de Maestro es «no comprobado», no «correcto»

Reglas que aplican aunque no lo parezca:
  - Regla 3: solo gratis. adb y Maestro CLI sí; Maestro Cloud, Firebase de pago o un emulador de
    pago no
  - Regla 6: si el aviso sin red dice que algo se guardó, es un fallo de la app y se apunta
  - Vocabulario: «lista» en los documentos

Donde sí te paras:
  - si el build 1.3.1 no está terminado o su APK no se descarga
  - si adb install -r falla por la firma
  - si tras instalar la versionName no es 1.3.1
  - si el flujo pide algo que solo se arregla tocando src/

Documentación que cambia:
  - fase-15.md, apartado 13: versión instalada, id del update del pie, el resultado de cada paso
    del flujo con sus capturas descritas, el de sin red y el botón atrás
  - e2e-con-maestro.md: lo que haya cambiado del montaje, el APK guardado con su SHA-256, y el
    «Pendiente del 2026-11-02» resuelto o actualizado
  - ROADMAP: el bloque «Estado» dice que los incrementos 3 y 4 están cerrados del todo, o qué
    falta; «Siguiente» sigue siendo el incremento 6 sin su paso 0 si ya está hecho
  - Y, el último, el agente revisor-documentacion

Terminado cuando:
  - adb y Maestro responden en este ordenador y el APK 1.3.1 está en ~/tools/apk/ con su SHA-256
  - el POCO tiene versionName=1.3.1 y el pie lo confirma
  - pin-unirse.yaml pasa entero, o está escrito por qué no y qué falta
  - el resultado está en fase-15.md, apartado 13
  - los interruptores de depuración están apagados, confirmado por mí

Al terminar: git status, qué entra en el commit, qué no y por qué, el mensaje en inglés y las
órdenes exactas.
```

## Lo que este prompt da por sentado

- Que el build lanzado el 2026-11-02 es el de `main` en ese momento. Si se lanzó desde un árbol con
  cambios sin commit, EAS los incluye o no según su configuración: la versión del pie lo dice.
- Que la lista de prueba del POCO sigue sin importar a nadie. `clearState` la saca de ella.
- Que nadie ha tocado la base desde el 2026-11-02.
