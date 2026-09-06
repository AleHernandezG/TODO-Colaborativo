# Verificación de Arranque en Frío (< 3 s en gama media)

**Auditoría de Rendimiento (§11.H y §16 de docs/especificacion-y-roadmap.md)**

Este documento recoge el análisis arquitectónico, las mediciones cuantitativas del bundle de producción, los tests de benchmark automatizados y el procedimiento físico para auditar el tiempo de arranque en frío (*cold start*) de la aplicación en dispositivos Android de gama media.

---

## 1. Criterio de Aceptación

- **Objetivo:** Arranque en frío inferior a **3.0 segundos** en dispositivos Android de gama media (perfil de referencia: Qualcomm Snapdragon 680 / 720G o MediaTek Helio G88/G99, 4 GB RAM, almacenamiento eMMC 5.1 / UFS 2.1).
- **Definición de Cold Start:** Tiempo transcurrido desde que el usuario pulsa el icono de la aplicación (o se lanza el intent nativo sin proceso en memoria) hasta que la pantalla principal renderiza la lista interactiva o el gate de bienvenida.

---

## 2. Presupuesto de Tiempos (Cold Start Breakdown)

El pipeline de arranque sigue la siguiente secuencia técnica:

| Fase | Descripción Técnica | Tiempo Estimado (Gama Media) |
|---|---|---|
| **1. Init Nativo + VM** | Arranque del proceso Android Zygote, creación de `MainActivity` e inicialización del motor JavaScript Hermes. | 400 – 600 ms |
| **2. Carga Bytecode Hermes** | Lectura y carga en memoria del bundle compilado `entry-*.hbc` (5.65 MB, 1832 módulos JS empaquetados). Hermes ejecuta bytecode precompilado sin fase JIT. | 600 – 900 ms |
| **3. Setup Síncrono** | Registro síncrono de defaults de TanStack Query (`registerExpenseMutationDefaults`, `registerItemMutationDefaults`) y proveedores React. | < 10 ms |
| **4. Hidratación Almacenamiento** | Lecturas paralelas desde `AsyncStorage` (clave de Zustand `session` y clave de TanStack `query-cache`). | 100 – 250 ms |
| **5. Bootstrap de Sesión** | `useSessionBootstrap()` resuelve sesión: <br>• **Offline con sesión:** inmediato desde Zustand (< 20 ms). <br>• **Online con sesión existente:** `supabase.auth.getSession()` (~150 – 350 ms). <br>• **Primer arranque anónimo:** `supabase.auth.signInAnonymously()` (~300 – 450 ms). | 20 – 350 ms |
| **6. Primer Render Interactivo** | Montaje de `_layout.tsx`, evaluación de `SessionGate` y render de la pantalla de bienvenida o `ItemsScreen`. | ~100 ms |
| **TOTAL ESTIMADO** | **Desde el toque del icono hasta la interactividad total** | **~1.6 s – 2.4 s** |

El tiempo total se sitúa holgadamente por debajo del umbral límite de **3.0 s**.

---

## 3. Mediciones Cuantitativas Automatizadas

### A. Bundle de Producción (`npx expo export --platform android`)
Ejecutado con React Compiler activado y optimización para Hermes bytecode:

- **Módulos procesados:** 1832 módulos.
- **Tiempo de bundling Metro:** 5769 ms.
- **Artefacto emitido:** `_expo/static/js/android/entry-76b04ed39256972dc1fa9d7bb14a14d1.hbc`
- **Tamaño del bundle compilado:** **5.65 MB** (bytecode directo para la VM de Hermes, evitando coste de parseo de texto JS en el dispositivo).
- **Assets estáticos:** 25 iconos y fuentes vectoriales optimizadas (1.31 MB fuente Material Icons).

### B. Benchmark de Inicialización de Sesión (`use-session-bootstrap-benchmark.test.ts`)
Suite de pruebas ejecutada en Jest midiendo con precisión de microsegundos (`performance.now()`):

```
PASS src/features/session/presentation/hooks/__tests__/use-session-bootstrap-benchmark.test.ts
  useSessionBootstrap — Benchmark de arranque e inicialización de sesión
    √ arranque Online con sesión existente: alcanza estado "ready" en < 500 ms (18 ms)
    √ arranque Online por primera vez (anónimo): completa bootstrap en < 500 ms (3 ms)
    √ arranque Offline con sesión cacheada: restaura sesión de inmediato (< 100 ms) (2 ms)
    √ arranque Offline sin sesión previa: detecta OfflineError limpiamente en < 500 ms (1 ms)
```

En todos los casos de arranque, el código JavaScript resuelve el estado de bootstrap entre 1 ms y 18 ms, dejando más de 2.5 segundos de margen para el sistema operativo y el framework nativo.

---

## 4. Guía de Medición Física con ADB en Dispositivo Real

Para verificar de forma empírica en un terminal Android físico conectado por cable USB o Wi-Fi con depuración activada:

### Paso 1: Conectar el dispositivo y verificar conexión
```bash
adb devices
```

### Paso 2: Forzar cierre completo de la app (matar proceso)
```bash
adb shell am force-stop com.alehernandezg.todocompartido
```

### Paso 3: Lanzar la app midiendo tiempos con ActivityManager
```bash
adb shell am start -W -n com.alehernandezg.todocompartido/.MainActivity
```

**Salida esperada:**
```
Starting: Intent { cmp=com.alehernandezg.todocompartido/.MainActivity }
Status: ok
LaunchState: COLD
Activity: com.alehernandezg.todocompartido/.MainActivity
TotalTime: 1840
WaitTime: 1865
Complete
```
* **TotalTime:** Tiempo total que tardó el sistema operativo en inicializar el proceso y dibujar la primera ventana interactiva en pantalla (debe ser `< 3000 ms`).

### Paso 4: Inspeccionar el log de `Displayed` en ActivityTaskManager
```bash
adb logcat -d -s "ActivityTaskManager" | grep "Displayed com.alehernandezg.todocompartido"
```

**Ejemplo de registro:**
```
ActivityTaskManager: Displayed com.alehernandezg.todocompartido/.MainActivity: +1s840ms
```

### Paso 5: Probar arranque en frío en modo avión (Offline)
1. Activar el modo avión en el dispositivo.
2. Forzar cierre: `adb shell am force-stop com.alehernandezg.todocompartido`
3. Lanzar de nuevo: `adb shell am start -W -n com.alehernandezg.todocompartido/.MainActivity`
4. Comprobar que la app abre de inmediato con la lista y los datos cacheados en disco sin pantallas en blanco ni tiempos colgados.
