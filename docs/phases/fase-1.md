# Fase 1 · MVP CRUD local a la nube

- Estado: **en curso**
- Inicio: 2026-07-19

Entregable de la fase (§12 del documento maestro): una persona usa la lista completa contra la
nube.

Incrementos, en orden. Cada uno se prueba en el Android real antes de pasar al siguiente:

1. [x] Sesión anónima
2. [ ] Crear y unirse a comunidad por código (RF-2, RF-5) + rate limit — **backend hecho**, app pendiente
3. [ ] Lista de artículos: leer y añadir (RF-3)
4. [ ] Marcar comprado y borrar con deshacer (RF-1, RF-4 sin imagen)
5. [ ] Estados vacíos, errores y repaso de accesibilidad

---

## Incremento 1 · Sesión anónima

La app pide una sesión anónima a Supabase al arrancar y la reutiliza en los siguientes
arranques. Es lo que da el `auth.uid()` del que dependen todas las políticas RLS
([ADR-0002](../adr/ADR-0002-modelo-de-sesion-y-rls.md)), así que sin esto no funciona nada de
lo que viene después.

Primera feature con las tres capas, y sirve de plantilla para las siguientes:

```
src/features/session/
├── domain/
│   ├── session.ts               la entidad
│   ├── session-repository.ts    el puerto (interfaz)
│   └── ensure-session.ts        el caso de uso, función pura
├── data/
│   └── supabase-session-repository.ts   el adaptador
└── presentation/
    ├── session-store.ts             estado de cliente (Zustand)
    ├── use-session-bootstrap.ts     arranque y reintento
    └── SessionGate.tsx              carga / error / contenido
```

`ensureSession` recibe el repositorio como parámetro en vez de importarlo. Por eso se puede
probar con un doble y sin tocar la red, y por eso `domain/` no sabe que Supabase existe.

**El estado de sesión vive en Zustand, no en TanStack Query.** No es estado de servidor: es
estado local del dispositivo. La regla de `CLAUDE.md` se aplica tal cual.

### Decisiones sobre la marcha

**`SessionGate` bloquea el árbol hasta que hay sesión.** La alternativa era dejar renderizar y
que cada pantalla se defendiera sola, lo que reparte por toda la app un caso que solo ocurre
al arrancar. A cambio, un fallo de red en el primer arranque deja al usuario en una pantalla
de error en vez de en la landing; se compensa con un botón de reintento, que es lo que la
persona va a querer hacer de todas formas.

**Los errores del adaptador se traducen a mensajes accionables.** Si Supabase responde
`anonymous_provider_disabled`, el mensaje dice literalmente dónde hay que ir a activarlo. Es
el error que más tiempo cuesta diagnosticar de este proyecto y ya nos pasó una vez en Fase 0.

**El `useEffect` de arranque consulta `getState()` en vez del `status` suscrito.** Con el
estado suscrito, React en modo estricto ejecuta el efecto dos veces y se crean dos sesiones
anónimas, o sea dos usuarios huérfanos por cada arranque en desarrollo.

### Cómo probarlo

1. `npx expo start --clear` y abre en el Android.
2. Debe verse un indicador de carga breve y luego la landing. Si se queda en la carga o sale
   la pantalla de error, el mensaje dice qué pasa.
3. **Cierra la app del todo** (deslizar en multitarea, no solo minimizar) y vuelve a abrirla.
   La segunda vez no debe crear una sesión nueva: se reutiliza la guardada.
4. Comprobación de que la sesión persiste de verdad, en el panel de Supabase:
   **Authentication → Users**. Cuenta los usuarios anónimos, reinicia la app dos o tres veces
   y vuelve a contar. El número no debe subir.
5. Modo avión antes de abrir la app por primera vez tras instalar: debe salir la pantalla de
   error con reintento, no una pantalla en blanco.

### Verificado

- `eslint`: 0 errores
- `tsc --noEmit`: limpio
- `jest --coverage`: 18 tests, 94.44% en dominio y datos (umbral 70%)
- `npx expo export --platform android`: compila, bundle 5.2 MB
- **En el Android real (2026-07-19):** la app arranca, muestra la landing, y tras varios
  cierres completos y reaperturas `npm run users` sigue devolviendo el mismo usuario
  (`73f3376a…`, creado 14:08:24 UTC). Cero usuarios nuevos, o sea que la sesión se reutiliza
  desde AsyncStorage en vez de recrearse.

Esta es además la primera vez que la app habla con Supabase de verdad, lo que cierra el matiz
que quedó abierto al final de la Fase 0.

---

## Incremento 2 · Crear y unirse a comunidad

### Backend (hecho)

Dos migraciones: `20260719150000_join_rate_limit.sql` y
`20260719151500_fix_join_community_ambiguity.sql`.

**Rate limit:** tabla `join_attempts` con RLS activo y sin políticas, o sea que solo la
alcanza la función `security definer`. El límite son **10 intentos fallidos en 15 minutos por
`auth.uid()`**. Cierra el punto E de la auditoría §11, que quedó pendiente en Fase 0.

#### `join_community` deja de lanzar excepciones

Cambia el contrato: antes devolvía `uuid` y lanzaba `invalid_join_code` o `username_taken`;
ahora devuelve `(status, community_id)` con `ok`, `invalid_join_code`, `username_taken` o
`too_many_attempts`.

No es estilo, es que la versión con excepciones **hacía imposible el rate limit**. En Postgres,
una excepción deshace la transacción entera, incluido el `insert` en `join_attempts` que
registra el intento. Cada intento fallido se borraba a sí mismo al fallar, así que el contador
nunca subía: un candado sin pestillo. Se detectó al escribir el test, no en producción.

Esto supera la descripción de `join_community` que da
[ADR-0002](../adr/ADR-0002-modelo-de-sesion-y-rls.md) (dice que "devuelve solo el
`community_id`"). El modelo de sesión y el razonamiento de RLS del ADR siguen vigentes; lo que
cambia es la forma del retorno.

#### La trampa de `#variable_conflict use_column`

La primera versión aplicada fallaba con `column reference "community_id" is ambiguous`
(SQLSTATE 42702): el parámetro de salida se llama `community_id` y `members` tiene una columna
igual, así que PL/pgSQL no sabe a cuál te refieres en el `insert` ni en el `on conflict`. Se
arregla con `#variable_conflict use_column` al principio del cuerpo.

Como la migración anterior ya estaba aplicada, **no se editó**: se añadió otra encima, que es
la regla de `supabase-data`.

#### Verificado

`npm run test:rls` pasa **13/13**, dos comprobaciones más que antes:

```
OK   El rate limit corta los intentos a fuerza bruta — cortado en el intento 10
OK   El rate limit es por usuario, no global — ok
```

La segunda importa: un rate limit mal escrito (contando intentos globales en vez de por
usuario) habría bloqueado a toda la beta en cuanto alguien se equivocara diez veces de código.

`db.types.ts` regenerado tras el cambio de firma.
