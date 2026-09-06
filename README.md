<div align="center">

<img src="assets/images/icon.png" alt="" width="96" />

# Lista de la compra colaborativa

**Una lista, varias personas, en tiempo real.**
Se entra con un código de invitación y un nombre. Sin registro y sin contraseñas.

![Expo SDK 54](https://img.shields.io/badge/Expo_SDK-54-000020?style=flat-square&logo=expo&logoColor=white)
![React Native 0.81](https://img.shields.io/badge/React_Native-0.81-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres_·_Realtime_·_RLS-3FCF8E?style=flat-square&logo=supabase&logoColor=white)

</div>

---

## Qué resuelve

Dos personas en la misma casa apuntan la compra en el mismo papel. Dos personas en países
distintos, no. Esta app es ese papel compartido: **una sola lista por comunidad**, que todos ven
igual y a la vez, aunque estén en redes y husos horarios diferentes.

El precio de entrada es cero a propósito. Nadie va a crearse una cuenta para apuntar «leche», así
que no hay cuentas: alguien crea la lista, comparte un código de seis caracteres y el resto entra
escribiendo su nombre. La sesión es anónima y la seguridad la ponen las políticas de la base de
datos, no un formulario de registro.

## Cómo funciona

Los móviles **no hablan entre sí**. Todos hablan con el mismo backend, y por eso da igual la red o
el país en el que esté cada uno.

```mermaid
flowchart LR
    subgraph MA["Móvil A"]
        direction TB
        UA["Tocas la lista<br/>se ve al instante"]
        QA["Cola de mutaciones<br/>en AsyncStorage"]
    end

    SB[("Supabase<br/>Postgres · RLS")]
    RT{{"Realtime<br/>filtrado por comunidad"}}

    subgraph MB["Móvil B"]
        UB["La lista cambia sola<br/>sin recargar nada"]
    end

    UA -->|con red| SB
    UA -.->|sin red| QA
    QA -.->|al reconectar| SB
    SB --> RT --> UB
```

Cada pantalla pinta el cambio antes de que el servidor conteste y lo deshace si falla. Sin
cobertura, la mutación se guarda en disco y se reenvía al volver la red, y sobrevive a que cierres
la app del todo. Eso último es lo que obliga a que **el id de un artículo lo genere el móvil**, no
el servidor: si no, un cambio hecho en la misma sesión sin conexión apuntaría a una fila que
todavía no existe.

## Arranque

Necesitas Node 22+, un `.env` con las claves de Supabase (los nombres están en `.env.example`) y
un móvil con **Expo Go 54**. La versión del SDK está fijada: Expo Go solo abre proyectos de su
misma major.

```bash
npm install
npx expo start            # QR para Expo Go
npx expo start --tunnel   # si el móvil y el PC no comparten Wi-Fi
```

## Comandos

| Comando                              | Qué hace                                                            |
| ------------------------------------ | ------------------------------------------------------------------- |
| `npm run lint`                       | ESLint sobre `src/`                                                 |
| `npm run typecheck`                  | `tsc --noEmit`, TypeScript en modo estricto                         |
| `npm test`                           | Jest. 58 suites, 408 tests verdes (cobertura > 96%)                 |
| `npm run test:rls`                   | Aislamiento entre comunidades contra el proyecto real. Da **65/65** |
| `npm run test:realtime`              | Eventos, filtro por comunidad y presencia. Da **18/18**             |
| `npm run test:e2e`                   | Maestro sobre el APK instalado. Necesita `adb` y el CLI de Maestro  |
| `npm run users`                      | Cuántos usuarios anónimos hay y cuáles quedaron huérfanos           |
| `npx expo export --platform android` | Comprobación de build por defecto                                   |

`test:rls` no es opcional. Comprueba que un usuario no puede leer ni escribir datos de otra
comunidad, que es el requisito de seguridad que sostiene todo lo demás. Pásalo después de tocar
cualquier política o función de Postgres.

## Estructura

```text
src/
├── app/            rutas de Expo Router
├── features/       una carpeta por feature, autocontenida
│   └── <feature>/
│       ├── domain/         entidades y casos de uso. Sin React y sin Supabase
│       ├── data/           el puerto y su adaptador de Supabase
│       └── presentation/   pantallas, componentes y hooks de TanStack Query
├── shared/         design system, cliente de Supabase, i18n, utilidades
└── theme/          tokens de color, espaciado, tipografía y radios
```

La regla que sujeta el reparto: `domain/` no importa nada de React ni de Supabase, así que los
casos de uso son funciones puras y se prueban en Node. Cambiar de backend sería escribir otro
adaptador en `data/`, sin tocar una línea de dominio.

Fuera de `src/`, cada carpeta de la raíz tiene un trabajo: `docs/` la documentación, `scripts/` las
herramientas de línea de comandos que no entran en el bundle, y `supabase/` las migraciones.

## Decisiones que dan forma al proyecto

Ninguna decisión vive solo en la cabeza de alguien. Estas son las que más condicionan el código:

| ADR                                                                 | Decisión                                            | Por qué importa                                                          |
| ------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------ |
| [0002](docs/adr/ADR-0002-modelo-de-sesion-y-rls.md)                 | Sesión anónima y RLS por función `security definer` | Sin cuentas pero con aislamiento real. Tiene dos trampas contadas        |
| [0004](docs/adr/ADR-0004-libreria-de-ui.md)                         | NativeWind propio, Paper solo para overlays         | El aspecto es nuestro; de la librería solo lo accesible que cuesta       |
| [0008](docs/adr/ADR-0008-persistencia-local-de-la-cache.md)         | AsyncStorage y no MMKV                              | MMKV es nativo y no arranca en Expo Go, que es como se prueba esto       |
| [0009](docs/adr/ADR-0009-cola-de-mutaciones-offline.md)             | Cola con `setMutationDefaults`                      | Una función no se serializa. Al rehidratar solo quedan variables         |
| [0010](docs/adr/ADR-0010-id-del-articulo-generado-en-el-cliente.md) | El id del artículo lo pone el móvil                 | Un alta offline y su edición posterior tienen que apuntar al mismo sitio |
| [0011](docs/adr/ADR-0011-caducidad-y-rotacion-del-join-code.md)     | El código de invitación caduca y se puede rotar     | Es el único secreto que protege una lista                                |
| [0015](docs/adr/ADR-0015-pin-por-miembro-para-identidad-no-suplantable.md) | PIN de 4 dígitos por miembro para identidad  | Base de identidad para reparto de gastos sin cuentas                     |
| [0017](docs/adr/ADR-0017-gestion-de-miembros-y-roles.md)            | Roles de admin, borrado y participantes invitados   | Limpieza de duplicados y miembros sin alterar deudas históricas          |
| [0018](docs/adr/ADR-0018-exportacion-de-lista-a-pdf.md)             | Exportación de lista a PDF 100% en cliente          | Lista imprimible y compartible sin red ni dependencias externas          |
| [0019](docs/adr/ADR-0019-observabilidad-y-crash-reporting-con-sentry.md) | Observabilidad y crash reporting con Sentry     | Captura desacoplada de errores y trazabilidad sin PII en producción       |
| [0020](docs/adr/ADR-0020-notificaciones-push-con-expo.md)          | Notificaciones push colaborativas con Expo          | Avisos a miembros ante nuevos artículos/gastos sin auto-notificación     |
| [0021](docs/adr/ADR-0021-modulo-de-recetas-y-volcado-a-lista.md)   | Módulo de recetas y volcado a lista de compra       | Planificación culinaria, catálogo y volcado en bloque con alerta push    |
| [0022](docs/adr/ADR-0022-planificador-semanal-de-menus-y-consolidacion.md) | Planificador semanal de menús y consolidación | Menú semanal, suma de ingredientes acumulados y volcado por lotes       |

Los 22 ADRs, con su estado, en [`docs/README.md`](docs/README.md). Un ADR no se edita para cambiar de
opinión: se escribe uno nuevo que supersede al viejo.

## Accesibilidad

No es una capa que se añade al final. Cada control lleva `accessibilityLabel` y
`accessibilityRole`, área táctil de 44 pt como mínimo y contraste AA. Ningún estado se comunica
solo con color: «comprado» lleva icono y texto además del tachado. La app respeta el tamaño de
fuente del sistema y el modo claro y oscuro desde los tokens.

Lo que un test no puede ver, que es si lo que se lee en voz alta tiene sentido y en el orden bueno,
se comprueba a mano con TalkBack. La última pasada fue el 2026-08-16 y salió limpia.

## Seguridad

- La clave que viaja en la app es la **publishable key**. Es pública por diseño; quien protege los
  datos es RLS.
- La **secret key** se salta RLS. Nunca en el cliente, nunca en el repo y nunca en una variable con
  prefijo `EXPO_PUBLIC_`.
- `.env` está en `.gitignore`. `.env.example` lleva los nombres sin valores.
- El código de invitación evita caracteres ambiguos (`O/0`, `I/1`), caduca a los siete días,
  cualquier miembro puede rotarlo y unirse tiene rate limit.

## Estado

**Fases 0 a 12 completadas · Requisitos funcionales (RF-1 a RF-15), observabilidad, recetas y menús.**

- **MVP (Fases 0 a 4):** cerrado, probado con dos móviles reales y 100% operativo.
- **Fase 5 (Endurecimiento):** sesión protegida, TalkBack verificado y expiración de códigos.
- **Fase 6 (Catálogo y Gastos):** catálogo de Mercadona (RF-10) y división de gastos estilo Tricount (RF-9).
- **Fase 7 (Gestión de Miembros):** roles de admin, baja física/lógica y participantes invitados (RF-11 y RF-12).
- **Fase 8 (Exportar a PDF):** generación y compartición offline de PDF (RF-8).
- **Fase 9 (Observabilidad y Release):** Sentry integrado con sanitización estricta sin PII, fallback offline/dev y perfiles de EAS para APK (`preview`) y App Bundle AAB (`production`).
- **Fase 10 (Notificaciones Push):** alertas push colaborativas con `expo-notifications`, RPCs con filtro anti auto-notificación y RLS.
- **Fase 11 (Recetas Compartidas):** creación y edición de recetas con ingredientes de catálogo, escalador de comensales y volcado en bloque a la lista (RF-14).
- **Fase 12 (Planificador Semanal de Menús):** comidas y cenas por día de la semana, consolidación agregada de ingredientes y volcado a lista en un toque (RF-15).
- **Auditoría final (§11) y Checklist (§16):** 100% completado (arranque en frío < 3s, virtualización fluida con 200 ítems y 51 dependencias auditadas sin librerías obsoletas).

Se distribuye como APK con EAS Build y se parchea por aire con `eas update`.

## Documentación

| Quieres...                                   | Vete a                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| Entender qué es y qué se va a construir      | [`docs/especificacion-y-roadmap.md`](docs/especificacion-y-roadmap.md) |
| Saber **por qué** algo está hecho así        | [`docs/adr/`](docs/adr/)                                               |
| Ver qué se hizo en cada fase y cómo probarlo | [`docs/phases/`](docs/phases/)                                         |
| Hacer una tarea concreta paso a paso         | [`docs/guias/`](docs/guias/)                                           |
| Las reglas duras del proyecto                | [`CLAUDE.md`](CLAUDE.md)                                               |

---

<div align="center">
<sub>Proyecto privado en beta. Documentación en español, código en inglés.</sub>
</div>
