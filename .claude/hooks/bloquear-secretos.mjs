#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

const SECRET_PATTERNS = [
  { name: 'una secret key de Supabase', pattern: /\bsb_secret_[A-Za-z0-9_-]{16,}/ },
  { name: 'una clave privada', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'una clave de AWS', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'un token de GitHub', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: 'un token de Expo', pattern: /\bEXPO_TOKEN\s*[:=]\s*["']?[A-Za-z0-9_-]{30,}/ },
  { name: 'un token de autenticación de Sentry', pattern: /\bsntrys_[A-Za-z0-9+/=_-]{40,}/ },
  {
    name: 'una clave asignada a mano',
    pattern:
      /\b(api[_-]?key|secret|token|password|service[_-]?role)\b["']?\s*[:=]\s*["'][^"'\s]{16,}["']/i,
  },
]
const FILES_WITHOUT_SECRETS_CHECK = new Set(['.env.example'])

let payload
try {
  payload = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  process.exit(0)
}

const toolInput = payload?.tool_input ?? {}
const filePath = typeof toolInput.file_path === 'string' ? toolInput.file_path : ''
if (FILES_WITHOUT_SECRETS_CHECK.has(basename(filePath))) process.exit(0)

const textsToWrite = [
  toolInput.content,
  toolInput.new_string,
  ...(toolInput.edits ?? []).map((edit) => edit?.new_string),
].filter((text) => typeof text === 'string')

const found = SECRET_PATTERNS.find(({ pattern }) => textsToWrite.some((text) => pattern.test(text)))
if (found) {
  process.stderr.write(
    `Bloqueado: lo que ibas a escribir en ${filePath} parece contener ${found.name}. ` +
      'Los secretos viven en .env, que la sesión no lee ni escribe. El código los lee de process.env; ' +
      'en tests y fixtures va un valor falso corto y evidente, como "test-key".\n',
  )
  process.exit(2)
}
process.exit(0)
