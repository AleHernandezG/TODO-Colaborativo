#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'

const projectDir = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd())

function isTrackedByGit(projectPath) {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', projectPath], {
      cwd: projectDir,
      stdio: 'ignore',
    })
    return true
  } catch {
    return false
  }
}

const PROTECTED_AREAS = [
  {
    matches: (path) => /^\.env(\.[^/]*)?$/.test(path) && path !== '.env.example',
    reason:
      'Los ficheros .env guardan las claves y la sesión no los lee ni los escribe. ' +
      'Si falta una variable, añade su nombre a .env.example y pídele el valor a Alejandro.',
  },
  {
    matches: (path) => path === 'src/shared/lib/db.types.ts',
    reason:
      'db.types.ts lo genera la CLI de Supabase. Cambia el esquema con una migración y regenera desde Git Bash con ' +
      '`npx supabase gen types typescript --linked > src/shared/lib/db.types.ts` (ver la skill supabase-data).',
  },
  {
    matches: (path) => /^supabase\/migrations\/[^/]+\.sql$/.test(path) && isTrackedByGit(path),
    reason:
      'Esta migración ya está en git y puede estar aplicada en alguna base. No se edita: escribe una migración nueva ' +
      'encima con la skill supabase-data y pásala por migration-reviewer.',
  },
]

function toProjectPath(filePath) {
  const absolute = isAbsolute(filePath) ? filePath : resolve(projectDir, filePath)
  return relative(projectDir, absolute).replaceAll('\\', '/')
}

function isAcceptedAdr(projectPath, absolutePath) {
  if (!/^docs\/adr\/ADR-\d{4}-[^/]+\.md$/.test(projectPath)) return false
  if (!existsSync(absolutePath)) return false
  return /^\s*[-*]?\s*\**Estado\**\s*:?\s*\**\s*:?\s*\**Aceptado\b/im.test(
    readFileSync(absolutePath, 'utf8'),
  )
}

function onlyTouchesStatusLine(toolName, toolInput) {
  const edits =
    toolName === 'MultiEdit'
      ? (toolInput.edits ?? [])
      : toolName === 'Edit'
        ? [{ old_string: toolInput.old_string, new_string: toolInput.new_string }]
        : null
  if (!edits || edits.length === 0) return false
  return edits.every(
    ({ old_string: before = '', new_string: after = '' }) =>
      !before.includes('\n') &&
      !after.includes('\n') &&
      /Estado/.test(before) &&
      /Estado/.test(after),
  )
}

function deny(reason) {
  process.stderr.write(`${reason}\n`)
  process.exit(2)
}

let payload
try {
  payload = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  process.exit(0)
}

const toolName = payload?.tool_name
const toolInput = payload?.tool_input ?? {}
const filePath = toolInput.file_path
if (typeof filePath !== 'string') process.exit(0)

const absolutePath = isAbsolute(filePath) ? filePath : resolve(projectDir, filePath)
const projectPath = toProjectPath(filePath)
if (projectPath.startsWith('..')) process.exit(0)

const area = PROTECTED_AREAS.find(({ matches }) => matches(projectPath))
if (area) deny(`Bloqueado: ${projectPath}. ${area.reason}`)

if (isAcceptedAdr(projectPath, absolutePath) && !onlyTouchesStatusLine(toolName, toolInput)) {
  deny(
    `Bloqueado: ${projectPath} es un ADR aceptado y no se edita. ` +
      'Escribe un ADR nuevo con la skill `adr` que lo sustituya, y en este solo cambia la línea de estado a «Sustituido por ADR-NNNN».',
  )
}

process.exit(0)
