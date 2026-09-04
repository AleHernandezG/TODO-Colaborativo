# ADR-0018: Exportación de lista a PDF

- Estado: Aceptado
- Fecha: 2026-09-05
- Resuelve: RF-8 (Exportar la lista a PDF) para la Fase 8.
- Relacionado con: [ADR-0003](ADR-0003-estructura-del-repositorio.md), [ADR-0004](ADR-0004-libreria-de-ui.md), [ADR-0008](ADR-0008-persistencia-local-de-la-cache.md).

## Contexto

El requisito RF-8 plantea la necesidad de generar un documento imprimible o compartible con los artículos de la lista de la compra de la comunidad. Esta funcionalidad permite:
1. Llevar la compra en papel o formato físico.
2. Compartir la lista con personas que no disponen de la aplicación móvil (por ejemplo vía mensajería, correo electrónico o almacenamiento en la nube).
3. Operar de forma 100% autónoma y offline cuando no hay cobertura en el supermercado.

A diferencia de otras funciones que dependen de tablas remotas o funciones transaccionales en PostgreSQL, la lista de artículos ya reside localmente en la caché de TanStack Query y en el almacenamiento persistente (`AsyncStorage`).

## Decisión

Se adopta una solución **100% en cliente** basada en la generación de HTML estático y el uso de las APIs oficiales de Expo (`expo-print` y `expo-sharing`), estructurada bajo los principios de Clean Architecture:

### 1. Maquetación desacoplada en el Dominio (`domain/`)
- La función pura `buildListPdfHtml` se ubica en `src/features/items/domain/build-list-pdf-html.ts`.
- No importa React, React Native ni dependencias nativas. Es una función puramente determinista y testeable mediante Jest.
- Genera un documento HTML5 autocontenido con CSS `@page` (A4 portrait, márgenes estándar de 16mm).
- Organiza los artículos en dos bloques estructurados: «Por comprar» (con casillas cuadradas `[ ]` y cantidades destacadas) y «Comprados» (con casillas marcadas `[✓]` y estilo atenuado).
- Aplica escape riguroso de caracteres especiales HTML (`&`, `<`, `>`, `"`, `'`) tanto en nombres de artículos como en el título de la comunidad para mitigar cualquier riesgo de inyección.

### 2. Capa de Servicios y Adaptador Nativo (`data/`)
- Se implementa el adaptador `expoListPdfExporter` en `src/features/items/data/expo-pdf-exporter.ts`.
- Utiliza `Print.printToFileAsync({ html })` de `expo-print` para generar el archivo binario PDF en el almacenamiento temporal de la app.
- Comprueba la disponibilidad del soporte de compartición del sistema operativo mediante `Sharing.isAvailableAsync()`.
- Lanza la hoja nativa del sistema (Android Sharesheet / iOS Activity View) mediante `Sharing.shareAsync` asociando el tipo MIME `application/pdf` y UTI `com.adobe.pdf`.
- Maneja de forma aislada los errores de E/S o la ausencia de cliente de compartición sin propagar excepciones no controladas a la interfaz.

### 3. Presentación e Interfaz Accesible (`presentation/`)
- El hook `useExportListPdf` orquesta la traducción de etiquetas con `i18next`, la fecha formateada según la localización activa y el estado reactivo `isExporting`.
- En `ItemsScreen`, se ubica un botón accesible («PDF») en la cabecera junto a las acciones principales.
- Dispone de tamaño táctil mínimo de 44pt, roles accesibles y deshabilitación inteligente si la lista está vacía o en proceso de carga.
- Los errores o advertencias se canalizan de manera uniforme y accesible a través de `useSnackbar`.

### 4. Sin impacto en Backend ni en Costes de Servidor
- No se realizan llamadas de red a Supabase ni se requieren Edge Functions o servicios de terceros.
- Cero costes de cómputo en la nube y total privacidad: el documento se procesa exclusivamente en el sandbox local del dispositivo.

## Alternativas consideradas

- **Generación de PDF en backend (Supabase Edge Function o Puppeteer / PDFKit):**
  Descartada. Implica latencia de red, requiere conexión obligatoria (rompiendo el requisito de funcionamiento offline), consume recursos de cómputo del backend y transmite datos innecesariamente fuera del dispositivo.
- **Librerías nativas directas (ej. `react-native-html-to-pdf`):**
  Descartada. Requieren vinculación nativa manual que rompería la compatibilidad inmediata con Expo Go (SDK 54). `expo-print` y `expo-sharing` forman parte del SDK estándar y están soportadas de fábrica en Expo Go.

## Consecuencias

- **Positivas:**
  - Funcionamiento inmediato sin conexión a internet.
  - Gran velocidad de renderizado y apertura del selector nativo del sistema.
  - Tests unitarios instantáneos sin necesidad de mocks de red complejos.
  - Compatible con el APK de desarrollo y con Expo Go 54.0.8.
- **Limitaciones conocidas:**
  - El PDF contiene el texto y las cantidades de los artículos, omitiendo imágenes remotas para preservar el funcionamiento instantáneo y offline sin descargas adicionales de almacenamiento.
