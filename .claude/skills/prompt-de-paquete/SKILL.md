---
name: prompt-de-paquete
description: Redacta el prompt de arranque de un paquete T-xx, o de un incremento dentro de él, en docs/plan/prompts/. Úsala cuando se cierra un paquete o un incremento y hay que dejar listo el siguiente, cuando Alejandro pide «el prompt del T-xx» o «el prompt del incremento N», o cuando el plan de una funcionalidad nueva necesita sus prompts.
---

# Prompt de arranque

El prompt se pega tal cual al abrir una sesión nueva. Esa sesión no sabe nada: lo que no está en el
prompt, o en lo que el prompt manda leer, no existe. Antes de escribir, lee el último de
`docs/plan/prompts/` y sigue su forma. Los del apartado 7 de `docs/auditoria-2026-10-11.md` son
también referencia: cada uno nombra sus skills y sus agentes.

## Antes de escribir

1. Lee la ficha del paquete en `docs/plan/ROADMAP.md`: qué resuelve, qué entra, qué sale, qué manda,
   «Terminado cuando» y «Cuidado con».
2. Lee el bloque «Estado» y los pendientes de los paquetes o incrementos de los que depende. Lo que
   dejaron pendiente es lo que este se va a encontrar.
3. Busca en `docs/plan/PREGUNTAS.md` las dudas abiertas que le afectan.
4. Busca huecos: una función que hace falta y no existe, un estado de `join_community` que los APK
   instalados no conocen, una decisión que ningún documento ha tomado. Esos huecos son la parte del
   prompt que más vale.
5. Mira el siguiente número libre de ADR (tabla de `docs/README.md`) y de pregunta, y apúntalos.

## Estructura

Fuera del bloque de código, unos párrafos para Alejandro: con qué llega el paquete, los recuentos de
partida (Jest, RLS, hooks), qué hay sin commit, qué versión está en los móviles y qué preguntas
siguen abiertas.

Dentro del bloque, en este orden:

1. Qué paquete o incremento es, en una frase, y qué capa calcula y cuál enseña.
2. El estado del árbol: si `git status` no sale limpio, se para y se dice; lo que haya es de
   Alejandro y no se ordena ni se descarta.
3. El ritmo: me enseñas el plan y las decisiones de golpe, cada una con tu recomendación y la
   alternativa que descartas; con «adelante» van como las propones y no vuelves a preguntar.
4. Qué leer, numerado, con el apartado concreto de cada documento y el motivo cuando no es obvio.
   Fuera de esta lista no se explora; para un símbolo, el LSP de TypeScript antes que leer ficheros
   enteros, y context7 para la versión exacta de una librería.
5. Dónde escribes, carpeta por carpeta.
6. Qué no tocas, con el motivo al lado.
7. Las decisiones que tiene que tomar, numeradas, con la recomendación y la alternativa descartada.
8. Los casos límite y los errores: sin red (`assertOnline`), sin servidor (timeout), rechazo del
   servidor, y el mensaje que da cada uno según ADR-0016.
9. Las reglas 1, 5 y 6 y el vocabulario, siempre, aunque parezca que no aplican.
10. Dónde se para: «Donde sí te paras», con los casos concretos.
11. El orden de trabajo, con el agente que toca en cada paso: `migration-reviewer` si hay SQL,
    `architecture-guard` al terminar de tocar `src/`, `silent-failure-hunter` si hay manejo de
    errores, y `cerrar-paquete` con `revisor-documentacion` al final.
12. La documentación que cambia, fichero por fichero.
13. Terminado cuando, con números exactos que se puedan comprobar en un test o en el Android.
14. No hagas commit, push, `eas update`, `eas build` ni `supabase db push`; al terminar,
    `git status`, qué entra, el mensaje propuesto y las órdenes preparadas.

Al final, fuera del bloque, «Lo que este prompt da por sentado».

## Cuidado con

- Una lista de lectura larga no es mejor. Cada entrada que no se usa cuesta contexto en una sesión
  que todavía no ha empezado a trabajar. `CLAUDE.md` y el bloque «Estado» ya llegan solos.
- Los números del «Terminado cuando» salen de los documentos o de una ejecución real, nunca de una
  cuenta de cabeza al redactar. `test:rls` cambió de 70 a 102 con dos migraciones: comprueba cuál
  vale para el proyecto contra el que se va a correr.
- Si el prompt da por cerrada una pregunta que sigue abierta en `PREGUNTAS.md`, el paquete la
  cierra sin que nadie la decida.
- Si un paquete posterior cambia algo que el prompt da por hecho (un número de ADR que se ocupa,
  una función que se renombra), se corrige en el prompt y se avisa.
