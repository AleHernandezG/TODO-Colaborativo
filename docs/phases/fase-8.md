# Fase 8 · Exportar la lista a PDF (RF-8)

- Estado: **completada** (código, tests unitarios, tipado estricto y build Android superados; lista para verificación en dispositivo físico).
- Inicio: 2026-09-05 · Cierre: 2026-09-05.
- Requisito funcional:
  - **RF-8 · Exportar la lista a PDF**: generación de documento PDF con el listado de la compra (agrupado por artículos pendientes y comprados, con cantidades y fecha), compartible nativamente mediante el sistema operativo y con funcionamiento 100% en cliente / offline.
- Documento de diseño: [ADR-0018](../adr/ADR-0018-exportacion-de-lista-a-pdf.md).
- Reglas clave: dependencias compatibles con Expo SDK 54, maquetación desacoplada en `domain/`, sin cambios en el esquema ni llamadas al backend de Supabase.

---

## Desglose de incrementos de trabajo

### Incremento 1 · Dependencias y modelo de dominio

**Objetivo:** Añadir las dependencias oficiales de Expo para SDK 54 y programar la función de generación del documento HTML/CSS de forma pura y testeable.

1. **Instalación de paquetes:**
   - `expo-print` (~15.0.8) y `expo-sharing` (~14.0.8) compatibles con Expo SDK 54.
2. **Lógica de dominio (`src/features/items/domain/build-list-pdf-html.ts`):**
   - Función pura `buildListPdfHtml` que toma los artículos, nombre de la comunidad, cadenas i18n y fecha formateada.
   - Generación de plantilla HTML5 con estilos `@page` para impresión A4.
   - Escape exhaustivo de caracteres HTML para prevenir inyección de código.
   - Separación clara entre artículos por comprar (casilla vacía `[ ]`, badge de cantidad) y artículos comprados (casilla marcada `[✓]`, texto tachado).
3. **Tests unitarios:**
   - `build-list-pdf-html.test.ts`: comprobación de escapado de caracteres, renderizado de secciones, badges de cantidad y resumen en pie de página.

---

### Incremento 2 · Adaptador de datos y servicio nativo

**Objetivo:** Crear el servicio de exportación que encapsula las APIs nativas de Expo.

1. **Servicio (`src/features/items/data/expo-pdf-exporter.ts`):**
   - Interfaz `ListPdfExporter` e implementación `expoListPdfExporter`.
   - Comprobación de disponibilidad previa con `Sharing.isAvailableAsync()`.
   - Generación del archivo PDF con `Print.printToFileAsync({ html })`.
   - Apertura de la hoja nativa de compartir con `Sharing.shareAsync` asociando `application/pdf`.
   - Captura y aislamiento de excepciones devolviendo tipos discriminados.
2. **Tests unitarios:**
   - `expo-pdf-exporter.test.ts`: verificación de flujo exitoso, manejo cuando compartir no está disponible y captura de errores de E/S.

---

### Incremento 3 · Presentación, UI accesible e internacionalización

**Objetivo:** Conectar la vista de la lista con el exportador, ofreciendo feedback inmediato y accesible.

1. **Hook de presentación (`src/features/items/presentation/hooks/use-export-list-pdf.ts`):**
   - Orquesta la obtención de traducciones, formateo de fecha con `Intl.DateTimeFormat`, estado de carga `isExporting` y notificaciones mediante `useSnackbar`.
2. **Pantalla principal (`src/features/items/presentation/screens/ItemsScreen.tsx`):**
   - Botón accesible «PDF» en la cabecera junto al acceso a «Gastos».
   - Tamaño táctil ≥ 44pt, `accessibilityLabel` y `accessibilityHint`.
   - Indicador de carga (`loading={isExporting}`) y deshabilitación si la lista no contiene artículos.
3. **Internacionalización:**
   - Claves añadidas en `src/shared/lib/i18n/es.json` y `en.json`.

---

## Resultados de validación técnica

1. **Batería de tests unitarios y de integración (`npm test`):**
   - **48 suites ejecutadas, 48 pasadas (100%)**.
   - **356 tests ejecutados, 356 pasados (100%)**.
2. **Aislamiento RLS y RPCs de backend (`npm run test:rls`):**
   - **51/51 comprobaciones correctas** (intactas, sin modificaciones en base de datos).
3. **Propagación en tiempo real (`npm run test:realtime`):**
   - **18/18 comprobaciones correctas**.
4. **Tipado estricto y Calidad de Código:**
   - `npm run typecheck`: **0 errores**.
   - `npm run lint`: **0 errores**.
5. **Compilación / Export Android:**
   - `npx expo export --platform android`: **compilación limpia completada sin incidencias**.

---

## Guión de verificación en dispositivo físico (Expo Go)

1. **Exportación con lista activa:**
   - Entrar a una comunidad con varios artículos (unos marcados como comprados y otros pendientes).
   - Pulsar el botón «PDF».
   - Verificar que aparece el spinner brevemente y el sistema operativo abre el diálogo de compartir (Google Drive, WhatsApp, visor de PDF, etc.).
   - Abrir el PDF y confirmar que los nombres, cantidades, secciones y fechas coinciden con la lista.
2. **Funcionamiento offline:**
   - Activar modo avión en el dispositivo móvil.
   - Con la lista en pantalla, pulsar de nuevo «PDF».
   - Confirmar que el PDF se genera y se puede previsualizar o guardar en el almacenamiento local sin requerir conexión a internet.
3. **Lista vacía o sin artículos:**
   - En una lista sin artículos, comprobar que el botón «PDF» se encuentra deshabilitado.
