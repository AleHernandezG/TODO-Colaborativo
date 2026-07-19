# Guía: dejar Supabase listo desde cero

Para cuando haya que reproducir el backend en un proyecto nuevo (otro entorno, otra persona,
o recuperarse de un desastre). El orden importa.

## 1. Variables de entorno

Copia `.env.example` a `.env` y rellena:

- `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` — panel, Settings → API. Usa la
  **publishable key** (`sb_publishable_...`).
- `SUPABASE_SECRET_KEY` — opcional, solo para que el test de RLS limpie sus datos. Se salta
  RLS: nunca en la app.

Si añades reglas al `.gitignore` desde PowerShell usa `Add-Content -Encoding utf8`. Un `echo >>`
lo escribe en UTF-16 y git deja de interpretar el fichero entero, con lo que `.env` deja de
estar ignorado sin que nada avise.

## 2. Activar las sesiones anónimas

**Authentication → Sign In / Providers**, bloque **User Signups** (arriba del todo, antes de la
lista de proveedores) → **Allow anonymous sign-ins**.

Viene desactivado de fábrica. Sin esto no hay `auth.uid()` y no funciona ni RLS ni el flujo de
entrada. El porqué está en [ADR-0002](../adr/ADR-0002-modelo-de-sesion-y-rls.md).

Comprobación, que la interfaz a veces no guarda a la primera:

```bash
curl -s -X POST "$SUPABASE_URL/auth/v1/signup" \
  -H "apikey: TU_PUBLISHABLE_KEY" -H "Content-Type: application/json" \
  -d "{\"data\":{},\"gotrue_meta_security\":{}}"
```

Debe devolver un JSON con `access_token`. Si devuelve `anonymous_provider_disabled`, no se
guardó.

## 3. Aplicar las migraciones

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Estos tres piden datos por teclado, así que **necesitan una terminal de verdad**. No funcionan
desde un shell no interactivo: `login` falla con `LegacyLoginMissingTokenError` y los otros dos
se quedan esperando la contraseña.

La contraseña que pide `link` es la **de la base de datos** (Settings → Database), no la de tu
cuenta de Supabase. Se puede resetear ahí mismo sin afectar a las claves de la API.

En Windows sin Docker, `db push` termina con un warning de `docker_engine`. Es el cacheo local
del catálogo de migraciones y no afecta al push remoto: la línea que vale es
`Finished supabase db push`. Docker solo hace falta para levantar Supabase en local.

## 4. Verificar el aislamiento

```bash
node --env-file=.env scripts/rls-isolation-test.mjs
```

Tiene que terminar en `11/11 comprobaciones correctas`. Si falla algo, **no sigas**: es un fallo
de aislamiento entre comunidades, no un bug normal.

## 5. Generar los tipos

```bash
npx supabase gen types typescript --linked > src/shared/lib/db.types.ts
```

`--linked` va contra el proyecto remoto ya enlazado. `--local` es lo que sale por defecto en la
documentación de Supabase y apunta a la instancia de Docker: sin Docker falla con un error que
no explica nada.

Ojo en PowerShell: el `>` escribe el fichero en UTF-8 **con BOM**, y ESLint lo marca. Quítalo
después de generar:

```bash
node -e "const f='src/shared/lib/db.types.ts',fs=require('fs');let s=fs.readFileSync(f,'utf8');if(s.charCodeAt(0)===0xFEFF)fs.writeFileSync(f,s.slice(1))"
```

Es el mismo problema de codificación que rompió el `.gitignore` en su día. PowerShell mete BOM
en casi todo lo que redirige.

Regenera los tipos **en el mismo cambio** en que toques el esquema. Un `db.types.ts` desfasado
es peor que no tenerlo, porque TypeScript pasa en verde y el fallo salta en ejecución.
