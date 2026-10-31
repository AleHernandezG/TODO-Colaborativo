---
name: aplicar-migracion
description: Prepara la aplicación de una migración de supabase/migrations al proyecto de ensayo y al real, con las comprobaciones antes y después, y deja las órdenes listas sin lanzarlas. Solo la lanza Alejandro.
disable-model-invocation: true
argument-hint: "[nombre del fichero .sql o «pendientes»]"
---

# Aplicar una migración

Argumentos: `$ARGUMENTS`. Si falta, son todas las de `supabase/migrations/` que
`npx supabase migration list` da como no aplicadas en el real.

Una migración aplicada no se edita, se corrige con otra encima. Por eso se aplica primero a un
proyecto de ensayo y solo después al real. `supabase db push` lo ejecuta Alejandro: el hook
`bloquear-escrituras-git.mjs` lo deniega en la sesión.

## Procedimiento

1. **Revisión.** Cada `.sql` ha pasado por `migration-reviewer` después de escribirlo. Si no, se
   lanza ahora y se arregla lo que encuentre antes de seguir.
2. **Ensayo**, siguiendo `docs/guias/ensayar-una-migracion.md` entero: aplicar todas las migraciones
   al proyecto de ensayo, ensayar el traslado si mueve datos y pasar `npm run test:rls` y
   `npm run test:realtime` contra el ensayo. Se apuntan los números exactos.
3. **Comprobaciones previas en el real**: las consultas que pida el ADR de la migración (en la
   ADR-0026, contar las listas con un único admin sin PIN). Las prepara la sesión; las corre
   Alejandro en el SQL editor o con su `.env`.
4. **La orden**, para que la lance Alejandro desde la raíz del repo:
   ```bash
   npx supabase db push
   ```
5. **Después**, ya aplicada:
   - `npx supabase gen types typescript --linked > src/shared/lib/db.types.ts` desde Git Bash
     (en PowerShell 5.1 el `>` escribe UTF-16 y rompe ESLint)
   - `npm run typecheck`, `npm test`, `npm run test:rls` contra el real y `npm run test:realtime`
   - si una función cambió de firma, comprobar que no quedan dos sobrecargas (`PGRST203`)
6. **Documentar**: el resultado en `docs/phases/fase-N.md`, la línea `Estado:` del ADR si pasa a
   verificado y el bloque «Estado» del ROADMAP.

## Dónde se para

- Si el ensayo y el real dan resultados distintos: el apartado del mismo nombre de la guía de
  ensayo, y se para hasta entenderlo.
- Si `test:rls` baja de su recuento: no se sigue ni se toca la migración aplicada; se escribe otra
  encima tras enseñar el diseño.
- Si `join_community` cambiaría los estados que devuelve: los APK instalados solo entienden seis.
