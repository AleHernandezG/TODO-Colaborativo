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
id sí se commitea (no es secreto): identifica el proyecto, no da acceso a nada.

## 2. Variables de entorno en EAS

El build de EAS **no lee tu `.env` local** (está en `.gitignore` y no viaja). Las variables
`EXPO_PUBLIC_*` se incrustan en el bundle en tiempo de compilación, así que si faltan durante el
build, el APK sale sin URL ni clave de Supabase y no conecta con nada. Hay que subirlas a EAS:

```powershell
npx eas-cli@latest env:create
```

Es interactivo. Créalas para el entorno **preview** (o "todos"), con visibilidad **Plain text**:

- `EXPO_PUBLIC_SUPABASE_URL` → el valor de tu `.env`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` → el valor de tu `.env` (la publishable key)

Plain text es correcto aquí: las dos son públicas por diseño y acaban dentro del APK de todas
formas; la seguridad la da RLS, no esconderlas. Aun así no las metemos en `eas.json` ni en el
repo, por la misma regla de higiene que mantiene `.env.example` sin valores.

Comprueba que quedaron subidas:

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

EAS Update todavía **no está montado**: falta instalar `expo-updates`, fijar un `runtimeVersion`
y hacer un build que lo incluya. Hasta entonces, cualquier cambio = APK nuevo. Los canales ya
están puestos en `eas.json` (`preview`/`production`) para cuando se active. Montarlo es una
tarea aparte con su propio plan; se documentará aquí cuando se haga.

## El backend: Supabase gratis

No hay servidor propio que desplegar. Todo el lado servidor lo pone Supabase (Postgres +
Realtime + RLS + las RPC), así que no existe cold-start por petición como el de una función
serverless. El plan **Free** sobra para la beta: 500 MB de base de datos y ~5 GB de tráfico al
mes, muy por encima de lo que gasta una lista de la compra.

Lo único que "se duerme": **un proyecto Free se pausa tras 7 días sin actividad** y se
reactiva a mano desde el panel (botón *Restore*, un par de minutos). Con uso normal —una lista
compartida se abre varias veces por semana— nunca llega a pausarse y no hay que hacer nada.

Si algún día ves que se pausó por estar la beta parada, el seguro barato es un **ping externo
diario** a la API REST que reinicie el contador de inactividad: un cron gratis de `cron-job.org`
o un GitHub Action programado pegándole a un endpoint una vez al día. Que sea externo; un
`pg_cron` interno puede no contar como actividad para la pausa. No hace falta pagar el plan Pro
solo por esto.

> Números a reconfirmar contra la documentación oficial de cada servicio, que cambian: la
> ventana de pausa de Supabase Free (7 días) y el límite de builds/mes del plan Free de EAS.
