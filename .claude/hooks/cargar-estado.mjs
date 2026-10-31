#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
const roadmapPath = join(projectDir, 'docs', 'plan', 'ROADMAP.md')

if (!existsSync(roadmapPath)) {
  process.stdout.write(
    'No existe docs/plan/ROADMAP.md, así que no hay estado que cargar. ' +
      'Si se ha movido, arregla la ruta en .claude/hooks/cargar-estado.mjs.\n',
  )
  process.exit(0)
}

const lines = readFileSync(roadmapPath, 'utf8').split(/\r?\n/)
const start = lines.findIndex((line) => /^##\s+Estado\b/.test(line))

if (start === -1) {
  process.stdout.write(
    'docs/plan/ROADMAP.md no tiene una sección «## Estado». El estado del proyecto vive ahí: añádela antes de seguir.\n',
  )
  process.exit(0)
}

const relativeEnd = lines.slice(start + 1).findIndex((line) => /^##\s/.test(line))
const end = relativeEnd === -1 ? lines.length : start + 1 + relativeEnd
const stateBlock = lines.slice(start, end).join('\n').trim()

process.stdout.write(
  'Estado del proyecto, sacado de docs/plan/ROADMAP.md. Arranca por el prompt del paquete que diga «Siguiente».\n\n' +
    `${stateBlock}\n`,
)
process.exit(0)
