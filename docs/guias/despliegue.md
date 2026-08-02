# Guía: sacar la app del PC y dejarla instalada

Para pasar de "escaneo el QR con Expo Go" a "la app vive en el móvil y funciona sola". El
resultado es un APK de Android instalable que arranca sin Metro y habla directo con Supabase.
Sirve tanto para tu dispositivo como para repartir la beta a los demás con su código de invitación.

El bucle de desarrollo diario sigue siendo Expo Go + QR (`npx expo start`). Esto es solo el
formato de entrega. Se apoya en `eas.json`, que ya está en la raíz con tres perfiles:
`development`, `preview` y `production`.

## Qué construye cada perfil

| Perfil | Sale | Para qué |
|---|---|---|
| `development` | APK con dev-client | Depurar módulos nativos que Expo Go no trae. Sigue necesitando Metro. |
| `preview` | APK standalone | **El que quieres.** JS empaquetado dentro, se instala y funciona sin nada más. |
| `production` | `.aab` (App Bundle) | El día que subas al Play Store. No sirve para instalar a mano. |

El de `preview` lleva `distribution: internal`: EAS te devuelve un enlace de descarga que abres
en el móvil y ya. No hace falta Play Store ni cuenta de desarrollador de Google.

## 0. Requisitos

- Una cuenta de Expo (gratis): https://expo.dev/signup
- `eas-cli` vía `npx`, no hace falta instalarlo global.

Como con la CLI de Supabase, el login y el primer build **piden datos por teclado**: usa una
terminal de verdad, no un shell no interactivo.

## 1. Login y enlazar el proyecto

```powershell
npx eas-cli@latest login
npx eas-cli@latest init
```

`init` crea el proyecto en tu cuenta de Expo y escribe `extra.eas.projectId` en `app.json`. Ese
id sí se commitea (no es secreto): identifica el proyecto, no da acceso a nada. En este repo
quedó con `slug: agora` y `owner: alejes0407s-team`; el `slug` es el identificador interno del
proyecto en Expo, no el nombre visible de la app (ese sigue siendo "Lista de la compra" en
`name`). El `projectId` es lo que de verdad ata el repo a su proyecto de EAS.

> No confundas `eas init` con `create-expo-app`. `npx create-expo-app` **crea un proyecto en
> blanco nuevo** en una subcarpeta; no enlaza este. Si lo lanzas por error dentro del repo, borra
> la carpeta que genere (era código de andamiaje que no usamos) y vuelve a `eas init`.

## 2. Variables de entorno en EAS

El build de EAS **no lee tu `.env` local** (está en `.gitignore` y no viaja). Las variables
`EXPO_PUBLIC_*` se incrustan en el bundle en tiempo de compilación, así que si faltan durante el
build, el APK sale sin URL ni clave de Supabase y no conecta con nada. Hay que subirlas a EAS.

`env:create` está **deprecado** y su modo interactivo tiene una trampa: el "Select environment"
es un **multi-select**, hay que marcar con **Espacio** antes de dar a Enter, y si le das a Enter
directamente sale `No environments selected` y no crea nada. Es más fiable pasar todo por flags
con `env:set`, que además vale para crear y para actualizar:

```powershell
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_URL --value "https://TU-PROYECTO.supabase.co" --environment preview --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "sb_publishable_..." --environment preview --visibility plaintext
```

Los valores salen de tu `.env`. El nombre del perfil de `eas.json` mapea al nombre del entorno:
un build `--profile preview` lee el entorno **preview**, así que ahí es donde tienen que estar.

`plaintext` es correcto aquí: las dos son públicas por diseño y acaban dentro del APK de todas
formas; la seguridad la da RLS, no esconderlas. Aun así no las metemos en `eas.json` ni en el
repo, por la misma regla de higiene que mantiene `.env.example` sin valores.

Comprueba que quedaron subidas (y que el build las lee: al arrancar imprime
`Environment variables ... loaded from the 'preview' environment`):

```powershell
npx eas-cli@latest env:list
```

## 3. Construir el APK

```powershell
npx eas-cli@latest build --platform android --profile preview
```

La primera vez pregunta si quieres que EAS genere y guarde el **keystore** de firma. Di que sí:
lo custodia Expo y no tienes que gestionar nada. No lo pierdas ni lo regeneres a la ligera; un
APK firmado con otro keystore Android lo trata como una app distinta y no deja actualizar encima.

El build corre en la nube de Expo (no necesitas Android Studio). En el plan gratis va por una
cola compartida, así que puede tardar o esperar turno en horas punta. Al terminar te da una URL
con el APK y un QR de **instalación** (ese QR es de un solo uso para descargar, no el de Metro).

## 4. Instalarlo en el Android

1. Abre la URL del build en el móvil (o escanea el QR de instalación).
2. Descarga el `.apk`.
3. Android pedirá permiso para **instalar apps de origen desconocido**: es normal al instalar
   fuera del Play Store, concédelo para el navegador/gestor de archivos que uses.
4. Instala. El icono queda en la pantalla de inicio como cualquier app y arranca solo.

Para repartir la beta: pásales a los demás esa misma URL. Instalan, abren, y entran con el
`join_code`. No necesitan cuenta de Expo ni nada.

## 5. Actualizar la app

Dos caminos según qué toques:

- **Cambios nativos** (una dependencia nueva con código nativo, permisos, el icono, el SDK):
  hay que hacer **build nuevo** (paso 3) y reinstalar el APK.
- **Cambios solo de JS/TS** (casi todo lo que tocamos): se pueden enviar por aire con **EAS
  Update**, sin reinstalar. El móvil se los descarga al reabrir la app.

EAS Update **ya está montado**. `expo-updates` quedó instalado y `app.json` tiene el
`runtimeVersion` con `policy: appVersion` y la `updates.url` apuntando al proyecto. Los canales
(`preview`/`production`) ya estaban en `eas.json`. Para publicar un cambio de JS al APK de la
beta sin reconstruir:

```powershell
npx eas-cli@latest update --branch preview --message "Descripción del cambio"
```

El `runtimeVersion` va atado a la `version` de `app.json` (`appVersion`): mientras no cambien
partes nativas y la `version` sea la misma, el update es compatible con el APK instalado. Si
tocas algo nativo (dependencia con código nativo, permisos, icono, SDK) sube la `version` y haz
**build nuevo** (paso 3); un update de JS no puede arreglar un cambio nativo.

### `eas update` empaqueta para todas las plataformas, incluida web

La primera vez que se lanzó, el comando murió antes de subir nada:

```
CommandError: It looks like you're trying to use web support but don't have the
required dependencies installed. Install react-native-web@^0.21.0
✖ Export failed
```

`eas update` llama por dentro a `expo export --platform=all`, y "all" son las plataformas del
config. `app.json` no traía array `platforms`, así que valía el de por defecto de Expo:
`["ios", "android", "web"]`. Web nunca ha sido objetivo de este proyecto y `react-native-web`
no está instalado, así que el export se caía ahí. Lo confuso es que `npx expo export --platform
android`, que es la comprobación de build habitual, pasa sin enterarse: nunca toca web.

Se arregla declarando los objetivos de verdad, no instalando una dependencia para satisfacer
un target que no existe:

```json
"platforms": ["android", "ios"]
```

**No obliga a build nuevo.** `platforms` solo decide qué bundles se generan al exportar; no es
configuración nativa y el `runtimeVersion` no se mueve, así que el APK instalado sigue siendo
compatible con el update.

Si algún día se quiere web, la respuesta es `npx expo install react-native-web react-dom` y
añadirlo al array, no quitarlo de ahí.

## El backend: Supabase gratis

No hay servidor propio que desplegar. Todo el lado servidor lo pone Supabase (Postgres +
Realtime + RLS + las RPC), así que no existe cold-start por petición como el de una función
serverless. El plan **Free** sobra para la beta: 500 MB de base de datos y ~5 GB de tráfico al
mes, muy por encima de lo que gasta una lista de la compra.

Lo único que "se duerme": **un proyecto Free se pausa tras 7 días sin actividad** y se
reactiva a mano desde el panel (botón *Restore*, un par de minutos). Al pausarse, el subdominio
del proyecto **deja de resolver en DNS**, así que la app no lo encuentra y falla al arrancar con
`Network request failed` / "no se pudo crear la sesión anónima". No es un fallo de la app: es el
backend dormido. Pasó la primera vez que se probó el APK, con la beta unos días parada.

### El ping diario que lo evita

Para que no vuelva a pausarse hay un **GitHub Action programado** en
`.github/workflows/keep-supabase-awake.yml`: una vez al día le hace una petición REST al
proyecto, lo que reinicia el contador de inactividad. Se eligió un Action (y no `cron-job.org`)
porque el repo ya vive en GitHub, no depende de otro servicio y no cuesta nada. Que el ping sea
**externo** importa: un `pg_cron` dentro de la propia base puede no contar como actividad para la
pausa.

La petición llama a una RPC mínima, `public.ping()` (`select 'pong'`), con la publishable key.
No vale leer una tabla: el ping va como rol `anon` (sin sesión), y todas las políticas RLS pasan
por `member_community_ids()`, que `anon` no puede ejecutar; una lectura anónima da
`permission denied` (HTTP 401), no 200. `ping()` es la única función que se concede a `anon` a
propósito (la migración `20260802120000_keep_alive_ping.sql`), y ejecutarla es una consulta real
a Postgres, que es lo que cuenta como actividad. El `/auth/v1/health` daría 200 pero no toca la
base, así que no serviría para evitar la pausa.

Esa migración tiene que estar aplicada en el proyecto (`npx supabase db push`) antes de que el
ping funcione; si no, la RPC no existe y el Action da 404.

Para que funcione hay que darle las dos variables como **secrets del repo** (Settings → Secrets
and variables → Actions → New repository secret). Van como secrets y no en el YAML por higiene,
aunque la anon key sea pública:

- `SUPABASE_URL` → `https://TU-PROYECTO.supabase.co`
- `SUPABASE_ANON_KEY` → la publishable key (`sb_publishable_...`)

Puedes lanzarlo a mano para probarlo sin esperar al cron: en la pestaña **Actions** del repo,
"Keep Supabase awake" → **Run workflow**. Debe salir `Supabase responded HTTP 200`.

Dos avisos del plan gratis de Actions: los workflows programados **se desactivan solos tras 60
días sin commits** en el repo (con desarrollo normal no llega a pasar; si la beta se congela,
un push cualquiera los reactiva), y la hora del cron puede retrasarse en horas punta, lo que a un
ping diario le da igual. No hace falta pagar el plan Pro de Supabase solo por esto.

> Números a reconfirmar contra la documentación oficial de cada servicio, que cambian: la
> ventana de pausa de Supabase Free (7 días) y el límite de builds/mes del plan Free de EAS.
