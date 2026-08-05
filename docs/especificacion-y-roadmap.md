# 🛒 Lista de la Compra Colaborativa — Documento Maestro de Producto y Desarrollo

> Documento único de referencia para diseñar, construir y auditar una app móvil de **listas de la compra compartidas por comunidad**, con sincronización global en tiempo real y una experiencia pensada para usuarios noveles.
>
> **Estado:** Especificación v1.0 (para arranque de desarrollo con Claude Code)
> **Fecha:** Julio 2026
> **Ámbito:** MVP funcional (beta) → base sólida para escalar

---

## 📑 Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Glosario y decisiones clave](#2-glosario-y-decisiones-clave)
3. [Requisitos funcionales (qué + cómo)](#3-requisitos-funcionales-qué--cómo)
4. [Requisitos no funcionales](#4-requisitos-no-funcionales)
5. [Arquitectura desacoplada](#5-arquitectura-desacoplada)
6. [Stack tecnológico actual (2026) con referencias](#6-stack-tecnológico-actual-2026-con-referencias)
7. [Modelo de datos y esquema](#7-modelo-de-datos-y-esquema)
8. [Sincronización global en tiempo real](#8-sincronización-global-en-tiempo-real)
9. [Autenticación beta y seguridad](#9-autenticación-beta-y-seguridad)
10. [Diseño UI/UX, affordance y accesibilidad](#10-diseño-uiux-affordance-y-accesibilidad)
11. [Auditoría global por apartado](#11-auditoría-global-por-apartado)
12. [Roadmap por fases](#12-roadmap-por-fases)
13. [Claude Code: skills, configuración y workflow](#13-claude-code-skills-configuración-y-workflow)
14. [Prompt maestro para Claude Code](#14-prompt-maestro-para-claude-code)
15. [Documentación de implementaciones](#15-documentación-de-implementaciones)
16. [Checklist final de entrega](#16-checklist-final-de-entrega)
17. [Referencias](#17-referencias)

---

## 1. Resumen ejecutivo

### 1.1 Visión

Una app móvil donde varias personas (una familia, un piso compartido, un equipo, un grupo de amigos) mantienen **una lista de la compra común** que se actualiza para todos **en tiempo real**, aunque estén en **redes y países distintos**. El acceso a cada comunidad es tan simple como introducir un **código de invitación** y elegir un **nombre de usuario**.

### 1.2 Propuesta de valor

| Problema                                                       | Solución de la app                             |
| -------------------------------------------------------------- | ---------------------------------------------- |
| Las listas de la compra se dispersan en chats, notas y papeles | Una única lista viva por comunidad             |
| Duplicados: dos personas compran lo mismo                      | Estado compartido y sincronizado al instante   |
| Compartir listas exige cuentas, correos, apps pesadas          | Entrar con un código + un nombre, sin fricción |
| Apps existentes con UX confusa para gente no técnica           | Diseño con máxima _affordance_ y accesibilidad |

### 1.3 Alcance del MVP (beta)

**Incluye:** crear/unirse a comunidad por código, CRUD completo de artículos (nombre, cantidad, imagen opcional), sincronización en tiempo real, sesión ligera (código + usuario), UI accesible.

**Excluye (fases posteriores):** autenticación fuerte, roles/permisos avanzados, historial/analytics, notificaciones push, modo offline avanzado con resolución de conflictos, exportación a PDF (RF-8), reparto de gastos (RF-9), monetización.

---

## 2. Glosario y decisiones clave

| Término                           | Definición en esta app                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| **Comunidad (Community)**         | Grupo de usuarios que comparten UNA lista. Identificada por un `join_code`.                 |
| **Miembro (Member)**              | Usuario dentro de una comunidad, identificado por `username` único dentro de esa comunidad. |
| **Artículo (Item)**               | Elemento de la lista: `name`, `quantity`, `image_url?`, estado (pendiente/comprado).        |
| **Código de unión (`join_code`)** | Cadena corta legible (p. ej. `PAN-42XK`) para entrar/registrarse en la comunidad.           |
| **Sesión ligera**                 | Par `join_code` + `username` persistido localmente. Sustituye al login clásico en beta.     |

**Decisiones tomadas (y su justificación, ampliadas más abajo):**

- **Multiplataforma con Expo (React Native)** → un solo código para iOS + Android + web.
- **Backend gestionado (BaaS)** → evitamos montar servidor propio; sincronización y persistencia listas de fábrica.
- **Recomendación primaria: Supabase**; **alternativa: Firebase** (ver §6.4 para el criterio de decisión).
- **Estado desacoplado:** _server state_ (TanStack Query) separado de _client state_ (Zustand).
- **Arquitectura por features + capas** (dominio / datos / presentación) para permitir cambios futuros sin reescribir.

---

## 3. Requisitos funcionales (qué + cómo)

Cada requisito se descompone en **Qué pide** → **Cómo se lleva a cabo** → **Criterio de aceptación**.

### RF-1 · Lista conjunta estilo TODO enfocada a la compra

- **Qué:** una lista compartida por comunidad, tipo checklist.
- **Cómo:** tabla `items` ligada a `community_id`. Cada artículo tiene estado `is_purchased`. La pantalla principal renderiza la lista con un check para marcar como comprado y filtros (pendientes / comprados).
- **Aceptación:** al marcar un artículo, cambia de sección y se refleja en todos los dispositivos de la comunidad en < 2 s.

### RF-2 · Crear comunidades/grupos que comparten la lista

- **Qué:** poder crear un grupo nuevo y obtener un código para invitar.
- **Cómo:** operación `createCommunity(name)` que inserta en `communities`, genera un `join_code` único (formato legible, sin caracteres ambiguos como `O/0`, `I/1`) y crea al creador como primer miembro.
- **Aceptación:** tras crear, se muestra el código con botones «Copiar» y «Compartir» (share sheet nativo).

### RF-3 · CRUD de artículos (altas, bajas, modificaciones) por cualquier usuario

- **Qué:** cualquier miembro puede Crear, Leer, Actualizar y Borrar artículos.
- **Cómo:** capa _repository_ con `createItem`, `getItems`, `updateItem`, `deleteItem`. Mutaciones con **actualización optimista** (la UI cambia al instante y confirma/revierte según el servidor).
- **Aceptación:** las 4 operaciones funcionan, se sincronizan y son reversibles ante error de red (rollback + aviso no intrusivo).

### RF-4 · Campos del artículo: nombre, cantidad, imagen de referencia (opcional)

- **Qué:** cada artículo con nombre (obligatorio), cantidad (obligatorio, por defecto 1) e imagen (opcional).
- **Cómo:**
  - `name`: texto validado (no vacío, límite de longitud).
  - `quantity`: entero ≥ 1 con selector +/− y entrada manual.
  - `image_url`: se sube a **Storage** del BaaS desde cámara o galería (`expo-image-picker`), se comprime antes de subir (`expo-image-manipulator`) y se guarda la URL pública/firmada.
- **Aceptación:** se puede crear un artículo solo con nombre; añadir imagen es un paso opcional que nunca bloquea el guardado.

### RF-5 · Acceso por código + registro con nombre de usuario (landing de la app)

- **Qué:** la pantalla inicial permite **unirse** con un código y registrarse con un `username`. En futuros accesos basta código + nombre.
- **Cómo:**
  - **Landing** con dos caminos: «Unirme a una lista» (introduce código) y «Crear una lista nueva».
  - Al introducir un código válido → pantalla de registro de `username` (único dentro de esa comunidad).
  - Se persiste localmente la **sesión ligera** (`join_code` + `username`) con almacenamiento cifrado (`expo-secure-store`) para reentrar automáticamente.
  - Reentrada: si el usuario cierra la app, vuelve directo a su lista; si cambia de dispositivo, introduce código + nombre y recupera su identidad de miembro.
- **Aceptación:** un usuario nuevo entra a una lista existente en < 30 s sin crear cuenta ni email.

> ⚠️ **Nota de seguridad (beta):** este esquema es deliberadamente simple. Cualquiera con el código puede entrar y suplantar un `username` no protegido. Es aceptable para beta cerrada; ver §9 para el plan de refuerzo.

### RF-6 · UI bonita, accesible, con patrones desacoplados

- **Qué:** interfaz estética, mantenible y usable por personas noveles.
- **Cómo:** sistema de diseño con _design tokens_, componentes reutilizables desacoplados de la lógica, jerarquía visual clara, _affordance_ explícita (botones que parecen botones), y cumplimiento de accesibilidad (ver §10).
- **Aceptación:** un usuario que nunca ha visto la app completa las 3 tareas núcleo (unirse, añadir artículo, marcar comprado) sin ayuda.

### RF-7 · Coordinación y sincronización global (usuarios en redes/países distintos)

- **Qué:** cambios visibles para todos aunque no compartan red y estén lejos.
- **Cómo:** el BaaS actúa como fuente de verdad en la nube; cada cliente **se suscribe a cambios en tiempo real** de su comunidad (websockets/streams del BaaS). Un cambio en Madrid llega a Buenos Aires porque ambos hablan con el mismo backend, no entre sí. Se añade **presencia** (quién está viendo la lista) como coordinación ligera.
- **Aceptación:** dos dispositivos en redes distintas ven el mismo cambio en < 2 s; sin conexión, los cambios se encolan y se sincronizan al reconectar.

---

> **RF-8, RF-9 y RF-10 están fuera del MVP.** Los dos primeros salieron después de escribir esta
> especificación, de `docs/funcionalidades.txt`; RF-10 lo pidió el usuario el 2026-08-05, ya con la
> beta cerrada. Se registran aquí para que no vivan solo en un `.txt` suelto ni en el chat, pero el
> alcance de la beta sigue siendo RF-1…RF-7.

### RF-8 · Exportar la lista a PDF (post-MVP)

- **Qué:** un botón que genera un PDF con la lista y lo deja guardar o compartir. Sirve para
  llevar la compra en papel o para mandársela a alguien que no tiene la app.
- **Cómo:** `expo-print` renderiza un HTML propio a PDF y `expo-sharing` abre el share sheet
  nativo. El PDF se compone **en el cliente** con lo que ya hay en la caché de TanStack Query,
  así que no hace falta red si la lista está cargada. No toca el esquema ni añade backend.
- **Aceptación:** desde la lista, un toque produce un PDF legible con nombre, cantidad y estado
  de cada artículo, agrupado igual que la pantalla (por comprar / comprados). Se puede guardar
  en el móvil o mandar por cualquier app. Con la lista ya cacheada, funciona sin conexión.

### RF-9 · Reparto de gastos entre miembros, estilo Tricount (post-MVP)

- **Qué:** al marcar un artículo como comprado, poder anotar **opcionalmente** cuánto costó,
  quién lo pagó y entre quiénes se reparte. Una pantalla aparte muestra el balance de cada
  miembro y la liquidación mínima («Ana debe 7,30 € a Luis»).
- **Cómo:** el gasto es una entidad propia ligada al artículo, con una tabla puente para los
  participantes del reparto. Los balances **se calculan, no se guardan**: funciones puras en
  `domain/`, testeables sin red. Importes en enteros (céntimos), nunca en coma flotante.
- **Aceptación:** dos miembros ven exactamente el mismo balance; editar un precio recalcula en
  ambos; ningún miembro puede modificar el gasto que registró otro (comprobado con RLS, como
  el aislamiento entre comunidades).
- **Depende de:** identidad fiable. Hoy el modelo de sesión es débil a propósito (§9.2) y
  `items.created_by` va a `null` por deuda de la Fase 1. Repartir dinero sobre nombres
  suplantables no es aceptable, así que esto llega **después** del refuerzo de auth. Decidido y
  razonado en [ADR-0005](adr/ADR-0005-reparto-de-gastos.md).

### RF-10 · Catálogo de productos de supermercado (post-MVP)

- **Qué:** al añadir o editar un artículo, poder buscarlo por nombre dentro de un supermercado y
  quedarse con su foto sin tener que hacerla. De paso, el catálogo trae el **precio de
  referencia**, que en RF-9 llega prerrellenado y **lo confirma el usuario**, nunca la app.
- **Cómo:** una tabla propia (`catalog_products`) que alimenta un script de `scripts/` fuera de la
  app; el móvil solo lee esa tabla y nunca habla con el supermercado. Las imágenes se referencian
  por URL, no se copian. La búsqueda es una RPC con `pg_trgm` que devuelve candidatos y una función
  pura de `domain/` que los ordena. Precio en enteros de céntimos con moneda y fecha de
  comprobación explícitas.
- **Aceptación:** escribir tres letras y elegir supermercado devuelve resultados con foto en menos
  de un segundo; elegir uno rellena la imagen del artículo sin abrir la cámara; **con el catálogo
  vacío o sin red la app se comporta exactamente como hoy**, porque este camino es un atajo y la
  foto propia sigue siendo el principal. El precio nunca se convierte en gasto sin que una persona
  lo confirme, y siempre se enseña con su antigüedad.
- **Depende de:** nada del refuerzo de auth. Es independiente de RF-9 y puede entrar antes. Lo que
  sí tiene abierto es de dónde salen los datos, que es una decisión con implicaciones legales.
  Diseño, esquema y alternativas en
  [ADR-0012](adr/ADR-0012-catalogo-de-productos-de-supermercado.md).

---

## 4. Requisitos no funcionales

| Categoría                | Requisito                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| **Rendimiento**          | Arranque en frío < 3 s; render de lista de 200 artículos fluido (listas virtualizadas).     |
| **Sincronización**       | Latencia de propagación P95 < 2 s con conexión normal.                                      |
| **Offline**              | La app abre y muestra la última lista cacheada sin red; cambios se encolan.                 |
| **Accesibilidad**        | WCAG 2.2 AA: contraste, targets táctiles ≥ 44×44 pt, compatibilidad con lector de pantalla. |
| **Internacionalización** | Textos externalizados (i18n) desde el inicio; ES por defecto, preparado para EN.            |
| **Mantenibilidad**       | Capas desacopladas, cobertura de tests en dominio y repositorios ≥ 70%.                     |
| **Seguridad (beta)**     | Reglas de acceso a nivel de fila por comunidad; secretos fuera del repo.                    |
| **Observabilidad**       | Registro de errores (Sentry o similar) y logs de sincronización.                            |

---

## 5. Arquitectura desacoplada

### 5.1 Principio rector

Separar **qué hace la app** (dominio) de **cómo obtiene los datos** (infraestructura) y de **cómo se muestra** (presentación). Así, si mañana cambias de Supabase a Firebase, o de una pantalla a otra, tocas una sola capa.

### 5.2 Estilo: _Feature-first_ + _Clean Architecture_ ligera

```
src/
├── app/                      # Rutas (Expo Router, file-based navigation)
│   ├── index.tsx             # Landing: unirse / crear
│   ├── join/[code].tsx       # Registro de username
│   └── list/index.tsx        # Lista compartida
│
├── features/                 # Una carpeta por feature, autocontenida
│   ├── community/
│   │   ├── domain/           # Entidades + casos de uso (SIN dependencias externas)
│   │   │   ├── community.entity.ts
│   │   │   └── use-cases/     # createCommunity, joinCommunity...
│   │   ├── data/             # Implementación repositorio (Supabase/Firebase)
│   │   │   ├── community.repository.ts       # interfaz (puerto)
│   │   │   └── community.supabase.repo.ts     # adaptador
│   │   └── presentation/     # Componentes + hooks de UI
│   │       ├── screens/
│   │       ├── components/
│   │       └── hooks/        # useCreateCommunity (usa TanStack Query)
│   ├── items/                # (misma estructura: domain/data/presentation)
│   └── session/
│
├── shared/                   # Transversal
│   ├── ui/                   # Design system: Button, Input, Card, tokens
│   ├── lib/                  # cliente del BaaS, i18n, config
│   ├── hooks/
│   └── utils/
│
└── theme/                    # Tokens de diseño (color, spacing, tipografía)
```

### 5.3 Patrones aplicados

- **Repository + Puerto/Adaptador (Ports & Adapters / Hexagonal):** el dominio define una **interfaz** de repositorio; la capa de datos la implementa para Supabase. Cambiar de proveedor = crear otro adaptador.
- **Casos de uso (Use Cases):** cada acción de negocio es una función pura testeable (`joinCommunity(code, username)`), sin saber de React ni de red.
- **Inversión de dependencias:** la UI depende de abstracciones (hooks/casos de uso), no de Supabase directamente.
- **Separación server/client state:** _server state_ con **TanStack Query** (caché, refetch, mutaciones, optimistic updates); _client state_ (tema, sesión local, UI) con **Zustand**. **Regla de oro: nunca duplicar el estado del servidor dentro de Zustand.**
- **Componentes presentacionales vs. contenedores:** los componentes de `shared/ui` no conocen la lógica; reciben props. Los _hooks_ de feature orquestan datos.

### 5.4 Diagrama de flujo (alto nivel)

```
[ UI / Pantalla ]
      │  (llama a hook)
      ▼
[ Hook de feature ]  ──TanStack Query──►  caché local + optimistic UI
      │  (invoca caso de uso)
      ▼
[ Caso de uso (dominio) ]
      │  (usa interfaz Repository)
      ▼
[ Repository (adaptador Supabase) ] ──► [ Supabase: Postgres + Realtime + Storage ]
                                              ▲
                        Suscripción Realtime  │  (empuja cambios a TODOS los clientes)
```

---

## 6. Stack tecnológico actual (2026) con referencias

> Verificado con fuentes de 2026 (ver §17). Fija las versiones en el momento de arrancar con `npx create-expo-app@latest`, que traerá el SDK estable vigente.

### 6.1 Frontend / Móvil

| Capa                  | Elección                                                          | Por qué                                                                                                            | Versión de referencia (2026)                                             |
| --------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Framework             | **Expo (React Native)**                                           | Un código para iOS/Android/web; tooling, build y OTA incluidos; framework recomendado oficialmente para producción | **Expo SDK 57** (RN 0.86, React 19.2). SDK 56 si prefieres madurez extra |
| Navegación            | **Expo Router**                                                   | Rutas basadas en ficheros, deep links (útil para el código de invitación)                                          | Incluido en el SDK                                                       |
| Lenguaje              | **TypeScript**                                                    | Tipado end-to-end; con Supabase puedes generar tipos del esquema                                                   | 5.x                                                                      |
| Estado servidor       | **TanStack Query**                                                | Caché, refetch, mutaciones y _optimistic updates_ con poco boilerplate; soporte offline                            | 5.x                                                                      |
| Estado cliente        | **Zustand**                                                       | 1.2 KB, sin boilerplate, ideal para sesión/tema/UI                                                                 | 5.x                                                                      |
| Persistencia local    | **react-native-mmkv**                                             | Almacenamiento clave-valor ~30× más rápido que AsyncStorage                                                        | Actual                                                                   |
| Red / conectividad    | **@react-native-community/netinfo**                               | Detectar online/offline para encolar y refrescar                                                                   | Actual                                                                   |
| Animaciones           | **Reanimated**                                                    | Transiciones fluidas, micro-interacciones                                                                          | 4.x                                                                      |
| Imágenes              | **expo-image**, **expo-image-picker**, **expo-image-manipulator** | Render eficiente + captura/selección + compresión antes de subir                                                   | Incluidas en el SDK                                                      |
| Almacenamiento seguro | **expo-secure-store**                                             | Guardar la sesión ligera (código + usuario) cifrada                                                                | Incluido en el SDK                                                       |

### 6.2 UI / Sistema de diseño (elige UNA vía)

| Opción                                                   | Cuándo usarla                                          | Notas                                              |
| -------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| **NativeWind** (Tailwind para RN)                        | Quieres velocidad y consistencia con _utility classes_ | Muy productivo; tokens vía config de Tailwind      |
| **Tamagui**                                              | Quieres tematización avanzada y rendimiento optimizado | Curva de entrada mayor, muy potente                |
| **Expo UI** (primitivas nativas SwiftUI/Jetpack Compose) | Quieres look 100% nativo                               | Novedad de SDK 56+; menos componentes “de fábrica” |
| **gluestack-ui / React Native Paper**                    | Quieres componentes accesibles listos                  | Buenos por accesibilidad incluida                  |

> **Recomendación para novatos + estética + accesibilidad:** **NativeWind** para el estilado + una librería accesible (gluestack-ui o Paper) para componentes complejos (modales, snackbars). Encapsula todo en `shared/ui` para poder cambiar de librería sin tocar features.

### 6.3 Backend / Sincronización (BaaS)

**Recomendación primaria: Supabase.** El modelo de datos aquí es claramente **relacional** (comunidades → miembros, comunidades → artículos), y Supabase aporta:

- **Postgres + Row Level Security (RLS):** el control de acceso por comunidad se aplica en la propia base de datos.
- **Supabase Realtime (v2):** empuja `INSERT/UPDATE/DELETE` a los clientes suscritos vía replicación lógica de Postgres → sincronización global.
- **Storage:** para las imágenes de referencia.
- **Tipos TypeScript autogenerados** del esquema (`supabase gen types typescript`).
- **Precios predecibles**, _free tier_ generoso y **open source** (sin _lock-in_).

**Alternativa: Firebase (Firestore).** Elígela si el **offline-first** es tu prioridad número uno (Firestore tiene persistencia offline y resolución de conflictos más maduras) o si quieres **Firebase Cloud Messaging** para push integrado desde el día 1.

#### 6.4 Criterio de decisión Supabase vs Firebase

| Prioriza...                                                            | Elige        |
| ---------------------------------------------------------------------- | ------------ |
| Datos relacionales, SQL, RLS, tipos, sin _lock-in_, coste predecible   | **Supabase** |
| Offline-first agresivo (uso intensivo sin red) y push nativo integrado | **Firebase** |
| Empezar en 5 minutos con modelo documental JSON                        | Firebase     |
| Portabilidad / self-hosting futuro                                     | Supabase     |

> Para una lista de la compra, la conectividad suele existir (en casa o en la tienda con datos móviles), así que **Supabase + caché offline (TanStack Query persistido + MMKV)** cubre el caso sin complejidad extra. Si detectas que el offline avanzado es crítico, considera **PowerSync** o **Legend-State** sobre Supabase para sincronización local-first.

### 6.5 Servicios de apoyo

| Necesidad                            | Herramienta                                                      |
| ------------------------------------ | ---------------------------------------------------------------- |
| Notificaciones push (fase posterior) | **Expo Notifications** (+ FCM/APNs) o **OneSignal**              |
| Errores/observabilidad               | **Sentry**                                                       |
| CI/CD y builds                       | **EAS Build / EAS Update** (OTA)                                 |
| Tests                                | **Jest** + **React Native Testing Library**; E2E con **Maestro** |
| Linter/formato                       | **ESLint** + **Prettier** + **TypeScript strict**                |

---

## 7. Modelo de datos y esquema

### 7.1 Entidades

```
Community 1 ─── N Member
Community 1 ─── N Item
```

### 7.2 Esquema Postgres (Supabase) — orientativo

```sql
-- Comunidades
create table communities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  join_code   text not null unique,          -- ej. 'PAN-42XK'
  created_at  timestamptz not null default now()
);

-- Miembros (username único DENTRO de cada comunidad)
create table members (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references communities(id) on delete cascade,
  username      text not null,
  created_at    timestamptz not null default now(),
  unique (community_id, username)
);

-- Artículos de la lista
create table items (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references communities(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 120),
  quantity      int  not null default 1 check (quantity >= 1),
  image_url     text,                          -- opcional
  is_purchased  boolean not null default false,
  created_by    uuid references members(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Índices para rendimiento de la lista
create index on items (community_id, is_purchased);
create index on members (community_id);
```

### 7.3 Realtime + RLS (esbozo)

```sql
alter table items enable row level security;
alter table members enable row level security;
alter table communities enable row level security;

-- Habilitar realtime en la tabla de artículos
alter publication supabase_realtime add table items;
```

> Las **políticas RLS** concretas dependen del modelo de sesión elegido (§9). En beta, una opción es usar **sesión anónima de Supabase** + una columna/claim que ligue al usuario con su `community_id`, restringiendo lectura/escritura a artículos de su comunidad.

---

## 8. Sincronización global en tiempo real

### 8.1 Cómo funciona

1. Todos los clientes hablan con **el mismo backend en la nube** (no entre sí) → funciona en cualquier red y país.
2. Cada dispositivo, al abrir la lista, **se suscribe al canal Realtime** de su `community_id`.
3. Cuando alguien crea/edita/borra un artículo, Postgres emite el cambio y Realtime lo **empuja** a todos los suscriptores.
4. TanStack Query recibe el evento y **actualiza la caché** → la UI se re-renderiza sola.

### 8.2 Actualización optimista + reconciliación

- Al mutar, la UI cambia **inmediatamente** (optimista).
- Si el servidor confirma → se consolida. Si falla → **rollback** + aviso discreto (snackbar).
- Los eventos Realtime son la **fuente de verdad** que reconcilia divergencias entre dispositivos.

### 8.3 Estrategia offline (beta pragmática)

- Última lista **cacheada** con persistencia (TanStack Query persist + MMKV) → la app abre y muestra datos sin red.
- Mutaciones offline **encoladas** y reenviadas al reconectar (detección con NetInfo).
- Conflictos simples → política **last-write-wins** por `updated_at` (suficiente para una lista de la compra).
- Si más adelante necesitas concurrencia fuerte → migrar a un motor **local-first** (PowerSync/Legend-State/ElectricSQL) o CRDTs.

### 8.4 Coordinación (presencia)

- Canal de **presencia** de Supabase Realtime para mostrar «Ana y Luis están viendo la lista».
- Opcional: indicador «Luis añadió pan hace 1 min» (feed ligero de actividad).

---

## 9. Autenticación beta y seguridad

### 9.1 Flujo beta (código + username)

```
Landing
 ├─ "Crear lista"  → nombre de comunidad → genera join_code → registra creador como miembro
 └─ "Unirme"       → introduce join_code → valida → elige username (único en la comunidad)
                                                         └─ persiste sesión ligera (SecureStore)
Reentrada
 └─ sesión válida en el dispositivo → entra directo a la lista
 └─ dispositivo nuevo → join_code + username → recupera identidad de miembro
```

### 9.2 Riesgos conocidos (asumidos en beta)

- Cualquiera con el `join_code` entra → el código es un secreto compartido débil.
- No hay contraseña por usuario → un `username` puede ser reclamado por otra persona.
- Sin verificación de identidad ni recuperación de cuenta.

### 9.3 Mitigaciones inmediatas (baratas, recomendadas ya)

- `join_code` largo, aleatorio y **con expiración/rotación** opcional.
- **RLS** que impida leer/escribir fuera de la propia comunidad (defensa en profundidad).
- Rate limiting en el endpoint de «unirse» para frenar fuerza bruta de códigos.
- Secretos y llaves **fuera del repositorio** (`.env`, EAS secrets).

### 9.4 Ruta de refuerzo (post-beta)

1. PIN o passphrase por miembro (reclamar/proteger un `username`).
2. Auth real: email/OTP, _magic link_ o proveedores sociales.
3. Roles y permisos (admin de la comunidad, solo-lectura).
4. Auditoría de cambios y expulsión de miembros.

---

## 10. Diseño UI/UX, affordance y accesibilidad

### 10.1 Principios

- **Affordance explícita:** los elementos interactivos se ven interactivos (relieve, color de acción, iconos + texto). Nada de “misterio”.
- **Una acción principal por pantalla:** botón primario grande y evidente (crear/unirse/añadir).
- **Feedback inmediato:** cada acción responde (animación, snackbar, cambio visual).
- **Prevención de errores:** valores por defecto sensatos (cantidad = 1), confirmación solo para borrados.
- **Reversibilidad:** «deshacer» tras borrar un artículo.

### 10.2 Flujos clave (para usuario novato)

1. **Onboarding en 1 pantalla:** dos botones enormes → «Crear lista» / «Unirme con código».
2. **Añadir artículo:** botón flotante `+` → hoja inferior con nombre, cantidad (+/−) y «Añadir foto» opcional → guardar.
3. **Marcar comprado:** un toque en el check; el artículo se atenúa y baja a «Comprados».

### 10.3 Sistema de diseño (design tokens)

| Token            | Ejemplo                                                                         |
| ---------------- | ------------------------------------------------------------------------------- |
| Color            | `primary`, `surface`, `success`, `danger`, `muted` (con variantes claro/oscuro) |
| Tipografía       | Escala 12/14/16/20/28; pesos regular/medium/bold                                |
| Espaciado        | Escala 4/8/12/16/24/32                                                          |
| Radio            | 8/12/16                                                                         |
| Sombra/elevación | niveles 0–3                                                                     |

Centralizados en `theme/tokens.ts` y consumidos por `shared/ui`. Cambiar el look = cambiar tokens, no componentes.

### 10.4 Accesibilidad (WCAG 2.2 AA)

- Contraste de texto ≥ 4.5:1 (≥ 3:1 para texto grande).
- Áreas táctiles ≥ 44×44 pt.
- **Etiquetas de accesibilidad** (`accessibilityLabel`, `accessibilityRole`) en todos los controles → compatibilidad con VoiceOver/TalkBack.
- Estados no dependientes solo del color (icono + texto para «comprado»).
- Respetar tamaño de fuente del sistema (_dynamic type_) y modo oscuro.
- Soporte de navegación por teclado en la versión web.

### 10.5 Modo oscuro e i18n

- Tema claro/oscuro desde el token layer.
- Todos los textos en ficheros de traducción (`i18n`), nunca hardcodeados.

---

## 11. Auditoría global por apartado

> Checklist de calidad para revisar cada área **antes de dar por buena** cada fase. Marca ✅ solo cuando se cumple.

### A. Funcionalidad

- [ ] Los 7 requisitos funcionales del MVP (RF-1…RF-7) tienen criterio de aceptación verificado. RF-8 y RF-9 son post-MVP y se auditan en su fase.
- [ ] CRUD completo probado con datos reales en 2 dispositivos.
- [ ] Casos límite: nombre vacío, cantidad 0, imagen que falla al subir, código inexistente.

### B. Arquitectura

- [ ] El dominio no importa nada de Supabase/React (grep de imports).
- [ ] Existe interfaz `Repository` + adaptador; cambiar de proveedor no toca `features/*/domain`.
- [ ] Server state solo en TanStack Query; client state solo en Zustand; sin duplicación.

### C. Stack

- [ ] Versiones fijadas y compatibles (Expo SDK ↔ RN ↔ librerías).
- [ ] Tipos TypeScript del esquema generados y usados.
- [ ] Sin dependencias abandonadas (última publicación reciente).

### D. Datos y sincronización

- [ ] Realtime propaga cambios entre 2 redes distintas en < 2 s.
- [ ] Offline: la app abre sin red y encola cambios; se sincronizan al volver.
- [ ] Optimistic UI con rollback probado (forzar error de red).
- [ ] Índices creados; lista de 200 ítems fluida.

### E. Seguridad (beta)

- [ ] RLS activo: un usuario NO puede leer artículos de otra comunidad (probado).
- [ ] Secretos fuera del repo; `.env` en `.gitignore`.
- [ ] Rate limit en «unirse»; `join_code` sin caracteres ambiguos.

### F. UI/UX y accesibilidad

- [ ] Test con 1 usuario novato: completa las 3 tareas núcleo sin ayuda.
- [ ] Contraste AA verificado; targets ≥ 44 pt; labels de accesibilidad presentes.
- [ ] Modo oscuro y tamaño de fuente del sistema respetados.
- [ ] «Deshacer» tras borrar funciona.

### G. Calidad de código

- [ ] Lint + typecheck sin errores; formato consistente.
- [ ] Tests de dominio y repositorios ≥ 70%.
- [ ] Cada feature documentada (README corto + ADR si hubo decisión relevante).

### H. Rendimiento

- [ ] Arranque en frío < 3 s en gama media.
- [ ] Listas virtualizadas; sin _jank_ al hacer scroll.
- [ ] Imágenes comprimidas antes de subir.

---

## 12. Roadmap por fases

> Cada fase termina con un **entregable demostrable** y su **auditoría** (§11) pasada.

### Fase 0 · Cimientos (1–2 días)

- Crear proyecto Expo + TypeScript strict + ESLint/Prettier.
- Estructura de carpetas (§5.2), design tokens base, `shared/ui` mínimo (Button, Input, Card).
- Proyecto Supabase, esquema (§7), RLS mínima, tipos generados.
- **Entregable:** app corre, conecta con Supabase, muestra pantalla landing vacía.

### Fase 1 · MVP CRUD local a la nube (3–5 días)

- Crear/unirse a comunidad por código (RF-2, RF-5).
- Sesión ligera con SecureStore.
- CRUD de artículos con nombre + cantidad (RF-3, RF-4 sin imagen aún).
- Lista con pendientes/comprados (RF-1).
- **Entregable:** una persona usa la lista completa contra la nube.

### Fase 2 · Colaboración en tiempo real (2–4 días)

- Suscripción Realtime + reconciliación en TanStack Query (RF-7).
- Optimistic UI + rollback.
- Presencia básica (quién está viendo).
- **Entregable:** dos dispositivos en redes distintas ven cambios en vivo.

### Fase 3 · Imágenes y pulido UX (3–4 días)

- Imagen de referencia: captura/galería, compresión, subida a Storage (RF-4 completo).
- **Editar un artículo ya creado** (nombre y cantidad): es la «M» de RF-3, quedó como deuda en la Fase 1.
- **Copiar y compartir el `join_code`** con el share sheet nativo: lo pide el criterio de aceptación de RF-2 y hoy solo se muestra el código.
- **Exportar la lista a PDF (RF-8).** Entra aquí por ser barato y no tocar el modelo de datos.
- Micro-interacciones, «deshacer», estados vacíos y de error.
- Accesibilidad y modo oscuro (RF-6).
- **Entregable:** experiencia completa y estética; auditoría F superada.

### Fase 4 · Robustez y offline (2–3 días)

- Caché persistente + cola offline (§8.3).
- Manejo de errores global (Sentry), estados de reconexión.
- Tests de dominio/repos + un E2E feliz con Maestro.
- **Entregable:** beta estable, auditoría global (§11) superada.

### Fase 5 · Endurecimiento (post-beta)

- El alcance real se recortó al abrirla, el 2026-08-05, y lo eligió el usuario: id del artículo generado en el cliente, expiración y rotación del `join_code`, i18n EN y la pasada con TalkBack. Diario en `docs/phases/fase-5.md`.
- **Lo que se quedó fuera a propósito:** PIN por miembro, Sentry, push, roles y analítica. Ninguna hace falta para una beta entre gente conocida.
- **Ojo con el PIN:** sigue siendo requisito previo del bloque B de la Fase 6. Sacarlo de la Fase 5 no lo cancela, lo aplaza; hay que recuperarlo antes de tocar dinero.

### Fase 6 · Catálogo de productos y reparto de gastos

Dos bloques con dependencias distintas. El A puede empezar en cuanto cierre la Fase 5; el B no.

**Bloque A · Catálogo de productos (RF-10).** Sin requisito de entrada.

- Decidir la fuente de datos y el supermercado con el que se empieza; con eso el ADR pasa a Aceptado. Lo que hay publicado y qué permite cada cadena, investigado en [`guias/fuentes-de-datos-del-catalogo.md`](guias/fuentes-de-datos-del-catalogo.md).
- Esquema (`supermarkets`, `catalog_products`, `items.catalog_product_id`) y RLS en la misma migración, revisados antes de escribir el `.sql`.
- Script de ingesta en `scripts/`, idempotente por `(supermarket_id, external_id)`.
- Buscador en la pantalla de artículo: RPC con `pg_trgm` + ranking como función pura de `domain/`.
- **Entregable:** se pone imagen a un artículo escribiendo tres letras, y con el catálogo vacío la app se comporta igual que hoy. Ver [ADR-0012](adr/ADR-0012-catalogo-de-productos-de-supermercado.md).

**Bloque B · Reparto de gastos (RF-9).**

- Modelo de datos del gasto y del reparto, con su ADR y sus políticas RLS antes de escribir la primera migración.
- Atribución real de quién añadió y quién compró cada artículo (cerrar la deuda de `items.created_by`).
- Registro opcional de precio y participantes al marcar comprado; pantalla de balances con liquidación mínima.
- Si el bloque A está hecho, el importe llega prerrellenado desde el catálogo **y lo confirma el usuario**, porque el precio de referencia caduca solo.
- **Requisito de entrada:** el PIN por miembro que quedó fuera de la Fase 5. Sin identidad no suplantable, los balances no valen nada. Ver [ADR-0005](adr/ADR-0005-reparto-de-gastos.md).
- **Entregable:** dos miembros ven el mismo balance y nadie puede tocar el gasto de otro.

**Estimación total MVP (Fases 0–4):** ~10–17 días de trabajo efectivo (variable según experiencia y ritmo con Claude Code). Las fases 5 y 6 son posteriores a la beta y no entran en esa cuenta.

---

## 13. Claude Code: skills, configuración y workflow

### 13.1 Prácticas base (probadas en 2026)

- **`CLAUDE.md` en la raíz** que Claude lee cada sesión: stack, estructura, convenciones y reglas duras. Mantenlo **< 200 líneas** y enlaza a docs largas en lugar de pegarlas.
- **Plan mode antes de editar**: deja que Claude planifique y apruebas antes de que toque ficheros.
- **Subagentes para trabajo amplio e independiente** (explorar el repo, revisar), inline para razonamiento profundo.
- **Allowlists de permisos y hooks** para no ejecutar comandos peligrosos.
- **Verifica, no confíes:** ejecuta la app, lee el diff.
- **Higiene de secretos:** nunca pegues llaves; usa `.env`/EAS secrets.
- **Skills como _dotfiles_:** pocas, opinionadas, versionadas; audítalas mensualmente y borra las que no uses en 30 días.

### 13.2 Skills recomendadas

| Skill                                       | Para qué                                                                              | Origen                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------- |
| **React Native / Expo Stack**               | Integración Expo + Expo Router + Zustand + TanStack Query, persistencia MMKV, offline | Comunidad (busca en el directorio de skills) |
| **Frontend Design**                         | Dirección visual y componentes con criterio (evitar look «plantilla»)                 | Skill pública de Anthropic                   |
| **Skill Creator**                           | Crear tus propias skills (p. ej. una skill «convenciones-del-proyecto»)               | Anthropic                                    |
| **Supabase / Postgres** (o crea una propia) | Esquemas, RLS, Realtime, generación de tipos                                          | Comunidad / propia                           |
| **Test/QA runner** (propia)                 | Estandarizar cómo se lanzan lint, typecheck y tests                                   | Propia con Skill Creator                     |

> Regla práctica: **8–12 skills** cubren casi todo. Más de eso paga «impuesto de contexto». Instálalas en `~/.claude/skills/` (globales) o `.claude/skills/` (por proyecto).

### 13.3 Estructura de configuración en el repo

```
proyecto/
├── CLAUDE.md                 # memoria del proyecto (stack, reglas, estructura)
├── .claude/
│   ├── skills/               # skills específicas del proyecto
│   ├── agents/               # subagentes (explorer, reviewer)
│   └── settings.json         # permisos, allowlists, hooks
├── docs/
│   ├── adr/                  # decisiones de arquitectura (ADR-0001...)
│   ├── phases/               # doc por fase (qué se hizo, cómo probar)
│   └── api/                  # contratos de repositorios
├── .env.example
└── src/ ...
```

### 13.4 Plantilla de `CLAUDE.md`

```markdown
# Proyecto: Lista de la Compra Colaborativa

## Stack

- Expo (React Native) + Expo Router + TypeScript (strict)
- Estado: TanStack Query (server) + Zustand (client). NUNCA duplicar server state en Zustand.
- Backend: Supabase (Postgres + Realtime + Storage + RLS)
- UI: NativeWind + shared/ui (componentes desacoplados). Tokens en theme/.

## Estructura

- features/<feature>/{domain,data,presentation}
- domain NO importa React ni Supabase (verifícalo)
- Repositorios como interfaces (puertos) + adaptador Supabase

## Reglas duras

- Accesibilidad: labels + contraste AA + targets >= 44pt en cada control nuevo.
- Optimistic UI con rollback en todas las mutaciones.
- Nunca commitear secretos. Usa .env / EAS secrets.
- Cada feature: test de dominio + README corto. ADR si hay decisión relevante.
- Antes de editar: plan mode. Después: lint + typecheck + correr la app.

## Comandos

- Dev: `npx expo start`
- Lint: `npm run lint` · Types: `npm run typecheck` · Test: `npm test`
- Tipos Supabase: `supabase gen types typescript --local > src/shared/lib/db.types.ts`
```

---

## 14. Prompt maestro para Claude Code

> Pégalo como primer mensaje al arrancar el desarrollo (con el `CLAUDE.md` ya en el repo). Está diseñado para trabajo por fases, con plan mode y documentación continua.

```text
Eres mi ingeniero senior para construir una app móvil de "lista de la compra
colaborativa" con Expo (React Native) + TypeScript + Supabase. Ya existe CLAUDE.md
en la raíz con el stack, la estructura y las reglas duras: respétalo estrictamente.

OBJETIVO GLOBAL
Construir el MVP descrito en docs/especificacion-y-roadmap.md,
por fases (0 a 4). No saltes de fase sin cerrar la anterior.

METODOLOGÍA (obligatoria en cada tarea)
1. PLAN antes de tocar código: enséñame un plan corto (archivos a crear/editar,
   decisiones, riesgos). Espera mi OK.
2. Implementa en incrementos pequeños y verificables.
3. Tras cada incremento: corre lint + typecheck; si hay tests, córrelos; y dime
   exactamente cómo probarlo a mano.
4. Documenta: actualiza docs/phases/fase-N.md (qué hiciste, decisiones, cómo probar)
   y crea un ADR en docs/adr/ si tomaste una decisión de arquitectura.

REGLAS DE ARQUITECTURA
- Feature-first + capas: features/<feature>/{domain,data,presentation}.
- domain sin dependencias de React ni Supabase. Repositorios como interfaces
  (puertos) con adaptador Supabase. La UI depende de hooks/casos de uso, no del BaaS.
- Server state SOLO en TanStack Query; client state (sesión local, tema, UI) en
  Zustand. Nunca dupliques server state.
- Todas las mutaciones con actualización optimista + rollback ante error.

REGLAS DE UX/ACCESIBILIDAD (no negociables)
- Pensado para usuario novato: acción principal grande y evidente por pantalla,
  feedback inmediato, "deshacer" tras borrar, valores por defecto sensatos.
- Cada control: accessibilityLabel + accessibilityRole, contraste AA, target >= 44pt.
- Textos vía i18n (nada hardcodeado). Soporta modo claro/oscuro desde tokens.

SEGURIDAD (beta)
- RLS que impida acceder a datos de otra comunidad (impleméntalo y pruébalo).
- Secretos en .env (nunca en el repo). join_code sin caracteres ambiguos.

FASE ACTUAL: empieza por la FASE 0 (cimientos). Cuando la termines y pase su
auditoría (sección 11 del .md), pídeme luz verde para la Fase 1.

ENTREGABLE DE ESTA PRIMERA TAREA
- Proyecto Expo + TS strict + ESLint/Prettier + estructura de carpetas.
- Design tokens base y shared/ui mínimo (Button, Input, Card accesibles).
- Cliente Supabase configurado + esquema (§7) aplicado + RLS mínima + tipos generados.
- docs/phases/fase-0.md con lo hecho y cómo verificarlo.

Empieza mostrándome el PLAN de la Fase 0. No escribas código todavía.
```

**Prompts de seguimiento útiles:**

- `"Avanza a la Fase 1. Plan primero."`
- `"Añade la suscripción Realtime a items para la comunidad activa. Muéstrame cómo reconcilias la caché de TanStack Query. Plan primero."`
- `"Audita la Fase 2 contra la sección 11 (D y B) del .md y lista lo que falta."`
- `"Genera/actualiza los tipos de Supabase y corrige errores de tipos resultantes."`
- `"Crea un subagente 'reviewer' que revise accesibilidad y separación de capas en el último diff."`

---

## 15. Documentación de implementaciones

### 15.1 Qué documentar (y dónde)

| Documento                              | Ubicación                    | Contenido                                                                       |
| -------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------- |
| **ADR (Architecture Decision Record)** | `docs/adr/ADR-000X.md`       | Decisión, contexto, alternativas, consecuencias (p. ej. «Supabase vs Firebase») |
| **Doc por fase**                       | `docs/phases/fase-N.md`      | Qué se implementó, cómo probarlo, deuda técnica pendiente                       |
| **Contratos de repositorio**           | `docs/api/`                  | Firmas de casos de uso y repositorios (puertos)                                 |
| **README de feature**                  | `src/features/<f>/README.md` | Propósito, entradas/salidas, ejemplos                                           |
| **CHANGELOG**                          | `CHANGELOG.md`               | Cambios por versión                                                             |

### 15.2 Plantilla de ADR

```markdown
# ADR-0001: Elección de backend (Supabase vs Firebase)

- Estado: Aceptado
- Fecha: 2026-07-XX

## Contexto

Necesitamos sincronización global en tiempo real y datos relacionales
(comunidades, miembros, artículos).

## Decisión

Usar Supabase (Postgres + Realtime + Storage + RLS).

## Alternativas consideradas

- Firebase (Firestore): mejor offline-first y push nativo, modelo documental.

## Consecuencias

- Datos relacionales, RLS, tipos, sin lock-in, coste predecible.

* Offline avanzado y push requieren piezas extra (TanStack persist / OneSignal).
```

### 15.3 Estrategia de tests

- **Dominio y casos de uso:** unitarios (Jest) — la parte más valiosa y estable.
- **Repositorios:** tests con Supabase local o mocks del cliente.
- **Componentes:** React Native Testing Library (render, interacción, accesibilidad).
- **E2E:** Maestro para el flujo feliz (unirse → añadir → marcar comprado).
- **Objetivo:** cobertura ≥ 70% en dominio/repos; no perseguir 100% en UI.

---

## 16. Checklist final de entrega

> Estado a 2026-08-05, con las fases 0 → 4 cerradas. El detalle de cada casilla está en el diario
> de su fase; el repaso completo de la §11 está en `docs/phases/fase-4.md`.

- [x] Los 7 requisitos funcionales del MVP (RF-1…RF-7) cumplidos y verificados en 2 dispositivos/redes.
- [x] Sincronización < 2 s entre países; offline abre y encola; rollback probado. _(Dos redes sí,
      dos países no: no hay forma de probarlo aquí y no depende de la app, los clientes no hablan
      entre sí.)_
- [x] RLS impide fugas entre comunidades (test explícito). `npm run test:rls`, 19/19.
- [x] Accesibilidad AA verificada + test con usuario novato superado. _(La pasada con TalkBack se
      aplazó a antes de publicar; ver F.2 en `docs/phases/fase-3.md`.)_
- [x] Arquitectura desacoplada verificada (dominio limpio, repos como puertos).
- [x] Lint/typecheck/tests en verde; cobertura dominio/repos ≥ 70%. 96.9% de sentencias.
- [x] `docs/` completo: ADRs, docs por fase, READMEs de feature. _(Sin READMEs de feature, a
      propósito: los diarios de fase y los ADR cubren eso y un cuarto sitio se desincroniza.)_
- [x] Secretos fuera del repo; `.env.example` presente.
- [x] Build EAS de prueba instalable. _(Android, APK 1.2.0 con updates por aire. iOS nunca se ha
      compilado: es plataforma secundaria y no hay Mac ni cuenta de desarrollador.)_
- [ ] Todas las auditorías (§11) en ✅. _(Tres puntos sin medir: lista de 200 artículos, arranque
      en frío en gama media, y revisión de dependencias abandonadas.)_

---

## 17. Referencias

- Expo — Changelog SDK 57 (RN 0.86, React 19.2): https://expo.dev/changelog/sdk-57
- Expo — Documentación SDK y política de versiones RN: https://docs.expo.dev/versions/latest/
- Ecosistema React Native 2026 (Expo SDK 56, RN 0.85, React 19.2): https://dev.to/davekurian/react-native-ecosystem-advances-with-expo-sdk-56-and-react-192-updates-in-2026-3df5
- Supabase vs Firebase 2026 (comparación técnica): https://www.bytebase.com/blog/supabase-vs-firebase/
- Firebase vs Supabase 2026 (pricing, realtime, veredicto): https://designrevision.com/blog/supabase-vs-firebase
- Estado en React Native 2026 (Zustand + TanStack Query): https://reactnativerelay.com/article/modern-state-management-react-native-zustand-tanstack-query
- React state management 2026 (server vs client state): https://ncctcr.com/blog/react-state-management-2026
- Offline con React Query + Zustand: https://addjam.com/blog/2026-03-20/react-native-offline-data-react-query-zustand/
- Claude Code — Buenas prácticas 2026 (CLAUDE.md, plan mode, subagentes): https://www.iwoszapar.com/p/claude-code-best-practices
- Claude Code — Skills 2026 (directorio y skill creator): https://www.developersdigest.tech/blog/best-claude-code-skills-2026
- Claude Code — Setup, skills, subagentes, hooks: https://ai.rundatarun.io/ai-development-agents/claude-code-best-practices

> Nota: las versiones exactas cambian con frecuencia. Verifica siempre las últimas al arrancar (`npx create-expo-app@latest`, `npm view <paquete> version`) y consulta la documentación oficial de cada herramienta.
