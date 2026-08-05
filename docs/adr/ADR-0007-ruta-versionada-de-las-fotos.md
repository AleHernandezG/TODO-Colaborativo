# ADR-0007: La ruta de la foto lleva versión

- Estado: Aceptado
- Fecha: 2026-08-04
- Supersede parcialmente a [ADR-0006](ADR-0006-fotos-de-articulos-en-storage.md): solo la
  decisión de la ruta determinista. El bucket privado, las cuatro políticas, el nombre
  `image_path` y la firma de 7 días siguen vigentes tal cual.

## Contexto

ADR-0006 fijó la ruta `<community_id>/<item_id>.jpg`, sin timestamp ni uuid, y descartó la ruta
aleatoria con este argumento:

> La ruta determinista además hace que la caché por URL de `expo-image` se invalide sola: la
> firma es nueva aunque la ruta sea la misma.

**Eso era falso, y la prueba en dispositivo lo destapó.** Al sustituir la foto de un artículo, la
app seguía enseñando la anterior. El objeto en Storage sí se actualizaba (se ve en la fecha de
modificación del panel), pero ninguna pantalla se enteraba.

La cadena, de arriba abajo:

1. `uploadImage` hace `upsert` sobre la misma ruta. Los bytes cambian.
2. `edit()` escribe en `image_path` **el mismo texto que ya estaba**.
3. La fila que devuelve el servidor es idéntica a la anterior, así que la query de la URL
   firmada, cuya clave es `['item-image-url', path]`, no cambia de clave. Con un `staleTime` de
   6,3 días, TanStack Query devuelve **la URL que ya tenía cacheada**. La firma nueva del punto
   anterior nunca se pide.
4. Misma URL y `cachePolicy="disk"` en `expo-image`: sirve los bytes viejos del disco.

El error de razonamiento de ADR-0006 fue dar por hecho que «la firma es nueva» sin mirar qué
dispara una firma nueva. Firmar es una query cacheada por ruta; si la ruta no cambia, no se
vuelve a firmar nunca.

Lo importante es que **no es un problema de caché local**. El segundo móvil recibe el evento de
Realtime, refresca la lista, ve el mismo `image_path` y se queda con su propia URL cacheada. Es
decir: en una app cuyo objetivo es que varias personas vean lo mismo, sustituir una foto no se
propagaba a nadie.

## Decisión

**La ruta pasa a ser `<community_id>/<item_id>-<epoch_ms>.jpg`.**

La identidad de la foto vuelve a estar representada en los datos: sustituirla cambia el valor de
`image_path`, y con eso cambia la clave de la query, la URL firmada y la clave de caché de
`expo-image`. La propagación al resto de dispositivos ocurre por el camino que ya existía
(evento de Realtime → refetch de la lista → ruta nueva), sin una sola línea de invalidación.

El timestamp lo genera el adaptador de `data/`, que es quien decide la forma de la ruta. El
dominio no sabe cómo se llaman los ficheros.

**No hace falta migración.** `image_path` es `text` y las cuatro políticas miran
`(storage.foldername(name))[1]`, que sigue siendo el `community_id`. Las fotos ya subidas
conservan su ruta vieja y se siguen viendo; solo las nuevas llevan versión.

**El objeto anterior se borra**, porque ya no hay un `upsert` que lo pise. El orden importa:

1. Subir la foto nueva.
2. Actualizar `image_path`.
3. Borrar el objeto anterior, **y si esto falla, no pasa nada.**

El paso 3 se traga su propio error (`removeImage(path).catch(() => undefined)`). El usuario ya
ve lo que quería y la fila apunta a un objeto que existe; convertir un fallo de limpieza en un
error de la edición dispararía el rollback optimista y le enseñaría un estado falso. El precio
de un fallo es un JPEG de ~200 KB abandonado.

Nunca al revés: borrar antes de actualizar la columna deja, si algo se cae en medio, una fila
apuntando a un objeto que ya no está, que es un fallo visible y permanente.

**«Quitar la foto» ahora también borra el objeto**, con el mismo criterio de «si falla, da
igual». ADR-0006 lo dejaba sin borrar apoyándose en que la siguiente foto pisaría el huérfano;
con rutas versionadas eso ya no ocurre y el objeto se quedaría para siempre.

## Alternativas consideradas

**Meter `updated_at` en la clave de la query.** Añadir `updatedAt` a la entidad `Item` y firmar
por `[path, updatedAt]`. Arregla el bug, no toca ADR-0006 y mantiene la ruta determinista, que
era la opción cómoda. Se descarta porque `updated_at` se mueve con **cualquier** edición: el
trigger `items_touch_updated_at` lo actualiza al cambiar el nombre, la cantidad o el
`is_purchased`. Marcar un artículo como comprado es la acción más frecuente de la app, y cada
una obligaría a los dos móviles a refirmar y **volver a descargar la foto entera**. Se cambia un
bug de correctitud por un problema de consumo de datos que solo se nota en la factura de quien
la paga.

**Una columna `image_updated_at timestamptz`.** La versión precisa de lo anterior: cambia solo
cuando cambia la foto y deja la ruta determinista intacta. Se descarta porque necesita migración
y ciclo de aprobación de esquema para conseguir exactamente lo mismo que meter el timestamp en
un nombre de fichero, que no cuesta nada. Guardar dos veces el mismo hecho (la foto cambió) en
dos sitios que hay que mantener sincronizados es peor que guardarlo una vez en la ruta.

**Invalidar a mano la query de la URL firmada tras sustituir.** Un
`queryClient.removeQueries({ queryKey: itemImageUrlKey(path) })` en el `onSuccess` de la
mutación. Es de una línea y arregla el móvil que hace el cambio. Se descarta porque **no arregla
el otro móvil**, que es la mitad del producto: el segundo dispositivo no ejecuta ese `onSuccess`
y no tiene forma de saber que la foto cambió, porque el dato que recibe es idéntico al que ya
tenía.

**Añadir un parámetro de cache-busting a la URL firmada** (`?v=<timestamp>`). La URL de Supabase
Storage ya lleva el token como query param y añadir otro requiere que el timestamp venga de algún
sitio, con lo que se vuelve al problema de arriba: hay que representar en los datos que la foto
cambió. Además ensucia una URL firmada, cuya integridad depende del token.

## Consecuencias

**A favor**

- Sustituir una foto se ve, en el móvil que la cambia y en los demás, con el mecanismo de
  sincronización que ya existía.
- La invalidación es precisa: solo se refirma y se descarga cuando la foto cambió de verdad, no
  cuando alguien marcó algo como comprado.
- No necesita migración, no cambia las políticas y no rompe las fotos ya subidas.

**En contra**

- **Vuelve la posibilidad de objetos huérfanos**, que era el argumento con el que ADR-0006
  descartó la ruta aleatoria. Se acepta a cambio de que la función se comporte bien: un huérfano
  cuesta 200 KB en un plan con 1 GB, y una foto que no se actualiza cuesta que la función no
  sirva. Si algún día molesta, se limpia con un job que compare el bucket contra `image_path`.
- **Un `upsert` ya no basta para sustituir**: hay una operación de red más (el borrado de la
  anterior) en cada cambio de foto. Es best-effort, así que no añade un modo de fallo nuevo al
  guardado.
- **La ruta ya no se puede deducir desde fuera** a partir del `community_id` y el `item_id`. No
  se usaba en ningún sitio (la columna es la fuente), pero conviene saberlo antes de escribir un
  script que lo dé por hecho.

## Notas

La trampa general, que no es de este proyecto, está anotada en la skill `expo-stack`: **una URL
cacheada no se entera de que el objeto que hay detrás cambió**. Si el contenido de un recurso
puede cambiar sin que cambie su identificador, el identificador está mal elegido.

Cómo se detectó y cómo se prueba: `docs/phases/fase-3.md`, «Lo que encontró la prueba en
dispositivo».
