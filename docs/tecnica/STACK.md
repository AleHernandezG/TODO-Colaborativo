# Stack

Versiones instaladas, sacadas de `node_modules/*/package.json` el **2026-10-31**. La versión que
manda es la de `package-lock.json`; si esta tabla discrepa, se corrige la tabla. Cada fila responde
a la regla 3 (solo gratis, con licencia MIT, Apache-2.0, BSD o dominio público).

El porqué de cada elección está en su ADR. Esta tabla no vuelve a decidir nada.

## La app

| Pieza | Versión | Licencia | Para qué | Riesgo |
| --- | --- | --- | --- | --- |
| `expo` | 57.0.27 | MIT | SDK. **No se sube sin Alejandro** (`CLAUDE.md`, Stack) | Subirlo es `version` nueva y build |
| `react-native` | 0.86.3 | MIT | Base | Fijado por el SDK |
| `react` | 19.2.3 | MIT | Base | Fijado por el SDK |
| `expo-router` | 57.0.25 | MIT | Navegación por ficheros | — |
| `typescript` | 5.9.3 | Apache-2.0 | Tipos en `strict` | SDK 57 espera la 6.0; excluido de `expo doctor` a propósito (fase 15) |
| `@tanstack/react-query` | 5.101.4 | MIT | Estado del servidor | — |
| `@tanstack/react-query-persist-client` y `query-async-storage-persister` | 5.101.4 | MIT | Caché y cola offline persistidas (ADR-0008, ADR-0009) | — |
| `zustand` | 5.0.14 | MIT | Estado del cliente | — |
| `@supabase/supabase-js` | 2.110.7 | MIT | Cliente de Supabase (ADR-0001) | — |
| `@react-native-async-storage/async-storage` | 2.2.0 | MIT | Persistencia local y sesión. No MMKV (ADR-0008) | Asíncrono: nada decide en el primer render |
| `@react-native-community/netinfo` | 12.0.1 | MIT | Conectividad, `assertOnline()` | — |
| `nativewind` | 4.2.6 | MIT | Estilos con clases (ADR-0004) | Fija `tailwindcss` en 3.x |
| `tailwindcss` | 3.4.19 | MIT | Lo usa NativeWind | No se sube a 4 mientras NativeWind 4 lo pida |
| `react-native-paper` | 5.15.3 | MIT | Solo `Snackbar`, `Dialog` y `Portal` (ADR-0004) | — |
| `react-native-reanimated` | 4.5.1 | MIT | Animación | — |
| `react-native-gesture-handler` | 2.32.0 | MIT | Gestos | — |
| `expo-image`, `expo-image-picker`, `expo-image-manipulator` | 57.0.5, 57.0.20, 57.0.21 | MIT | Fotos de artículos y recetas (ADR-0006, ADR-0023) | — |
| `expo-updates` | 57.0.25 | MIT | Updates por aire, runtime por `appVersion` | Ver `docs/guias/despliegue.md`, apartado 5 |
| `expo-notifications` | 57.0.22 | MIT | Push (ADR-0020) | — |
| `expo-print`, `expo-sharing` | 57.0.2, 57.0.22 | MIT | PDF de la lista (ADR-0018) | — |
| `expo-localization`, `i18next`, `react-i18next` | 57.0.2, 26.3.6, 17.0.10 | MIT | Español e inglés | — |
| `@sentry/react-native` | 7.11.0 | MIT | Fallos en producción (ADR-0019) | Plan gratuito de Sentry; falta el DSN en EAS `preview` |

## Calidad

| Pieza | Versión | Licencia | Para qué |
| --- | --- | --- | --- |
| `jest` y `jest-expo` | 29.7.0 y 57.0.5 | MIT | Tests. `--testPathPattern` en singular, que es la opción de Jest 29 |
| `@testing-library/react-native` | 14.0.1 | MIT | Tests de hooks y componentes |
| `eslint` y `eslint-config-expo` | 9.39.5 y 57.0.2 | MIT | Lint, con las reglas de capas de `eslint.config.js` |
| `prettier` | 3.9.5 | MIT | Formato. Lo pasa el hook `formatear.mjs` al escribir |
| Maestro CLI | fuera de npm | Apache-2.0 | E2E en el Android (`docs/guias/e2e-con-maestro.md`) |

## Fuera de npm

| Pieza | Versión en esta máquina | Notas |
| --- | --- | --- |
| Node | 22.14.0 | Los hooks y los scripts de `scripts/` son `.mjs` de Node |
| CLI de Supabase | 2.122.0 (por `npx`) | Gratis. `db push` lo lanza solo Alejandro |
| `eas-cli` | por `npx eas-cli@latest` | Plan gratuito de EAS: builds con cola y límite mensual |
| Supabase | plan Free | El proyecto se pausa tras una semana sin actividad; lo evita el ping diario (`docs/guias/despliegue.md`) |

## Lo que se miró y no entró

- **MMKV** en lugar de AsyncStorage: descartado por ADR-0008 cuando se probaba en Expo Go. El
  motivo ya no aplica; cambiarlo exige un ADR nuevo.
- **expo-secure-store** para la sesión: límite de ~2048 bytes por valor, menos que la sesión de
  Supabase (`docs/phases/fase-0.md`).
- **TypeScript 6**: pendiente de su propia pasada de typecheck y lint (fase 15, apartado 6).
- **El plugin `security-guidance`**: ver `METODO-DE-TRABAJO.md`.
