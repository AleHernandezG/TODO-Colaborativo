#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'

const projectDir = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd())
const PRETTIER_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|json)$/i
const NOT_FORMATTED = new Set(['src/shared/lib/db.types.ts', 'package-lock.json'])

let payload
try {
  payload = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  process.exit(0)
}

const filePath = payload?.tool_input?.file_path
if (typeof filePath !== 'string') process.exit(0)

const absolutePath = isAbsolute(filePath) ? filePath : resolve(projectDir, filePath)
if (!existsSync(absolutePath)) process.exit(0)

const projectPath = relative(projectDir, absolutePath).replaceAll('\\', '/')
if (projectPath.startsWith('..') || projectPath.startsWith('node_modules/')) process.exit(0)
if (!PRETTIER_EXTENSIONS.test(projectPath) || NOT_FORMATTED.has(projectPath)) process.exit(0)
if (!existsSync(join(projectDir, 'node_modules', 'prettier'))) process.exit(0)

try {
  execFileSync(
    'npx',
    ['--no-install', 'prettier', '--write', '--log-level', 'silent', projectPath],
    {
      cwd: projectDir,
      stdio: 'ignore',
      timeout: 50_000,
      shell: process.platform === 'win32',
    },
  )
} catch {}

process.exit(0)
