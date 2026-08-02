# ADR-0005: El reparto de gastos va en fase propia y exige identidad no suplantable

- Estado: Aceptado
- Fecha: 2026-08-02

## Contexto

De `docs/funcionalidades.txt` salen dos funciones que no estaban en la especificación original:
exportar la lista a PDF y un reparto de gastos estilo Tricount. La primera es un botón que
genera un fichero en el cliente y no toca nada más. La segunda no.

Lo que pide el reparto de gastos, en concreto: al marcar un artículo como comprado, poder
anotar cuánto costó, quién lo pagó y entre quiénes se reparte; y una pantalla que resuma quién
debe cuánto a quién. Registrado como RF-9 en el documento maestro.

Eso choca de frente con el modelo de sesión de la beta. Hoy la identidad de un miembro es un
`username` dentro de una comunidad a la que se entra con un código compartido (§9.2 del
documento maestro): cualquiera que tenga el código entra, y un nombre no está protegido por
nada. Es una decisión consciente y es aceptable para una lista de la compra, donde lo peor que
puede pasar es que alguien borre el pan. Deja de ser aceptable en cuanto la app dice «Ana debe
7,30 € a Luis», porque entonces la app está afirmando algo sobre el dinero de una persona real
apoyándose en un nombre que cualquiera puede escribir.

Se suma que la atribución ni siquiera está implementada: `items.created_by` se guarda como
`null` desde la Fase 1 (deuda documentada en `docs/phases/fase-1.md`, incremento 3), porque el
cliente no tiene a mano su propio id de miembro.

## Decisión

**El reparto de gastos es una fase propia (Fase 6), posterior a la beta, y su requisito de
entrada es el PIN o passphrase por miembro del punto 1 de §9.4.** No se construye sobre la
identidad actual.

La exportación a PDF (RF-8) va aparte y sin condiciones: entra en la Fase 3 con el resto del
pulido, porque no toca el esquema, no depende de quién eres y se puede tirar sin coste si
molesta.

Además quedan fijadas desde ahora las restricciones de diseño del esquema, para que la
discusión no se repita cuando toque escribir la migración. Quien la escriba las respeta o
justifica por escrito, en un ADR nuevo, por qué no:

**Dinero.** Importes en enteros de céntimos (`integer`), nunca `numeric` con decimales y mucho
menos coma flotante. La moneda se guarda explícita en el gasto en vez de darse por supuesta.
Un reparto entre tres personas de 10,00 € da 3,33 + 3,33 + 3,34: con céntimos el resto es
visible y se reparte de forma determinista; con flotantes desaparece y los balances dejan de
cuadrar por un céntimo que nadie sabe de dónde sale.

**El gasto es una entidad propia, no columnas colgadas de `items`.** Añadir `price` y `paid_by`
a la tabla `items` parece más corto y es una trampa: mezcla dos ciclos de vida distintos (el
artículo se borra de la lista de la compra, el hecho de que alguien pagó 4 € no se borra),
obliga a nulos en casi todas las filas, y no tiene dónde meter a los participantes del reparto.
La relación con el artículo es opcional y con `on delete set null`, de forma que quitar el pan
de la lista no borre la deuda.

**Los participantes van en tabla puente**, con el importe imputado a cada uno, no solo la lista
de quiénes. Guardando el importe por participante, un reparto desigual («esto lo pagó Ana pero
es solo para Luis y para mí») cabe en el mismo modelo sin migración nueva.

**Los balances se calculan, no se guardan.** Nada de una columna `balance` en `members` que
haya que mantener a mano y que se desincronice el día que falle un update. El balance es la
suma de lo pagado menos lo imputado, y la liquidación mínima (quién le paga a quién para que
todos queden a cero) es un algoritmo en `domain/`, función pura y testeable, no SQL. Si algún
día el rendimiento lo pide, se resuelve con una vista o un índice, no con una columna
denormalizada.

**La suma de las partes cuadra con el total, y lo comprueba la base de datos**, no la buena
voluntad del cliente. Un `constraint` diferible o la propia RPC que escribe el gasto y sus
partes en una transacción.

**RLS activo en la misma migración que crea cada tabla**, por `community_id` y con la misma
función `security definer` que ya usan `items` y `members` (ADR-0002). Con una vuelta de tuerca
que las tablas actuales no necesitan: en `items` cualquier miembro puede editar cualquier fila,
pero un gasto solo lo modifica o borra quien lo registró. En la lista de la compra el borrado
compartido es cómodo; en el dinero es una discusión.

**Cada clave foránea con su `on delete` explícito y su índice** si se filtra por ella. Vale para
cualquier tabla del proyecto, se recuerda aquí porque este modelo tiene más relaciones que todo
lo anterior junto.

## Alternativas consideradas

**Meterlo en la Fase 3, con la identidad actual.** Es lo que pedía el impulso de tenerlo ya.
Se descarta porque produce una función que miente con confianza: los balances se pueden
falsificar entrando con el código y poniéndose el nombre de otro, y el usuario no tiene forma
de notarlo. Una función de dinero que no es fiable es peor que no tenerla, porque la gente se
la cree.

**Adelantar el §9.4 entero (email/OTP, magic link o proveedores sociales).** Resolvería la
identidad de sobra, y se lleva por delante la propuesta de valor de la app, que es entrar en
una lista en menos de 30 segundos sin cuenta ni correo. El PIN por miembro es el mínimo que
hace falta: protege el nombre dentro de la comunidad, que es justo lo que el reparto necesita,
y no obliga a nadie a registrarse.

**No construirlo y decirle al usuario que use Tricount.** Alternativa honesta y hay que
nombrarla, porque Tricount ya hace esto mejor de lo que lo vamos a hacer nosotros. Se descarta
porque el valor no está en el cálculo, que es aritmética de primaria, sino en anotar el precio
en el mismo gesto de marcar el artículo como comprado, con el carrito en la mano. Cambiar de
app en la cola del súper es exactamente lo que la gente no hace.

**Hacer el cálculo de balances en Postgres, con vistas y funciones.** Tentador porque el dato
está ahí, pero el algoritmo de liquidación mínima es lógica de negocio y las reglas del
proyecto la quieren en `domain/`, sin React y sin Supabase, donde se prueba con un test de tres
líneas. En SQL se prueba con `npm run test:rls` y una sesión real, que cuesta bastante más por
cada caso.

## Consecuencias

**A favor**

- La beta no se retrasa. Las fases 2, 3 y 4 siguen igual y la app llega a estar terminada antes
  de abrir un módulo grande.
- Cuando llegue la Fase 6, el modelo ya tiene la forma decidida y las trampas conocidas: la
  conversación de la migración es corta.
- Obliga a cerrar la deuda de `items.created_by`, que además hace falta para la atribución de
  la presencia (Fase 2) y para el «Luis añadió pan hace 1 min» de §8.4.

**En contra**

- La función que el usuario ha pedido con más ganas es la que más tarda en llegar. Se compensa
  a medias con el PDF, que sí entra pronto.
- Amarra la Fase 6 a la Fase 5: si el PIN se complica, el reparto se queda esperando. Es
  deliberado, pero es una dependencia dura donde antes no había ninguna.
- Fijar restricciones de esquema antes de escribir la primera línea corre el riesgo de decidir
  con menos información de la que habrá entonces. Por eso la puerta queda abierta con un ADR
  que supersede a este, que es como se cambia de opinión en este repo.

## Notas

Al implementar, mirar antes:

- `docs/adr/ADR-0002-modelo-de-sesion-y-rls.md`, sobre todo la recursión en las políticas y la
  función `security definer`. El modelo de gastos tiene más tablas y el mismo riesgo.
- `docs/phases/fase-1.md`, incremento 3, para el porqué de `created_by = null` y qué haría
  falta para arreglarlo.
- La skill `supabase-data` para el procedimiento de migraciones (nunca se editan, se apilan) y
  la regeneración de `db.types.ts`.
