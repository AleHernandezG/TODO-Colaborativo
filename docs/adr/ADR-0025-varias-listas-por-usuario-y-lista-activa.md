# ADR-0025: Varias listas por usuario y lista activa

- **Fecha:** 2026-10-05
- **Estado:** Aceptado
- **Decisores:** Alejandro, con Claude

---

## Contexto

El servidor permite desde el primer día que una misma sesión anónima esté en varias comunidades:
`members` tiene una fila por (comunidad, usuario) y las políticas resuelven la pertenencia con
`member_community_ids()`. La app no lo aprovechaba. Guardaba una sola `membership` en un store de
Zustand y, para pasar de la lista de casa a la del piso, había que pulsar "Salir de esta lista",
volver a la portada, escribir el código de invitación, el nombre y el PIN, y repetirlo entero para
volver. Con dos listas eso se hace varias veces al día.

Había además un engaño en el botón. "Salir" solo borraba la `membership` del móvil; en el servidor
la persona seguía siendo miembro, seguía contando en los repartos de gastos y seguía recibiendo
notificaciones. No era una baja, era un olvido local.

Restricciones que puso el usuario al aprobar el plan: no romper la app que ya está instalada y
cubrir cada incremento con pruebas automáticas.

## Decisión

### 1. Mis listas son server state y viven en una query

`CommunityRepository.listMine()` lee `members` con la comunidad embebida, filtrando por el
`auth_user_id` de la sesión y por `removed_at is null`. En presentación es la query
`['my-communities']`, persistida, que se refresca al abrir el selector y al volver la app a primer
plano. No hay migración: las tablas, la RLS y los tipos generados ya daban para esto.

### 2. La lista activa sigue en el store, con la misma forma

`useActiveCommunityStore` conserva `membership`, `setMembership` y `leave`. El valor persistido en
AsyncStorage no cambia de clave ni de forma. Ese store es el puntero local a "cuál estoy mirando",
que es estado de cliente, y de paso guarda el nombre y el código para pintar la cabecera sin red.

Para que no se quede rancio, `useActiveMembershipSync` lo reconcilia contra la respuesta del
servidor con `checkActiveMembership` (dominio, función pura):

| Qué dice el servidor                         | Qué hace la app                                        |
| -------------------------------------------- | ------------------------------------------------------ |
| Sigo en la activa, mismos datos              | Nada                                                   |
| Sigo en la activa, cambió nombre o código    | Actualiza el store                                     |
| Ya no estoy en la activa y me quedan otras   | Pasa a la primera por orden alfabético y avisa         |
| Ya no estoy en ninguna                       | Vacía el store, la pantalla vuelve a la portada, avisa |

La reconciliación solo corre con una respuesta llegada después de montar la pantalla. La copia
persistida de la query nunca decide, porque puede ser de antes de crear una lista y echaría al
usuario de la que acaba de abrir.

### 3. El cambio de lista se hace desde el título

El nombre de la lista en la cabecera es un botón con un `▾`. Abre un diálogo con mis listas en
forma de grupo de radio, la activa marcada con borde, icono y texto, y debajo "Crear otra lista" y
"Unirme con un código". Es el patrón del selector de cuenta de Google y del de workspace de las
apps de Microsoft, y lo mismo que hace Tricount con sus grupos: el contexto actual es el título, y
tocarlo enseña los demás.

Cambiar no navega. La pantalla de lista se vuelve a montar con `key={community.id}` y sus queries,
su canal de Realtime y su estado local nacen de la lista nueva.

### 4. El botón "Salir de esta lista" desaparece

Ya no hace falta para cambiar y nunca fue una baja. Quitar a alguien de verdad sigue siendo cosa
del admin en la pantalla de miembros (ADR-0017).

### 5. Las notificaciones push cubren todas mis listas

El token del dispositivo se registra en cada comunidad a la que pertenezco, no solo en la abierta.
El cliente que envía añade `communityId` a los datos de la notificación, y al tocarla la app abre
esa lista antes de navegar. Si ya no pertenezco a esa lista, no navega.

## Alternativas consideradas

**Reducir el store a `activeCommunityId` y sacar todo lo demás de la query.** Es lo más limpio
sobre el papel y se descartó por tres costes. Cambia el valor persistido, así que necesita una
migración de `persist` y un rollback por aire a la versión anterior encontraría un formato que no
entiende. La caché de queries se tira con cada build o update (el buster cambia), de modo que justo
después de actualizar y sin cobertura la app no sabría el nombre de su propia lista. Y obliga a
tocar los dieciséis sitios que hoy leen `membership`. A cambio se ganaba no tener el nombre y el
código en dos sitios, que la reconciliación del punto 2 ya resuelve.

**Una pantalla "Mis listas" como inicio de la app.** Añade un paso a quien solo tiene una lista,
que hoy es casi todo el mundo, y esa persona abre la app para apuntar leche, no para elegir dónde.

**Pestañas o un cajón lateral.** Las pestañas no escalan a nombres largos ni a más de cuatro
listas. El cajón obliga a meter un icono de menú en una cabecera que ya va justa en Android.

**Migración para tener una RPC `my_communities()`.** Innecesaria. El `select` embebido pasa por la
RLS que ya existe y está comprobado contra el backend real.

## Consecuencias

- Quien usó el antiguo "Salir" sigue siendo miembro en el servidor, así que esas listas le
  aparecen ahora en el selector. Es el comportamiento correcto: refleja lo que el servidor siempre
  dijo.
- Una instalación cuya sesión anónima se perdió (reinstalar, borrar datos) tenía una `membership`
  guardada que la RLS ya no respaldaba y veía una lista vacía sin explicación. Ahora la
  reconciliación la devuelve a la portada con un aviso, y puede volver a entrar con su PIN.
- El nombre y el código de la lista activa están en el store y en la query. Manda la query; el
  store se corrige solo. Quien añada otro dato de la comunidad al store hereda esa obligación, y
  lo razonable es no añadirlo.
- Las notificaciones enviadas por un móvil con la versión anterior no llevan `communityId` y se
  comportan como hasta ahora: abren la ruta sobre la lista que esté activa.
- El arranque en frío desde una notificación sigue sin atenderse (no se consulta
  `getLastNotificationResponseAsync`). Ya era así antes y queda como deuda.
- `usePushNotifications` cambia de firma: recibe un array de ids y un callback opcional.
- El aislamiento se comprueba en `npm run test:rls` con cinco casos nuevos: una sesión en dos
  listas ve las dos, un compañero de una no ve la otra y un desconocido no ve ninguna.
