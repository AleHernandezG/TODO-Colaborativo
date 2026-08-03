# Fase 3 · Imágenes y pulido UX

- Estado: **código completo, pendiente de aplicar la migración y verificar en el APK 1.2.0**
- Inicio: 2026-08-03

Entregable de la fase (§12 del documento maestro): experiencia completa y estética, auditoría F
superada.

1. [x] Editar un artículo ya creado (la «M» de RF-3, deuda de la Fase 1)
2. [x] Copiar y compartir el `join_code` (criterio de aceptación de RF-2)
3. [x] Imagen de referencia en el artículo: cámara/galería, compresión, Storage (RF-4 completo)
4. [x] Micro-interacciones, estados vacíos y de error, accesibilidad y modo oscuro (RF-6)

**RF-8 (exportar a PDF) no entra aquí.** El documento maestro lo pone en esta fase, pero
`CLAUDE.md` lo declara post-MVP junto a RF-9 y esa es la regla que manda. Se queda registrado
en §3 y §12 del maestro sin tocarse.

El incremento 3 es el único que toca backend. Su diseño de Storage se enseñó y se aprobó antes de
escribir el `.sql`, según la regla de cambios de esquema de `CLAUDE.md`.

---

## Incremento 1 · Editar un artículo

La «M» de «altas, bajas y modificaciones» que RF-3 pide y que la Fase 1 dejó a medias: se podía
crear, marcar y borrar, pero un nombre mal escrito solo se arreglaba borrando y volviendo a
escribir, que en una lista compartida además borra el artículo de la pantalla de los demás.

| Fichero | Qué hace |
|---|---|
| `domain/edit-item.ts` | Caso de uso: normaliza, valida, delega |
| `domain/item-repository.ts` | El puerto gana `edit()` |
| `data/supabase-item-repository.ts` | `update` de `name` y `quantity` por id |
| `shared/ui/Dialog.tsx` | Envoltorio propio sobre el `Dialog` de Paper |
| `presentation/use-edit-item.ts` | Mutación optimista con rollback |
| `presentation/components/EditItemDialog.tsx` | El formulario, con `Input` + `QuantityStepper` |
| `presentation/components/ItemRow.tsx` | El nombre pasa a ser pulsable |
| `presentation/ItemsScreen.tsx` | Sostiene qué artículo se está editando |

### Sin cambio de base de datos

Se comprobó antes de escribir nada, porque un `update` de columnas nuevas habría necesitado
migración y OK previo. No hace falta:

- La política `items_update` ya lleva `using` **y** `with check` sobre la pertenencia a la
  comunidad. Editar nombre y cantidad de un artículo propio ya estaba permitido; mover el
  artículo a otra comunidad sigue estando prohibido, que es lo que cierra el `with check`.
- `updated_at` lo pone el trigger `items_touch_updated_at`. El adaptador **no** lo manda, igual
  que no lo manda `setPurchased`. Mandarlo desde el cliente solo compite con el trigger.
- Ninguna tabla ni columna cambia de forma, así que `db.types.ts` no se regenera.

### Se pulsa el nombre, no un lápiz

La fila ya tenía dos zonas táctiles (el check y la ✕). Meter un icono de editar la deja en tres
controles pequeños en 44 pt de alto, que es exactamente el patrón que un usuario novato falla:
apunta al check y le sale otra cosa.

Así que la zona pulsable es el propio nombre, con su cantidad al lado, ocupando todo el hueco
libre entre el check y la ✕. Es un objetivo grande, y el peor caso de un toque accidental es que
se abra un diálogo que se cierra con «Cancelar». Lo comparo con el peor caso de la ✕, que es
destruir algo: por eso la ✕ sigue siendo un objetivo pequeño y aparte.

Alternativa descartada: pulsación larga sobre la fila. Es invisible; nadie que no lo sepa lo
descubre, y el usuario objetivo es justo ese.

El `accessibilityLabel` del nombre lee «Leche, cantidad 3» y el hint dice qué pasa al pulsar. El
check conserva su label de marcar/desmarcar, así que el lector de pantalla ofrece dos acciones
distintas y claras sobre la misma fila.

### Diálogo, no pantalla nueva

Editar son dos campos que ya existen en la barra de añadir. Una ruta nueva significa navegación,
botón atrás, y perder de vista la lista para cambiar una palabra.

El `Dialog` de React Native Paper entra por lo mismo que entró el `Snackbar` en
[ADR-0004](../adr/ADR-0004-libreria-de-ui.md): las superposiciones accesibles (foco atrapado,
cierre con el atrás de Android, lectura correcta por TalkBack) son caras de hacer a mano y es lo
único que se le pide a Paper. El import queda dentro de `shared/ui/Dialog.tsx`; la feature de
items no sabe que Paper existe.

El envoltorio no expone la API de Paper hacia fuera: recibe `title`, `confirmLabel`,
`cancelLabel`, `onConfirm`, `onDismiss` y los hijos, y pinta los botones con nuestro `Button`
para que el área táctil y el contraste sean los del resto de la app. Los de Paper son texto
plano pequeño y se quedan cortos de 44 pt.

### La mutación

Optimista con rollback, como todas menos `create_community`. El nombre que se pinta por
adelantado pasa por `normalizeItemName`, el mismo que aplicará el dominio, para que la fila no
parpadee al llegar la confirmación del servidor.

El caso de uso devuelve `EditItemResult` (`ok` / `invalid_name` / `invalid_quantity`) en vez de
lanzar, siguiendo la regla de la skill `expo-stack`: lo que el usuario puede provocar es un
estado, no una excepción. En la práctica los dos estados inválidos son inalcanzables desde la
UI, porque el botón «Guardar» se deshabilita con el mismo validador. Están manejados igual —
snackbar y refetch— porque un validador duplicado que se desincronice es cuestión de tiempo, y
el coste de cubrirlo son cuatro líneas.

`edit()` devuelve `void`, como `setPurchased`. Devolver la fila actualizada obligaría a un
`select` de vuelta en cada edición para un dato que la caché ya tiene y que Realtime va a
refrescar de todas formas.

### Dos personas editando el mismo artículo

Gana el último que escriba. Es last-write-wins por `updated_at`, la política de conflictos que
`CLAUDE.md` fija para toda la app, y aquí es más visible que en marcar comprado porque el campo
es texto libre: si A cambia «Leche» por «Leche entera» y B, a la vez, por «Leche desnatada»,
uno de los dos pierde su cambio sin aviso.

Se asume a propósito. La alternativa es bloquear la fila mientras alguien la edita, que exige
saber quién está editando qué (presencia por artículo, no por lista) y deja artículos
bloqueados cuando a alguien se le muere la batería con el diálogo abierto. Para una lista de la
compra de cinco personas, el coste no compensa.

Lo que sí se nota: el que pierde ve cómo su texto cambia solo cuando llega el evento de
Realtime. Eso es correcto (la lista muestra la verdad del servidor) y es lo mismo que ya pasa al
marcar comprado.

### Cómo probarlo

En el móvil, con la lista abierta:

1. Pulsa el **nombre** de un artículo. Se abre el diálogo con el nombre y la cantidad actuales
   ya rellenos, no vacíos.
2. Cambia el nombre y sube la cantidad. «Guardar». La fila se actualiza al instante.
3. Vuelve a abrirlo y pulsa «Cancelar». Nada cambia.
4. Borra el nombre entero dentro del diálogo. «Guardar» se pone gris y no se puede pulsar.
5. Con el diálogo abierto, pulsa el **atrás de Android**. Se cierra el diálogo, no la pantalla.
6. Con dos dispositivos: edita en uno y mira el otro. El cambio llega en menos de 2 s.
7. Modo avión, edita y guarda: aviso de «no tienes conexión» y la fila vuelve a su valor
   anterior.
8. Con TalkBack: al enfocar la fila debe leer el nombre y la cantidad, y ofrecer el check como
   control separado.

### Verificado

- `tsc --noEmit`: limpio
- `eslint`: 0 errores
- `jest`: 110 tests (79 → 104 en la Fase 2 → 110 aquí; 4 nuevos del caso de uso, 2 del adaptador)
- `npx expo export --platform android`: compila

---

## Incremento 2 · Copiar y compartir el código

RF-2 acepta la creación de comunidad «con botones Copiar y Compartir (share sheet nativo)». La
Fase 1 dejó el código pintado y nada más, así que compartirlo era teclearlo a mano en WhatsApp.
Con un código como `PAN-42XK` eso es un error de transcripción esperando a pasar, y el mensaje
de error que verá el otro («ese código no existe») no ayuda a encontrarlo.

| Fichero | Qué hace |
|---|---|
| `shared/lib/share.ts` | `copyToClipboard` y `shareText`, dos líneas cada uno |
| `features/community/presentation/JoinCodeCard.tsx` | El bloque del código con sus dos botones |
| `features/items/presentation/ItemsScreen.tsx` | Deja de pintar el bloque a mano |

### Dependencia nueva: `expo-clipboard`

Es la primera dependencia **nativa** que entra desde el APK actual, y eso tiene una consecuencia
de entrega: **este incremento no se puede llevar al móvil con `eas update`**. Un update por aire
solo cambia el bundle de JavaScript; un módulo nativo que no esté dentro del APK no aparece por
publicar un update, y la app rompería al llamarlo. Hace falta build nuevo.

`Clipboard` estaba en el core de React Native y se sacó; en RN 0.81 ya no existe. `expo-clipboard`
es el sustituto oficial y viene incluido en el cliente de Expo Go, así que en Expo Go se prueba
por QR sin build.

Compartir, en cambio, usa el `Share` del propio React Native, que no es dependencia nueva.

### El bloque del código se muda a `community`

Estaba escrito a mano dentro de `ItemsScreen`, que es la pantalla de artículos. El `join_code` no
tiene nada que ver con artículos: es de la comunidad. Ahora es `JoinCodeCard` en
`features/community/presentation/` y la pantalla de lista lo monta con dos props.

El `accessibilityLabel` que deletrea el código (`P A N - 4 2 X K`) se mudó con él. Leído del
tirón por TalkBack, un código sin caracteres ambiguos suena igual de ambiguo.

### Copiar avisa; compartir, no

Copiar no tiene retorno visual propio: el portapapeles es invisible. Sin snackbar, el usuario
pulsa y no pasa nada aparente, así que vuelve a pulsar. Con snackbar («Código copiado») sabe que
ya está.

Compartir abre el menú del sistema, que ya es la confirmación. Añadir un snackbar encima sería
ruido, y además en Android el resultado de `Share.share` no distingue de forma fiable entre
compartir y cancelar: siempre resuelve `sharedAction`. Un aviso de «compartido» que aparece
también al cancelar es peor que ninguno.

Los dos fallos (portapapeles bloqueado, ninguna app que reciba el intent) caen en el mismo
mensaje, `list.shareFailed`. Son casos raros y la acción de recuperación es la misma: apuntar el
código a mano.

### Los dos botones son secundarios

La acción principal de la pantalla de lista es «Añadir», y sigue siendo el único botón primario.
Copiar y compartir van en `variant="secondary"`, lado a lado, cada uno a media anchura con
`flex-1`, lo que deja los dos por encima de 44 pt de alto y de ancho.

### Cómo probarlo

1. Pulsa **Copiar** al pie de la lista. Sale «Código copiado». Pega en WhatsApp: aparece el
   código, sin espacios ni saltos.
2. Pulsa **Compartir**. Se abre el menú del móvil. Elige cualquier app: el mensaje lleva el
   nombre de la lista y el código.
3. Cancela el menú de compartir. No debe salir ningún aviso.
4. Manda el mensaje a otro móvil y úsalo para entrar con «Tengo un código». El código pegado
   debe funcionar tal cual, sin recortar nada.
5. Con TalkBack: los dos botones se anuncian con su nombre y su pista.

### Verificado

- `tsc --noEmit`: limpio
- `eslint`: 0 errores
- `jest`: 113 tests (3 nuevos de `share.ts`)
- `npx expo export --platform android`: compila, bundle 5,36 MB

---

## Entrega de los incrementos 1 y 2: build nuevo, versión 1.1.0

`app.json` sube de `1.0.0` a `1.1.0`. No es cosmético: `runtimeVersion` usa
`policy: appVersion`, así que la versión **es** el identificador de compatibilidad entre el APK
instalado y los updates por aire.

Dejarla en `1.0.0` tiene una consecuencia mala y silenciosa. El APK que ya está en el móvil no
lleva `expo-clipboard` dentro. Si se publicara un `eas update` con la versión sin tocar, ese APK
lo aceptaría (mismo `runtimeVersion`), se lo descargaría, y **rompería al pulsar «Copiar»**: el
JS llamaría a un módulo nativo que no existe en ese binario. Y como el update queda cacheado, la
app se queda rota hasta reinstalar.

Subiendo a `1.1.0` el APK viejo deja de ser destino válido para los updates nuevos: se queda con
el último que sí le servía y sigue funcionando. La única forma de llegar a `1.1.0` es instalar el
APK nuevo, que es exactamente lo que queremos.

Regla que se hereda para el resto de la fase: **el incremento 3 (cámara y galería) también es
nativo**, así que volverá a pedir build. Los updates por aire vuelven a servir en el incremento
4, que es solo JS.

### Cómo actualizar el móvil

```powershell
npx eas-cli@latest build --platform android --profile preview
```

Se instala el APK encima del anterior (mismo keystore, no hace falta desinstalar) y **no se
pierde la sesión ni la comunidad**: viven en AsyncStorage, que sobrevive a la actualización. Al
pie de la lista debe leerse `v1.1.0 · base`. Si sigue diciendo `v1.0.0`, el APK que se instaló
no es el nuevo.

Para probar antes de esperar al build, en el dispositivo que tiene Expo Go 54 vale
`npx expo start` y escanear el QR: `expo-clipboard` viene dentro del cliente de Expo Go.

---

## Incremento 3 · Imagen de referencia en el artículo

RF-4 completo: «se puede crear un artículo solo con nombre; añadir imagen es un paso opcional que
nunca bloquea el guardado». La columna `image_url` existía desde la Fase 0 y nunca se escribió.

Para qué sirve de verdad: en una lista compartida, «champú» no basta. Quien compra no sabe cuál
de los seis del lineal es el que se usa en casa. Una foto del bote lo resuelve sin escribir una
descripción de tres líneas.

| Fichero | Qué hace |
|---|---|
| `supabase/migrations/20260803120000_item_images_storage.sql` | Renombra la columna, crea el bucket y sus cuatro políticas |
| `domain/item.ts` | `imageUrl` → `imagePath` |
| `domain/item-repository.ts` | El puerto gana `uploadImage`, `removeImage` y `signImageUrl` |
| `domain/item-image.ts` | La caducidad de la firma, y quién la pide |
| `domain/edit-item.ts` | `ItemImageChange`: mantener, quitar o sustituir |
| `domain/delete-item.ts` | Borra la foto antes que la fila |
| `data/supabase-item-repository.ts` | Storage: subir, borrar y firmar |
| `shared/lib/image.ts` | Redimensiona y comprime antes de subir |
| `presentation/use-pick-image.ts` | Permisos + cámara/galería + compresión |
| `presentation/use-item-image-url.ts` | Una query por ruta, cacheada |
| `presentation/components/ItemImage.tsx` | Miniatura con sus tres estados |
| `presentation/components/EditItemDialog.tsx` | La sección de foto |
| `presentation/components/ItemRow.tsx` | Miniatura de 36 pt en la fila |

### El cambio de esquema

Una migración, tres cosas.

**`image_url` pasa a llamarse `image_path`.** El nombre viejo mentía sobre lo que se guarda. En
un bucket privado no hay URL estable: lo que se guarda es la ruta dentro del bucket
(`<community_id>/<item_id>.jpg`) y la URL se firma en el momento de pintarla, con caducidad. Una
columna llamada `image_url` invita a que alguien meta ahí una URL firmada, que caduca, y a
depurar meses después por qué las fotos viejas dan 400.

**El bucket es privado** (`public = false`), con `file_size_limit` de 2 MB y
`allowed_mime_types` de `image/jpeg` y nada más. Un bucket público sería un fallo de seguridad
equivalente a desactivar RLS: la URL pública de Storage es adivinable a partir del id de la
comunidad y del artículo, y ese id viaja en los eventos de Realtime. Toda la fase 0 se dedicó a
que nadie leyera datos de otra comunidad; regalar las fotos por una URL sin firmar lo tira.

Los límites son de la BD, no del cliente. El cliente ya comprime a 1280 px y JPEG, así que 2 MB
sobra de largo; el límite está para que una app modificada no pueda subir un vídeo de 400 MB al
plan Free.

**Cuatro políticas sobre `storage.objects`**, una por operación, todas con la misma condición:

```sql
bucket_id = 'item-images'
and (storage.foldername(name))[1] in (
  select c.community_id::text from public.member_community_ids() as c(community_id)
)
```

La primera carpeta de la ruta es el `community_id`, y `member_community_ids()` es la misma
función `security definer` que sostiene las políticas de `items`. Así el aislamiento de fotos y
el de datos son la misma regla, no dos reglas parecidas que se puedan desincronizar.

Se compara **texto contra texto** (`community_id::text`) en vez de castear la carpeta a `uuid`.
Un objeto con una ruta que no sea un uuid (subido a mano, o de una versión futura con otro
esquema de rutas) haría fallar el cast con un error de tipo en mitad de la política. Comparando
como texto, ese objeto simplemente no coincide con nada y se deniega, que es el comportamiento
correcto.

Las cuatro se conceden `to authenticated`, no a `public`. Con sesión anónima de Supabase el rol
efectivo es `authenticated`; `anon` es quien llega sin token y no tiene nada que hacer aquí.

`update` lleva `using` **y** `with check`, por lo mismo que `items_update`: sin `with check` se
podría mover un objeto propio a la carpeta de otra comunidad.

### La ruta es determinista: `<community_id>/<item_id>.jpg`

No lleva timestamp ni uuid aleatorio. Consecuencias, todas buscadas:

- **Un artículo, una foto.** Sustituir es `upsert: true` sobre la misma ruta. No hay huérfanos
  acumulándose en el bucket cada vez que alguien cambia la foto.
- **La política se puede escribir.** El `community_id` está en la ruta, así que Postgres puede
  decidir sin consultar `items`.
- **La caché de `expo-image` se invalida sola** al cambiar la foto, porque la URL firmada es
  nueva aunque la ruta sea la misma.

Lo que cuesta: la ruta necesita el `item_id`, que solo existe después de crear el artículo. Por
eso **la foto se añade desde el diálogo de editar, no desde la barra de añadir**. Encaja con el
criterio de RF-4 (añadir imagen nunca bloquea el guardado) y con la barra de añadir tal como
está: un campo y un botón, que es lo que hace que añadir la compra sea rápido.

### Mantener, quitar o sustituir

El caso de uso recibe la intención, no el resultado:

```ts
export type ItemImageChange =
  | { kind: 'keep' }
  | { kind: 'clear' }
  | { kind: 'replace'; uri: string }
```

Y `edit()` traduce eso a un `image_path` que puede ser `undefined` (no toques la columna), `null`
(vacíala) o una ruta. La distinción entre `undefined` y `null` es la que evita que editar el
nombre de un artículo le borre la foto: el adaptador solo mete `image_path` en el `patch` si el
caso de uso decidió algo sobre ella.

**«Quitar la foto» vacía la columna y deja el objeto en el bucket.** No borra en Storage. El
motivo es que quitar la foto es una acción reversible desde el punto de vista del usuario (vuelve
a ponerle otra) y no merece tener un modo de fallo de red propio: si el `remove` fallara habría
que decidir si se guarda igual, si se reintenta, o si se deja la columna apuntando a un objeto
que ya no está. Como la ruta es determinista, la siguiente foto de ese artículo pisa el objeto
huérfano. El único desperdicio posible es un JPEG de ~200 KB por artículo al que se le quitó la
foto y nunca se le puso otra.

**Borrar el artículo sí borra el objeto, y en ese orden: foto primero, fila después.**

```ts
if (item.imagePath) {
  await repository.removeImage(item.imagePath)
}
await repository.remove(item.id)
```

Al revés, si el borrado del objeto falla, la fila ya no existe y nadie sabe qué había que
limpiar. En este orden, un fallo deja el artículo intacto y el reintento es seguro: el borrado
de un objeto que ya no está no es un error en Storage. Es el mismo criterio que se aplica al
`delete` diferido con «Deshacer», que se dispara al cerrarse la ventana de 5 s.

### Compresión antes de subir

`shared/lib/image.ts`, con la API contextual de `expo-image-manipulator` (SDK 54; la vieja
`manipulateAsync` está deprecada):

```ts
const context = ImageManipulator.manipulate(input.uri)
if (input.width > uploadImageMaxWidth) {
  context.resize({ width: uploadImageMaxWidth })
}
```

1280 px de ancho y calidad 0.7 deja una foto de móvil (típicamente 4000×3000 y 3-4 MB) en unos
150-250 KB. En una miniatura de 36 pt y en una vista de 96 pt no se distingue, y el ahorro es
real: el plan Free de Supabase da 1 GB de Storage y los datos móviles de quien sube la foto no
son gratis.

**Solo se reduce, nunca se amplía.** El `if` sobre `width` está para eso: una captura de pantalla
de 720 px reescalada a 1280 pesaría más y no se vería mejor.

`allowsEditing: true` en el picker deja recortar antes de subir, que en Android es el recorte
nativo del sistema y es la forma más barata de que la foto encuadre el producto.

### Firmar la URL: una query por ruta

```ts
export const imageUrlTtlSeconds = 7 * 24 * 60 * 60
```

Siete días, y la query que la envuelve usa `staleTime` y `gcTime` al **90 % de ese TTL**. Así la
firma se renueva antes de caducar y nunca se pinta una URL muerta. La constante vive en `domain/`
porque es una regla del producto («cuánto vale un enlace a una foto»), no un detalle de Supabase.

Una query por ruta (`['item-image-url', path]`) en vez de firmar en lote al cargar la lista:
`createSignedUrls` (plural) existe, pero obligaría a que la pantalla de lista supiera de firmas y
a refirmar la lista entera cuando cambia un artículo. Con una query por ruta, cada miniatura se
ocupa de lo suyo, la caché de Query las deduplica si dos filas apuntan a la misma ruta, y una
lista sin fotos no hace ni una petición.

`cachePolicy="disk"` en `expo-image` cierra el círculo: la segunda vez que se ve la lista, la
foto sale del disco sin descargar nada. La caché va por URL, así que una foto sustituida (URL
nueva) no se sirve desde la vieja.

### Los tres estados de la miniatura

`ItemImage` es un solo componente para la fila (36 pt) y para el diálogo (96 pt), con tres
estados y label de accesibilidad en cada uno:

- **Subiendo o firmando:** cuadro con `ActivityIndicator` y label «Subiendo la foto de X».
- **Sin foto:** recuadro punteado con 📷 y label «Este artículo no tiene foto». En el diálogo es
  el hueco que invita a pulsar los botones; en la fila no se pinta (ver abajo).
- **Con foto:** la imagen, con label «Foto de X».

En la fila, la miniatura **solo aparece si hay foto o se está subiendo una**. Un placeholder
punteado en cada artículo de una lista de veinte sería ruido puro, y encima sugeriría que falta
algo por hacer en cada línea.

El estado «subiendo» de la fila sale de la propia mutación, sin estado local que mantener:

```ts
const uploadingImageItemId =
  editItem.isPending && editItem.variables?.image.kind === 'replace'
    ? editItem.variables.itemId
    : null
```

Es la única parte de la edición que **no** es optimista, y a propósito: la subida tarda de verdad
(un segundo largo con datos móviles) y no hay nada que pintar por adelantado hasta que Storage
confirma. El nombre y la cantidad sí se actualizan al instante, como siempre. Quitar la foto
también es optimista: la columna se pone a `null` en la caché sin esperar.

### El diálogo se hizo scrollable

Con la sección de foto, el diálogo de editar pasa de dos campos a cuatro bloques. En un móvil
pequeño con el teclado abierto y el tamaño de fuente del sistema subido, eso se sale de la
pantalla y los botones «Guardar» y «Cancelar» quedan fuera de alcance.

`shared/ui/Dialog.tsx` mete los hijos en el `Dialog.ScrollArea` de Paper con un `ScrollView` y
`keyboardShouldPersistTaps="handled"` (sin eso, el primer toque en un botón con el teclado
abierto solo cierra el teclado). El padding horizontal se mueve del `ScrollArea` al contenido
para que la barra de scroll quede en el borde y no cortando el texto.

### Los tests del dominio comparten un fixture

El puerto `ItemRepository` pasa de 5 a 9 métodos, y seis ficheros de test tenían su propio mock
copiado a mano. Cada método nuevo obligaba a tocar los seis. Ahora hay
`domain/__fixtures__/item-repository.ts` con `fakeItemRepository(overrides)` y `fakeItem()`.

Va en `__fixtures__` y no en `__tests__` porque el preset `jest-expo` trata **cualquier** fichero
dentro de `__tests__` como suite, y un fichero de ayudas sin tests falla con «your test suite must
contain at least one test». `jest.config.js` lo excluye además de la cobertura, que si no baja el
porcentaje con código que no es de producción.

### Entrega: build nuevo otra vez

`expo-image-picker` y `expo-image-manipulator` son módulos nativos, así que aplica lo mismo que
en los incrementos 1 y 2: **`eas update` no sirve**, hace falta APK. `app.json` gana el plugin de
`expo-image-picker` con los textos de permiso de cámara y fotos, que son los que lee el usuario
en el diálogo del sistema y por eso están en español y explican para qué.

En Expo Go los dos módulos vienen incluidos en el cliente 54, así que se puede probar por QR sin
esperar al build.

### Cómo probarlo

Antes de nada, en el ordenador:

```powershell
npx supabase db push --linked --yes
npx expo install expo-image-picker expo-image-manipulator
```

y luego, **desde Git Bash** (en PowerShell 5.1 el `>` escribe UTF-16 y rompe ESLint):

```bash
npx supabase gen types typescript --linked > src/shared/lib/db.types.ts
```

En el móvil:

1. Pulsa el nombre de un artículo. El diálogo ahora tiene «Foto de referencia» con un recuadro
   punteado y dos botones.
2. **Hacer una foto**. Android pide permiso de cámara la primera vez: acéptalo. Recorta y
   acepta. La vista previa del diálogo muestra la foto **antes** de guardar.
3. «Guardar». En la fila aparece un spinner de un segundo y luego la miniatura.
4. Cierra la app del todo y ábrela. La foto sigue ahí y aparece al instante (caché de disco).
5. Vuelve a abrir el artículo y elige **Elegir de la galería**. La foto se sustituye, no se
   duplica.
6. **Quitar la foto** y guardar. La miniatura desaparece de la fila al instante.
7. Edita solo el **nombre** de un artículo que tenga foto. La foto **no** se pierde. Este es el
   caso que más fácil se rompe.
8. Rechaza el permiso de cámara a propósito (o quítalo en los ajustes de Android). Sale el aviso
   de permiso denegado y el diálogo se queda como estaba, sin romperse.
9. Modo avión, intenta poner una foto y guardar: aviso de «no tienes conexión» y el artículo se
   queda como estaba.
10. Con dos dispositivos: pon una foto en uno y mira el otro. La miniatura aparece en menos de
    2 s sin tocar nada.
11. Borra un artículo que tenga foto y **deja pasar los 5 s** del «Deshacer». En el panel de
    Supabase (Storage → `item-images`) el objeto ya no está.
12. Con TalkBack: la miniatura se anuncia como «Foto de X» y no se traga el foco del nombre.

Y una comprobación de seguridad que no se ve en la app: en el panel de Supabase, Storage →
`item-images`, copia la URL pública de un objeto (`/object/public/...`) y ábrela en el navegador.
Debe dar error. La firmada (`/object/sign/...`) sí funciona, y deja de funcionar a los 7 días.

### El script de RLS también prueba Storage

`scripts/rls-isolation-test.mjs` pasa de 13 a **19 comprobaciones**. Las seis nuevas atacan
Storage por la API REST, con dos sesiones anónimas reales, igual que las demás:

| Comprobación | Qué demuestra |
|---|---|
| B sube una foto a su carpeta | La política de insert no está de más apretada |
| A no puede subir a la carpeta de B | `item_images_insert` aísla |
| A no lista las fotos de B | `item_images_select` aísla |
| A no puede firmar una foto de B | Firmar exige poder leer |
| B sí puede firmar la suya | La firma funciona para quien debe |
| La URL pública no sirve la foto | El bucket es privado de verdad |

Las dos positivas son tan importantes como las negativas. Una política rota «hacia dentro» (que
deniegue a todo el mundo) también rompe la app, y sin ellas el script daría verde con un bucket
inaccesible.

`npm run test:rls` ya no es solo RLS de Postgres; el número de referencia en `CLAUDE.md` sube a
19/19.

### Verificado

- `eslint`: 0 errores
- `jest`: 127 tests (113 → 127; 4 nuevos del caso de uso de editar, 3 de borrar, 7 del adaptador)
- `npm run test:rls`: 19/19 con la migración aplicada
- `tsc --noEmit`: limpio tras regenerar `db.types.ts`
- `npx expo export --platform android`: bundle de 5.42 MB

Antes del `db push`, `test:rls` daba 17/19 y `tsc` tres errores de `image_path` en
`data/supabase-item-repository.ts`. Queda anotado porque es el estado normal entre escribir el
adaptador y aplicar la migración, y las dos que fallaban eran las **positivas** de Storage: las
cuatro negativas pasaban ya, porque un bucket que no existe tampoco deja entrar a nadie. Un
verde en las negativas no prueba nada si las positivas no pasan a la vez.

---

## Incremento 4 · Micro-interacciones, estados y accesibilidad

RF-6 pide «interfaz estética, mantenible y usable por personas noveles», y su criterio de
aceptación es que alguien que nunca ha visto la app complete las tres tareas núcleo (unirse,
añadir artículo, marcar comprado) sin ayuda. Este incremento no añade funciones: quita fricción
y arregla lo que estaba mal en modo oscuro y con lector de pantalla.

| Fichero | Qué cambia |
|---|---|
| `theme/tokens.js` | Token nuevo `borderStrong` |
| `theme/index.ts` | `usePalette()` |
| `theme/__tests__/tokens.test.ts` | De 9 a 23 comprobaciones de contraste |
| `tailwind.config.js` | Clase `line-strong` |
| `shared/ui/Button.tsx` | El spinner ya no es blanco fijo |
| `shared/ui/Input.tsx`, `Checkbox.tsx`, `QuantityStepper.tsx` | Bordes de control con contraste |
| `items/presentation/components/ItemRow.tsx` | Entrada y reflujo animados |
| `items/presentation/components/ItemImage.tsx` | Modo decorativo para la fila |
| `items/presentation/ItemsScreen.tsx` | Todo dentro de un scroll; estados vacío y «ya está» |

### El borde de los controles no cumplía contraste

El test de tokens comprobaba texto sobre fondo (4.5:1) y nada más. Faltaba la otra mitad de AA:
la **1.4.11, contraste no textual**, que exige **3:1** para el límite visual de un control.

El token `border` (`#D1D5DB` en claro, `#2A3140` en oscuro) da **1.48:1** contra el fondo en las
dos variantes. Como separador decorativo está bien; como borde de una casilla de verificación
vacía o de un campo de texto es un control que mucha gente no ve.

Se añade `borderStrong` (`#6B7280` en las dos variantes: 4.83:1 en claro, 3.96:1 en oscuro) y se
reparten así:

- `borderStrong` → lo que **es** un control: casilla sin marcar, borde del `Input`, botones del
  `QuantityStepper`, recuadro punteado de la foto.
- `border` → lo que **separa**: la línea sobre el pie de la lista, contornos de tarjeta.

No se sube el token existente porque un separador con 3:1 se lee como un borde de control y
ensucia la pantalla. Son dos usos distintos y ahora son dos tokens distintos.

El test de tokens pasa de 9 a 23 casos: añade `textMuted` sobre `surface`, `danger` y `success`
sobre fondo y superficie (los mensajes de error se pintan con `danger` y nadie había comprobado
que se leyeran), y un bloque nuevo a 3:1 para `borderStrong` y `primary`. Es la forma de que
«contraste AA verificado» del apartado F sea una comprobación automática y no una opinión.

### Dos fallos de modo oscuro

**El spinner del botón primario era `colors.light.onPrimary`**, o sea blanco fijo. En claro va
sobre azul oscuro y se ve; en oscuro el primario es `#60A5FA` (azul claro) y el spinner blanco
encima casi desaparece. Ahora sale de la paleta activa, y el secundario usa el color de texto en
vez del gris por defecto de Android.

**Cada componente resolvía la paleta a mano** con `useColorScheme() === 'dark' ? ... : ...`.
Ahora es `usePalette()` en `theme/`. Un sitio menos donde olvidarse de la variante oscura, que
es exactamente cómo se coló el fallo del spinner.

### La pantalla entera scrollea

La pantalla de lista tenía tres bloques de altura fija (cabecera, barra de añadir y pie con el
código y el botón de salir) y la lista repartiéndose lo que sobrara. Con el tamaño de fuente del
sistema al 150-200 %, que es un ajuste normal y no un caso raro, esos bloques se comen la
pantalla y la lista se queda con unos pocos píxeles de alto.

Ahora la cabecera va en `ListHeaderComponent` y el pie en `ListFooterComponent`. Solo hay un
scroll y no puede quedarse sin sitio.

Lo que cuesta: con muchos artículos, la barra de añadir y el código de invitación quedan fuera de
pantalla y hay que subir o bajar para llegar. Se acepta porque el caso que rompía (fuente grande)
dejaba la app inutilizable, y el que empeora (lista larga) cuesta un gesto. La alternativa era
fijar la barra de añadir abajo, tipo chat: se descarta porque cambia la jerarquía de la pantalla
más de lo que este incremento pretende, y habría que reprobarla entera con dos dispositivos.

El `flexGrow: 1` del `contentContainerStyle` se queda: es lo que permite que el estado vacío se
centre en el hueco disponible en vez de pegarse a la cabecera.

### Micro-interacciones: entrada y reflujo

`ItemRow` se envuelve en un `Animated.View` de Reanimated con `entering={FadeIn}` y
`layout={LinearTransition}`, 180 ms los dos.

- **`entering`** suaviza la aparición de un artículo nuevo, propio o de otra persona vía
  Realtime. Antes aparecía de golpe y era difícil ver qué había cambiado.
- **`layout`** anima el reflujo de las filas de debajo cuando una desaparece. Es lo que más se
  nota al marcar comprado: la fila salta de «Por comprar» a «Comprados» y el resto de la lista
  ya no da un tirón.

**El movimiento entre secciones no se anima**, y es una limitación asumida. Marcar comprado
desmonta la fila de una sección y la monta en otra, así que Reanimated la ve como una salida y
una entrada distintas, no como la misma vista moviéndose. Animarlo de verdad exigiría una lista
plana con cabeceras propias en vez de un `SectionList`. No compensa.

Reanimated respeta «reducir movimiento» de Android por defecto (`ReduceMotion.System`), así que
quien lo tenga activado no ve ninguna de las dos animaciones sin que haya que programarlo.

No entran vibraciones (`expo-haptics`): es un módulo nativo y este incremento se prometió como
solo-JS. Queda apuntado para la Fase 4, que ya lleva build propio.

### La miniatura de la fila es decorativa

`ItemImage` gana `decorative`. En la fila, el `Pressable` del nombre ya se anuncia como «Leche,
cantidad 3» y ofrece la acción de editar; una miniatura accesible dentro de ese botón añade una
parada más del lector de pantalla que no aporta nada y parte la fila en dos nodos.

Con `decorative`, la miniatura de la fila es `accessible={false}` +
`importantForAccessibility="no-hide-descendants"`. En el diálogo de editar sigue siendo
accesible, porque ahí sí es el contenido del que se habla.

### Estado vacío y estado «ya está»

El vacío era una frase suelta centrada. Ahora es un estado con las tres partes que un usuario
novato necesita: icono, título («Aquí no hay nada todavía») y qué hacer («Escribe arriba lo
primero que haya que comprar y pulsa Añadir»). El texto anterior describía la situación; el nuevo
dice la acción, que es lo que pide el criterio de aceptación de RF-6.

Y aparece un aviso nuevo cuando **todos** los artículos están comprados: la lista sigue llena,
así que el estado vacío no salta, pero no queda nada por hacer y hasta ahora no se decía. Es un
`accessibilityLiveRegion="polite"`, así que TalkBack lo anuncia solo al marcar el último.

La pantalla de carga también cambia: el `ActivityIndicator` a secas no dice si está cargando o
si se ha colgado. Ahora lleva el texto «Cargando la lista…» debajo, que ya existía en i18n pero
solo se usaba como etiqueta de accesibilidad.

### Entrega: 1.2.0

`app.json` sube a `1.2.0`. Es la misma regla del `runtimeVersion` que obligó a `1.1.0`: el APK
de la 1.1.0 lleva `expo-clipboard` pero **no** `expo-image-picker` ni
`expo-image-manipulator`, así que no puede recibir un update con el código del incremento 3.

Los incrementos 3 y 4 se entregan juntos en el mismo APK. A partir de la 1.2.0, mientras no
entre otro módulo nativo, `eas update` vuelve a servir.

### Cómo probarlo

1. **Ajustes de Android → Pantalla → Tamaño de fuente, al máximo.** Abre la lista. Todo debe
   seguir alcanzable con scroll: el título, la barra de añadir, el código de invitación y el
   botón de salir. Nada recortado, ningún botón fuera de la pantalla.
2. Vuelve la fuente a normal y **cambia a modo oscuro** (Ajustes → Pantalla → Tema oscuro).
   Recorre las cuatro pantallas: inicio, crear, entrar con código y lista. Mira sobre todo el
   borde de los campos de texto y el de la casilla sin marcar: tienen que verse, no intuirse.
3. Pulsa «Crear la lista» en modo oscuro y fíjate en el **spinner del botón** mientras carga.
   Debe verse sobre el azul, no fundirse con él.
4. **Añade un artículo.** Aparece con un fundido, no de golpe.
5. **Marca uno como comprado.** Baja a «Comprados» y las filas de debajo se recolocan
   deslizándose.
6. **Borra el último artículo pendiente** teniendo otros comprados. Debe salir «Ya está todo
   comprado».
7. **Borra todos.** Sale el carrito con el título y la instrucción, centrado.
8. Activa **Ajustes → Accesibilidad → Quitar animaciones**. Repite los pasos 4 y 5: la lista
   cambia sin animación y sin parpadeos.
9. Con **TalkBack**, desliza por una fila con foto: debe leer «Leche, cantidad 3, botón» y pasar
   directamente al botón de borrar. No debe pararse en la miniatura.
10. Con TalkBack, marca el último pendiente: debe anunciar «Ya está todo comprado» sin que
    tengas que buscarlo.

### Verificado

- `eslint`: 0 errores
- `jest`: 141 tests (127 → 141; los 14 nuevos son de contraste de tokens)
- `tsc --noEmit`: limpio

---

## Decisiones sobre la marcha

**El envoltorio `Dialog` acepta un solo par de acciones (confirmar y cancelar).** No admite tres
botones ni acciones destructivas con estilo propio. Se puede ampliar cuando haga falta; hacerlo
ahora sería diseñar para un caso que no existe. El borrado, que sería el candidato a un diálogo
destructivo, no lo usa a propósito: borra ya y ofrece deshacer.

**`share.ts` va en `shared/lib`, no en la feature de comunidad.** Compartir texto no es de
comunidad: el día que se exporte la lista a PDF (RF-8) se compartirá desde el mismo sitio. Lo
que sí es de comunidad es el mensaje, y ese vive en i18n y lo compone `JoinCodeCard`.

**El mensaje compartido no lleva enlace de descarga.** No hay app publicada en ninguna tienda,
así que un enlace sería una promesa falsa. Cuando la haya, se añade a `list.shareMessage` y ya.

**`realtime-check.mjs` espera por condición, no por reloj.** Las dos comprobaciones de presencia
esperaban un tiempo fijo (4 s y 2,5 s) a que llegaran los eventos de entrada y salida. Lanzando
el script con `npm test` en paralelo, el evento de salida no llegaba dentro de los 2,5 s y la
suite daba 10/12 con la app perfectamente bien. Ahora hay un `waitUntil(condición, 10000)` que
sondea cada 200 ms y sale en cuanto se cumple.

El cambio va en las dos direcciones que importan: quita el falso negativo, y en el caso bueno
termina antes que la espera fija porque no agota los 4 s. Un test de red que falla una de cada
tres veces es peor que no tenerlo: enseña a ignorar los rojos, que es justo lo que no quieres
de la comprobación que decide si una fase se cierra.

---

## Auditoría F (§11 del documento maestro)

El entregable de la fase es «experiencia completa y estética, **auditoría F superada**». Los
cuatro puntos del apartado F, con la prueba de cada uno y quién la hace.

### F.1 · Test con 1 usuario novato: completa las 3 tareas núcleo sin ayuda

**Pendiente. No lo puedo hacer yo y no lo voy a dar por bueno leyendo el código.**

Las tres tareas núcleo, tal y como hay que plantearlas (sin decir dónde está nada):

1. «Entra en esta lista con este código: `XXX-XXXX`.»
2. «Apunta que hay que comprar tres litros de leche.»
3. «Ya la has comprado, márcalo.»

Se pasa si las hace sin que nadie le señale la pantalla y sin preguntar «¿y ahora qué?». Los
sitios donde espero que se atasque, por si conviene mirarlos de cerca:

- El paso de la landing a «Tengo un código»: hay dos botones y el correcto depende de si alguien
  le pasó un código, algo que la pantalla no sabe.
- La cantidad. El valor por defecto es 1 y el `QuantityStepper` está dentro del diálogo de
  editar, no en la barra de añadir. Para poner 3 hay que añadir primero y editar después.
- Marcar comprado: la casilla es el control, pero el nombre al lado abre el diálogo de editar.
  Es el toque accidental más probable de la pantalla.

Si falla el punto 2, la conclusión no es «el usuario no lo entiende», es que la cantidad tiene
que estar en la barra de añadir. Anótalo y lo arreglamos antes de la Fase 4.

### F.2 · Contraste AA verificado; targets ≥ 44 pt; labels de accesibilidad presentes

**Cumplido, y ahora es automático.** Las tres cosas se comprobaban a ojo hasta este incremento;
ahora fallan el build si se rompen.

| Qué | Cómo se comprueba | Resultado |
|---|---|---|
| Contraste de texto (4.5:1) | `src/theme/__tests__/tokens.test.ts` | 8 pares × 2 esquemas |
| Contraste de controles (3:1, WCAG 1.4.11) | mismo fichero | 3 pares × 2 esquemas |
| Área táctil ≥ 44 pt | `minTouchTarget` en 5 componentes | `ItemRow`, `Button`, `Checkbox`, `Input`, `QuantityStepper` |
| Labels | grep de `<Pressable` vs `accessibilityLabel` | 5 de 5 |

El test de tokens calcula la luminancia relativa y el ratio de verdad; no compara contra una
lista de valores apuntados a mano, que se queda desfasada en cuanto alguien toca un color. Si
mañana el azul primario se aclara medio tono, el test lo dice.

No hay `TouchableOpacity` ni `TouchableHighlight` en el código: todo control pulsable es
`Pressable` o pasa por `shared/ui`, así que el grep de arriba es exhaustivo y no una muestra.

El hueco real que encontró esta auditoría fue el de 1.4.11 (bordes de control a 1.48:1), y está
resuelto con `borderStrong`. Está contado arriba, en el incremento 4.

### F.3 · Modo oscuro y tamaño de fuente del sistema respetados

**Cumplido en código, falta verlo en el móvil.** Lo que se ha hecho:

- Ningún componente resuelve la paleta a mano: todos pasan por `usePalette()`. Era el agujero
  por el que se coló el spinner blanco sobre azul claro.
- Ninguna altura fija en la pantalla de lista. La cabecera y el pie viven dentro del scroll de la
  `SectionList`, así que con la fuente al 200 % nada queda fuera de alcance.
- Ningún `fontSize` numérico ni `allowFontScaling={false}` en toda la app: los tamaños salen de
  clases de Tailwind, que escalan con el ajuste del sistema.

Lo que no puede comprobar un test: que el resultado se lea. Eso son los pasos 1 a 3 del «cómo
probarlo» del incremento 4.

### F.4 · «Deshacer» tras borrar funciona

**Cumplido.** Implementado desde la Fase 1 en `use-delete-item.ts` y sin tocar en esta fase.
Lo que conviene recordar al probarlo, porque es lo que lo hace correcto y no se ve desde fuera:

- El `delete` contra el servidor **no se lanza al pulsar la ✕**. Se difiere 5 s. Si deshaces, se
  cancela el timer y el servidor nunca se enteró, así que el artículo vuelve con su `id` y su
  fecha originales.
- El timer sobrevive a salir de la pantalla. Borrar y volver atrás confirma el borrado igual.

Verificación manual: borra un artículo, pulsa «Deshacer» **en el segundo móvil no debe haber
pasado nada** (ni desaparecer ni reaparecer), porque el borrado nunca llegó al servidor.

### Otros apartados que esta fase movió

No son el criterio de cierre, pero cambiaron y quedan anotados:

- **E (seguridad):** el bucket `item-images` es privado y sus cuatro políticas se apoyan en
  `member_community_ids()`, igual que las tablas. El script de aislamiento pasa de 13 a 19
  comprobaciones; las 6 nuevas son de Storage. Detalle en el incremento 3 y en
  [ADR-0006](../adr/ADR-0006-fotos-de-articulos-en-storage.md).
- **G (calidad):** `eslint` en 0, `tsc` limpio, `jest` en 141 tests y 20 suites.
- **H (rendimiento):** las fotos se comprimen a 1280 px de ancho y JPEG al 70 % antes de subir
  (`shared/lib/image.ts`), y el bucket rechaza cualquier cosa por encima de 2 MB.

---

## Verificación automática, con la migración aplicada

La migración `20260803120000_item_images_storage.sql` se aplicó el 2026-08-03 con
`npx supabase db push --linked --yes`, y `db.types.ts` se regeneró en el mismo momento. El
`db push` avisa de que no encuentra Docker: es solo el caché local del catálogo de migraciones,
la migración se aplica igual.

| Comprobación | Resultado |
|---|---|
| `npm run lint` | 0 errores |
| `npx tsc --noEmit` | limpio |
| `npm test` | 141 tests, 20 suites |
| `npm run test:rls` | 19/19 |
| `npm run test:realtime` | 12/12 |
| `npx expo export --platform android` | bundle de 5.42 MB |

## Qué falta para cerrar la fase

Solo la verificación en dispositivo:

```bash
npx eas-cli@latest build --platform android --profile preview
```

La fase se cierra cuando el APK 1.2.0 esté instalado en los dos móviles, el pie de la pantalla
de lista diga `v1.2.0 · base`, y pasen los pasos manuales de los incrementos 3 y 4 más el test
con usuario novato de F.1.
