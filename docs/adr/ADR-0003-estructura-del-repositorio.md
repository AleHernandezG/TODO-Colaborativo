# ADR-0003: Estructura del repositorio y organización de la documentación

- Estado: Aceptado
- Fecha: 2026-07-19

## Contexto

Al cerrar la parte de backend de la Fase 0 el repositorio eran once ficheros de documentación,
dos de SQL y un script. Cero TypeScript. Justo antes de generar el proyecto Expo, que va a
traer `package.json`, `app.json`, `tsconfig.json`, `assets/` y unas cuantas carpetas más, toca
decidir dónde vive cada cosa. Después es más caro: mover ficheros con historial de git y
referencias cruzadas duele más que colocarlos bien la primera vez.

Dos preguntas concretas que había que responder:

1. ¿La app Expo vive en la raíz o en `apps/mobile/` con vistas a un monorepo?
2. ¿Cómo se organiza `docs/` para que no se convierta en un cajón de sastre?

## Decisión

### La app vive en la raíz. No hay monorepo

`package.json`, `app.json` y `src/` van en la raíz del repositorio.

Un monorepo (pnpm workspaces + Turborepo) es la respuesta correcta cuando hay varias apps
compartiendo código: web + móvil, o app + API. Aquí hay **una** app y el backend es Supabase,
o sea que no hay nada que compartir. El coste no es teórico: Metro necesita configuración de
`watchFolders`, EAS Build necesita saber cuál es la raíz del workspace, y las versiones
duplicadas de React o React Native dentro de un monorepo dan errores en tiempo de ejecución
que no se parecen a su causa.

El criterio para cambiar de opinión es concreto: **cuando estés copiando tipos o código entre
dos proyectos**. Mientras no pase, no hace falta.

### `src/app/` para las rutas, no `app/` en la raíz

Expo Router soporta las dos ubicaciones y la documentación oficial usa `src/app` en sus
ejemplos. Se elige `src/` porque deja la raíz para configuración y mantiene todo el código de
la app bajo un único directorio, que es lo que ya describía `CLAUDE.md`.

La estructura interna de `src/` (features autocontenidas con `domain/`, `data/`,
`presentation/`) no cambia: es la de §5.2 del documento maestro y la que aplican las skills.
Coincide además con lo que recomiendan las guías de Expo para proyectos medianos, donde una
carpeta `features/` evita que la lógica se disperse en `components/` y `hooks/` globales.

### `docs/` organizada por tipo de documento, no por tema

```
docs/
├── README.md                     índice; por dónde entrar según lo que busques
├── especificacion-y-roadmap.md   el documento maestro
├── adr/                          decisiones de arquitectura, numeradas e inmutables
├── phases/                       diario de cada fase: qué se hizo y cómo probarlo
└── guias/                        cómo hacer tareas concretas (setup, despliegue, depuración)
```

La separación sigue la idea de [Diátaxis](https://diataxis.fr/): un documento sirve para
aprender, para consultar, para resolver una tarea o para entender por qué algo es como es, y
mezclar esos cuatro propósitos en un fichero es lo que hace que la documentación no se lea.
Aquí se traduce a: la especificación es referencia, los ADR son explicación, `phases/` es el
registro de lo hecho y `guias/` son instrucciones paso a paso.

Los ADR se quedan en `docs/adr/` con el formato Nygard que ya usan ADR-0001 y ADR-0002
(Contexto / Decisión / Alternativas / Consecuencias). Numeración correlativa, sin reutilizar
números, y **no se editan para cambiar de opinión**: se escribe uno nuevo que supersede al
anterior. Un ADR es un registro de lo que se pensaba en una fecha, no documentación viva.

### Nombres de fichero

Todo en `kebab-case` y minúsculas, salvo los ADR (que llevan su prefijo `ADR-NNNN-`) y los
ficheros que por convención van en mayúsculas en la raíz: `README.md`, `CLAUDE.md`.

Por eso `COMPRA-COLABORATIVA-Especificacion-y-Roadmap.md` pasó a
`especificacion-y-roadmap.md`. Se renombró con `git mv`, así que el historial se conserva.

### Qué va en la raíz

Solo configuración y los dos ficheros que alguien lee al llegar:

```
README.md          qué es esto y cómo arrancarlo
CLAUDE.md          reglas duras del proyecto
.env.example       nombres de las variables, sin valores
package.json  app.json  tsconfig.json  ...
docs/  scripts/  src/  supabase/  assets/
```

`scripts/` es para herramientas que se ejecutan a mano o en CI y no forman parte del bundle de
la app (hoy: la prueba de aislamiento de RLS). `supabase/` lo gestiona la CLI y su contenido
no se toca a mano salvo las migraciones.

## Alternativas consideradas

- **Monorepo desde el principio (`apps/mobile`, `packages/`).** Descartado por lo de arriba:
  paga complejidad de tooling hoy a cambio de flexibilidad que no se necesita. Migrar a
  monorepo más adelante es mover carpetas y ajustar Metro; no es una decisión irreversible.
- **`app/` en la raíz en vez de `src/app/`.** Es el layout por defecto de `create-expo-app` y
  funciona igual. Se descarta porque mezcla rutas con configuración en el primer nivel y
  contradice la estructura ya escrita en `CLAUDE.md`.
- **Documentación en una wiki o en Notion.** Se separa de la revisión por PR y se desincroniza
  del código en cuestión de semanas. La documentación vive en el repo y se revisa con él.

## Consecuencias

- Quien llega al repo encuentra el código donde espera y la documentación clasificada por para
  qué sirve, no por cuándo se escribió.
- Renombrar el documento maestro rompe cualquier enlace externo que apuntara al nombre viejo.
  Dentro del repo se actualizaron las dos referencias que había.
- Al no haber monorepo, si algún día hay una web que comparta tipos con la app habrá que
  reestructurar. Es un coste asumido y acotado.
- La regla de "un ADR no se edita" implica que este mismo fichero envejecerá. Si la estructura
  cambia de verdad, se escribe ADR-000N superseding a este, no se reescribe este.
