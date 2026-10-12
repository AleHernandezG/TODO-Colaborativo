# Guía: ensayar una migración antes de aplicarla al proyecto real

Para las migraciones que, si fallan, dejan la app sin poder usarse: las que reescriben
`join_community` o `create_community`, las que eliminan una columna y las que mueven datos. En esta
máquina no hay Docker, así que `supabase db reset` contra una base local no existe; el ensayo se hace
contra **un segundo proyecto de Supabase**, gratuito y vacío.

La primera vez se usa con la migración `20261012120000_member_secrets_and_identity_hardening.sql`
([ADR-0026](../adr/ADR-0026-pin-fuera-de-members-y-recuperacion-de-identidad.md)). Decidido por el
usuario el 2026-10-12: esa migración no tiene vuelta atrás una vez hecho el `drop column`.

## Qué prueba el ensayo y qué no

| Prueba                                                                       | No prueba                                                          |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Que el fichero se aplica entero sobre el esquema que dejan las anteriores    | Que se aplica bien sobre **los datos** reales (el ensayo está vacío) |
| Que las funciones no revientan en su primera llamada                         | Objetos creados a mano en el panel del proyecto real               |
| Que `test:rls` y `test:realtime` pasan con el esquema nuevo                  | El comportamiento de los APK ya instalados                         |

Por lo primero de la columna derecha, antes de aplicar al real se lanzan además las consultas de
comprobación que traiga el ADR de la migración (en ADR-0026, el apartado «Lo que no se ha podido
comprobar»).

## 0. Una sola vez: crear el proyecto de ensayo

1. En https://supabase.com/dashboard, **New project** en la misma organización. Nombre sugerido:
   `lista-compra-ensayo`. Plan Free. Apunta la contraseña de la base de datos.
2. **Authentication → Sign In / Providers → Allow anonymous sign-ins**: actívalo. Viene apagado de
   fábrica y sin él no funciona ningún flujo ni ningún test.
3. **Project Settings → API**: copia la URL, la publishable key y la secret key.
4. Crea `.env.ensayo` en la raíz del repo, con los mismos nombres que `.env`:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<ref-del-ensayo>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
   SUPABASE_SECRET_KEY=sb_secret_...
   ```

   `.env.ensayo` no se commitea: está en `.gitignore`. Lleva una secret key, así que comprueba con
   `git status` que no aparece antes de seguir.

Un proyecto Free se pausa a los 7 días sin actividad. Para un ensayo da igual: se reactiva desde el
panel (botón **Restore**) cuando haga falta.

## 1. Aplicar todas las migraciones al ensayo

Desde Git Bash, en la raíz del repo:

```bash
npx supabase link --project-ref <ref-del-ensayo>
npx supabase db push
```

`link` cambia a qué proyecto apunta la CLI en esta copia del repo. **Mientras esté enlazado al
ensayo, todo `db push` y todo `gen types --linked` van al ensayo.** No regeneres `db.types.ts` en
este paso.

`db push` enseña la lista de migraciones pendientes antes de aplicar: la primera vez serán todas.
Si alguna falla, el error sale aquí y el proyecto real no se ha tocado: es para lo que sirve el
ensayo. Copia el error tal cual.

### Si la migración mueve datos, ensaya también el traslado

El ensayo está vacío, así que un paso que copia filas corre con cero filas y no prueba nada. Para
la migración de ADR-0026, que copia los hashes de `members.pin_hash` a `member_secrets`:

1. Saca el fichero `20261012120000_...sql` de `supabase/migrations/` (muévelo fuera del repo).
2. `npx supabase db push`: aplica todas las demás.
3. Crea una lista con PIN usando las funciones viejas. Lo más corto es lanzar
   `node --env-file=.env.ensayo scripts/rls-isolation-test.mjs` sin `SUPABASE_SECRET_KEY` en
   `.env.ensayo`: sin esa clave el script no limpia y deja sus listas de prueba en la base. Fallarán
   las comprobaciones nuevas, es lo esperado.
4. Devuelve el fichero a su sitio y `npx supabase db push` otra vez.
5. En el editor SQL del ensayo: `select exposed, count(*) from member_secrets group by 1;` tiene que
   dar filas con `exposed = true`, tantas como miembros tenían PIN.

## 2. Pasar los tests contra el ensayo

```bash
node --env-file=.env.ensayo scripts/rls-isolation-test.mjs
node --env-file=.env.ensayo scripts/realtime-check.mjs
```

Tienen que dar el mismo recuento que dice `CLAUDE.md` en la sección «Comandos». El catálogo estará
vacío en el ensayo; si alguna comprobación de búsqueda del catálogo falla solo por eso, se ingiere
con `node --env-file=.env.ensayo --experimental-strip-types scripts/catalog-ingest.mjs` y se repite.

## 3. Volver al proyecto real

```bash
npx supabase link --project-ref mnjhkqpeeivitpfejoxq
npx supabase migration list --linked
```

La lista tiene que enseñar como pendiente solo la migración nueva. Si enseña más, para y míralo
antes de aplicar nada.

## 4. Aplicar al real

Solo con los pasos 1 y 2 en verde y las consultas de comprobación del ADR lanzadas en el editor SQL
del proyecto real:

```bash
npx supabase db push
npm run test:rls
npm run test:realtime
npx supabase gen types typescript --linked > src/shared/lib/db.types.ts
npm run typecheck && npm run lint && npm test
```

`gen types` desde Git Bash, no desde PowerShell 5.1 (escribe UTF-16 y rompe ESLint; ver la skill
`supabase-data`). El resultado de los tests se anota en el diario de la fase.

## Si el ensayo y el real dan resultados distintos

La diferencia casi siempre son los datos: el ensayo está vacío. Una restricción nueva (`check`,
`unique`) puede pasar en vacío y fallar contra filas reales. Por eso las consultas de comprobación
del ADR se lanzan contra el real, no contra el ensayo.
