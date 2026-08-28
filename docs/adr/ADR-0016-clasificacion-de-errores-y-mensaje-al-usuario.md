# ADR-0016: Clasificación de errores y mensaje al usuario

- Estado: Aceptado
- Fecha: 2026-08-28
- Motivado por el fallo de PostgREST del 2026-08-24 al 2026-08-28, contado en `../phases/fase-6.md`.

## Contexto

Durante cuatro días la app no dejó unirse a ninguna lista. El mensaje en pantalla era «No se pudo
conectar con el servidor». El servidor estaba perfectamente: la migración del PIN había dejado dos
sobrecargas vivas de `join_community` y PostgREST devolvía `PGRST203` a cualquier cliente que no
mandara `p_pin`.

El fallo tardó lo que tardó porque el código estaba montado para que tardase:

1. **Cada adaptador construía el texto en castellano.** `data/` hacía
   `throw new Error('No se pudo unir a la lista: ' + error.message)`. El detalle real de Supabase
   iba concatenado al final de una frase que ya afirmaba una causa.
2. **Cada pantalla aplanaba todo lo que no fuera `OfflineError`.** Trece sitios repetían el mismo
   ternario `cause instanceof OfflineError ? t('errors.offline') : t('errors.network')`. Un error de
   esquema, un rechazo de RLS, un timeout y un cable desenchufado salían con la misma frase.
3. **El código de error no llegaba a ninguna parte.** Ni a la pantalla, ni a la consola. `PGRST203`
   existía en la respuesta HTTP y se perdía en la primera capa que lo tocaba.

Un usuario que dice «me sale que no puede conectar» está repitiendo lo que la app afirmó, y la app
lo afirmó sin saberlo. Eso es lo que hay que arreglar, no solo la migración.

## Decisión

El texto que ve la persona se decide en `presentation/`, con el error ya clasificado. `data/` solo
informa de qué operación falló y qué dijo el servidor.

### 1. `data/` lanza `ServerError`, nunca un texto traducido

`src/shared/lib/errors.ts` expone `serverError(operation, cause)`, que envuelve el error de Supabase
en un `ServerError` con tres campos: `operation` (el nombre técnico, `join_community`,
`items.insert`, `storage.upload`), `detail` (el mensaje del servidor tal cual) y `code`
(`error.code`, o el `statusCode`, o el `status` HTTP, el primero que exista).

`ServerError.message` queda como `operation: detail [code]`. Es lo que aparece en un stack trace y lo
que buscan los tests, y no es lo que se le pinta a nadie.

Ningún fichero de `data/` importa i18n. No lo hacía antes tampoco: escribía castellano a mano, que es
peor.

### 2. `presentation/` clasifica y traduce

`describeFailure(cause)` reduce cualquier cosa lanzada a un `Failure` con un `kind` de cinco valores:

| `kind`        | Cuándo                                                       | Qué se le dice                                  |
| ------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| `offline`     | `OfflineError`: NetInfo dice que no hay red                  | Conéctate y vuelve a intentarlo                 |
| `unreachable` | El mensaje es un fallo de `fetch` («network request failed») | No se pudo hablar con el servidor               |
| `timeout`     | `AbortError`, o el mensaje habla de timeout                  | El servidor tardó demasiado                     |
| `rejected`    | Hay código de error: el servidor contestó y dijo no          | El servidor rechazó la operación, con el código |
| `unknown`     | Todo lo demás                                                | Algo ha ido mal                                 |

El orden importa: el timeout gana al resto de pistas, y `unreachable` gana a `rejected`, porque un
`Network request failed` puede llegar envuelto en un error de Supabase con `status: 0`.

`useErrorSnackbar()` es lo que usan las pantallas: recibe la causa, opcionalmente un mensaje propio
de la acción, y saca el snackbar. `useFailureMessage()` es la misma lógica devolviendo el texto, para
los sitios que lo pintan en línea en vez de en un snackbar.

### 3. El mensaje propio de la acción solo sobrevive a `rejected` y `unknown`

«No se pudo añadir el artículo» es información útil cuando el servidor contestó y dijo no. Cuando el
móvil está en modo avión, es ruido que tapa la única cosa que la persona puede arreglar. Así que en
`offline`, `unreachable` y `timeout` gana el mensaje del `kind`, y en los otros dos gana el de la
acción.

### 4. El código de error se le enseña al usuario

`errors.withCode` deja el mensaje como «El servidor ha rechazado la operación. Vuelve a intentarlo.
(PGRST203)». No es bonito y es a propósito: es la diferencia entre un parte que dice «no conecta» y
uno que trae la causa dentro. Una captura de pantalla vale entonces como diagnóstico.

Solo aparece si hay código. Un `offline` no lleva paréntesis.

### 5. En desarrollo, una línea buscable por consola

`logFailure` imprime `[error] rejected · join_community · PGRST203: Could not choose the best
candidate function`. Un solo formato, con la operación dentro, para poder buscar por nombre de RPC
en el log de Metro. Bajo `__DEV__`, así que no queda nada en el bundle de producción.

## Alternativas descartadas

**Sentry o similar.** Es lo que de verdad habría dado el aviso el primer día, y sigue fuera del
alcance por lo mismo que en la Fase 5: es un servicio externo, con su cuenta y su configuración, para
una beta que usan cuatro personas. Esto no lo sustituye, lo abarata: cuando entre Sentry, el `Failure`
ya está formado y es lo que se manda.

**Seguir montando el texto en `data/` pero con más precisión.** Multiplica el problema por cada
adaptador nuevo y sigue sin clasificar nada: el que escribe el adaptador no sabe si el móvil tenía
red.

**Pintar el mensaje crudo del servidor.** «Could not choose the best candidate function between
public.join_community(text,text)...» no le sirve a nadie que no sea yo, y a mí me llega igual por el
código y por la consola.

## Consecuencias

- Los tests de los adaptadores comprueban `operation: detail`, no frases en castellano. Los dos del
  catálogo se actualizaron con esto.
- Añadir un método a un adaptador obliga a nombrar su operación. Es una línea y es lo que aparece en
  el log cuando falle.
- Desaparecen las claves `errors.network` y `errors.syncFailed` de los dos JSON de i18n, y también
  `errors.invalidJoinCode` y `errors.usernameTaken`, que duplicaban las de `community.errors.*` y no
  las usaba nadie.
- `use-pick-image.ts` se queda como estaba. Sus fallos son de permisos y del selector del sistema, no
  de un servidor, y ya tienen sus propios mensajes.
