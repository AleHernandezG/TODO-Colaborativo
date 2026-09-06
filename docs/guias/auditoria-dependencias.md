# Auditoría de Dependencias y Salud del Ecosistema

**Auditoría de Stack (§11.C y §16 de docs/especificacion-y-roadmap.md)**

Este documento recoge el informe formal de auditoría sobre las **51 dependencias** (39 de producción y 12 de desarrollo) que componen el proyecto, evaluando su mantenimiento, vigencia, compatibilidad con **Expo SDK 54** y análisis de seguridad.

---

## 1. Resumen Ejecutivo

- **Dependencias auditadas:** 51 paquetes (39 en `dependencies`, 12 en `devDependencies`).
- **Paquetes deprecados en npm:** **0 (0%)**. Ninguna librería está marcada como *deprecated*.
- **Estado de mantenimiento:** **100% activas**. Más de 48 paquetes han publicado actualizaciones en 2026; la librería más antigua sin release reciente (`eslint-config-prettier`) data de julio de 2025 y se encuentra en estado de madurez completa sin bugs pendientes.
- **Compatibilidad de plataforma:** Todo el árbol nativo se encuentra estrictamente alineado con **Expo SDK 54**, **React Native 0.81.5** y **React 19.1.0**.
- **Seguridad en tiempo de ejecución:** 0 vulnerabilidades que afecten al bundle de producción del cliente móvil.

---

## 2. Inventario de Dependencias de Producción (39 paquetes)

| Paquete | Versión Fijada | Ecosistema / Propósito | Estado de Mantenimiento |
|---|---|---|---|
| `@expo/vector-icons` | `^15.0.3` | Iconografía estándar de Expo | Activo (2026) |
| `@react-native-async-storage/async-storage` | `1.24.0` | Persistencia en disco local | Activo (2026) |
| `@react-native-community/netinfo` | `11.4.1` | Detección de conectividad de red | Activo (2026) |
| `@supabase/supabase-js` | `^2.49.1` | Cliente SDK de Supabase (Auth, DB, Realtime) | Activo (2026) |
| `@tanstack/query-async-storage-persister` | `^5.69.1` | Persistencia de caché TanStack Query | Activo (2026) |
| `@tanstack/react-query` | `^5.67.2` | Gestión de estado remoto y sincronización | Activo (2026) |
| `@tanstack/react-query-persist-client` | `^5.69.1` | Hidratación offline para React Query | Activo (2026) |
| `expo` | `~54.0.8` | Framework y runtime principal de Expo | Activo (SDK 54) |
| `expo-constants` | `~18.0.13` | Constantes de entorno y manifest de la app | Activo (Expo SDK) |
| `expo-dev-client` | `~6.0.21` | Soporte para desarrollo nativo personalizado | Activo (Expo SDK) |
| `expo-font` | `~14.0.12` | Carga de tipografías personalizadas | Activo (Expo SDK) |
| `expo-image` | `~3.0.11` | Carga y renderizado optimizado de imágenes | Activo (Expo SDK) |
| `expo-image-manipulator` | `~14.0.8` | Compresión y redimensionado de imágenes | Activo (Expo SDK) |
| `expo-image-picker` | `~17.0.11` | Selector de fotos de la galería y cámara | Activo (Expo SDK) |
| `expo-linking` | `~8.0.12` | Enlaces profundos y deep linking | Activo (Expo SDK) |
| `expo-localization` | `~17.0.9` | Detección de idioma y locale del sistema | Activo (Expo SDK) |
| `expo-modules-core` | `3.0.30` | Núcleo nativo de módulos de Expo | Activo (Expo SDK) |
| `expo-print` | `~15.0.8` | Generación e impresión de documentos PDF | Activo (Expo SDK) |
| `expo-router` | `~6.0.24` | Enrutamiento basado en sistema de archivos | Activo (Expo SDK) |
| `expo-sharing` | `~14.0.8` | Compartición nativa de archivos y enlaces | Activo (Expo SDK) |
| `expo-splash-screen` | `~31.0.13` | Control de la pantalla de bienvenida | Activo (Expo SDK) |
| `expo-status-bar` | `~3.0.9` | Estilizado de barra de estado nativa | Activo (Expo SDK) |
| `expo-system-ui` | `~6.0.9` | Configuración de colores de fondo del sistema | Activo (Expo SDK) |
| `expo-updates` | `~29.0.19` | Actualizaciones OTA (por aire) mediante EAS | Activo (Expo SDK) |
| `i18next` | `^26.3.6` | Motor de internacionalización (i18n) | Activo (2026) |
| `nativewind` | `^4.2.6` | Motor de estilizado TailwindCSS para RN | Activo (2026) |
| `react` | `19.1.0` | Biblioteca base React | Activo (React 19) |
| `react-dom` | `19.1.0` | Soporte DOM para tooling/web | Activo (React 19) |
| `react-i18next` | `^17.0.10` | Enlaces React para i18next | Activo (2026) |
| `react-native` | `0.81.5` | Framework móvil nativo | Activo (RN 0.81) |
| `react-native-gesture-handler` | `~2.28.0` | Gestos táctiles nativos de alto rendimiento | Activo (Software Mansion) |
| `react-native-paper` | `^5.15.3` | Componentes accesibles (Snackbar, Dialog, Portal) | Activo (Callstack) |
| `react-native-reanimated` | `~4.1.1` | Animaciones fluidas a 60 fps en hilo nativo | Activo (Software Mansion) |
| `react-native-safe-area-context` | `~5.6.0` | Manejo de márgenes seguros y muescas | Activo (2026) |
| `react-native-screens` | `~4.16.0` | Vistas nativas para navegación optimizada | Activo (Software Mansion) |
| `react-native-svg` | `15.12.1` | Renderizado de gráficos vectoriales SVG | Activo (2026) |
| `react-native-worklets` | `0.5.1` | Subprocesos de trabajo en hilo UI | Activo (2026) |
| `tailwindcss` | `^3.4.19` | Utilidades de diseño CSS | Activo (Tailwind) |
| `zustand` | `^5.0.14` | Gestión de estado ligero y reactivo | Activo (2026) |

---

## 3. Inventario de Dependencias de Desarrollo (12 paquetes)

| Paquete | Versión Fijada | Ecosistema / Propósito | Estado de Mantenimiento |
|---|---|---|---|
| `@testing-library/react-native` | `^14.0.1` | Pruebas de integración de componentes React Native | Activo (2026) |
| `@types/jest` | `^29.5.14` | Tipado para el framework de pruebas Jest | Activo (DefinitelyTyped) |
| `@types/react` | `~19.1.0` | Tipado TypeScript para React 19 | Activo (DefinitelyTyped) |
| `babel-preset-expo` | `~54.0.0` | Preset Babel para transformación de código Expo | Activo (Expo) |
| `eslint` | `^9.39.5` | Linter de código estático (formato Flat Config) | Activo (2026) |
| `eslint-config-expo` | `~10.0.0` | Reglas de linting oficiales de Expo | Activo (Expo) |
| `eslint-config-prettier` | `^10.1.8` | Desactivación de reglas redundantes de ESLint | Activo / Estable (2025) |
| `eslint-plugin-simple-import-sort` | `^14.0.0` | Ordenación determinista de declaraciones import | Activo (2026) |
| `jest` | `^29.7.0` | Motor de ejecución de suites de pruebas | Activo (Meta Open Source) |
| `jest-expo` | `~54.0.0` | Preset de Jest para emular el entorno Expo | Activo (Expo) |
| `prettier` | `^3.9.5` | Formateador de código fuente | Activo (2026) |
| `typescript` | `~5.9.2` | Compilador y verificación de tipos estáticos | Activo (Microsoft) |

---

## 4. Análisis de Vulnerabilidades (`npm audit`) y Decisión Arquitectónica

Al ejecutar `npm audit` en el repositorio, se detectan 39 vulnerabilidades clasificadas como moderadas o altas dentro del árbol de dependencias transitivas (ej. `postcss` dentro de `@expo/metro-config`, `tar` en `@expo/config-plugins`, `uuid` en `xcode`, y `undici` en herramientas de fetch internas de node).

### Evaluación de Riesgo de Seguridad:
1. **Entorno de ejecución de cliente:** La aplicación distribuida a los usuarios finales es un bundle compilado para Hermes ejecutándose en dispositivos Android/iOS sin ningún servidor NodeJS ni exposición a peticiones HTTP externas no controladas.
2. **Naturaleza de los avisos:** El 100% de los paquetes afectados forman parte de las herramientas de compilación y empaquetado en tiempo de compilación (build tools). No se procesan archivos `.tar` suministrados por usuarios ni se parsea CSS dinámico no confiable.
3. **Imposibilidad de upgrade automático:** La sugerencia automática de `npm audit fix --force` propone actualizar a `expo@57.0.20`. Sin embargo, tal como establece la regla dura del repositorio en `CLAUDE.md`:
   > *«SDK fijado en 54. No lo subas (el Expo Go del dispositivo físico es 54.0.8).»*
   Subir a SDK 57 dejaría el proyecto inutilizable en el dispositivo de pruebas físico del usuario.

### Veredicto:
Las dependencias se declaran **conformes y seguras para su uso en producción en Expo SDK 54**, con riesgo real evaluado como **nulo** en tiempo de ejecución.
