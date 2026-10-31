#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const projectDir = resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd())
const featuresDir = join(projectDir, 'src', 'features')
const DOMAIN_TESTS = 'features.[a-z-]+.domain.'
const testCommand = [
  'npx',
  [
    '--no-install',
    'jest',
    '--silent',
    '--passWithNoTests=false',
    '--testPathPattern',
    DOMAIN_TESTS,
  ],
]
const testCommandText = `npx jest --testPathPattern "${DOMAIN_TESTS}"`
const stampPath = join(projectDir, '.claude', '.ultima-verificacion-nucleo')

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? listFiles(path) : [path]
  })
}

function domainDirs() {
  if (!existsSync(featuresDir)) return []
  return readdirSync(featuresDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(featuresDir, entry.name, 'domain'))
    .filter((dir) => existsSync(dir))
}

function contentFingerprint(dirs) {
  const hash = createHash('sha256')
  const files = dirs.flatMap(listFiles).sort()
  for (const file of files) {
    hash.update(relative(projectDir, file).replaceAll('\\', '/'))
    hash.update('\0')
    hash.update(readFileSync(file))
    hash.update('\0')
  }
  return hash.digest('hex')
}

function lastPassingFingerprint() {
  return existsSync(stampPath) ? readFileSync(stampPath, 'utf8').trim() : ''
}

let payload = {}
try {
  payload = JSON.parse(readFileSync(0, 'utf8'))
} catch {}

if (payload.stop_hook_active) process.exit(0)

const dirs = domainDirs()
if (dirs.length === 0) process.exit(0)

const fingerprint = contentFingerprint(dirs)
if (fingerprint === lastPassingFingerprint()) process.exit(0)

const [command, args] = testCommand
try {
  execFileSync(command, args, {
    cwd: projectDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 220_000,
    shell: process.platform === 'win32',
  })
  writeFileSync(stampPath, fingerprint)
  process.exit(0)
} catch (error) {
  if (error.code === 'ENOENT') {
    process.stderr.write(
      `Cambió algún domain/ pero no se encuentra \`${command}\` para pasar sus tests. Instala las dependencias con \`npm ci\` o pásalos a mano con \`${testCommandText}\`.\n`,
    )
    process.exit(2)
  }
  const output = `${error.stdout ?? ''}\n${error.stderr ?? ''}`.trim()
  process.stderr.write(
    `Cambió algún domain/ o sus tests y \`${testCommandText}\` falla. ` +
      'Arréglalo antes de dar el turno por terminado. Si el fallo viene de una regla del dominio, manda la regla 1: no la cambies sin permiso.\n\n' +
      `${output.slice(-4000)}\n`,
  )
  process.exit(2)
}
