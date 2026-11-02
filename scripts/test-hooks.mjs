#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const hooksDir = join(projectDir, '.claude', 'hooks')

const GIT = 'git '
const GH = 'gh '

function runHook(hook, payload) {
  const result = spawnSync(process.execPath, [join(hooksDir, hook)], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
  })
  const denied =
    result.status === 2 || /"permissionDecision"\s*:\s*"deny"/.test(result.stdout ?? '')
  return { denied, stdout: result.stdout ?? '', stderr: result.stderr ?? '', status: result.status }
}

const gitCases = [
  [GIT + 'commit -m "x"', true],
  [GIT + 'push origin main', true],
  [GIT + 'tag v1.0.0', true],
  [GIT + 'merge feat/x', true],
  [GIT + 'rebase main', true],
  ['cd src && ' + GIT + 'commit -am x', true],
  [GIT + '-C . ' + 'push', true],
  [GIT + '-c user.name=x ' + 'commit -m y', true],
  ['FOO=1 ' + GIT + 'push', true],
  [GH + 'pr create --title x', true],
  [GH + 'pr merge 12', true],
  [GH + 'api -X POST repos/x/y/issues', true],
  [GH + 'api repos/x/y/issues -f title=x', true],
  ['eas ' + 'update --branch preview -m x', true],
  ['npx eas-cli ' + 'build --profile preview', true],
  ['npx -y eas-cli@latest ' + 'submit', true],
  ['eas ' + 'env:create --name X', true],
  ['npx supabase ' + 'db push', true],
  ['supabase ' + 'db reset --linked', true],
  ['npx supabase ' + 'migration repair --status applied 1', true],
  ['maestro ' + 'cloud app.apk .maestro', true],
  ['adb ' + 'uninstall com.alejandrohernandez.listacompra', true],
  ['adb -s 1e5b87b9 ' + 'uninstall com.x', true],
  ['adb shell pm ' + 'uninstall com.x', true],
  ['maestro test .maestro/pin-unirse.yaml', false],
  ['adb install -r app.apk', false],
  ['adb shell dumpsys package com.x', false],
  ['eas whoami', false],
  ['eas build:list --limit 5', false],
  ['eas update:list', false],
  ['npx supabase gen types typescript --linked', false],
  ['npx supabase migration list', false],
  ['npx expo export --platform android', false],
  [GIT + 'status', false],
  [GIT + 'log --oneline -5', false],
  [GIT + 'diff --stat', false],
  [GIT + 'stash list', false],
  [GH + 'pr view 12', false],
  [GH + 'api repos/x/y/pulls', false],
  ['npm run lint', false],
  ['echo ' + 'commit', false],
]

const migration = 'supabase/migrations/20261012130000_recipes_isolation_and_archived_members.sql'
const untrackedMigration = 'supabase/migrations/29991231000000_new_draft.sql'
const acceptedAdr = 'docs/adr/ADR-0001-eleccion-de-backend.md'
const acceptedAdrBoldStatus = 'docs/adr/ADR-0002-modelo-de-sesion-y-rls.md'
const acceptedAdrBoldLabel = 'docs/adr/ADR-0026-pin-fuera-de-members-y-recuperacion-de-identidad.md'

const protectCases = [
  [
    'escribir .env',
    { tool_name: 'Write', tool_input: { file_path: '.env', content: 'X=1' } },
    true,
  ],
  [
    'escribir .env.local',
    { tool_name: 'Write', tool_input: { file_path: '.env.local', content: 'X=1' } },
    true,
  ],
  [
    'escribir .env.example',
    { tool_name: 'Write', tool_input: { file_path: '.env.example', content: 'X=' } },
    false,
  ],
  [
    'editar db.types.ts',
    {
      tool_name: 'Edit',
      tool_input: { file_path: 'src/shared/lib/db.types.ts', old_string: 'a', new_string: 'b' },
    },
    true,
  ],
  [
    'editar una migración que ya está en git',
    { tool_name: 'Edit', tool_input: { file_path: migration, old_string: 'a', new_string: 'b' } },
    true,
  ],
  [
    'escribir una migración nueva sin añadir a git',
    { tool_name: 'Write', tool_input: { file_path: untrackedMigration, content: 'select 1;' } },
    false,
  ],
  [
    'reescribir un ADR aceptado',
    { tool_name: 'Write', tool_input: { file_path: acceptedAdr, content: '# x' } },
    true,
  ],
  [
    'editar el cuerpo de un ADR aceptado',
    {
      tool_name: 'Edit',
      tool_input: { file_path: acceptedAdr, old_string: '## Contexto', new_string: '## Otro' },
    },
    true,
  ],
  [
    'editar el cuerpo de un ADR con «Estado: **Aceptado**»',
    {
      tool_name: 'Edit',
      tool_input: { file_path: acceptedAdrBoldStatus, old_string: 'x', new_string: 'y' },
    },
    true,
  ],
  [
    'editar el cuerpo de un ADR con «**Estado:** Aceptado»',
    {
      tool_name: 'Edit',
      tool_input: { file_path: acceptedAdrBoldLabel, old_string: 'x', new_string: 'y' },
    },
    true,
  ],
  [
    'cambiar solo la línea Estado de un ADR aceptado',
    {
      tool_name: 'Edit',
      tool_input: {
        file_path: acceptedAdr,
        old_string: '- Estado: Aceptado',
        new_string: '- Estado: Sustituido por [ADR-0099](ADR-0099-x.md)',
      },
    },
    false,
  ],
  [
    'escribir un ADR nuevo',
    {
      tool_name: 'Write',
      tool_input: { file_path: 'docs/adr/ADR-0999-prueba.md', content: '- Estado: Propuesto' },
    },
    false,
  ],
  [
    'editar código normal',
    {
      tool_name: 'Edit',
      tool_input: { file_path: 'src/app/index.tsx', old_string: 'a', new_string: 'b' },
    },
    false,
  ],
]

const fakeSupabaseSecret = 'sb_' + 'secret_' + 'A1b2C3d4E5f6G7h8I9j0K1l2'
const fakeGithubToken = 'gh' + 'p_' + 'a'.repeat(36)
const fakePrivateKey = '-----BEGIN ' + 'PRIVATE KEY-----'

const secretCases = [
  [
    'secret key de Supabase',
    { tool_name: 'Write', tool_input: { file_path: 'scripts/x.mjs', content: fakeSupabaseSecret } },
    true,
  ],
  [
    'token de GitHub en un Edit',
    {
      tool_name: 'Edit',
      tool_input: { file_path: 'scripts/x.mjs', old_string: 'a', new_string: fakeGithubToken },
    },
    true,
  ],
  [
    'clave privada',
    { tool_name: 'Write', tool_input: { file_path: 'x.pem', content: fakePrivateKey } },
    true,
  ],
  [
    'clave asignada a mano',
    {
      tool_name: 'Write',
      tool_input: { file_path: 'x.ts', content: `const apiKey = "${'z'.repeat(24)}"` },
    },
    true,
  ],
  [
    'valor falso de test',
    {
      tool_name: 'Write',
      tool_input: { file_path: 'x.test.ts', content: 'const apiKey = "test-key"' },
    },
    false,
  ],
  [
    'nombres en .env.example',
    {
      tool_name: 'Write',
      tool_input: { file_path: '.env.example', content: 'SUPABASE_SECRET_KEY=sb_secret_...' },
    },
    false,
  ],
  [
    'publishable key',
    {
      tool_name: 'Write',
      tool_input: { file_path: 'x.ts', content: 'EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_' },
    },
    false,
  ],
]

let failures = 0
let total = 0

function check(label, actual, expected) {
  total += 1
  if (actual === expected) {
    process.stdout.write(`  ok    ${label}\n`)
  } else {
    failures += 1
    process.stdout.write(`  FALLO ${label}: se esperaba ${expected ? 'bloquear' : 'dejar pasar'}\n`)
  }
}

process.stdout.write('bloquear-escrituras-git.mjs\n')
for (const tool of ['Bash', 'PowerShell']) {
  for (const [command, expected] of gitCases) {
    const { denied } = runHook('bloquear-escrituras-git.mjs', {
      tool_name: tool,
      tool_input: { command },
    })
    check(`${tool}: ${command}`, denied, expected)
  }
}

process.stdout.write('proteger-intocables.mjs\n')
for (const [label, payload, expected] of protectCases) {
  check(label, runHook('proteger-intocables.mjs', payload).denied, expected)
}

process.stdout.write('bloquear-secretos.mjs\n')
for (const [label, payload, expected] of secretCases) {
  check(label, runHook('bloquear-secretos.mjs', payload).denied, expected)
}

process.stdout.write('cargar-estado.mjs\n')
const state = runHook('cargar-estado.mjs', { source: 'startup' })
check('imprime el bloque «## Estado» del ROADMAP', /^## Estado/m.test(state.stdout), true)

process.stdout.write(`\n${total - failures}/${total} comprobaciones en verde\n`)
process.exit(failures === 0 ? 0 : 1)
