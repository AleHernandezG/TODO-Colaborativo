#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const BLOCKED_GIT_SUBCOMMANDS = new Set([
  'commit',
  'push',
  'merge',
  'rebase',
  'tag',
  'cherry-pick',
  'revert',
  'am',
])
const GIT_OPTIONS_WITH_VALUE = new Set([
  '-C',
  '-c',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--exec-path',
  '--config-env',
])
const BLOCKED_GH_COMMANDS = new Map([
  ['pr', new Set(['create', 'merge', 'comment', 'review', 'edit', 'close', 'reopen', 'ready'])],
  ['issue', new Set(['create', 'comment', 'edit', 'close', 'reopen', 'delete', 'transfer'])],
  ['repo', new Set(['create', 'delete', 'edit', 'fork', 'rename', 'archive'])],
  ['release', new Set(['create', 'delete', 'edit', 'upload'])],
  ['gist', new Set(['create', 'delete', 'edit'])],
  ['label', new Set(['create', 'delete', 'edit', 'clone'])],
  ['secret', new Set(['set', 'delete'])],
  ['variable', new Set(['set', 'delete'])],
  ['workflow', new Set(['run', 'enable', 'disable'])],
  ['run', new Set(['rerun', 'cancel', 'delete'])],
])
const GH_API_WRITE_FLAGS = new Set(['-f', '-F', '--field', '--raw-field', '--input'])

function splitIntoSegments(command) {
  return command.split(/&&|\|\||[;|\n\r]/)
}

function tokenize(segment) {
  return segment
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.replace(/^["'&(]+|["')]+$/g, ''))
    .filter(Boolean)
}

function skipEnvAssignments(tokens) {
  let index = 0
  while (index < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[index])) index += 1
  return index
}

function isExecutable(token, name) {
  return new RegExp(`(^|[\\\\/])${name}(\\.exe)?$`, 'i').test(token ?? '')
}

function findBlockedGitCommand(tokens, start) {
  let index = start + 1
  while (index < tokens.length) {
    const token = tokens[index]
    if (!token.startsWith('-')) {
      const subcommand = token.toLowerCase()
      return BLOCKED_GIT_SUBCOMMANDS.has(subcommand) ? `git ${subcommand}` : null
    }
    const [flag] = token.split('=')
    index += !token.includes('=') && GIT_OPTIONS_WITH_VALUE.has(flag) ? 2 : 1
  }
  return null
}

function findBlockedGhCommand(tokens, start) {
  const [group, action] = tokens.slice(start + 1).map((token) => token.toLowerCase())
  if (!group) return null

  if (group === 'api') {
    const args = tokens.slice(start + 2)
    const methodIndex = args.findIndex(
      (arg) => arg === '-X' || arg === '--method' || arg.startsWith('--method='),
    )
    const method =
      methodIndex === -1
        ? null
        : (args[methodIndex].includes('=')
            ? args[methodIndex].split('=')[1]
            : args[methodIndex + 1]
          )?.toUpperCase()
    const hasWriteMethod = method && method !== 'GET'
    const hasWriteBody = args.some((arg) => GH_API_WRITE_FLAGS.has(arg.split('=')[0]))
    return hasWriteMethod || hasWriteBody ? 'gh api (con método de escritura o cuerpo)' : null
  }

  const blockedActions = BLOCKED_GH_COMMANDS.get(group)
  return blockedActions?.has(action) ? `gh ${group} ${action}` : null
}

const EAS_READ_ONLY = new Set([
  'whoami',
  'config',
  'diagnostics',
  'project:info',
  'fingerprint:compare',
])
const BLOCKED_SUPABASE_COMMANDS = new Map([
  ['db', new Set(['push', 'reset'])],
  ['migration', new Set(['repair', 'up', 'squash'])],
  ['functions', new Set(['deploy', 'delete'])],
  ['secrets', new Set(['set', 'unset'])],
  ['storage', new Set(['rm', 'cp', 'mv'])],
])

function skipPackageRunner(tokens, start) {
  const runner = tokens[start]?.toLowerCase()
  if (!runner) return start
  let index = start
  if (isExecutable(runner, 'npx') || isExecutable(runner, 'bunx')) index += 1
  else if (isExecutable(runner, 'npm') || isExecutable(runner, 'pnpm')) {
    if (['exec', 'dlx', 'x'].includes(tokens[start + 1]?.toLowerCase())) index += 2
    else return start
  } else return start
  while (index < tokens.length && tokens[index].startsWith('-')) index += 1
  if (tokens[index] === '--') index += 1
  return index
}

function findBlockedEasCommand(tokens, start) {
  const subcommand = tokens
    .slice(start + 1)
    .find((token) => !token.startsWith('-'))
    ?.toLowerCase()
  if (!subcommand) return null
  if (EAS_READ_ONLY.has(subcommand) || /:(list|view|inspect)$/.test(subcommand)) return null
  return `eas ${subcommand}`
}

function findBlockedSupabaseCommand(tokens, start) {
  const words = tokens.slice(start + 1).filter((token) => !token.startsWith('-'))
  const [group, action] = words.map((token) => token.toLowerCase())
  return BLOCKED_SUPABASE_COMMANDS.get(group)?.has(action) ? `supabase ${group} ${action}` : null
}

function findBlockedDeviceCommand(tokens, start) {
  const words = tokens.slice(start + 1).filter((token) => !token.startsWith('-'))
  if (isExecutable(tokens[start], 'maestro') || isExecutable(tokens[start], 'maestro.bat')) {
    return words[0]?.toLowerCase() === 'cloud' ? 'maestro cloud' : null
  }
  if (isExecutable(tokens[start], 'adb')) {
    const args = tokens.slice(start + 1)
    let index = 0
    while (index < args.length && args[index].startsWith('-')) {
      index += ['-s', '-t', '-H', '-P', '-L'].includes(args[index]) ? 2 : 1
    }
    const rest = args.slice(index).map((token) => token.toLowerCase())
    if (rest[0] === 'uninstall') return 'adb uninstall'
    if (rest[0] === 'shell' && rest[1] === 'pm' && rest[2] === 'uninstall') return 'adb uninstall'
  }
  return null
}

function findBlockedCommand(command) {
  for (const segment of splitIntoSegments(command)) {
    const tokens = tokenize(segment)
    const start = skipPackageRunner(tokens, skipEnvAssignments(tokens))
    const blockedDevice = findBlockedDeviceCommand(tokens, start)
    if (blockedDevice) return blockedDevice
    if (isExecutable(tokens[start], 'eas') || /^eas-cli(@.*)?$/i.test(tokens[start] ?? '')) {
      const blocked = findBlockedEasCommand(tokens, start)
      if (blocked) return blocked
    }
    if (isExecutable(tokens[start], 'supabase') || /^supabase@/i.test(tokens[start] ?? '')) {
      const blocked = findBlockedSupabaseCommand(tokens, start)
      if (blocked) return blocked
    }
    if (isExecutable(tokens[start], 'git')) {
      const blocked = findBlockedGitCommand(tokens, start)
      if (blocked) return blocked
    }
    if (isExecutable(tokens[start], 'gh')) {
      const blocked = findBlockedGhCommand(tokens, start)
      if (blocked) return blocked
    }
  }
  return null
}

function deny(blocked) {
  const isRelease = /^(eas|supabase) /.test(blocked)
  const isDevice = /^(adb|maestro) /.test(blocked)
  const reason = isDevice
    ? `Bloqueado: \`${blocked}\` ${
        blocked === 'maestro cloud'
          ? 'sube el APK a Maestro Cloud, que es de pago (regla 3 de CLAUDE.md).'
          : 'borra la app y sus datos del móvil conectado, que es de una persona.'
      } Para probar en el móvil, \`docs/guias/e2e-con-maestro.md\`. Si hace falta de verdad, que lo lance Alejandro con \`! ${blocked} ...\`.`
    : `Bloqueado por la regla 4 de CLAUDE.md: \`${blocked}\` lo ejecuta solo Alejandro. ` +
      (isRelease
        ? 'Publica o cambia algo fuera del repo (EAS o el proyecto de Supabase). Prepara la orden exacta y la comprobación previa (skills publicar-version o aplicar-migracion) y entrégasela. '
        : 'Deja los cambios en el árbol de trabajo y entrégale git status, qué entra y qué no, el mensaje de commit en inglés y las órdenes exactas. ') +
      `Si quiere que se lance desde aquí, que lo escriba él con \`! ${blocked} ...\` en el prompt.`
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  )
}

let payload
try {
  payload = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  process.exit(0)
}

const command = payload?.tool_input?.command
if (typeof command !== 'string') process.exit(0)

const blocked = findBlockedCommand(command)
if (blocked) deny(blocked)
process.exit(0)
