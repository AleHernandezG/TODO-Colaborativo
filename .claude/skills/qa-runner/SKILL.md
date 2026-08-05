---
name: qa-runner
description: El ritual de cierre de este proyecto — lint, typecheck, tests, prueba manual y documentación de fase. Úsala SIEMPRE antes de dar por terminado cualquier incremento de código, y cuando el usuario diga "termina", "ciérralo", "ya está", "pasa los tests", "comprueba que funciona" o pida cerrar una fase. Aplica aunque el cambio parezca trivial.
---

# Cierre de un incremento

Un cambio no está hecho cuando compila. Está hecho cuando alguien más podría cogerlo mañana
y saber qué hace, cómo probarlo y por qué se decidió así. Este es el orden y el porqué.

## 1. Calidad, en este orden

```bash
npm run lint
npm run typecheck
npm test
```

El orden importa porque el coste sube en cada paso. Lint tarda segundos y pilla imports
muertos y variables sin usar; typecheck tarda más; los tests son lo más lento. Correrlos al
revés significa esperar a la suite entera para descubrir un import mal escrito.

Si un script todavía no existe, no lo simules ni lo saltes en silencio: dilo. En Fase 0
montar estos tres scripts **es** parte del trabajo, no un accesorio.

## 2. Ante un fallo

Arréglalo. No lo silencies.

Un `eslint-disable`, un `@ts-expect-error` o un `.skip` son deuda con intereses: el aviso
existía por algo y quien lo apague pierde la única señal que había. Si de verdad hay que
suprimir algo, que sea la excepción justificada, con el motivo escrito en la documentación de
la fase, no un `disable` suelto en mitad de un fichero.

`any` para callar a TypeScript merece mención aparte: el proyecto está en `strict` justo para
que los tipos del esquema de Supabase avisen cuando cambia una columna. Un `any` bien puesto
cancela exactamente esa protección.

## 3. Cobertura

```bash
npm run test:coverage
```

Dominio y repositorios ≥ 70%, y el umbral está puesto en `jest.config.js`, así que por debajo el
comando falla solo. La UI no se persigue.

No es un número arbitrario: los casos de uso son funciones puras, se testean rápido y son
donde vive la lógica que puede estar mal de forma silenciosa. Los tests de UI de una app RN
cuestan mucho y se rompen cada vez que mueves un padding, así que ahí el retorno es malo.
Prueba la UI a mano.

Lo que sí conviene tener cubierto siempre: generación y validación de `join_code`, el
aislamiento por comunidad, y el rollback de una mutación optimista cuando la red falla.

## 4. Prueba manual

Los tests no ven la app. Deja escrito cómo probar el cambio a mano, con pasos concretos:

```
1. npx expo start (o --tunnel si el móvil no está en tu Wi-Fi)
2. Entra con el código PAN-42XK, usuario "ana"
3. Añade "leche", ponla en cantidad 3
4. Modo avión → marca como comprada → debe cambiar al instante
5. Quita el modo avión → debe seguir marcada, sin duplicados
```

Para cualquier cosa que toque sincronización, la prueba necesita **dos dispositivos** (o un
emulador y el móvil). Un cambio de Realtime probado en un solo cliente no está probado.

Comprueba también, si el cambio añadió UI: modo claro y oscuro, y con el tamaño de fuente
del sistema subido. Un layout que revienta con fuente grande es un fallo de accesibilidad,
no un detalle estético.

La parte del guion que se repite igual en cada fase (crear lista, añadir, marcar, borrar con
deshacer) está automatizada en `.maestro/`. Necesita el CLI de Maestro, `adb` y el APK instalado,
así que no sustituye a la prueba a mano de lo que cambió; sirve para confirmar que lo de siempre
sigue en pie sin volver a recorrerlo a dedo. Cómo se ejecuta y qué basura deja en Supabase:
`docs/guias/e2e-con-maestro.md`.

Si tocaste un texto de `es.json` o la etiqueta de un control, mira si algún flujo de `.maestro/`
lo tenía escrito: los selectores son copias literales de esos textos.

## 5. Documentar

Actualiza `docs/phases/fase-N.md`: qué se hizo, qué se decidió y cómo probarlo.

Si hubo una decisión de arquitectura — elegir una librería, cambiar la forma de los datos,
descartar una alternativa — va un ADR en `docs/adr/` con contexto, decisión, alternativas
consideradas y consecuencias. Lo valioso de un ADR es lo que se descartó y por qué; eso es
justo lo que nadie recuerda seis meses después.

## 6. Antes de cerrar fase

Las fases van en orden, 0 → 4, y ninguna se salta. Antes de pedir luz verde para la siguiente:

- Los tres comandos de calidad, en verde
- Prueba manual hecha, con sus pasos escritos
- `docs/phases/fase-N.md` actualizado y ADRs creados si tocaba
- Sin secretos en el repo: `git diff` revisado, `.env` sigue ignorado
- Los criterios de la sección 11 (auditoría) del documento maestro, repasados

Y entonces pide la luz verde. No la des por hecha.

## Qué no hacer

- Reportar "todo correcto" sin haber corrido los comandos. Si algo falló, se dice, con la
  salida delante.
- Commitear sin que lo pidan.
- Dar por buena una funcionalidad de sincronización probada en un único cliente.
